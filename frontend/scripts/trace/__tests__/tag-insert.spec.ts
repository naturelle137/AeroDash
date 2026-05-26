import { describe, expect, it } from 'vitest'

import { insertTagComment } from '../lib/tag-insert.mjs'

describe('insertTagComment', () => {
  it('inserts a TS comment before a function', () => {
    const text = 'export function processPayment() {}\n'
    const result = insertTagComment({
      fileText: text,
      filePath: 'frontend/src/modules/payments/process.ts',
      tag: '@IMP-PF-CORE-001@',
      fromTags: ['@REQ-PF-001@'],
      lineIndex: 1,
    })
    expect(result.text).toBe(
      '// @IMP-PF-CORE-001@ (FROM: @REQ-PF-001@)\nexport function processPayment() {}\n',
    )
    expect(result.alreadyPresent).toBe(false)
  })

  it('is idempotent when the tag is already present', () => {
    const text = '// @IMP-PF-CORE-001@ (FROM: @REQ-PF-001@)\nexport function x() {}\n'
    const result = insertTagComment({
      fileText: text,
      filePath: 'foo.ts',
      tag: '@IMP-PF-CORE-001@',
      fromTags: ['@REQ-PF-001@'],
      lineIndex: 2,
    })
    expect(result.text).toBe(text)
    expect(result.alreadyPresent).toBe(true)
  })

  it('appends at end of file when lineIndex is omitted', () => {
    const text = '# scenario: pilot flies'
    const result = insertTagComment({
      fileText: text,
      filePath: 'x.feature',
      tag: '@E2E-D-001@',
      technical: true,
    })
    expect(result.text).toBe('# scenario: pilot flies\n# @E2E-D-001@ (TECHNICAL)\n')
  })

  it('rejects an out-of-range line index', () => {
    expect(() =>
      insertTagComment({
        fileText: 'one\n',
        filePath: 'foo.ts',
        tag: '@IMP-MB-CORE-002@',
        lineIndex: 10,
      }),
    ).toThrow(/out of range/)
  })
})
