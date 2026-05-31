// @UT-SYS-SHARED-049@ (FROM: @IMP-UI-SHARED-009@)
import { describe, it, expect } from 'vitest'
import { buildContributionEnvironment } from '../contribution-environment'

describe('buildContributionEnvironment', () => {
  it('joins detected fields with newlines and labels each', () => {
    const out = buildContributionEnvironment({
      userAgent: 'Mozilla/5.0 (iPad)',
      viewportWidth: 1024,
      viewportHeight: 768,
      theme: 'dark',
      appVersion: '0.4.0-alpha',
    })
    expect(out).toBe(
      'User-Agent: Mozilla/5.0 (iPad)\nViewport: 1024 × 768\nTheme: dark\nAeroDash version: 0.4.0-alpha',
    )
  })

  it('omits missing pieces silently', () => {
    const out = buildContributionEnvironment({
      userAgent: 'UA',
      viewportWidth: null,
      viewportHeight: null,
      theme: null,
      appVersion: null,
    })
    expect(out).toBe('User-Agent: UA')
  })

  it('skips viewport when only one dimension is known', () => {
    const out = buildContributionEnvironment({
      userAgent: 'UA',
      viewportWidth: 1024,
      viewportHeight: null,
      theme: 'light',
      appVersion: null,
    })
    expect(out).toBe('User-Agent: UA\nTheme: light')
  })

  it('trims whitespace-only fields out', () => {
    const out = buildContributionEnvironment({
      userAgent: '   ',
      viewportWidth: 800,
      viewportHeight: 600,
      theme: null,
      appVersion: '   ',
    })
    expect(out).toBe('Viewport: 800 × 600')
  })
})
