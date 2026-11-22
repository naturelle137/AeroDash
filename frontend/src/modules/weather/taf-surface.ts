import { liquidWeatherToken } from './metar-surface'

/** Current-time TAF interpretation; unsupported groups never become runway evidence. */
export function tafLiquid(body: string, start: number, end: number, now: number): boolean | null {
  if (![start, end, now].every(Number.isFinite) || start >= end || end - start > 48 * 3600000 || now < start || now >= end) return null
  const tokens = body.trim().replace(/=$/, '').split(/\s+/)
  const groups: { kind: string; from: number; to: number; liquid: boolean | undefined }[] = []
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
    const windMatch = /^(\d{3}|VRB)(\d{2,3})(?:G\d{2,3})?(KT|MPS|KMH)$/.exec(tokens[i] ?? '')
    if (windMatch) {
      if ((windMatch[1] !== 'VRB' && +windMatch[1]! > 360) || (windMatch[1] === '000' && +windMatch[2]! !== 0)) return null
      wind = true; i++
    }
    if (/^\d+$/.test(tokens[i] ?? '') && /^\d+\/\d+SM$/.test(tokens[i + 1] ?? '')) i++
    const cavok = tokens[i] === 'CAVOK'
    if (cavok || /^(?:\d{4}|(?:M|P)?\d+(?:\/\d+)?SM)$/.test(tokens[i] ?? '')) { visibility = true; i++ }
    if (cavok) { sky = true; liquid = false }
    while (i < tokens.length && !/^(?:FM|TEMPO$|BECMG$|PROB|FEW|SCT|BKN|OVC|VV|SKC$|CLR$|NSC$|NCD$)/.test(tokens[i]!)) {
      const token = tokens[i++]!
      if (cavok || ++weather > 3) return null
      const value = token === 'NSW' ? false : liquidWeatherToken(token)
      if (value === null || (token === 'NSW' && weather !== 1) || (weather > 1 && tokens[i - 2] === 'NSW')) return null
      liquid = (liquid ?? false) || value
    }
    while (/^(?:(?:FEW|SCT|BKN|OVC)\d{3}(?:CB|TCU)?|VV(?:\d{3}|\/\/\/)|SKC|CLR|NSC|NCD)$/.test(tokens[i] ?? '')) {
      if (cavok) return null
      sky = true; i++
    }
    if (i === first || ((kind === 'base' || kind === 'FM') && (!wind || !visibility || !sky))) return null
    if (kind === 'base' || kind === 'FM') liquid ??= false
    groups.push({ kind, from, to, liquid })
  }
  let prevailing: boolean | undefined
  let boundary = start
  for (const group of groups) {
    if (group.kind === 'base') prevailing = group.liquid
    if (group.kind === 'FM') {
      if (group.from <= boundary) return null
      boundary = group.from
      if (now >= group.from) prevailing = group.liquid
    }
    if (group.kind === 'TEMPO' && group.from < boundary) return null
    if (group.kind === 'BECMG') {
      if (group.from < boundary) return null
      boundary = group.to
      if (now >= group.from && now < group.to) return null
      if (now >= group.to && group.liquid !== undefined) prevailing = group.liquid
    }
  }
  return prevailing === true || groups.some((g, index) => g.kind === 'TEMPO' && now >= g.from && now < g.to && g.liquid === true && !groups.slice(index + 1).some(next => next.kind === 'FM' && now >= next.from))
}
