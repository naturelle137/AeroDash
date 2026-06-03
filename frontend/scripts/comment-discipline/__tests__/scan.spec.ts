import { describe, expect, it } from 'vitest'

import {
  detectForbiddenInComment,
  extractComments,
  scanSource,
  stripVueStyleBlocks,
} from '../lib/scan.mjs'

describe('comment-discipline / extractComments', () => {
  it('extracts a single-line comment with its source line number', () => {
    const out = extractComments('const a = 1\n// hello there\nconst b = 2\n')
    expect(out).toEqual([{ text: ' hello there', line: 2 }])
  })

  it('extracts a block comment spanning multiple lines', () => {
    const out = extractComments('line 1\n/* a\n b\n c */\nline 5\n')
    expect(out).toHaveLength(1)
    expect(out[0]).toMatchObject({ line: 2 })
    expect(out[0].text).toContain('a')
    expect(out[0].text).toContain('c')
  })

  it('extracts HTML comments', () => {
    const out = extractComments('<template>\n  <!-- pilot warning -->\n</template>\n')
    expect(out).toEqual([{ text: ' pilot warning ', line: 2 }])
  })

  it('does not treat `//` inside a double-quoted string as a comment', () => {
    const out = extractComments('const url = "https://example.com" // real comment\n')
    expect(out).toEqual([{ text: ' real comment', line: 1 }])
  })

  it('does not treat `//` inside a template literal as a comment', () => {
    const out = extractComments('const url = `https://example.com`\nconst x = 1\n')
    expect(out).toEqual([])
  })

  it('handles escaped quotes inside strings without leaking into a fake comment', () => {
    const out = extractComments('const s = "a \\"// not a comment" \nconst y = 1\n')
    expect(out).toEqual([])
  })
})

describe('comment-discipline / detectForbiddenInComment', () => {
  it('flags `refs #N`, case-insensitively', () => {
    expect(detectForbiddenInComment(' refs #270')).toEqual(['refs #270'])
    expect(detectForbiddenInComment(' Refs #270')).toEqual(['Refs #270'])
    expect(detectForbiddenInComment(' REFS #270')).toEqual(['REFS #270'])
  })

  it('flags `closes #N`, `fixes #N`, `resolves #N`', () => {
    expect(detectForbiddenInComment(' closes #1')).toEqual(['closes #1'])
    expect(detectForbiddenInComment(' fixes #2')).toEqual(['fixes #2'])
    expect(detectForbiddenInComment(' resolves #3')).toEqual(['resolves #3'])
  })

  it('flags `issue #N` and `issue-N`', () => {
    expect(detectForbiddenInComment('see issue #271')).toEqual(['issue #271'])
    expect(detectForbiddenInComment('on branch issue-271')).toEqual(['issue-271'])
  })

  it('flags audit-finding IDs CS-, DP-, TECH-, PR-, UX-', () => {
    expect(detectForbiddenInComment('see CS-007 and DP-008')).toEqual(['CS-007', 'DP-008'])
    expect(detectForbiddenInComment('TECH-001 / PR-005 / UX-001')).toEqual([
      'TECH-001',
      'PR-005',
      'UX-001',
    ])
  })

  it('does not flag shtracer tags (the permitted form)', () => {
    expect(detectForbiddenInComment('@REQ-SYS-006@')).toEqual([])
    expect(detectForbiddenInComment('@IMP-MB-CORE-014@ (FROM: @REQ-MB-005@)')).toEqual([])
    expect(detectForbiddenInComment('@DES-UX-013@')).toEqual([])
    expect(detectForbiddenInComment('@H-019@')).toEqual([])
  })

  it('does not flag plain prose without forbidden patterns', () => {
    expect(detectForbiddenInComment(' clamp lateral CG bounds when payload exceeds envelope')).toEqual([])
  })

  it('does not flag lower-case `ux-001` (audit IDs are upper-case)', () => {
    expect(detectForbiddenInComment(' ux-001 lower')).toEqual([])
  })

  it('does not flag two-digit audit-like tokens (e.g. CS-12)', () => {
    expect(detectForbiddenInComment(' CS-12 short')).toEqual([])
  })
})

describe('comment-discipline / stripVueStyleBlocks', () => {
  it('removes <style> bodies but preserves newline count', () => {
    const src = '<template>x</template>\n<style scoped>\n  color: #1d4ed8;\n  background: #212121;\n</style>\n'
    const out = stripVueStyleBlocks(src)
    expect(out).not.toContain('#1d4ed8')
    expect(out).not.toContain('#212121')
    expect((out.match(/\n/g) ?? []).length).toBe((src.match(/\n/g) ?? []).length)
  })
})

describe('comment-discipline / scanSource', () => {
  it('returns line + match for each forbidden reference in a TS file', () => {
    const src = ['const a = 1', '// refs #270, CS-007', 'const b = 2', '/* DP-004 */', ''].join('\n')
    expect(scanSource('frontend/src/example.ts', src)).toEqual([
      { file: 'frontend/src/example.ts', line: 2, match: 'refs #270' },
      { file: 'frontend/src/example.ts', line: 2, match: 'CS-007' },
      { file: 'frontend/src/example.ts', line: 4, match: 'DP-004' },
    ])
  })

  it('ignores CSS hex colours inside <style> blocks of a Vue file', () => {
    const src = [
      '<template>',
      '  <!-- pilot note: refs #999 -->',
      '</template>',
      '<style scoped>',
      '.x { color: #123; background: #1d4ed8; border: 1px solid #212121; }',
      '</style>',
      '',
    ].join('\n')
    const out = scanSource('frontend/src/Example.vue', src)
    expect(out.map((f) => f.match)).toEqual(['refs #999'])
  })

  it('returns no findings for a clean source file', () => {
    const src = ['// @IMP-MB-CORE-014@ (FROM: @REQ-MB-005@)', 'export const ok = 1', ''].join('\n')
    expect(scanSource('frontend/src/ok.ts', src)).toEqual([])
  })
})
