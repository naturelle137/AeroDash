// Unit tests for the dependency-aware issue selection module (refs #318).
// Runs with Node's built-in test runner — no frontend toolchain required:
//   node --test .github/scripts/
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  parseDependencies,
  parseParent,
  evaluateEligibility,
  compareIssues,
  buildQueue,
  renderReport,
} from './select-issues.mjs';

const MS = 5; // current milestone number used across tests

/** Minimal eligible candidate factory. */
function issue(overrides = {}) {
  return {
    number: 1,
    title: 'An issue',
    state: 'open',
    labels: [{ name: 'accepted' }, { name: 'engineering' }],
    milestone: { number: MS },
    body: '',
    createdAt: '2026-01-01T00:00:00Z',
    ...overrides,
  };
}

const cfg = (over = {}) => ({ currentMilestone: MS, openIssueNumbers: [], batchSize: 1, ...over });

test('parseDependencies extracts depends-on and blocked-by refs only', () => {
  const body = [
    'Some prose mentioning #999 casually.',
    'depends on #12',
    'Blocked-by: #34 and #56',
  ].join('\n');
  assert.deepEqual(parseDependencies(body).sort((a, b) => a - b), [12, 34, 56]);
});

test('parseDependencies ignores incidental issue refs', () => {
  assert.deepEqual(parseDependencies('See #100 for context.'), []);
  assert.deepEqual(parseDependencies(''), []);
  assert.deepEqual(parseDependencies(undefined), []);
});

test('parseParent reads the feature-template parent section', () => {
  const body = '### Parent Feature / Issue\n\n#316\n\n### Task Description';
  assert.equal(parseParent(body), 316);
  assert.equal(parseParent('no parent here'), null);
});

test('evaluateEligibility accepts a fully-qualified candidate', () => {
  assert.deepEqual(evaluateEligibility(issue(), cfg()), { eligible: true, reason: 'eligible' });
});

test('evaluateEligibility rejects closed / mislabelled / wrong-milestone / opted-out', () => {
  assert.match(evaluateEligibility(issue({ state: 'closed' }), cfg()).reason, /not open/);
  assert.match(evaluateEligibility(issue({ labels: [{ name: 'accepted' }] }), cfg()).reason, /engineering/);
  assert.match(evaluateEligibility(issue({ labels: [{ name: 'engineering' }] }), cfg()).reason, /accepted/);
  assert.match(evaluateEligibility(issue({ milestone: { number: 99 } }), cfg()).reason, /≠ current/);
  assert.match(evaluateEligibility(issue({ milestone: null }), cfg()).reason, /no milestone/);
  assert.match(
    evaluateEligibility(issue({ labels: [{ name: 'accepted' }, { name: 'engineering' }, { name: 'automation:opt-out' }] }), cfg()).reason,
    /opted out/,
  );
});

test('evaluateEligibility requires an active milestone to be configured', () => {
  assert.match(evaluateEligibility(issue(), cfg({ currentMilestone: null })).reason, /no active milestone/);
});

test('compareIssues orders by priority label, then age, then number', () => {
  const high = issue({ number: 9, labels: [{ name: 'accepted' }, { name: 'engineering' }, { name: 'priority:high' }] });
  const oldPlain = issue({ number: 8, createdAt: '2025-01-01T00:00:00Z' });
  const newPlain = issue({ number: 2, createdAt: '2026-06-01T00:00:00Z' });
  const ordered = [newPlain, oldPlain, high].sort(compareIssues).map((i) => i.number);
  assert.deepEqual(ordered, [9, 8, 2]); // high priority first, then older, then newer
});

test('buildQueue selects eligible issues up to the batch size', () => {
  const issues = [
    issue({ number: 1, createdAt: '2026-01-01T00:00:00Z' }),
    issue({ number: 2, createdAt: '2026-02-01T00:00:00Z' }),
    issue({ number: 3, createdAt: '2026-03-01T00:00:00Z' }),
  ];
  const { queue, deferred, skipped } = buildQueue(issues, cfg({ batchSize: 2, openIssueNumbers: [1, 2, 3] }));
  assert.deepEqual(queue.map((q) => q.number), [1, 2]);
  assert.equal(deferred.length, 1);
  assert.match(deferred[0].reason, /over batch capacity/);
  assert.equal(skipped.length, 0);
});

