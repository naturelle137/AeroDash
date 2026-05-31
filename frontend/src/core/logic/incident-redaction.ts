/**
 * Privacy redaction for pilot-supplied incident report text (issue #281,
 * PR-006). P1 Safety Core — pure TypeScript, no framework dependencies,
 * deterministic.
 *
 * Goal: strip the obvious PII classes that a pilot might paste into a free-
 * text problem report (email, phone, GPS coordinates, aircraft registration,
 * URLs with query strings) before the report is queued to IndexedDB and
 * eventually opened on github.com. The pilot is then shown the redacted
 * text in a preview so they can confirm what will leave the device.
 *
 * Non-goals:
 * - Heuristic NER (names, addresses). Those need pilot judgement — the
 *   preview-before-submit dialog is the second line of defence.
 * - Removing aviation numerics ("100 kg pilot mass", "50 L fuel"). Those
 *   are exactly the values needed to reproduce the bug, so they are kept
 *   verbatim.
 * - Redacting public airport ICAO/IATA codes — they are route-revealing
 *   but the diagnostic value outweighs the privacy cost for this MVP
 *   (the pilot can edit them out in the GitHub draft if they wish).
 *
 * Mirrors the spirit of the logger's
 * {@link ../../shared/utils/logger.ts | redactPayload} field-allow-list
 * (DP-004 / CS-012) but operates on free text rather than structured data.
 */

// @IMP-SYS-CORE-014@ (FROM: @REQ-SYS-016@, @REQ-SYS-017@)

export const REDACTION_MARKERS = {
  EMAIL: '[REDACTED-EMAIL]',
  PHONE: '[REDACTED-PHONE]',
  COORD: '[REDACTED-COORD]',
  REGISTRATION: '[REDACTED-REG]',
  URL: '[REDACTED-URL]',
} as const

export type RedactionCounts = {
  email: number
  phone: number
  coord: number
  registration: number
  url: number
}

/**
 * Patterns applied in order. Each replaces a self-contained PII class with
 * a marker so the next pattern still sees clean text on both sides.
 *
 * Order matters: URL stripping happens before email/phone, otherwise an
 * email/phone embedded in a query string would be matched twice.
 *
 * Regex syntax constraint: no lookbehind. Lookbehind shipped in Safari
 * 16.4, but `vite.config.ts` pins `build.target` at `safari16.0` so the
 * bundle must parse on Safari 16.0–16.3 (Vite does not transpile regex
 * syntax — a lookbehind here would throw `SyntaxError` at module-load on
 * those iOS versions and cascade-break every importer). Lookahead is fine
 * (Safari has supported it for years).
 */
