import { FT_TO_M } from './unit-conversion-constants'

/** Straight-line height/distance from the stated runway reference, not a flight path. */
export function obstacleGradient(height: number, heightUnit: 'ft' | 'm', distance: number, distanceUnit: 'ft' | 'm'): number | null {
  if (!Number.isFinite(height) || !Number.isFinite(distance) || height <= 0 || distance <= 0) return null
  const ratio = height / distance * (heightUnit === distanceUnit ? 1 : heightUnit === 'ft' ? FT_TO_M : 1 / FT_TO_M) * 100
  return Number.isFinite(ratio) && ratio > 0 ? ratio : null
}
