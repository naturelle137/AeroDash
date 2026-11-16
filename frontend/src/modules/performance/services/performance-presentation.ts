import type { GroupAssessment, MassSource, PerformanceAssessment, PerformanceGroupId } from './poh-inspection'

/**
 * Current Performance presentation shared by the Flight Prep step, the standalone
 * route and the briefing pack. Every value is display-ready text built from one
 * assessment; consumers render it and never compute distances themselves.
 */
export interface PerformancePresentation {
  /** Identity of the exact inputs; a consumer holding another key holds stale data. */
  readonly inputKey: string
  /** `not-computed`: current inputs have no result yet. `blocked`: no distance for either group. */
  readonly status: 'not-computed' | 'blocked' | 'assessed'
  readonly aircraft: { readonly registration: string; readonly model: string; readonly category: string | null } | null
  /** Overall reason when status is `not-computed` or `blocked`. */
  readonly reason: string | null
  /** Conditions actually used; null until assessed. */
  readonly conditions: { readonly pressureAltitude: string; readonly temperature: string } | null
  readonly groups: readonly PerformanceGroupPresentation[]
  readonly runway: RunwayPresentation
  /** Scope statements that must accompany any displayed distance. */
  readonly scope: readonly string[]
}

export interface PerformanceGroupPresentation {
  readonly id: PerformanceGroupId
  readonly title: string
  /** e.g. "1 012.5 kg — current Mass & Balance takeoff mass"; null when unavailable. */
  readonly mass: string | null
  readonly status: 'success' | 'blocked' | 'not-computed'
  /** Exact reason for a blocked or unavailable group. */
  readonly reason: string | null
  readonly rows: readonly { readonly label: string; readonly value: string; readonly note: string | null }[]
}

export type RunwayPresentation =
  | { readonly status: 'declared'; readonly label: string; readonly rows: readonly { readonly label: string; readonly value: string }[]; readonly note: string }
  | { readonly status: 'unavailable'; readonly reason: string }

const TITLES: Record<PerformanceGroupId, string> = { takeoff: 'Takeoff', landing: 'Landing' }

export const PERFORMANCE_SCOPE = [
  'Raw POH/AFM table distances only. No wind, surface, slope, density-altitude or operational safety factor is applied.',
  'No runway comparison, Go/No-Go advisory or operational approval is provided.',
] as const

export function formatNumber(value: number, digits = 1): string {
  return value.toLocaleString('en-GB', { minimumFractionDigits: digits, maximumFractionDigits: digits })
}

function massLabel(source: MassSource): string | null {
  return source.status === 'ready' ? `${formatNumber(source.massKg)} kg — ${source.origin}` : null
}

function groupPresentation(id: PerformanceGroupId, source: MassSource, group: GroupAssessment | null): PerformanceGroupPresentation {
  const base = { id, title: TITLES[id], mass: massLabel(source) }
  if (!group) {
    return { ...base, status: source.status === 'ready' ? 'not-computed' : 'blocked', reason: source.status === 'ready' ? null : source.reason, rows: [] }
  }
  if (group.status === 'blocked') return { ...base, status: 'blocked', reason: group.message, rows: [] }
  return {
    ...base,
    status: 'success',
    reason: null,
    rows: group.distances.map((row) => ({
      label: row.label,
      value: `${formatNumber(row.distance)} m`,
      note: row.massTreatment === 'benefit-capped'
        ? `Mass below the table minimum ${formatNumber(row.massRange.min)} kg: capped at the documented ${formatNumber(row.lookupMass)} kg distance for these conditions (no shorter value; not an extrapolation).`
        : null,
    })),
  }
}

export type PresentationInput = {
  inputKey: string
  aircraft: PerformancePresentation['aircraft']
  takeoff: MassSource
  landing: MassSource
  /** Assessment computed for exactly `inputKey`, or null. */
  assessment: PerformanceAssessment | null
  pressureAltitudeBasis: string
  /** Why no result exists when `assessment` is null. */
  pendingReason: string
  runway: RunwayPresentation
}

export function presentPerformance(input: PresentationInput): PerformancePresentation {
  const { assessment } = input
  const common = { inputKey: input.inputKey, aircraft: input.aircraft, runway: input.runway, scope: PERFORMANCE_SCOPE }
  if (!assessment || assessment.status === 'blocked') {
    return {
      ...common,
      status: assessment ? 'blocked' : 'not-computed',
      reason: assessment ? assessment.message : input.pendingReason,
      conditions: null,
      groups: [groupPresentation('takeoff', input.takeoff, null), groupPresentation('landing', input.landing, null)]
        .map((group) => assessment && group.status === 'not-computed' ? { ...group, status: 'blocked' as const, reason: assessment.message } : group),
    }
  }
  const groups = [
    groupPresentation('takeoff', input.takeoff, assessment.takeoff),
    groupPresentation('landing', input.landing, assessment.landing),
  ]
  const anySuccess = groups.some((group) => group.status === 'success')
  return {
    ...common,
    status: anySuccess ? 'assessed' : 'blocked',
    reason: anySuccess ? null : 'No takeoff or landing distance is available; see each reason.',
    conditions: {
      pressureAltitude: input.pressureAltitudeBasis,
      temperature: `${formatNumber(assessment.conditions.temperatureC)} °C`,
    },
    groups,
  }
}
