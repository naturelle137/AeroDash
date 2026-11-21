import { obstacleGradient } from '@/core/logic/obstacle-gradient'
import type { Notification } from '@/core/domain/notification.schema'
import { parseLookupNumber } from './poh-inspection'

export const OBSTACLE_UNITS = ['ft', 'm'] as const
export type ObstacleUnit = typeof OBSTACLE_UNITS[number]

export type ObstacleInput = { height: string; heightUnit: ObstacleUnit; distance: string; distanceUnit: ObstacleUnit }

export const emptyObstacleInput = (): ObstacleInput => ({ height: '', heightUnit: 'ft', distance: '', distanceUnit: 'ft' })

export type ObstacleAssessment =
  | { status: 'none' }
  | { status: 'invalid'; errors: { height?: string; distance?: string } }
  | { status: 'active'; height: number; heightUnit: ObstacleUnit; distance: number; distanceUnit: ObstacleUnit }

function field(raw: string, label: string): { value: number } | { error: string } {
  const value = parseLookupNumber(raw)
  if (value === null) return { error: `${label} must be a number, for example 150.` }
  if (value <= 0) return { error: `${label} must be greater than zero.` }
  return { value }
}

/** Both fields blank is "no obstacle"; any partial or invalid entry is never active. */
export function assessObstacle(input: ObstacleInput): ObstacleAssessment {
  if (!input.height.trim() && !input.distance.trim()) return { status: 'none' }
  const height = input.height.trim() ? field(input.height, 'Obstacle height') : { error: 'Enter the obstacle height or clear the distance.' }
  const distance = input.distance.trim() ? field(input.distance, 'Obstacle distance') : { error: 'Enter the obstacle distance or clear the height.' }
  if ('error' in height || 'error' in distance) {
    return { status: 'invalid', errors: { ...('error' in height ? { height: height.error } : {}), ...('error' in distance ? { distance: distance.error } : {}) } }
  }
  return { status: 'active', height: height.value, heightUnit: input.heightUnit, distance: distance.value, distanceUnit: input.distanceUnit }
}

export function describeObstacle(assessment: ObstacleAssessment): string {
  return assessment.status === 'active'
    ? `${assessment.height} ${assessment.heightUnit} above the runway at ${assessment.distance} ${assessment.distanceUnit} from the runway`
    : assessment.status === 'invalid' ? 'Invalid entry, not used' : 'None'
}

export function describeGradient(assessment: ObstacleAssessment): string {
  if (assessment.status !== 'active') return 'Not available'
  const gradient = obstacleGradient(assessment.height, assessment.heightUnit, assessment.distance, assessment.distanceUnit)
  return gradient === null ? 'Cannot calculate for these values.' : `Approximately ${gradient.toPrecision(4)}%`
}

export const OBSTACLE_SCOPE = 'The gradient is a straight-line height divided by distance from the runway reference; it does not account for ground roll, flight path, terrain or margins. Applicable climb performance is unavailable, so obstacle clearance cannot be determined. Verify using the POH/AFM and official sources.'

export function obstacleNotification(assessment: ObstacleAssessment): Notification[] {
  return assessment.status === 'active' ? [{
    id: 'WARN-PF-001', severity: 'WARNING', context: 'Performance.Obstacles', persistent: true, dismissible: false,
    message: `Unverified obstacle data in use (${describeObstacle(assessment)}). Clearance is not calculated or verified.`,
  }] : []
}
