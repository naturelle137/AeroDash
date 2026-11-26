/** ISA reduction of model surface pressure at its matching model elevation. */
export function modelQnh(surfaceHpa: number, elevationM: number): number | null {
  if (!Number.isFinite(surfaceHpa) || surfaceHpa < 500 || surfaceHpa > 1100 || !Number.isFinite(elevationM) || elevationM < -500 || elevationM > 3000) return null
  const pressureAltitude = 44330.77 - 11880.32 * surfaceHpa ** 0.190263
  const result = 1013.25 * (1 - 0.0065 * (pressureAltitude - elevationM) / 288.15) ** 5.25588
  return result >= 850 && result <= 1090 ? Math.round(result * 10) / 10 : null
}
