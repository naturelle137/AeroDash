/** Published base distances take precedence over estimates from their paired distance. */
export function resolveDistance(published: number | null, counterpart: number, operation: 'takeoff' | 'landing', missing: 'roll' | 'distance'): { distance: number; provenance: 'poh' | 'estimated' } {
  if (published !== null) return { distance: published, provenance: 'poh' }
  const factor = operation === 'takeoff' ? 1.9 : 1.67
  return { distance: missing === 'distance' ? counterpart * factor : counterpart / factor, provenance: 'estimated' }
}
