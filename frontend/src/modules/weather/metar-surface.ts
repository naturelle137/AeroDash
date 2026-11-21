// METAR body groups follow the Aviation Weather Center observation format.
export function metarLiquid(body: string): boolean | null {
  const tokens = body.replace(/=$/, '').split(/\s+/)
  let i = 0
  if (tokens[i] === 'AUTO' || tokens[i] === 'COR') i++
  const wind = /^(\d{3}|VRB)(\d{2,3})(?:G(\d{2,3}))?(KT|MPS|KMH)$/.exec(tokens[i++] ?? '')
  if (!wind || (wind[1] !== 'VRB' && Number(wind[1]) > 360) || (wind[1] === '000' && Number(wind[2]) !== 0)) return null
  if (/^\d{3}V\d{3}$/.test(tokens[i] ?? '')) {
    const [from, to] = tokens[i++]!.split('V').map(Number)
    if (from! > 360 || to! > 360) return null
  }
  const visibility = tokens[i++] ?? ''
  const cavok = visibility === 'CAVOK'
  if (!cavok && !/^(?:\d{4}|(?:M|P)?\d+(?:\/\d+)?SM)$/.test(visibility)) return null
  if (/^\d{4}(?:NDV|[NSEW]{1,2})$/.test(tokens[i] ?? '')) i++
  while (/^R\d{2}[LCR]?\/(?:M|P)?\d{4}(?:V(?:M|P)?\d{4})?[UDN]?$/.test(tokens[i] ?? '')) i++
  let liquid = false
  let groups = 0
  while (i < tokens.length && !/^(?:FEW|SCT|BKN|OVC|VV|SKC|CLR|NSC|NCD)/.test(tokens[i] ?? '') && !/^(?:M?\d{2}|\/\/)\//.test(tokens[i] ?? '') && tokens[i] !== 'RMK') {
    const token = tokens[i++]!
    if (cavok || ++groups > 3) return null
    const m = /^(\+|-|VC)?(MI|PR|BC|DR|BL|SH|TS|FZ)?((?:(?:DZ|RA|SN|SG|IC|PL|GR|GS|UP|BR|FG|FU|VA|DU|SA|HZ|PY|PO|SQ|FC|SS|DS)){1,3})$/.exec(token)
    if (!m) return null
    const phenomena = m[3]!.match(/../g)!
    const precipitation = phenomena.every(p => /^(DZ|RA|SN|SG|IC|PL|GR|GS|UP)$/.test(p))
    if (new Set(phenomena).size !== phenomena.length || (phenomena.length > 1 && !precipitation)) return null
    if (m[2] === 'FZ' && !phenomena.every(p => p === 'RA' || p === 'DZ' || p === 'FG')) return null
    if (m[2] === 'SH' && (!precipitation || phenomena.includes('DZ'))) return null
    if (m[2] === 'TS' && !precipitation) return null
    if (m[2] && /^(MI|PR|BC)$/.test(m[2]) && m[3] !== 'FG') return null
    if (m[2] && /^(DR|BL)$/.test(m[2]) && !/^(SN|DU|SA)$/.test(m[3]!)) return null
    if (m[1] !== 'VC' && (phenomena.includes('RA') || phenomena.includes('DZ'))) liquid = true
  }
  let sky = 0
  while (/^(?:(?:FEW|SCT|BKN|OVC)(?:\d{3}|\/\/\/)(?:CB|TCU)?|VV(?:\d{3}|\/\/\/)|SKC|CLR|NSC|NCD)$/.test(tokens[i] ?? '')) { i++; sky++ }
  if (!cavok && !sky) return null
  if (cavok && sky) return null
  if (!/^(?:M?\d{2}|\/\/)\/(?:M?\d{2}|\/\/)$/.test(tokens[i++] ?? '')) return null
  const pressure = /^(Q|A)(\d{4})$/.exec(tokens[i++] ?? '')
  if (!pressure || (pressure[1] === 'Q' ? Number(pressure[2]) < 800 || Number(pressure[2]) > 1100 : Number(pressure[2]) < 2350 || Number(pressure[2]) > 3250)) return null
  if (i < tokens.length && tokens[i] !== 'RMK') return null
  return liquid
}
