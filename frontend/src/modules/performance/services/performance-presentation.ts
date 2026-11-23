import type { SourceAssessment } from '@/core/logic/performance.correction-sources'
import type { Notification } from '@/core/domain/notification.schema'
import { BLOCKER_MESSAGES, CORRECTION_LABELS, INPUT_GAP_MESSAGES, OPERATION_LABELS, SUMMARY_MESSAGES, reasonMessage } from './correction-source-messages'
import type { CorrectedOperationPresentation } from './corrected-distances'
import { OBSTACLE_SCOPE } from './obstacle-constraint'
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
  /** Current entered conditions, including blocked/uncomputed input text. */
  readonly inputs: readonly { readonly label: string; readonly value: string; readonly warnings?: readonly string[] }[]
  /** Conditions actually used; null until assessed. */
  readonly conditions: { readonly pressureAltitude: string; readonly temperature: string } | null
  readonly groups: readonly PerformanceGroupPresentation[]
  readonly operational: OperationalPresentation
  /** Corrected distances per operation; empty until a result exists. Raw groups stay uncorrected. */
  readonly corrected: readonly CorrectedOperationPresentation[]
  readonly notifications: readonly Notification[]
  /** Upper-axis extrapolation awaiting or holding pilot acknowledgment; null when no group is extrapolated. */
  readonly extrapolation: ExtrapolationPresentation | null
  readonly runway: RunwayPresentation
  /** Scope statements that must accompany any displayed distance. */
  readonly scope: readonly string[]
}

export interface ExtrapolationPresentation {
  readonly acknowledged: boolean
  /** What was extrapolated, per distance; shown before and after acknowledgment. */
  readonly details: readonly string[]
  readonly warning: string
}

export const EXTRAPOLATION_WARNING = 'Performance data is extrapolated beyond the table limits: the boundary distance carries a fixed +20 % penalty. Treat the figures as estimates, not as POH/AFM values.'
export const LOWER_AXIS_ESTIMATE = 'ESTIMATED (lower-axis table boundary)'
const AXIS_LABELS = { mass: ['mass', 'kg'], pressureAltitude: ['pressure altitude', 'ft'], temperature: ['temperature', '°C'] } as const

export interface OperationalPresentation {
  readonly status: 'unavailable'
  readonly reason: string
  readonly sources: SourceAssessment | null
  readonly rows: readonly { readonly label: string; readonly value: string; readonly reasons: readonly string[] }[]
}

/** Preserve source-specific limitations for the pack without applying a correction. */
export function presentOperationalAssessment(sources: SourceAssessment | null, unavailableReason: string): OperationalPresentation {
  return {
    status: 'unavailable',
    reason: !sources ? unavailableReason : sources.status === 'blocked' ? BLOCKER_MESSAGES[sources.reason]
      : 'Corrected distances and runway comparisons appear only where an accepted aircraft-manual source covers wind, surface and slope.',
    sources,
    rows: sources?.status === 'assessed' ? sources.corrections.map((row) => ({
      label: `${OPERATION_LABELS[row.operation]} — ${CORRECTION_LABELS[row.correction]}`,
      value: SUMMARY_MESSAGES[row.summary],
      reasons: [
        ...(row.inputGap ? [INPUT_GAP_MESSAGES[row.inputGap]] : []),
        ...row.candidates.flatMap(({ candidate, reasons }) => [
          `${candidate.document.title}, ${candidate.document.identifier}, ${candidate.document.revision}, ${candidate.section}`,
          ...reasons.map(reasonMessage),
        ]),
      ],
    })) : [],
  }
}

export interface PerformanceGroupPresentation {
  readonly id: PerformanceGroupId
  readonly title: string
  /** e.g. "1 012.5 kg — current Mass & Balance takeoff mass"; null when unavailable. */
  readonly mass: string | null
  readonly status: 'success' | 'blocked' | 'not-computed'
  /** Exact reason for a blocked or unavailable group. */
  readonly reason: string | null
  readonly rows: readonly { readonly label: string; readonly value: string; readonly note: string | null; readonly warnings?: readonly string[] }[]
}

export type RunwayPresentation =
  | { readonly status: 'declared'; readonly label: string; readonly rows: readonly { readonly label: string; readonly value: string }[]; readonly note: string }
  | { readonly status: 'unavailable'; readonly reason: string }

const TITLES: Record<PerformanceGroupId, string> = { takeoff: 'Takeoff', landing: 'Landing' }

export const PERFORMANCE_SCOPE = [
  'Base distances from POH/AFM tables or marked estimates are uncorrected: no wind, surface, slope or density-altitude correction is applied to them. Corrected distances are shown separately with their source and any missing or unverified corrections.',
  'Runway comparisons use declared distances and do not constitute a Go/No-Go decision or operational approval.',
] as const

export function formatNumber(value: number, digits = 1): string {
  return value.toLocaleString('en-GB', { minimumFractionDigits: digits, maximumFractionDigits: digits })
}

function massLabel(source: MassSource): string | null {
  return source.status === 'ready' ? `${formatNumber(source.massKg)} kg — ${source.origin}` : null
}

function extrapolationDetails(group: Extract<GroupAssessment, { status: 'success' }>, title: string): string[] {
  return group.distances.flatMap((row) => row.extrapolation ? [`${title} ${row.label}: ${row.extrapolation.axes.map(({ axis, value, max, fraction }) => `${AXIS_LABELS[axis][0]} ${formatNumber(value)} ${AXIS_LABELS[axis][1]} is ${formatNumber(fraction * 100)} % above the table maximum ${formatNumber(max)} ${AXIS_LABELS[axis][1]}`).join(', ')}`] : [])
}

