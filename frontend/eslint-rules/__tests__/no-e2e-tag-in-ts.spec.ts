/**
 * Spec for the `aerodash/no-e2e-tag-in-ts` ESLint rule (issue #265).
 *
 * Drives the rule with ESLint's `RuleTester` (synthetic snippets) AND
 * with the real ESLint engine over the on-disk fixture so the DoD item
 * "@E2E-`-in-`.ts` lint rule fires on a fixture" is exercised end-to-end.
 */

import path from 'node:path'
import { fileURLToPath } from 'node:url'

import { describe, expect, it } from 'vitest'
import { Linter } from 'eslint'

import rule from '../no-e2e-tag-in-ts.js'

function lintSnippet(code: string) {
  const linter = new Linter()
  return linter.verify(code, {
    languageOptions: { ecmaVersion: 2022, sourceType: 'module' },
    plugins: { aerodash: { rules: { 'no-e2e-tag-in-ts': rule } } },
    rules: { 'aerodash/no-e2e-tag-in-ts': 'error' },
  })
}

describe('aerodash/no-e2e-tag-in-ts (synthetic)', () => {
  it.each([
    ['line comment with non-E2E tag', '// @IMP-PF-CORE-001@ — non-E2E tag\nexport const y = 1'],
    ['line comment with REQ id', '// REQ-MB-001 — fine\nexport const x = 1'],
    ['plain UT-id string', "export const id = 'IMP-MB-CORE-001'"],
    ['unit-test tag comment', '// @UT-MB-CORE-001@\nexport const z = 1'],
    // String/template literals carrying the tag pattern are inert data
    // (trace scanner only reads comments) — the rule deliberately
    // ignores them so trace-CLI tests can exercise the @E2E- regex.
    ['E2E pattern in string literal', "export const tag = '@E2E-A-007@'"],
    ['E2E pattern in template literal', 'export const tag = `@E2E-B-002@`'],
  ])('passes for %s', (_label, code) => {
    expect(lintSnippet(code)).toEqual([])
  })

  it('fires on E2E tag inside a line comment', () => {
    const messages = lintSnippet('// @E2E-A-001@\nexport const x = 1')
    expect(messages).toHaveLength(1)
    expect(messages[0]?.messageId).toBe('unexpectedInComment')
    expect(messages[0]?.message).toContain('@E2E-A-001@')
  })

  it('fires on E2E tag inside a block comment', () => {
    const messages = lintSnippet('/* @E2E-STRESS-042@ */\nexport const y = 1')
    expect(messages).toHaveLength(1)
    expect(messages[0]?.messageId).toBe('unexpectedInComment')
  })

  it('fires once per offending comment, even when multiple comments carry the pattern', () => {
    const messages = lintSnippet(
      '// @E2E-A-001@\n// @E2E-STRESS-042@\nexport const x = 1',
    )
    expect(messages).toHaveLength(2)
    expect(messages.every((m) => m.ruleId === 'aerodash/no-e2e-tag-in-ts')).toBe(true)
  })
})

describe('aerodash/no-e2e-tag-in-ts (real fixture)', () => {
  it('fires on `eslint-rules/__fixtures__/has-e2e-tag.ts`', async () => {
    const here = path.dirname(fileURLToPath(import.meta.url))
    const fixturePath = path.resolve(here, '..', '__fixtures__', 'has-e2e-tag.ts')

    const linter = new Linter()
    const { readFile } = await import('node:fs/promises')
    const source = await readFile(fixturePath, 'utf8')
    const results = linter.verify(source, {
      languageOptions: { ecmaVersion: 2022, sourceType: 'module' },
      plugins: { aerodash: { rules: { 'no-e2e-tag-in-ts': rule } } },
      rules: { 'aerodash/no-e2e-tag-in-ts': 'error' },
    })

    const ruleHits = results.filter((m) => m.ruleId === 'aerodash/no-e2e-tag-in-ts')
    expect(ruleHits.length).toBeGreaterThanOrEqual(2)
    const tags = ruleHits.map((m) => m.message)
    expect(tags.some((t) => t.includes('@E2E-A-001@'))).toBe(true)
    expect(tags.some((t) => t.includes('@E2E-STRESS-042@'))).toBe(true)
    // The string-literal carrier in the fixture is intentionally NOT
    // flagged — the rule only covers comments.
    expect(tags.some((t) => t.includes('@E2E-A-007@'))).toBe(false)
  })
})
