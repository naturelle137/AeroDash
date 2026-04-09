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
  // @UT-AC-STORE-001@ (FROM: @IMP-AC-STORE-002@)
  it('validates D-EBPN as valid ICAO registration', () => {
    expect(validateIcaoRegistration('D-EBPN')).toBe(true)
  })

  // @UT-AC-STORE-002@ (FROM: @IMP-AC-STORE-002@)
  it('rejects "123" as invalid registration (must start with a letter)', () => {
    expect(validateIcaoRegistration('123')).toBe(false)
  })

  // @UT-AC-STORE-003@ (FROM: @IMP-AC-STORE-002@)
  it('accepts N12345 (US-style registration)', () => {
    expect(validateIcaoRegistration('N12345')).toBe(true)
  })

  // @UT-AC-STORE-004@ (FROM: @IMP-AC-STORE-002@)
  it('accepts G-ABCD (UK-style registration)', () => {
    expect(validateIcaoRegistration('G-ABCD')).toBe(true)
  })

  // @UT-AC-STORE-005@ (FROM: @IMP-AC-STORE-002@)
  it('rejects empty string', () => {
    expect(validateIcaoRegistration('')).toBe(false)
  })

  // @UT-AC-STORE-006@ (FROM: @IMP-AC-STORE-002@)
  it('rejects a single character (too short)', () => {
    expect(validateIcaoRegistration('A')).toBe(false)
  })

  // @UT-AC-STORE-007@ (FROM: @IMP-AC-STORE-002@)
  it('rejects 8 characters (too long)', () => {
    expect(validateIcaoRegistration('D-ABCDEF')).toBe(false)
  })

  // @UT-AC-STORE-008@ (FROM: @IMP-AC-STORE-002@)
  it('rejects registration with special characters', () => {
    expect(validateIcaoRegistration('D-EB!N')).toBe(false)
  })

  // @UT-AC-STORE-009@ (FROM: @IMP-AC-STORE-002@)
  it('accepts 2-character registration (minimum valid length)', () => {
    expect(validateIcaoRegistration('AB')).toBe(true)
  })

  // @UT-AC-STORE-010@ (FROM: @IMP-AC-STORE-002@)
  it('accepts 7-character registration (maximum valid length)', () => {
    expect(validateIcaoRegistration('D-ABCDE')).toBe(true)
  })
})

describe('hasDuplicateRegistration', () => {
  const existingProfiles = [
    { id: 'uuid-001', registration: 'D-EBPN' },
    { id: 'uuid-002', registration: 'D-ECSM' },
    { id: 'uuid-003', registration: 'N12345' },
  ]

  // @UT-AC-STORE-011@ (FROM: @IMP-AC-STORE-003@)
  it('detects duplicate registration in fleet (case-insensitive)', () => {
    expect(hasDuplicateRegistration('D-EBPN', existingProfiles)).toBe(true)
  })

  // @UT-AC-STORE-012@ (FROM: @IMP-AC-STORE-003@)
  it('detects duplicate registration case-insensitively', () => {
    expect(hasDuplicateRegistration('d-ebpn', existingProfiles)).toBe(true)
  })

  // @UT-AC-STORE-013@ (FROM: @IMP-AC-STORE-003@)
  it('returns false when registration is not in fleet', () => {
    expect(hasDuplicateRegistration('OE-KFB', existingProfiles)).toBe(false)
  })

  // @UT-AC-STORE-014@ (FROM: @IMP-AC-STORE-003@)
  it('allows same reg when excludeId matches the profile owning that registration', () => {
    // Editing uuid-001 (D-EBPN) — should not flag itself as duplicate
    expect(hasDuplicateRegistration('D-EBPN', existingProfiles, 'uuid-001')).toBe(false)
  })

  // @UT-AC-STORE-015@ (FROM: @IMP-AC-STORE-003@)
  it('still detects duplicate when excludeId does not match the conflicting profile', () => {
    // uuid-002 has D-ECSM. We are checking D-ECSM for uuid-003 — should flag.
    expect(hasDuplicateRegistration('D-ECSM', existingProfiles, 'uuid-003')).toBe(true)
  })

  // @UT-AC-STORE-016@ (FROM: @IMP-AC-STORE-003@)
  it('returns false when profiles array is empty', () => {
    expect(hasDuplicateRegistration('D-EBPN', [])).toBe(false)
  })
})