function groupPresentation(id: PerformanceGroupId, source: MassSource, group: GroupAssessment | null, acknowledged = true): PerformanceGroupPresentation {
  const base = { id, title: TITLES[id], mass: massLabel(source) }
  if (!group) {
    return { ...base, status: source.status === 'ready' ? 'not-computed' : 'blocked', reason: source.status === 'ready' ? null : source.reason, rows: [] }
  }
  if (group.status === 'blocked') return { ...base, status: 'blocked', reason: group.message, rows: [] }
  if (group.extrapolated && !acknowledged) {
    return { ...base, status: 'blocked', reason: 'Extrapolated result withheld until the pilot in command acknowledges the extrapolated data below.', rows: [] }
  }
  return {
    ...base,
    status: 'success',
    reason: null,
    rows: group.distances.map((row) => ({
      label: row.label,
      value: `${formatNumber(row.distance)} m`,
      note: [row.lowerAxisCaps.length ? LOWER_AXIS_ESTIMATE : '', row.extrapolation ? 'ESTIMATED — EXTRAPOLATED (+20 % penalty)' : '', row.provenance === 'estimated' ? 'ESTIMATED (CAA SSL 07)' : ''].filter(Boolean).join(' · ') || null,
    })),
  }
}

export type PresentationInput = {
  inputKey: string
  warnings?: readonly string[]
  inputs: PerformancePresentation['inputs']
  aircraft: PerformancePresentation['aircraft']
  takeoff: MassSource
  landing: MassSource
  /** Assessment computed for exactly `inputKey`, or null. */
  assessment: PerformanceAssessment | null
  pressureAltitudeBasis: string
  /** Why no result exists when `assessment` is null. */
  pendingReason: string
  runway: RunwayPresentation
  operational: OperationalPresentation
  corrected?: readonly CorrectedOperationPresentation[]
  /** Extra notifications, such as the unverified-obstacle warning; an active obstacle also adds its scope limit. */
  notifications?: readonly Notification[]
  obstacleActive?: boolean
  /** Pilot acknowledgment of exactly `inputKey`'s extrapolated data. */
  extrapolationAcknowledged?: boolean
}

export function presentPerformance(input: PresentationInput): PerformancePresentation {
  const { assessment } = input
  const corrected = input.corrected ?? []
  const perOperation: Notification[] = corrected.flatMap((item) => {
    if (item.status !== 'applied') return []
    return [
      ...(item.comparison.status === 'insufficient' ? [{ id: 'CRIT-PF-002', severity: 'CRITICAL' as const, message: `${item.title}: ${item.comparison.summary}`, context: 'Performance.RunwayLength', persistent: true, dismissible: false }] : []),
      ...(item.safetyFactorWarning ? [{ id: 'WARN-PF-002', severity: 'WARNING' as const, message: `${item.title}: ${item.safetyFactorWarning}`, context: 'Performance.SafetyFactor', persistent: true, dismissible: true }] : []),
    ]
  })
  const notifications = [...(input.notifications ?? []), ...perOperation].reduce<Notification[]>((all, item) => {
    const existing = all.find(n => n.id === item.id)
    if (existing) existing.message += ` ${item.message}`
    else all.push({ ...item })
    return all
  }, [])
  const common = { inputKey: input.inputKey, inputs: input.inputs, aircraft: input.aircraft, runway: input.runway, operational: input.operational, corrected, notifications, scope: input.obstacleActive ? [...PERFORMANCE_SCOPE, OBSTACLE_SCOPE] : PERFORMANCE_SCOPE }
  const acknowledged = input.extrapolationAcknowledged ?? false
  if (!assessment || assessment.status === 'blocked') {
    return {
      ...common,
      status: assessment ? 'blocked' : 'not-computed',
      reason: assessment ? assessment.message : input.pendingReason,
      conditions: null,
      extrapolation: null,
      groups: [groupPresentation('takeoff', input.takeoff, null), groupPresentation('landing', input.landing, null)]
        .map((group) => assessment && group.status === 'not-computed' ? { ...group, status: 'blocked' as const, reason: assessment.message } : group),
    }
  }
  const groups = [
    groupPresentation('takeoff', input.takeoff, assessment.takeoff, acknowledged),
    groupPresentation('landing', input.landing, assessment.landing, acknowledged),
  ]
  const details = (['takeoff', 'landing'] as const).flatMap((id) => {
    const group = assessment[id]
    return group.status === 'success' ? extrapolationDetails(group, TITLES[id]) : []
  })
  const anySuccess = groups.some((group) => group.status === 'success')
  return {
    ...common,
    status: anySuccess ? 'assessed' : 'blocked',
    reason: anySuccess ? null : 'No takeoff or landing distance is available; see each reason.',
    extrapolation: details.length ? { acknowledged, details, warning: EXTRAPOLATION_WARNING } : null,
    conditions: {
      pressureAltitude: input.pressureAltitudeBasis,
      temperature: `${formatNumber(assessment.conditions.temperatureC)} °C`,
    },
    groups: groups.map(group => ({ ...group, rows: group.rows.map(row => ({ ...row, warnings: [...(input.warnings ?? [])] })) })),
  }
}
