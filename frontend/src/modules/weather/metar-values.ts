import { QNH_SUPPORTED_HPA } from '@/core/logic/pressure-altitude'

export type MetarValues = { wind?: { direction: string; speed: string; unit: 'kt' | 'm/s' }; temperature?: string; qnh?: string }

export function metarValues(raw: string): MetarValues {
  const parts = raw.split(/\s+RMK(?:\s|$)/, 1)[0]!.split(/\s+/)
  const values: MetarValues = {}
  const winds = parts.filter(part => /^(?:\d{3}|VRB)\d{2,3}(?:G\d{2,3})?(?:KT|MPS)$/.test(part))
  if (winds.length === 1 && !parts.some(part => /^\d{3}V\d{3}$/.test(part))) {
    const match = /^(\d{3})(\d{2,3})(?:G\d{2,3})?(KT|MPS)$/.exec(winds[0]!)
    if (match) {
      const direction = Number(match[1]); const speed = Number(match[2])
      if (speed <= 200 && ((direction >= 1 && direction <= 360 && speed > 0) || (direction === 0 && speed === 0))) {
        values.wind = { direction: speed === 0 ? '' : String(direction), speed: String(speed), unit: match[3] === 'KT' ? 'kt' : 'm/s' }
      }
    }
  }
  const temperatures = parts.filter(part => /^(?:M?\d{2}|\/\/)\/(?:M?\d{2}|\/\/)$/.test(part))
  if (temperatures.length === 1) {
    const temp = temperatures[0]!.split('/')[0]!
    if (/^M?\d{2}$/.test(temp)) values.temperature = String(temp.startsWith('M') ? -Number(temp.slice(1)) : Number(temp))
  }
  const pressures = parts.filter(part => /^[QA]\d{4}$/.test(part))
  if (pressures.length === 1) {
    const pressure = pressures[0]!
    const qnh = pressure.startsWith('Q') ? Number(pressure.slice(1)) : Number((Number(pressure.slice(1)) / 100 * 33.86389).toFixed(2))
    if (qnh >= QNH_SUPPORTED_HPA.min && qnh <= QNH_SUPPORTED_HPA.max) values.qnh = String(qnh)
  }
  return values
}