const URL_PATTERN = /\bhttps?:\/\/[^\s<>"']+/gi
// Pragmatic email regex — not RFC 5322 perfect, but covers everything a
// pilot is likely to paste. The `[\w.+-]+` local part deliberately accepts
// underscores so addresses like `john_doe@example.com` are caught.
const EMAIL_PATTERN = /\b[\w.+-]+@[\w-]+(?:\.[\w-]+)+\b/g
// Phone — international, +/- separators, spaces, parens. Capture group 1
// re-emits the leading boundary char so the replacement does not eat it
// (replaces the lookbehind that would otherwise drop iOS Safari 16.0–16.3
// out of scope, M1). Two alternatives, both anchored to require either a
// leading `+` (international form) OR an internal `[\s()]` separator so
// plain numeric ranges like `"between 1700-1815"` or `"100-200-300"` are
// not swallowed (m1). The optional `\(?` consumes a leading parenthesis
// such as `(415) 555-2671` so no dangling `(` survives in the output (m3).
const PHONE_PATTERN =
  /(^|[^\w.-])(\+\d[\d\s().-]{6,}\d|\(?\s*\d[\d().-]*[\s()]\d[\d\s().-]{4,}\d)(?![\w.-])/g
// Decimal lat/lon pair, e.g. "50.0379,8.5622" or "50.0379 N 8.5622 E".
const COORD_DECIMAL_PATTERN =
  /-?\d{1,3}\.\d{2,}\s*[NnSs]?[ ,;/]+-?\d{1,3}\.\d{2,}\s*[EeWw]?/g
// Integer-only coordinate pair (m2), e.g. "50N 8E" or "50,8 N/E". The
// pattern requires explicit N/S/E/W hemisphere markers so plain numeric
// lists ("50,8 kg, 12,3 L") are not over-matched. Lat range capped to
// 2 digits, lon to 3 digits.
const COORD_INT_PATTERN =
  /(^|[^\w.-])(-?\d{1,2}\s*[NnSs][ ,;/]+-?\d{1,3}\s*[EeWw])\b/g
// DMS lat/lon, e.g. "50°02'16"N 008°33'44"E". Uses degree, ASCII single
// quote, ASCII double quote; tolerates extra spaces.
const COORD_DMS_PATTERN =
  /\d{1,3}°\s*\d{1,2}'\s*\d{1,2}(?:\.\d+)?"?\s*[NnSs][ ,;/]+\d{1,3}°\s*\d{1,2}'\s*\d{1,2}(?:\.\d+)?"?\s*[EeWw]/g
// ICAO aircraft registration: country prefix (1-2 letters) + dash + 3-5
// LETTERS (no digits) so the pattern catches D-EBPN, OE-ABC, G-ABCD,
// HB-XYZ but spares aviation diagnostics that look superficially similar:
//   • Flight levels  (FL-100)
//   • Aircraft types (A-320, B-737)
//   • Throttle/abbreviations (T-O for take-off, V-1, Cs-A)
// Trade-off (B3): rare alphabetic country prefixes with digit-containing
// suffixes (none in routine ICAO use) slip through; pilots typing a non-
// standard registration can redact it manually in the preview pane.
// False positives on common English bigrams (E-MAIL, X-RAY, MS-DOS) are
// acceptable because the preview shows the result before submission.
const REGISTRATION_DASH_PATTERN = /\b[A-Z]{1,2}-[A-Z]{3,5}\b/g
// N-numbers: must be N + 2 or more digits so engine readings like "N1"
// and "N2" (turbine speed gauges) survive. Trailing letters optional.
const REGISTRATION_N_PATTERN = /\bN[0-9]{2,5}[A-Z]{0,2}\b/g

/**
 * Apply the redaction pipeline to free text. Returns the redacted text plus
 * per-class match counts so the preview UI can tell the pilot exactly how
 * many secrets were stripped (low-friction trust signal).
 *
 * The function is pure and deterministic — same input ⇒ same output, no
 * IO, no Date.now, no random.
 *
 * @param text Raw pilot input. May be empty (yields empty result + zero
 *             counts).
 */
export function redactIncidentText(text: string): {
  redacted: string
  counts: RedactionCounts
} {
  const counts: RedactionCounts = {
    email: 0,
    phone: 0,
    coord: 0,
    registration: 0,
    url: 0,
  }

  // URLs first so embedded emails/phones in query strings don't double-count.
  let out = text.replace(URL_PATTERN, () => {
    counts.url += 1
    return REDACTION_MARKERS.URL
  })

  out = out.replace(EMAIL_PATTERN, () => {
    counts.email += 1
    return REDACTION_MARKERS.EMAIL
  })

  // Coordinate forms before phone — DMS digit sequences would otherwise
  // get partially gobbled by the phone matcher.
  out = out.replace(COORD_DMS_PATTERN, () => {
    counts.coord += 1
    return REDACTION_MARKERS.COORD
  })
  out = out.replace(COORD_DECIMAL_PATTERN, () => {
    counts.coord += 1
    return REDACTION_MARKERS.COORD
  })
  out = out.replace(COORD_INT_PATTERN, (_match, lead: string) => {
    counts.coord += 1
    return `${lead}${REDACTION_MARKERS.COORD}`
  })

  out = out.replace(PHONE_PATTERN, (_match, lead: string) => {
    counts.phone += 1
    return `${lead}${REDACTION_MARKERS.PHONE}`
  })

  out = out.replace(REGISTRATION_DASH_PATTERN, () => {
    counts.registration += 1
    return REDACTION_MARKERS.REGISTRATION
  })
  out = out.replace(REGISTRATION_N_PATTERN, () => {
    counts.registration += 1
    return REDACTION_MARKERS.REGISTRATION
  })

  return { redacted: out, counts }
}

/** Total number of redactions across every class — handy for the UI badge. */
export function totalRedactions(counts: RedactionCounts): number {
  return (
    counts.email +
    counts.phone +
    counts.coord +
    counts.registration +
    counts.url
  )
}
