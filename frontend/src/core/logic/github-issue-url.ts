// @IMP-SYS-CORE-013@ (FROM: @REQ-SYS-017@, @REQ-SYS-018@, @DES-ARCH-014@)
//
// Pure P1 builder for prefilled GitHub "new issue" URLs that target the
// existing bug_report.yml and feature_request.yml templates. Field IDs and
// the severity dropdown labels MUST match
// .github/ISSUE_TEMPLATE/bug_report.yml and feature_request.yml verbatim;
// if a template is changed, the input types here must be updated in the
// same commit or the prefill silently drops fields on the GitHub side.

export const GITHUB_REPO_OWNER = 'naturelle137'
export const GITHUB_REPO_NAME = 'AeroDash'
export const GITHUB_REPO_URL = `https://github.com/${GITHUB_REPO_OWNER}/${GITHUB_REPO_NAME}`
export const GITHUB_NEW_ISSUE_URL = `${GITHUB_REPO_URL}/issues/new`
export const GITHUB_ISSUES_URL = `${GITHUB_REPO_URL}/issues`
export const GITHUB_SECURITY_ADVISORY_URL = `${GITHUB_REPO_URL}/security/advisories/new`

export const BUG_REPORT_TEMPLATE = 'bug_report.yml'
export const FEATURE_REQUEST_TEMPLATE = 'feature_request.yml'

export const BUG_SEVERITY_VALUES = [
  'Minor: Cosmetic or minor workaround available',
  'Major: Core functionality impaired, no workaround',
  'CRITICAL: Incorrect calculations/data (Safety Hazard!)',
  'Blocker: App does not start / Crash',
] as const

export type BugSeverity = (typeof BUG_SEVERITY_VALUES)[number]

export interface BugReportInput {
  title: string
  description: string
  reproduction: string
  severity: BugSeverity
  hazard_ref?: string
  environment: string
}

export interface FeatureRequestInput {
  title: string
  problem: string
  solution: string
  req_id?: string
  safety_impact?: string
  dod: string
}

const GITHUB_URL_MAX_LEN = 7500
const TRUNCATION_MARKER = '… (truncated)'

interface TextField {
  key: string
  value: string
}

function requireField(name: string, value: string): void {
  if (value.trim() === '') {
    throw new Error(`github-issue-url: required field "${name}" is empty`)
  }
}

function pushOptional(fields: TextField[], key: string, value: string | undefined): void {
  if (value === undefined) return
  const trimmed = value.trim()
  if (trimmed === '') return
  fields.push({ key, value: trimmed })
}

function buildUrl(template: string, title: string, textFields: readonly TextField[]): string {
  const params = new URLSearchParams()
  params.set('template', template)
  params.set('title', title)
  for (const f of textFields) {
    params.set(f.key, f.value)
  }
  return `${GITHUB_NEW_ISSUE_URL}?${params.toString()}`
}

function titleOnlyFallback(template: string, title: string): string {
  const params = new URLSearchParams()
  params.set('template', template)
  params.set('title', title)
  return `${GITHUB_NEW_ISSUE_URL}?${params.toString()}`
}

function trimAndBuild(template: string, title: string, fields: TextField[]): string {
  const working: TextField[] = fields.map((f) => ({ ...f }))

  while (true) {
    const url = buildUrl(template, title, working)
    if (url.length <= GITHUB_URL_MAX_LEN) return url

    let longestIdx = -1
    let longestLen = TRUNCATION_MARKER.length
    for (let i = 0; i < working.length; i++) {
      const candidate = working[i]
      if (candidate !== undefined && candidate.value.length > longestLen) {
        longestIdx = i
        longestLen = candidate.value.length
      }
    }
    if (longestIdx === -1) break

    const f = working[longestIdx]
    if (f === undefined) break
    const newLen = Math.floor(f.value.length * 0.8)
    if (newLen <= TRUNCATION_MARKER.length) {
      working.splice(longestIdx, 1)
    } else {
      f.value = `${f.value.slice(0, newLen - TRUNCATION_MARKER.length)}${TRUNCATION_MARKER}`
    }
  }

  return titleOnlyFallback(template, title)
}

export function buildBugReportUrl(input: BugReportInput): string {
  requireField('title', input.title)
  requireField('description', input.description)
  requireField('reproduction', input.reproduction)
  requireField('severity', input.severity)
  requireField('environment', input.environment)

  const fields: TextField[] = [
    { key: 'description', value: input.description.trim() },
    { key: 'reproduction', value: input.reproduction.trim() },
    { key: 'severity', value: input.severity.trim() },
    { key: 'environment', value: input.environment.trim() },
  ]
  pushOptional(fields, 'hazard_ref', input.hazard_ref)

  return trimAndBuild(BUG_REPORT_TEMPLATE, input.title.trim(), fields)
}

export function buildFeatureRequestUrl(input: FeatureRequestInput): string {
  requireField('title', input.title)
  requireField('problem', input.problem)
  requireField('solution', input.solution)
  requireField('dod', input.dod)

  const fields: TextField[] = [
    { key: 'problem', value: input.problem.trim() },
    { key: 'solution', value: input.solution.trim() },
    { key: 'dod', value: input.dod.trim() },
  ]
  pushOptional(fields, 'req_id', input.req_id)
  pushOptional(fields, 'safety_impact', input.safety_impact)

  return trimAndBuild(FEATURE_REQUEST_TEMPLATE, input.title.trim(), fields)
}
