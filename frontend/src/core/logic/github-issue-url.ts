/**
 * Pure builder for a GitHub "new issue" deep link pre-filled from an
 * {@link IncidentReport} (issue #281, PR-006). P1 Safety Core — pure
 * TypeScript, no framework dependencies, deterministic.
 *
 * Why P1: the URL is the only artefact that leaves the device. If this
 * function corrupts the body (drops the redaction notice, leaks unredacted
 * description, mis-encodes), the privacy contract breaks. Keeping it pure
 * lets the unit suite verify every byte that hits navigator.clipboard /
 * window.open.
 *
 * @see docs/development/incident-to-regression.md
 */

import type { IncidentReport } from '../domain/incident-report.schema'

// @IMP-SYS-CORE-015@ (FROM: @REQ-SYS-017@, @REQ-SYS-018@)

/** GitHub caps the issue-prefill URL near ~8 KB; we leave headroom. */
export const GITHUB_URL_MAX_LEN = 7_500

/**
 * Issue-template form field IDs declared by
 * `.github/ISSUE_TEMPLATE/incident_report.yml`. Kept in lock-step with the
 * template — drift would mean prefilled fields silently land in the wrong
 * slot.
 */
export const TEMPLATE_FILE = 'incident_report.yml'
export const TEMPLATE_FIELD_KIND = 'kind'
export const TEMPLATE_FIELD_DESCRIPTION = 'description'
export const TEMPLATE_FIELD_CONTEXT = 'context'

/** Human-readable label for each {@link IncidentReport.kind}. */
export const INCIDENT_KIND_LABELS: Record<IncidentReport['kind'], string> = {
  CALCULATION: 'Calculation result looked wrong',
  DATA: 'Aircraft or airport data looked wrong',
  UI: 'UI / display defect',
  CRASH: 'App froze or failed to load',
  OTHER: 'Other',
}

/** Hard-coded prefix every incident-derived GitHub issue title carries. */
export const TITLE_PREFIX = '[Incident]'

/**
 * Build the `?key=value&...` query string for a GitHub issue prefill URL.
 * Repeated calls with the same input yield byte-identical output.
 */
function buildQuery(params: Array<[string, string]>): string {
  return params
    .map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(v)}`)
    .join('&')
}

/**
 * Render the markdown the pilot will see in the "Description" field of the
 * pre-filled issue. The free text has ALREADY been redacted (see
 * {@link incident-redaction}); this function only frames it with a header
 * that makes the source obvious to the triage reviewer.
 */
export function renderIncidentBody(report: IncidentReport): string {
  return [
    `**Summary:** ${report.summary}`,
    '',
    '### Pilot description (redacted)',
    '',
    report.redactedDescription,
  ].join('\n')
}

/**
 * Render the markdown for the "Context" field. Pure operational metadata —
 * no pilot-supplied data flows through here.
 */
export function renderIncidentContext(report: IncidentReport): string {
  const c = report.context
  return [
    `- **Captured at:** ${report.createdAt}`,
    `- **App version:** ${c.appVersion}`,
    `- **Route:** ${c.routeName ?? 'unknown'}${c.pathTail ? ` (${c.pathTail})` : ''}`,
    `- **Online:** ${c.online === null ? 'unknown' : c.online ? 'yes' : 'no'}`,
    `- **User agent:** ${c.userAgent ?? 'unknown'}`,
    `- **Incident ID:** ${report.id}`,
  ].join('\n')
}

export interface GithubIssueUrlInput {
  /**
   * Repository web URL, e.g. `https://github.com/naturelle137/AeroDash`. The
   * function tolerates a trailing slash but does not invent a default —
   * pass an empty string and you get `/issues/new?...` so the caller can
   * see the misuse instead of leaking a hard-coded fallback.
   */
  repoUrl: string
  report: IncidentReport
}

/**
 * Build a `https://github.com/<owner>/<repo>/issues/new?...` URL with the
 * incident report's title, kind, description, and context pre-filled into
 * the `incident_report.yml` GitHub issue-form template fields.
 *
 * Long descriptions are truncated to stay below
 * {@link GITHUB_URL_MAX_LEN}; the truncation point appends a clearly
 * visible marker so the pilot can re-paste the rest from the saved report.
 */
export function buildGithubIssueUrl(input: GithubIssueUrlInput): string {
  const base = `${input.repoUrl.replace(/\/+$/, '')}/issues/new`
  const title = `${TITLE_PREFIX} ${input.report.summary}`
  const body = renderIncidentBody(input.report)
  const context = renderIncidentContext(input.report)

  let query = buildQuery([
    ['template', TEMPLATE_FILE],
    ['title', title],
    [TEMPLATE_FIELD_KIND, INCIDENT_KIND_LABELS[input.report.kind]],
    [TEMPLATE_FIELD_DESCRIPTION, body],
    [TEMPLATE_FIELD_CONTEXT, context],
  ])

  let url = `${base}?${query}`

  if (url.length > GITHUB_URL_MAX_LEN) {
    const overflowMarker = '\n\n…[truncated; open the saved report on the device for the full text]'
    // Trim the description body by exactly the overflow + marker length.
    const overflow = url.length - GITHUB_URL_MAX_LEN
    // Encoded length grows roughly 3× with URL-encoding, so trim more
    // aggressively to stay under the cap in one pass.
    const trimChars = Math.min(body.length, overflow * 3 + overflowMarker.length + 16)
    const trimmedBody = body.slice(0, Math.max(0, body.length - trimChars)) + overflowMarker
    query = buildQuery([
      ['template', TEMPLATE_FILE],
      ['title', title],
      [TEMPLATE_FIELD_KIND, INCIDENT_KIND_LABELS[input.report.kind]],
      [TEMPLATE_FIELD_DESCRIPTION, trimmedBody],
      [TEMPLATE_FIELD_CONTEXT, context],
    ])
    url = `${base}?${query}`
  }
  return url
}
