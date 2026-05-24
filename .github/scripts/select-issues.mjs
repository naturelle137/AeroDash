// Dependency-aware, deterministic issue selection for the overnight automation.
//
// Pure logic (no network, no GitHub SDK) so it is unit-testable with `node --test`.
// The workflow fetches issues with `gh` and pipes a JSON envelope to this script
// on stdin; the script prints the prioritised queue + deferral/skip reasons.
//
// Governed by ADR-317-DEV (autonomous AI contribution). Selection invariants:
//   * eligible = open + `accepted` + `engineering` + current milestone + not opted-out
//   * ordering is deterministic (no random choice)
//   * issues blocked by an unresolved dependency are deferred, never selected
//   * every decision carries an explainable reason (run report)
//
// refs #318 (parent #316)

export const REQUIRED_LABELS = ['accepted', 'engineering'];
export const DEFAULT_OPT_OUT_LABEL = 'automation:opt-out';
export const DEFAULT_BATCH_SIZE = 1;

/**
 * Optional priority-label convention (future-proofing; not yet in the label set).
 * Lower rank = higher priority. Unlabelled issues fall in the middle.
 */
const PRIORITY_RANK = { 'priority:high': 0, 'priority:medium': 1, 'priority:low': 2 };
const DEFAULT_PRIORITY_RANK = 1;

function labelNames(issue) {
  return (issue.labels ?? []).map((l) => (typeof l === 'string' ? l : l.name));
}

function hasLabel(issue, name) {
  return labelNames(issue).includes(name);
}

/**
 * Extract issue numbers this issue declares a hard dependency on.
 * Recognises (case-insensitive): "depends on #N", "depends-on: #N",
 * "blocked by #N", "blocked-by: #N". Only lines containing such a keyword
 * contribute, so an unrelated "#123" in prose is ignored.
 */
