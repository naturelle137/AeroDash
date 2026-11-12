/**
 * Unit tests for profile.validator.ts
 *
 * @see frontend/src/modules/aircraft/services/profile.validator.ts
 */

import { describe, it, expect } from 'vitest'
import {
  validateIcaoRegistration,
  hasDuplicateRegistration,
} from '../services/profile.validator'

describe('validateIcaoRegistration', () => {
  it('validates D-EBPN as valid ICAO registration', () => {
    expect(validateIcaoRegistration('D-EBPN')).toBe(true)
  })

  it('rejects "123" as invalid registration (must start with a letter)', () => {
    expect(validateIcaoRegistration('123')).toBe(false)
  })

  it('accepts N12345 (US-style registration)', () => {
    expect(validateIcaoRegistration('N12345')).toBe(true)
  })

  it('accepts G-ABCD (UK-style registration)', () => {
    expect(validateIcaoRegistration('G-ABCD')).toBe(true)
  })

  it('rejects empty string', () => {
    expect(validateIcaoRegistration('')).toBe(false)
  })

  it('rejects a single character (too short)', () => {
    expect(validateIcaoRegistration('A')).toBe(false)
  })

  it('rejects 8 characters (too long)', () => {
    expect(validateIcaoRegistration('D-ABCDEF')).toBe(false)
  })

  it('rejects registration with special characters', () => {
    expect(validateIcaoRegistration('D-EB!N')).toBe(false)
  })

  it('accepts 2-character registration (minimum valid length)', () => {
    expect(validateIcaoRegistration('AB')).toBe(true)
  })

  it('accepts 7-character registration (maximum valid length)', () => {
    expect(validateIcaoRegistration('D-ABCDE')).toBe(true)
  })

  // ─── Tightened regex — hyphen abuse rejection ──────────────────────────────

  it('rejects a registration of letter + only hyphens ("A------")', () => {
    expect(validateIcaoRegistration('A------')).toBe(false)
  })

  it('rejects a registration with multiple hyphen-separated segments ("A-A-A-A")', () => {
    expect(validateIcaoRegistration('A-A-A-A')).toBe(false)
  })

  it('rejects a registration with a leading hyphen ("-ABCD")', () => {
    expect(validateIcaoRegistration('-ABCD')).toBe(false)
  })

  it('rejects a registration with a trailing hyphen ("ABCD-")', () => {
    expect(validateIcaoRegistration('ABCD-')).toBe(false)
  })

  it('rejects a registration with consecutive hyphens ("A--BC")', () => {
    expect(validateIcaoRegistration('A--BC')).toBe(false)
  })

  it('rejects a registration of only hyphens ("------")', () => {
    expect(validateIcaoRegistration('------')).toBe(false)
  })

  it('accepts a 2-letter prefix with hyphen + alnum suffix ("OE-KFB")', () => {
    expect(validateIcaoRegistration('OE-KFB')).toBe(true)
  })

  it('rejects a registration whose suffix is only hyphens ("D------")', () => {
    expect(validateIcaoRegistration('D------')).toBe(false)
  })
})

describe('hasDuplicateRegistration', () => {
  const existingProfiles = [
    { id: 'uuid-001', registration: 'D-EBPN' },
    { id: 'uuid-002', registration: 'D-ECSM' },
    { id: 'uuid-003', registration: 'N12345' },
  ]

  it('detects duplicate registration in fleet (case-insensitive)', () => {
    expect(hasDuplicateRegistration('D-EBPN', existingProfiles)).toBe(true)
  })

  it('detects duplicate registration case-insensitively', () => {
    expect(hasDuplicateRegistration('d-ebpn', existingProfiles)).toBe(true)
  })

  it('returns false when registration is not in fleet', () => {
    expect(hasDuplicateRegistration('OE-KFB', existingProfiles)).toBe(false)
  })

  it('allows same reg when excludeId matches the profile owning that registration', () => {
    // Editing uuid-001 (D-EBPN) — should not flag itself as duplicate
    expect(hasDuplicateRegistration('D-EBPN', existingProfiles, 'uuid-001')).toBe(false)
  })

  it('still detects duplicate when excludeId does not match the conflicting profile', () => {
    // uuid-002 has D-ECSM. We are checking D-ECSM for uuid-003 — should flag.
    expect(hasDuplicateRegistration('D-ECSM', existingProfiles, 'uuid-003')).toBe(true)
  })

  it('returns false when profiles array is empty', () => {
    expect(hasDuplicateRegistration('D-EBPN', [])).toBe(false)
  })
})
