import { mkdtemp, mkdir, writeFile, rm } from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'

import { afterEach, beforeEach, describe, expect, it } from 'vitest'

import { indexById, scanAll, scanType } from '../lib/parser.mjs'

let sandbox: string

beforeEach(async () => {
  sandbox = await mkdtemp(path.join(os.tmpdir(), 'trace-parser-'))
})

afterEach(async () => {
  await rm(sandbox, { recursive: true, force: true })
})

async function writeFileEnsuring(rel: string, contents: string): Promise<void> {
  const abs = path.join(sandbox, rel)
  await mkdir(path.dirname(abs), { recursive: true })
  await writeFile(abs, contents)
}

describe('parser', () => {
  it('extracts IMP tags from frontend/src/**/*.ts (excluding *.spec.ts)', async () => {
    await writeFileEnsuring(
      'frontend/src/modules/mass-balance/store.ts',
      [
        '// @IMP-MB-STORE-001@ (FROM: @REQ-MB-001@)',
        'export function massBalanceStore() {}',
      ].join('\n'),
    )
    // This spec file should be ignored by the IMP scan.
    await writeFileEnsuring(
      'frontend/src/modules/mass-balance/store.spec.ts',
      ['// @UT-MB-STORE-001@ (FROM: @IMP-MB-STORE-001@)', 'describe(() => {})'].join('\n'),
    )

    const impOccurrences = await scanType(sandbox, 'IMP')
    expect(impOccurrences).toHaveLength(1)
    expect(impOccurrences[0].id).toBe('@IMP-MB-STORE-001@')
    expect(impOccurrences[0].segments).toEqual(['MB', 'STORE'])
    expect(impOccurrences[0].fromTags).toEqual(['@REQ-MB-001@'])

    const utOccurrences = await scanType(sandbox, 'UT')
    expect(utOccurrences).toHaveLength(1)
    expect(utOccurrences[0].id).toBe('@UT-MB-STORE-001@')
  })

  it('extracts REQ tags from Markdown comment lines only', async () => {
    await writeFileEnsuring(
      'docs/requirements/mass_balance.md',
      [
        '<!-- @REQ-MB-001@ -->',
        '### REQ-MB-001',
        '',
        // The bare-text mention below must NOT match because comment lines
        // are required by the scan config.
        'Some prose mentioning @REQ-MB-002@ that should be ignored.',
      ].join('\n'),
    )

    const occurrences = await scanType(sandbox, 'REQ')
    expect(occurrences.map((o) => o.id)).toEqual(['@REQ-MB-001@'])
  })

  it('extracts E2E tags and TECHNICAL marker from .feature files', async () => {
    await writeFileEnsuring(
      'frontend/tests/e2e/features/phase-d-system-pwa/smoke.feature',
      [
        '# @E2E-D-001@ (TECHNICAL)',
        'Feature: Boot',
        '  Scenario: app starts',
      ].join('\n'),
    )
    const occurrences = await scanType(sandbox, 'E2E')
    expect(occurrences).toHaveLength(1)
    expect(occurrences[0]).toMatchObject({
      id: '@E2E-D-001@',
      segments: ['D'],
      technical: true,
      fromTags: [],
    })
  })

  it('does not confuse @REQ-MB-001@ with the REQ regex inside @IMP- tags', async () => {
    await writeFileEnsuring(
      'frontend/src/modules/mass-balance/store.ts',
      ['// @IMP-MB-CORE-001@ (FROM: @REQ-MB-001@)', 'export function x() {}'].join('\n'),
    )
    await writeFileEnsuring(
      'docs/requirements/mass_balance.md',
      ['<!-- @REQ-MB-001@ -->', '### REQ-MB-001'].join('\n'),
    )

    const reqs = await scanType(sandbox, 'REQ')
    const imps = await scanType(sandbox, 'IMP')
    expect(reqs).toHaveLength(1)
    expect(imps).toHaveLength(1)
    expect(reqs[0].id).toBe('@REQ-MB-001@')
    expect(imps[0].id).toBe('@IMP-MB-CORE-001@')
  })

  it('scanAll returns the combined byType index', async () => {
    await writeFileEnsuring(
      'docs/requirements/mass_balance.md',
      ['<!-- @REQ-MB-001@ -->'].join('\n'),
    )
    await writeFileEnsuring(
      'frontend/src/modules/mass-balance/store.ts',
      ['// @IMP-MB-STORE-001@ (FROM: @REQ-MB-001@)', 'export function x() {}'].join('\n'),
    )

    const result = await scanAll(sandbox)
    expect(result.byType.REQ).toHaveLength(1)
    expect(result.byType.IMP).toHaveLength(1)
    expect(result.occurrences).toHaveLength(2)
  })

  it('extracts IMP tags from .vue files (both <template> HTML comments and <script> //)', async () => {
    // Regression for B1: IMP tags inside Vue single-file components were
    // invisible to the scanner, so `sync --apply` would silently delete
    // their registry entries.
    await writeFileEnsuring(
      'frontend/src/modules/aircraft/views/FleetView.vue',
      [
        '<template>',
        '  <!-- @IMP-AC-VIEW-001@ (FROM: @REQ-AC-001@) -->',
        '  <section />',
        '</template>',
        '',
        '<script setup lang="ts">',
        '// @IMP-AC-VIEW-002@ (FROM: @REQ-AC-001@)',
        'const x = 1',
        '</script>',
      ].join('\n'),
    )

    const occurrences = await scanType(sandbox, 'IMP')
    const ids = occurrences.map((o) => o.id).sort()
    expect(ids).toEqual(['@IMP-AC-VIEW-001@', '@IMP-AC-VIEW-002@'])
    const fromTagsByid = new Map(occurrences.map((o) => [o.id, o.fromTags]))
    expect(fromTagsByid.get('@IMP-AC-VIEW-001@')).toEqual(['@REQ-AC-001@'])
    expect(fromTagsByid.get('@IMP-AC-VIEW-002@')).toEqual(['@REQ-AC-001@'])
  })

  it('indexById flags multiply-declared tags', async () => {
    const occurrences = [
      {
        id: '@IMP-MB-CORE-001@',
        type: 'IMP' as const,
        segments: ['MB', 'CORE'],
        number: 1,
        file: 'a.ts',
        line: 1,
        fromTags: [],
        technical: false,
      },
      {
        id: '@IMP-MB-CORE-001@',
        type: 'IMP' as const,
        segments: ['MB', 'CORE'],
        number: 1,
        file: 'b.ts',
        line: 5,
        fromTags: [],
        technical: false,
      },
    ]
    const index = indexById(occurrences)
    expect(index.get('@IMP-MB-CORE-001@')).toHaveLength(2)
  })
})