test('buildQueue defers an issue blocked by a still-open dependency', () => {
  const issues = [
    issue({ number: 10, body: 'depends on #11' }),
    issue({ number: 11, milestone: { number: 99 } }), // open but not a candidate this run
  ];
  const { queue, deferred } = buildQueue(issues, cfg({ batchSize: 5, openIssueNumbers: [10, 11] }));
  assert.deepEqual(queue.map((q) => q.number), []);
  assert.equal(deferred.find((d) => d.number === 10).reason.includes('#11'), true);
});

test('buildQueue selects an issue whose dependency is already closed', () => {
  const issues = [issue({ number: 10, body: 'depends on #11' })];
  // #11 not in openIssueNumbers ⇒ resolved/closed ⇒ dependency satisfied
  const { queue } = buildQueue(issues, cfg({ batchSize: 5, openIssueNumbers: [10] }));
  assert.deepEqual(queue.map((q) => q.number), [10]);
});

test('buildQueue defers a parent that still has open child tasks', () => {
  const issues = [
    issue({ number: 100, title: 'Parent feature' }),
    issue({ number: 101, title: 'Child task', body: '### Parent Feature / Issue\n\n#100' }),
  ];
  const { queue, deferred } = buildQueue(issues, cfg({ batchSize: 5, openIssueNumbers: [100, 101] }));
  // Child (101) is selectable; parent (100) deferred because a child is open.
  assert.deepEqual(queue.map((q) => q.number), [101]);
  assert.equal(deferred.find((d) => d.number === 100).reason.includes('#101'), true);
});

test('buildQueue skips ineligible issues with reasons', () => {
  const issues = [
    issue({ number: 1, state: 'closed' }),
    issue({ number: 2, milestone: { number: 99 } }),
    issue({ number: 3 }),
  ];
  const { queue, skipped } = buildQueue(issues, cfg({ batchSize: 5, openIssueNumbers: [1, 2, 3] }));
  assert.deepEqual(queue.map((q) => q.number), [3]);
  assert.equal(skipped.length, 2);
});

test('buildQueue short-circuits to an explicitly requested issue, bypassing selection', () => {
  const issues = [
    issue({ number: 7, milestone: { number: 99 }, labels: [{ name: 'open' }] }), // not normally eligible
  ];
  const { queue } = buildQueue(issues, cfg({ issueNumber: 7, openIssueNumbers: [7] }));
  assert.deepEqual(queue.map((q) => q.number), [7]);
  assert.match(queue[0].reason, /explicitly requested/);
});

test('buildQueue reports an unknown requested issue as skipped', () => {
  const { queue, skipped } = buildQueue([issue({ number: 1 })], cfg({ issueNumber: 4242 }));
  assert.equal(queue.length, 0);
  assert.equal(skipped[0].number, 4242);
  assert.match(skipped[0].reason, /not found/);
});

test('renderReport escapes backslashes and pipes in titles (table integrity)', () => {
  const result = buildQueue(
    [issue({ number: 1, title: 'a\\b|c' })],
    cfg({ batchSize: 5, openIssueNumbers: [1] }),
  );
  const md = renderReport(result, cfg());
  // Backslash escaped first, then pipe — so a literal `a\b|c` renders as `a\\b\|c`.
  assert.match(md, /a\\\\b\\\|c/);
});

test('renderReport produces a Markdown summary with all three sections', () => {
  const result = buildQueue(
    [issue({ number: 1 }), issue({ number: 2, state: 'closed' })],
    cfg({ batchSize: 5, openIssueNumbers: [1, 2] }),
  );
  const md = renderReport(result, cfg());
  assert.match(md, /Selected \(1\)/);
  assert.match(md, /Deferred \(0\)/);
  assert.match(md, /Skipped \(1\)/);
  assert.match(md, /#1/);
});
