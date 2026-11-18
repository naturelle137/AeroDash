/** Resolve one missing base distance; published values always take precedence. */
export function estimateDistance(value: number, operation: 'takeoff' | 'landing', missing: 'roll' | 'distance'): number {
  const factor = operation === 'takeoff' ? 1.9 : 1.67
  return missing === 'distance' ? value * factor : value / factor
}
