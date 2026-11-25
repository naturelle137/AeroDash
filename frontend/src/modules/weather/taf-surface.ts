import { liquidWeatherToken } from './metar-surface'
import type { MetarValues } from './metar-values'

export type TafWind = NonNullable<MetarValues['wind']>

/** Current-time TAF interpretation; unsupported groups never become runway evidence. */
export function tafLiquid(body: string, start: number, end: number, now: number, mode: 'liquid' | 'soft' = 'liquid'): boolean | null {
  return analyse(body, start, end, now, mode)?.liquid ?? null
}

/** Prevailing forecast wind at `now`; null when absent, in a BECMG transition, variable, or the TAF is unsupported. TEMPO/PROB groups are not prevailing. */
export function tafWind(body: string, start: number, end: number, now: number): TafWind | null {
  return analyse(body, start, end, now, 'liquid')?.wind ?? null
}

function analyse(body: string, start: number, end: number, now: number, mode: 'liquid' | 'soft'): { liquid: boolean; wind: TafWind | null } | null {
  if (![start, end, now].every(Number.isFinite) || start >= end || end - start > 48 * 3600000 || now < start || now >= end) return null
  const tokens = body.trim().replace(/=$/, '').split(/\s+/)
  const groups: { kind: string; from: number; to: number; liquid: boolean | undefined; precip: boolean | undefined; wind: TafWind | null | undefined }[] = []
  function time(day: string, hour: string, minute = '00'): number {
    if (+hour > 24 || +minute > 59 || (+hour === 24 && +minute !== 0)) return NaN
    for (let date = start; date <= end; date += 60000) {
      const d = new Date(date)
      if (+hour === 24) d.setUTCDate(d.getUTCDate() - 1)
      if (d.getUTCDate() === +day && d.getUTCHours() === +hour % 24 && d.getUTCMinutes() === +minute) return date
    }
    return NaN
  }
  let i = 0
  while (i < tokens.length) {
    let kind = 'base', from = start, to = end
    if (groups.length) {
      const token = tokens[i++]!
      const fm = /^FM(\d{2})(\d{2})(\d{2})$/.exec(token)
      if (fm) { kind = 'FM'; from = time(fm[1]!, fm[2]!, fm[3]!) }
      else {
        kind = token
        if (/^PROB(?:30|40)$/.test(kind)) {
          if (tokens[i] === 'TEMPO') i++
          kind = 'TEMPO'
        }
        if (kind !== 'TEMPO' && kind !== 'BECMG') return null
        const period = /^(\d{2})(\d{2})\/(\d{2})(\d{2})$/.exec(tokens[i++] ?? '')
        if (!period) return null
        from = time(period[1]!, period[2]!); to = time(period[3]!, period[4]!)
      }
      if (!Number.isFinite(from) || !Number.isFinite(to) || from >= to) return null
    }
    const first = i
    let wind = false, visibility = false, sky = false, weather = 0
    let liquid: boolean | undefined
    let precip: boolean | undefined
    let value: TafWind | null | undefined
    const windMatch = /^(\d{3}|VRB)(\d{2,3})(?:G\d{2,3})?(KT|MPS|KMH)$/.exec(tokens[i] ?? '')
    if (windMatch) {
      if ((windMatch[1] !== 'VRB' && +windMatch[1]! > 360) || (windMatch[1] === '000' && +windMatch[2]! !== 0)) return null
      const direction = Number(windMatch[1]); const speed = Number(windMatch[2])
      // Variable direction, km/h and implausible speeds are not offered as inputs.
      value = windMatch[1] !== 'VRB' && windMatch[3] !== 'KMH' && speed <= 200 && ((direction >= 1 && speed > 0) || speed === 0)
        ? { direction: speed === 0 ? '' : String(direction), speed: String(speed), unit: windMatch[3] === 'KT' ? 'kt' : 'm/s' }
        : null
      wind = true; i++
    }
    if (/^\d+$/.test(tokens[i] ?? '') && /^\d+\/\d+SM$/.test(tokens[i + 1] ?? '')) i++
    const cavok = tokens[i] === 'CAVOK'
    if (cavok || /^(?:\d{4}|(?:M|P)?\d+(?:\/\d+)?SM)$/.test(tokens[i] ?? '')) { visibility = true; i++ }
    if (cavok) { sky = true; liquid = false; precip = false }
    while (i < tokens.length && !/^(?:FM|TEMPO$|BECMG$|PROB|FEW|SCT|BKN|OVC|VV|SKC$|CLR$|NSC$|NCD$)/.test(tokens[i]!)) {
      const token = tokens[i++]!
      if (cavok || ++weather > 3) return null
      const value = token === 'NSW' ? false : liquidWeatherToken(token)
      if (value === null || (token === 'NSW' && weather !== 1) || (weather > 1 && tokens[i - 2] === 'NSW')) return null
      liquid = (liquid ?? false) || value
      precip = (precip ?? false) || (token !== 'NSW' && /^(?:\+|-)?(?:SH|TS|FZ)?(?:DZ|RA|SN|SG|IC|PL|GR|GS|UP)+$/.test(token))
    }
    while (/^(?:(?:FEW|SCT|BKN|OVC)\d{3}(?:CB|TCU)?|VV(?:\d{3}|\/\/\/)|SKC|CLR|NSC|NCD)$/.test(tokens[i] ?? '')) {
      if (cavok) return null
      sky = true; i++
    }
    if (i === first || ((kind === 'base' || kind === 'FM') && (!wind || !visibility || !sky))) return null
    if (kind === 'base' || kind === 'FM') { liquid ??= false; precip ??= false }
    groups.push({ kind, from, to, liquid, precip, wind: value })
  }
  let prevailing: boolean | undefined
  let wind: TafWind | null = null
  let boundary = start
  for (const group of groups) {
    if (group.kind === 'base') { prevailing = group.liquid; wind = group.wind ?? null }
    if (group.kind === 'FM') {
      if (group.from <= boundary) return null
      boundary = group.from
      if (now >= group.from) { prevailing = group.liquid; wind = group.wind ?? null }
    }
    if (group.kind === 'TEMPO' && group.from < boundary) return null
    if (group.kind === 'BECMG') {
      if (group.from < boundary) return null
      boundary = group.to
      if (now >= group.from && now < group.to) return null
      if (now >= group.to && group.liquid !== undefined) prevailing = group.liquid
      if (now >= group.to && group.wind !== undefined) wind = group.wind
    }
  }
  if (mode === 'soft') {
    let currentPrecip = false, since = start
    for (const group of groups) {
      if ((group.kind === 'base' || group.kind === 'FM' || group.kind === 'BECMG') && (group.kind === 'base' || now >= (group.kind === 'BECMG' ? group.to : group.from))) {
        const effective = group.kind === 'BECMG' ? group.to : group.from
        if (group.precip !== undefined) {
          if (!currentPrecip || !group.precip) since = effective
          currentPrecip = group.precip
        }
      }
    }
    const nextChange = groups.filter(g => (g.kind === 'FM' || g.kind === 'BECMG') && g.from > now && g.precip === false).map(g => g.from)
    const until = Math.min(end, ...nextChange)
    return { liquid: currentPrecip && until - since > 2 * 3600000, wind }
  }
  return { wind, liquid: prevailing === true || groups.some((g, index) => g.kind === 'TEMPO' && now >= g.from && now < g.to && g.liquid === true && !groups.slice(index + 1).some(next => next.kind === 'FM' && now >= next.from)) }
}
