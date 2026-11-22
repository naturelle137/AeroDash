import { describe, expect, it } from 'vitest'
import { releaseDateForVersion } from '../release-date'

describe('releaseDateForVersion', () => {
  const changelog = '## [Unreleased]\n\n## [1.2.3] - 2026-05-24\n'

  it('uses the date of the exact version', () => {
    expect(releaseDateForVersion(changelog, '1.2.3')).toBe('2026-05-24')
  })

  it('returns null for missing or invalid release metadata', () => {
    expect(releaseDateForVersion(changelog, '1.2.3-alpha')).toBeNull()
    expect(releaseDateForVersion('## [1.2.3] - 2026-02-30', '1.2.3')).toBeNull()
    expect(releaseDateForVersion('## [1.2.3] - ', '1.2.3')).toBeNull()
  })
})
