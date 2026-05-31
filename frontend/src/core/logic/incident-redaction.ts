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
 */
const URL_PATTERN = /\bhttps?:\/\/[^\s<>"']+/gi
// Pragmatic email regex — not RFC 5322 perfect, but covers everything a
// pilot is likely to paste. The `[\w.+-]+` local part deliberately accepts
// underscores so addresses like `john_doe@example.com` are caught.
const EMAIL_PATTERN = /\b[\w.+-]+@[\w-]+(?:\.[\w-]+)+\b/g
// Phone — international, +/- separators, spaces, parens. We want at least
// 7 digits in total to avoid matching plain quantity numbers like "300 kg".
const PHONE_PATTERN = /(?<![\w.-])\+?\d[\d\s().-]{6,}\d(?![\w.-])/g
// Decimal lat/lon pair, e.g. "50.0379,8.5622" or "50.0379 N 8.5622 E".
const COORD_DECIMAL_PATTERN =
  /-?\d{1,3}\.\d{2,}\s*[NnSs]?[ ,;/]+-?\d{1,3}\.\d{2,}\s*[EeWw]?/g
// DMS lat/lon, e.g. "50°02'16"N 008°33'44"E". Uses degree, ASCII single
// quote, ASCII double quote; tolerates extra spaces.
const COORD_DMS_PATTERN =
  /\d{1,3}°\s*\d{1,2}'\s*\d{1,2}(?:\.\d+)?"?\s*[NnSs][ ,;/]+\d{1,3}°\s*\d{1,2}'\s*\d{1,2}(?:\.\d+)?"?\s*[EeWw]/g
// ICAO aircraft registration: country prefix (1-2 letters) + dash + 1-5
// alphanumerics, e.g. D-EBPN, OE-ABC, G-ABCD. Also N-numbers (N12345,
// N123AB). Anchored on word boundaries so it does NOT eat ICAO airport
// codes (4 letters, no dash).
const REGISTRATION_DASH_PATTERN = /\b[A-Z]{1,2}-[A-Z0-9]{1,5}\b/g
const REGISTRATION_N_PATTERN = /\bN[0-9]{1,5}[A-Z]{0,2}\b/g

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

  out = out.replace(PHONE_PATTERN, () => {
    counts.phone += 1
    return REDACTION_MARKERS.PHONE
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
