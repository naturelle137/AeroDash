import { mkdtemp, mkdir, writeFile, rm } from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'

import { afterEach, beforeEach, describe, expect, it } from 'vitest'

import { extractMarkdownTitle, indexById, scanAll, scanType } from '../lib/parser.mjs'

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

  // Issue #264 — REQ and UJ registries depend on a human-readable title
  // harvested from the markdown heading that follows each tag comment.
  it('harvests the heading title for a REQ tag', async () => {
    await writeFileEnsuring(
      'docs/requirements/mass_balance.md',
      [
        '## Requirements',
        '',
        '<!-- @REQ-MB-001@ (FROM: @H-005@) -->',
        '',
        '### REQ-MB-001: Dynamic Envelope Updates',
        '',
        '**Requirement:** …',
      ].join('\n'),
    )

    const occurrences = await scanType(sandbox, 'REQ')
    expect(occurrences[0].title).toBe('Dynamic Envelope Updates')
  })

  it('harvests the heading title for a UJ tag wrapped in an anchor span', async () => {
    await writeFileEnsuring(
      'docs/journeys/01_fleet_management.md',
      [
        '<!-- @UJ-A-001@ (FROM: @REQ-AC-001@) -->',
        '',
        '## <a name="UJ-A-001"></a>UJ-A-001: The "Fleet Admin" Workflow (Complex Profile)',
        '',
        '**Persona:** Fleet Admin',
      ].join('\n'),
    )

    const occurrences = await scanType(sandbox, 'UJ')
    expect(occurrences[0].title).toBe('The "Fleet Admin" Workflow (Complex Profile)')
  })

  it('omits the title field when no heading follows the tag', async () => {
    await writeFileEnsuring(
      'docs/requirements/system.md',
      [
        '<!-- @REQ-SYS-001@ -->',
        '',
        'Not a heading line, just prose.',
      ].join('\n'),
    )

    const occurrences = await scanType(sandbox, 'REQ')
    expect(occurrences[0].title).toBeUndefined()
  })

  // Issue #264 — a REQ tag that appears inside a downstream
  // `(FROM: @REQ-XX@)` clause must be classified as a citation, not as
  // a competing declaration. Without this distinction the new
  // trace/requirements/ registry would churn on file-list mismatches
  // for every REQ that is cross-referenced from another REQ document.
  it('marks tags inside (FROM: …) as citations and bare tags as declarations', async () => {
    await writeFileEnsuring(
      'docs/requirements/detailed_aircraft_data.md',
      [
        '<!-- @REQ-AD-020@ -->',
        '### REQ-AD-020: Battery Pack Definition',
      ].join('\n'),
    )
    await writeFileEnsuring(
      'docs/requirements/fuel_endurance.md',
      [
        '<!-- @REQ-FE-006@ (FROM: @REQ-AD-020@) -->',
        '### REQ-FE-006: Electric Endurance',
      ].join('\n'),
    )

    const occurrences = await scanType(sandbox, 'REQ')
    const adDecl = occurrences.find((o) => o.id === '@REQ-AD-020@' && o.declared)
    const adCite = occurrences.find((o) => o.id === '@REQ-AD-020@' && !o.declared)
    const feDecl = occurrences.find((o) => o.id === '@REQ-FE-006@')
    expect(adDecl?.file).toBe('docs/requirements/detailed_aircraft_data.md')
    expect(adCite?.file).toBe('docs/requirements/fuel_endurance.md')
    expect(feDecl?.declared).toBe(true)
  })

  it('does not harvest titles for code-level tags (IMP/UT/IT/E2E)', async () => {
    await writeFileEnsuring(
      'frontend/src/core/logic/mass-balance.logic.ts',
      [
        '// @IMP-MB-CORE-001@ (FROM: @REQ-MB-001@)',
        'export function zeroFuelMass() {}',
      ].join('\n'),
    )
    const occurrences = await scanType(sandbox, 'IMP')
    expect(occurrences[0].title).toBeUndefined()
  })

  describe('extractMarkdownTitle', () => {
    it('strips heading markers, anchor spans, and ID prefix', () => {
      expect(extractMarkdownTitle('### REQ-MB-001: Dynamic Envelope Updates')).toBe('Dynamic Envelope Updates')
      expect(extractMarkdownTitle('## <a name="UJ-B-002"></a>UJ-B-002: The "Hybrid Engine" Performance Calculation')).toBe('The "Hybrid Engine" Performance Calculation')
    })

    it('returns empty when the line is not a heading', () => {
      expect(extractMarkdownTitle('  not a heading')).toBe('')
      expect(extractMarkdownTitle('')).toBe('')
    })

    it('handles a heading with no ID prefix (DES H1)', () => {
      expect(extractMarkdownTitle('# AeroDash Architecture - Aircraft Data Model')).toBe('AeroDash Architecture - Aircraft Data Model')
    })
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
