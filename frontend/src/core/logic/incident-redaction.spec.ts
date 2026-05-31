// @UT-SYS-CORE-110@ (FROM: @IMP-SYS-CORE-014@)
import { describe, it, expect } from 'vitest'
import {
  REDACTION_MARKERS,
  redactIncidentText,
  totalRedactions,
} from './incident-redaction'

describe('redactIncidentText', () => {
  it('returns the empty result for empty input', () => {
    const { redacted, counts } = redactIncidentText('')
    expect(redacted).toBe('')
    expect(totalRedactions(counts)).toBe(0)
  })

  it('passes through aviation-numeric text untouched', () => {
    const text =
      'After loading 100 kg pilot mass and 50 L fuel the CG was 1.84 m at MTOM 650 kg.'
    const { redacted, counts } = redactIncidentText(text)
    expect(redacted).toBe(text)
    expect(totalRedactions(counts)).toBe(0)
  })

  it('redacts email addresses', () => {
    const { redacted, counts } = redactIncidentText(
      'reach me at john.doe+pilot@example.com or admin@flight.aero',
    )
    expect(redacted).toContain(REDACTION_MARKERS.EMAIL)
    expect(redacted).not.toContain('john.doe+pilot@example.com')
    expect(redacted).not.toContain('admin@flight.aero')
    expect(counts.email).toBe(2)
  })

  it('redacts phone numbers in international and grouped formats', () => {
    const { redacted, counts } = redactIncidentText(
      'Call +49 151 1234 5678 or (415) 555-2671 for follow-up.',
    )
    expect(redacted).toContain(REDACTION_MARKERS.PHONE)
    expect(redacted).not.toMatch(/\+49 151 1234 5678/)
    expect(redacted).not.toMatch(/\(415\) 555-2671/)
    expect(counts.phone).toBe(2)
  })

  it('does not treat aviation quantity like "300 kg" as a phone number', () => {
    const { counts } = redactIncidentText('Loaded 300 kg fuel and 50 L oil.')
    expect(counts.phone).toBe(0)
  })

  it('redacts decimal coordinate pairs', () => {
    const { redacted, counts } = redactIncidentText(
      'Departed from 50.0379,8.5622 heading east.',
    )
    expect(redacted).toContain(REDACTION_MARKERS.COORD)
    expect(redacted).not.toContain('50.0379,8.5622')
    expect(counts.coord).toBe(1)
  })

  it('redacts DMS coordinate pairs', () => {
    const { redacted, counts } = redactIncidentText(
      `Position 50°02'16"N 008°33'44"E logged on takeoff roll.`,
    )
    expect(redacted).toContain(REDACTION_MARKERS.COORD)
    expect(counts.coord).toBe(1)
  })

  it('redacts ICAO-style aircraft registration', () => {
    const { redacted, counts } = redactIncidentText(
      'D-EBPN and N12345 both showed the same defect.',
    )
    expect(redacted).toContain(REDACTION_MARKERS.REGISTRATION)
    expect(redacted).not.toContain('D-EBPN')
    expect(redacted).not.toContain('N12345')
    expect(counts.registration).toBe(2)
  })

  it('redacts URLs even when they contain emails in query strings', () => {
    const { redacted, counts } = redactIncidentText(
      'See https://example.com/x?u=pilot@example.com&t=1',
    )
    expect(redacted).toContain(REDACTION_MARKERS.URL)
    expect(redacted).not.toContain('pilot@example.com')
    expect(counts.url).toBe(1)
    // Email inside URL is swallowed by the URL marker — not counted twice.
    expect(counts.email).toBe(0)
  })

  it('is deterministic — same input yields identical output', () => {
    const text = 'Contact: pilot@example.com or +49 151 1234 5678 at D-EBPN.'
    const first = redactIncidentText(text)
    const second = redactIncidentText(text)
    expect(first).toEqual(second)
  })

  it('totals every class via totalRedactions', () => {
    const { counts } = redactIncidentText(
      'Email a@b.co and call +12 345 6789 0 at https://x.io re D-EBPN at 50.04,8.56.',
    )
    expect(totalRedactions(counts)).toBe(
      counts.email + counts.phone + counts.coord + counts.registration + counts.url,
    )
    expect(totalRedactions(counts)).toBeGreaterThanOrEqual(4)
  })

  // B3: registration pattern must NOT eat aviation diagnostics that look
  // superficially like an ICAO reg. The reviewer found these false positives
  // were destroying the very data needed to triage a calculation defect.
  it.each([
    'Climbed to FL-100 and held',
    'Operated an A-320 today',
    'Compared to B-737 numbers',
    'Took off, called T-O at V-1',
  ])('preserves aviation diagnostic phrase: %s', (phrase) => {
    const { redacted, counts } = redactIncidentText(phrase)
    expect(counts.registration).toBe(0)
    expect(redacted).toBe(phrase)
  })

  it('preserves single-digit N-number engine readings (N1, N2)', () => {
    const text = 'Read N1 95% and N2 88% on takeoff'
    const { redacted, counts } = redactIncidentText(text)
    expect(counts.registration).toBe(0)
    expect(redacted).toBe(text)
  })

  // M1: lookbehind would throw SyntaxError on Safari 16.0–16.3 at module-load
  // time. Reaching this assertion proves the module compiled — we still
  // exercise a phone redaction to make sure the pattern is wired up.
  it('does not use regex lookbehind syntax (Safari 16.0 floor)', () => {
    const { redacted } = redactIncidentText('Call +49 151 1234 5678 for dispatch.')
    expect(typeof redactIncidentText).toBe('function')
    expect(redacted).toContain(REDACTION_MARKERS.PHONE)
  })

  // M3: phone redaction must remove BOTH the parens and the digits so no
  // dangling `(` survives in the output.
  it('strips the leading parenthesis when redacting "(415) 555-2671"', () => {
    const { redacted } = redactIncidentText('Phone (415) 555-2671 for ops.')
    expect(redacted).not.toContain('(415)')
    expect(redacted).not.toContain('(415')
    expect(redacted).toContain(REDACTION_MARKERS.PHONE)
  })

  // m1: plain numeric ranges must NOT be redacted as phones — pilots lose
  // timeline detail like "between 1700-1815".
  it.each(['Window between 1700-1815 UTC', 'Score sequence 100-200-300'])(
    'does not redact narrative numeric run: %s',
    (phrase) => {
      const { redacted, counts } = redactIncidentText(phrase)
      expect(counts.phone).toBe(0)
      expect(redacted).toBe(phrase)
    },
  )

  // m2: integer hemisphere-tagged coordinate pairs should still be redacted.
  it('redacts integer coordinate pairs that carry N/S/E/W markers', () => {
    const { redacted, counts } = redactIncidentText('Departed 50N 8E in the morning.')
    expect(counts.coord).toBe(1)
    expect(redacted).toContain(REDACTION_MARKERS.COORD)
    expect(redacted).not.toContain('50N 8E')
  })

  // Sanity: numeric pilot input ("50,8 kg, 12,3 L") must NOT trip the
  // integer-coord branch (no hemisphere marker).
  it('does not over-match plain numeric pairs without hemisphere markers', () => {
    const text = 'Loaded 50,8 kg cargo and 12,3 L oil.'
    const { redacted, counts } = redactIncidentText(text)
    expect(counts.coord).toBe(0)
    expect(redacted).toBe(text)
  })
})