export function parseDependencies(body) {
  if (!body) return [];
  const deps = new Set();
  const keyword = /\b(depends[ -]on|blocked[ -]by)\b/i;
  for (const line of body.split(/\r?\n/)) {
    if (!keyword.test(line)) continue;
    for (const m of line.matchAll(/#(\d+)/g)) deps.add(Number(m[1]));
  }
  return [...deps];
}

/**
 * Extract the parent issue number from the feature-template
 * "Parent Feature / Issue" section, if present.
 */
export function parseParent(body) {
  if (!body) return null;
  const m = body.match(/Parent Feature\s*\/\s*Issue[\s\S]{0,80}?#(\d+)/i);
  return m ? Number(m[1]) : null;
}

/**
 * Decide whether a single issue is eligible for autonomous implementation.
 * Returns { eligible: boolean, reason: string }.
 */
export function evaluateEligibility(issue, config) {
  const {
    currentMilestone,
    optOutLabel = DEFAULT_OPT_OUT_LABEL,
    requiredLabels = REQUIRED_LABELS,
  } = config;

  if ((issue.state ?? 'open').toLowerCase() !== 'open') {
    return { eligible: false, reason: 'not open' };
  }
  if (hasLabel(issue, optOutLabel)) {
    return { eligible: false, reason: `opted out (${optOutLabel})` };
  }
  for (const required of requiredLabels) {
    if (!hasLabel(issue, required)) {
      return { eligible: false, reason: `missing label '${required}'` };
    }
  }
  const milestoneNumber = issue.milestone?.number ?? null;
  if (currentMilestone == null) {
    return { eligible: false, reason: 'no active milestone configured' };
  }
  if (milestoneNumber == null) {
    return { eligible: false, reason: 'no milestone' };
  }
  if (milestoneNumber !== currentMilestone) {
    return { eligible: false, reason: `milestone #${milestoneNumber} ≠ current #${currentMilestone}` };
  }
  return { eligible: true, reason: 'eligible' };
}

function priorityRank(issue) {
  let best = DEFAULT_PRIORITY_RANK;
  for (const name of labelNames(issue)) {
    if (name in PRIORITY_RANK) best = Math.min(best, PRIORITY_RANK[name]);
  }
  return best;
}

/**
 * Deterministic ordering comparator: priority label, then oldest first
 * (createdAt ascending), then lowest issue number. Total order — stable and
 * reproducible across runs.
 */
export function compareIssues(a, b) {
  const pr = priorityRank(a) - priorityRank(b);
  if (pr !== 0) return pr;
  const at = Date.parse(a.createdAt ?? '') || 0;
  const bt = Date.parse(b.createdAt ?? '') || 0;
  if (at !== bt) return at - bt;
  return a.number - b.number;
}

function asNumberSet(value) {
  if (value instanceof Set) return value;
  return new Set((value ?? []).map(Number));
}

/**
 * Build the prioritised, dependency-aware, batch-limited work queue.
 *
 * @param {Array} issues       Candidate issues (typically open issues fetched via gh).
 * @param {Object} config
 * @param {number} config.currentMilestone   Active milestone number.
 * @param {Set<number>|number[]} config.openIssueNumbers  All open issue numbers
 *        in the repo (used to resolve whether a dependency is still unresolved).
 * @param {number} [config.batchSize]         Per-run cap (default 1).
 * @param {string} [config.optOutLabel]
 * @param {number|null} [config.issueNumber]  Dispatch short-circuit: implement
 *        exactly this issue, bypassing selection (still subject to existence).
 * @returns {{queue: Array, deferred: Array, skipped: Array}} each entry
 *          { number, title, reason }.
 */
export function buildQueue(issues, config) {
  const {
    batchSize = DEFAULT_BATCH_SIZE,
    issueNumber = null,
  } = config;
  const openSet = asNumberSet(config.openIssueNumbers);

  const entry = (issue, reason) => ({ number: issue.number, title: issue.title, reason });

  // ── Dispatch short-circuit: a single targeted issue bypasses selection. ──
  if (issueNumber != null) {
    const target = issues.find((i) => i.number === Number(issueNumber));
    if (!target) {
      return { queue: [], deferred: [], skipped: [{ number: Number(issueNumber), title: '(unknown)', reason: 'requested issue not found among candidates' }] };
    }
    return { queue: [entry(target, 'explicitly requested via workflow_dispatch')], deferred: [], skipped: [] };
  }

  const skipped = [];
  const eligible = [];
  for (const issue of issues) {
    const verdict = evaluateEligibility(issue, config);
    if (verdict.eligible) eligible.push(issue);
    else skipped.push(entry(issue, verdict.reason));
  }

  // Reverse parent map: a parent issue with any still-open child is deferred so
  // children land first (a parent Feature only closes once its Tasks are done).
  const openChildrenOf = new Map();
  for (const issue of issues) {
    const parent = parseParent(issue.body);
    if (parent != null && openSet.has(issue.number)) {
      if (!openChildrenOf.has(parent)) openChildrenOf.set(parent, []);
      openChildrenOf.get(parent).push(issue.number);
    }
  }

  eligible.sort(compareIssues);

  const queue = [];
  const deferred = [];
  for (const issue of eligible) {
    // Defer parents that still have open children.
    const openChildren = openChildrenOf.get(issue.number) ?? [];
    if (openChildren.length > 0) {
      deferred.push(entry(issue, `parent of open task(s) ${openChildren.map((n) => '#' + n).join(', ')}`));
      continue;
    }
    // Defer issues with an unresolved (still-open) hard dependency.
    const unresolved = parseDependencies(issue.body).filter((dep) => openSet.has(dep));
    if (unresolved.length > 0) {
      deferred.push(entry(issue, `blocked by ${unresolved.map((n) => '#' + n).join(', ')}`));
      continue;
    }
    if (queue.length < batchSize) {
      queue.push(entry(issue, 'selected'));
    } else {
      deferred.push(entry(issue, `over batch capacity (${batchSize})`));
    }
  }

  return { queue, deferred, skipped };
}

/** Render a Markdown run-report table for the GitHub Actions job summary. */
export function renderReport({ queue, deferred, skipped }, config = {}) {
  const lines = [];
  lines.push('## 🤖 Overnight automation — selection report');
  lines.push('');
  lines.push(`* Active milestone: **${config.currentMilestone ?? 'n/a'}**`);
  lines.push(`* Batch size: **${config.batchSize ?? DEFAULT_BATCH_SIZE}**`);
  if (config.issueNumber != null) lines.push(`* Targeted issue: **#${config.issueNumber}**`);
  lines.push('');
  const section = (title, rows) => {
    lines.push(`### ${title} (${rows.length})`);
    if (rows.length === 0) {
      lines.push('_none_');
    } else {
      lines.push('| Issue | Title | Reason |');
      lines.push('| :---- | :---- | :----- |');
      for (const r of rows) lines.push(`| #${r.number} | ${String(r.title).replace(/\|/g, '\\|')} | ${r.reason} |`);
    }
    lines.push('');
  };
  section('✅ Selected', queue);
  section('⏸️ Deferred', deferred);
  section('⏭️ Skipped', skipped);
  return lines.join('\n');
}

// ── CLI: read a JSON envelope on stdin, print the queue + report on stdout. ──
// Envelope: { issues: [...], openIssueNumbers: [...], currentMilestone, batchSize, issueNumber }
async function main() {
  const chunks = [];
  for await (const chunk of process.stdin) chunks.push(chunk);
  const input = JSON.parse(Buffer.concat(chunks).toString('utf8') || '{}');
  const config = {
    currentMilestone: input.currentMilestone ?? null,
    openIssueNumbers: input.openIssueNumbers ?? [],
    batchSize: input.batchSize ?? DEFAULT_BATCH_SIZE,
    optOutLabel: input.optOutLabel ?? DEFAULT_OPT_OUT_LABEL,
    issueNumber: input.issueNumber ?? null,
  };
  const result = buildQueue(input.issues ?? [], config);
  process.stdout.write(JSON.stringify({ ...result, report: renderReport(result, config) }, null, 2));
}

// Run as CLI only when invoked directly (not when imported by tests).
if (import.meta.url === `file://${process.argv[1]}` || process.argv[1]?.endsWith('select-issues.mjs')) {
  main().catch((err) => {
    console.error(err);
    process.exit(1);
  });
}
