import { mkdtemp, mkdir, readFile, writeFile, rm } from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'

import { afterEach, beforeEach, describe, expect, it } from 'vitest'

import { parseArgv, run } from '../index.mjs'
import { runResolve } from '../commands/resolve.mjs'
import { runTag } from '../commands/tag.mjs'
import { runSync } from '../commands/sync.mjs'
import { runCheck } from '../commands/check.mjs'

let sandbox: string

beforeEach(async () => {
  sandbox = await mkdtemp(path.join(os.tmpdir(), 'trace-cli-'))
})

afterEach(async () => {
  await rm(sandbox, { recursive: true, force: true })
})

async function writeFileEnsuring(rel: string, contents: string): Promise<void> {
  const abs = path.join(sandbox, rel)
  await mkdir(path.dirname(abs), { recursive: true })
  await writeFile(abs, contents)
}

describe('parseArgv', () => {
  it('separates positionals from --flag value pairs', () => {
    const { positionals, flags } = parseArgv(['tag', 'IMP', '--file', 'src/x.ts', '--from', 'REQ-MB-001'])
    expect(positionals).toEqual(['tag', 'IMP'])
    expect(flags).toEqual({ file: 'src/x.ts', from: 'REQ-MB-001' })
  })

  it('understands --flag=value', () => {
    const { flags } = parseArgv(['--module=MB', '--layer=CORE'])
    expect(flags).toEqual({ module: 'MB', layer: 'CORE' })
  })

  it('treats trailing --flag as boolean', () => {
    const { flags } = parseArgv(['--apply'])
    expect(flags).toEqual({ apply: true })
  })
})

describe('runTag', () => {
  it('inserts the next sequential IMP tag inferred from the file path', async () => {
    const filePath = 'frontend/src/modules/mass-balance/views/MbView.ts'
    await writeFileEnsuring(filePath, 'export const x = 1\n')

    const result = await runTag({
      repoRoot: sandbox,
      type: 'IMP',
      file: filePath,
      fromTags: ['@REQ-MB-001@'],
      lineIndex: 1,
    })
    expect(result.tag).toBe('@IMP-MB-VIEW-001@')

    const after = await readFile(path.join(sandbox, filePath), 'utf8')
    expect(after.startsWith('// @IMP-MB-VIEW-001@ (FROM: @REQ-MB-001@)\n')).toBe(true)
  })

  it('computes the next id from existing scan when one tag already exists', async () => {
    const a = 'frontend/src/modules/mass-balance/views/A.ts'
    const b = 'frontend/src/modules/mass-balance/views/B.ts'
    await writeFileEnsuring(a, '// @IMP-MB-VIEW-001@ (FROM: @REQ-MB-001@)\nexport const a = 1\n')
    await writeFileEnsuring(b, 'export const b = 1\n')

    const result = await runTag({
      repoRoot: sandbox,
      type: 'IMP',
      file: b,
      fromTags: ['@REQ-MB-001@'],
      lineIndex: 1,
    })
    expect(result.tag).toBe('@IMP-MB-VIEW-002@')
  })

  it('warns when a same-(type, segments) tag already lives in the target file', async () => {
    // m2 heads-up: a developer running `trace tag` twice in the same file
    // gets a fresh `…-NNN+1` id by design (multiple distinct artifacts per
    // file are legal), but the CLI surfaces the existing sibling tag so an
    // accidental double-invocation is visible.
    const filePath = 'frontend/src/modules/mass-balance/views/MbView.ts'
    await writeFileEnsuring(filePath, '// @IMP-MB-VIEW-001@ (FROM: @REQ-MB-001@)\nexport const x = 1\n')

    const messages: string[] = []
    const result = await runTag({
      repoRoot: sandbox,
      type: 'IMP',
      file: filePath,
      fromTags: ['@REQ-MB-001@'],
      log: (m) => messages.push(m),
    })
    expect(result.tag).toBe('@IMP-MB-VIEW-002@')
    expect(messages.join('\n')).toMatch(/same \(type, segments\) is already present/i)
  })
})

describe('runResolve', () => {
  it('replaces @TYPE@ placeholders with generated ids', async () => {
    const filePath = 'frontend/src/modules/performance/core/calc.ts'
    await writeFileEnsuring(filePath, [
      '// @IMP@ (FROM: @REQ-PF-001@)',
      'export function calcA() {}',
      '// @IMP@ (FROM: @REQ-PF-001@)',
      'export function calcB() {}',
    ].join('\n'))

    const summary = await runResolve({ repoRoot: sandbox, files: [filePath] })
    expect(summary.exitCode).toBe(0)

    const after = await readFile(path.join(sandbox, filePath), 'utf8')
    expect(after).toContain('// @IMP-PF-CORE-001@ (FROM: @REQ-PF-001@)')
    expect(after).toContain('// @IMP-PF-CORE-002@ (FROM: @REQ-PF-001@)')
  })

  it('reports no-op when there are no placeholders', async () => {
    const filePath = 'frontend/src/modules/performance/core/calc.ts'
    await writeFileEnsuring(filePath, '// @IMP-PF-CORE-001@ (FROM: @REQ-PF-001@)\n')
    const messages: string[] = []
    await runResolve({ repoRoot: sandbox, files: [filePath], log: (m) => messages.push(m) })
    expect(messages.join('\n')).toContain('no @TYPE@ placeholder')
  })

  it('infers per-placeholder segments in mixed-type files (REQ + IMP)', async () => {
    // Regression for M1: previously runResolve sampled the first @TYPE@
    // it found, inferred segments for that type, then applied the same
    // segments to every other placeholder — emitting structurally invalid
    // ids that the next scan could not see.
    const reqPath = 'docs/requirements/mass_balance.md'
    await writeFileEnsuring(reqPath, ['<!-- @REQ@ -->', '### REQ-MB — Title'].join('\n'))
    const impPath = 'frontend/src/modules/mass-balance/core/calc.ts'
    await writeFileEnsuring(impPath, [
      '// @IMP@ (FROM: @REQ-MB-001@)',
      'export function calc() {}',
    ].join('\n'))

    const summary = await runResolve({ repoRoot: sandbox, files: [reqPath, impPath] })
    expect(summary.exitCode).toBe(0)

    const reqAfter = await readFile(path.join(sandbox, reqPath), 'utf8')
    const impAfter = await readFile(path.join(sandbox, impPath), 'utf8')
    expect(reqAfter).toContain('<!-- @REQ-MB-001@ -->')
    expect(impAfter).toContain('// @IMP-MB-CORE-001@ (FROM: @REQ-MB-001@)')
  })
})

describe('runSync', () => {
  it('adds missing entries when source declares new tags', async () => {
    await writeFileEnsuring(
      'frontend/src/modules/performance/core/calc.ts',
      '// @IMP-PF-CORE-001@ (FROM: @REQ-PF-001@)\nexport const a = 1\n',
    )

    const dry = await runSync({ repoRoot: sandbox })
    expect(dry.report.IMP.added).toEqual(['IMP-PF-CORE-001'])
    // Without --apply the registry must not be created on disk.

    const applied = await runSync({ repoRoot: sandbox, apply: true })
    expect(applied.report.IMP.added).toEqual(['IMP-PF-CORE-001'])

    const written = await readFile(
      path.join(sandbox, 'trace/implementation/pf.yaml'),
      'utf8',
    )
    expect(written).toContain('IMP-PF-CORE-001')
    expect(written).toContain('frontend/src/modules/performance/core/calc.ts')
  })

  it('routes new E2E entries into an existing curated phase file rather than forking a new <phase>.yaml', async () => {
    // Regression for M2: previously every new @E2E-A-NNN@ landed in
    // `trace/e2e/a.yaml`, splitting Phase A across `a.yaml` and the
    // curated `fleet-management.yaml`. We expect the new entry to land
    // in the existing curated file.
    await writeFileEnsuring(
      'trace/e2e/fleet-management.yaml',
      [
        'Fleet management (Phase A)',
        '  E2E-A-001',
        '    title: Existing curated scenario',
        '',
      ].join('\n'),
    )
    await writeFileEnsuring(
      'frontend/tests/e2e/features/phase-a-fleet-management/existing.feature',
      [
        '# @E2E-A-001@ (TECHNICAL)',
        'Feature: Existing',
        '  Scenario: app starts',
      ].join('\n'),
    )
    await writeFileEnsuring(
      'frontend/tests/e2e/features/phase-a-fleet-management/smoke.feature',
      [
        '# @E2E-A-002@ (TECHNICAL)',
        'Feature: Boot',
        '  Scenario: app starts',
      ].join('\n'),
    )

    const applied = await runSync({ repoRoot: sandbox, apply: true, types: ['E2E'] })
    expect(applied.report.E2E.added).toEqual(['E2E-A-002'])
    expect(applied.report.E2E.files).toContain('trace/e2e/fleet-management.yaml')
    expect(applied.report.E2E.files).not.toContain('trace/e2e/a.yaml')

    const written = await readFile(path.join(sandbox, 'trace/e2e/fleet-management.yaml'), 'utf8')
    expect(written).toContain('E2E-A-001')
    expect(written).toContain('E2E-A-002')
  })

  it('preserves registry entries whose files all point to out-of-scope extensions', async () => {
    // Regression for m5: an entry whose file extension isn't scanned by
    // any configured scanner (a `.json` fixture, a future language) must
    // not be silently treated as stale — that's a scanner blind spot,
    // not a deleted artifact.
    await writeFileEnsuring(
      'trace/implementation/sys.yaml',
      [
        'SYS — Out-of-scope artifact',
        '  IMP-SYS-CORE-999',
        '    title: Schema fixture',
        '    files:',
        '      - frontend/src/core/fixtures/aircraft.json',
        '',
      ].join('\n'),
    )

    const applied = await runSync({ repoRoot: sandbox, apply: true, types: ['IMP'] })
    expect(applied.report.IMP.removed).not.toContain('IMP-SYS-CORE-999')
    expect(applied.report.IMP.preserved).toContain('IMP-SYS-CORE-999')
  })

  it('rejects unknown --types and exits non-zero', async () => {
    const messages: string[] = []
    const result = await runSync({
      repoRoot: sandbox,
      apply: false,
      types: ['NOPE'] as unknown as Array<'IMP'>,
      log: (m) => messages.push(m),
    })
    expect(result.exitCode).toBe(1)
    expect(messages.join('\n')).toMatch(/unknown type/i)
  })

  it('removes stale registry entries (without status: deleted) when source no longer declares them', async () => {
    await writeFileEnsuring(
      'trace/implementation/pf.yaml',
      [
        'PF Core',
        '  IMP-PF-CORE-999',
        '    title: Stale entry',
        '    req:',
        '      - REQ-PF-001',
        '    files:',
        '      - frontend/src/modules/performance/old.ts',
        '',
      ].join('\n'),
    )

    const applied = await runSync({ repoRoot: sandbox, apply: true })
    expect(applied.report.IMP.removed).toEqual(['IMP-PF-CORE-999'])
  })
})

describe('runCheck', () => {
  it('reports orphaned IMPs and dangling FROM references', async () => {
    await writeFileEnsuring(
      'frontend/src/modules/performance/core/calc.ts',
      [
        '// @IMP-PF-CORE-001@',
        'export const a = 1',
        '// @IMP-PF-CORE-002@ (FROM: @REQ-PF-999@)',
        'export const b = 1',
      ].join('\n'),
    )

    const { exitCode, report } = await runCheck({ repoRoot: sandbox })
    expect(exitCode).toBe(1)
    expect(report.orphanImplementations).toContain('@IMP-PF-CORE-001@')
    expect(report.danglingFromRefs.map((d) => d.from)).toContain('@REQ-PF-999@')
  })

  it('warn-only mode never returns a non-zero exit code', async () => {
    await writeFileEnsuring(
      'frontend/src/modules/performance/core/calc.ts',
      '// @IMP-PF-CORE-001@\nexport const a = 1\n',
    )
    const { exitCode } = await runCheck({ repoRoot: sandbox, warnOnly: true })
    expect(exitCode).toBe(0)
  })

  it('treats same-file tag repetition as a single declaration (header manifest + inline tags)', async () => {
    // Regression for issue #265: the manifest block at the top of a spec file
    // PLUS inline tags above each `it(...)` is an accepted documentation
    // convention, not a duplicate. Cross-file repeats remain real defects.
    await writeFileEnsuring(
      'frontend/src/__tests__/repeats.spec.ts',
      [
        '// @UT-SYS-APP-001@ (FROM: @IMP-SYS-SHARED-001@)',
        '// @UT-SYS-APP-002@ (FROM: @IMP-SYS-SHARED-001@)',
        '// @UT-SYS-APP-001@ (FROM: @IMP-SYS-SHARED-001@)',
        'it(\'one\', () => {})',
        '// @UT-SYS-APP-002@ (FROM: @IMP-SYS-SHARED-001@)',
        'it(\'two\', () => {})',
      ].join('\n'),
    )
    await writeFileEnsuring(
      'frontend/src/shared/components/AppShell.vue',
      '// @IMP-SYS-SHARED-001@ (FROM: @REQ-SYS-001@)\n',
    )
    await writeFileEnsuring(
      'docs/requirements/system.md',
      '<!-- @REQ-SYS-001@ -->\n### REQ-SYS-001 — App shell\n',
    )

    const { report } = await runCheck({ repoRoot: sandbox })
    expect(report.duplicates.map((d) => d.id)).not.toContain('@UT-SYS-APP-001@')
    expect(report.duplicates.map((d) => d.id)).not.toContain('@UT-SYS-APP-002@')
  })

  it('still flags cross-file duplicate declarations', async () => {
    await writeFileEnsuring(
      'frontend/src/modules/a/__tests__/a.spec.ts',
      '// @UT-MB-CORE-001@ (FROM: @IMP-MB-CORE-001@)\nit(\'a\', () => {})\n',
    )
    await writeFileEnsuring(
      'frontend/src/modules/b/__tests__/b.spec.ts',
      '// @UT-MB-CORE-001@ (FROM: @IMP-MB-CORE-001@)\nit(\'b\', () => {})\n',
    )
    await writeFileEnsuring(
      'frontend/src/core/calc.ts',
      '// @IMP-MB-CORE-001@ (FROM: @REQ-MB-001@)\nexport const x = 1\n',
    )
    await writeFileEnsuring(
      'docs/requirements/mb.md',
      '<!-- @REQ-MB-001@ -->\n### REQ-MB-001 — Title\n',
    )

    const { report } = await runCheck({ repoRoot: sandbox })
    expect(report.duplicates.map((d) => d.id)).toContain('@UT-MB-CORE-001@')
  })
})

describe('runCheck --structural-only', () => {
  it('passes when only orphan/coverage gaps exist (orphans are warn-only)', async () => {
    await writeFileEnsuring(
      'frontend/src/modules/performance/core/calc.ts',
      '// @IMP-PF-CORE-001@\nexport const a = 1\n',
    )
    // Populate the IMP registry so the gate sees an orphan-without-drift state.
    await runSync({ repoRoot: sandbox, apply: true })

    const { exitCode } = await runCheck({ repoRoot: sandbox, structuralOnly: true })
    expect(exitCode).toBe(0)
  })

  it('fails on a fresh dangling FROM reference with no baseline', async () => {
    await writeFileEnsuring(
      'frontend/src/modules/performance/core/calc.ts',
      '// @IMP-PF-CORE-001@ (FROM: @REQ-PF-999@)\nexport const a = 1\n',
    )
    await runSync({ repoRoot: sandbox, apply: true })

    const { exitCode, structural } = await runCheck({ repoRoot: sandbox, structuralOnly: true })
    expect(exitCode).toBe(1)
    expect(structural?.newViolations.danglingFromRefs).toContain('@REQ-PF-999@')
  })

  it('grandfathers pre-existing violations via the baseline file', async () => {
    await writeFileEnsuring(
      'frontend/src/modules/performance/core/calc.ts',
      '// @IMP-PF-CORE-001@ (FROM: @REQ-PF-999@)\nexport const a = 1\n',
    )
    await runSync({ repoRoot: sandbox, apply: true })

    const baselinePath = path.join(sandbox, 'baseline.json')
    await writeFile(
      baselinePath,
      JSON.stringify({ duplicates: [], danglingFromRefs: ['@REQ-PF-999@'], registryDrift: {} }),
    )
    const { exitCode } = await runCheck({
      repoRoot: sandbox,
      structuralOnly: true,
      baselinePath,
    })
    expect(exitCode).toBe(0)
  })

  it('fires when a NEW violation appears beyond the baseline', async () => {
    await writeFileEnsuring(
      'frontend/src/modules/performance/core/calc.ts',
      '// @IMP-PF-CORE-001@ (FROM: @REQ-PF-999@)\nexport const a = 1\n',
    )
    await writeFileEnsuring(
      'frontend/src/modules/performance/core/calc2.ts',
      '// @IMP-PF-CORE-002@ (FROM: @REQ-PF-888@)\nexport const b = 1\n',
    )
    await runSync({ repoRoot: sandbox, apply: true })

    const baselinePath = path.join(sandbox, 'baseline.json')
    await writeFile(
      baselinePath,
      JSON.stringify({ duplicates: [], danglingFromRefs: ['@REQ-PF-999@'], registryDrift: {} }),
    )
    const { exitCode, structural } = await runCheck({
      repoRoot: sandbox,
      structuralOnly: true,
      baselinePath,
    })
    expect(exitCode).toBe(1)
    expect(structural?.newViolations.danglingFromRefs).toContain('@REQ-PF-888@')
    expect(structural?.newViolations.danglingFromRefs).not.toContain('@REQ-PF-999@')
  })
})

describe('run dispatcher', () => {
  it('exits 0 for help and prints usage', async () => {
    const lines: string[] = []
    const code = await run(['help'], { repoRoot: sandbox, log: (m) => lines.push(m) })
    expect(code).toBe(0)
    expect(lines.join('\n')).toContain('trace — AeroDash traceability CLI')
  })

  it('returns the parse JSON via the write callback', async () => {
    await writeFileEnsuring(
      'frontend/src/modules/performance/core/calc.ts',
      '// @IMP-PF-CORE-001@ (FROM: @REQ-PF-001@)\n',
    )
    let written = ''
    const code = await run(['parse'], { repoRoot: sandbox, log: () => {}, write: (m) => { written += m } })
    expect(code).toBe(0)
    expect(written).toContain('"@IMP-PF-CORE-001@"')
  })

  // Defensive m2 — `--module --layer CORE` would otherwise turn
  // flags.module into the literal segment 'TRUE' and surface as the
  // confusing "Unknown module: TRUE".
  it('rejects boolean values for --module / --layer / --phase / --file / --line', async () => {
    await expect(
      run(['tag', 'IMP', '--module', '--layer', 'CORE', '--file', 'frontend/src/x.ts'],
         { repoRoot: sandbox }),
    ).rejects.toThrow(/--module requires a value/)
  })

  // Defensive m3 — `--line foo` previously evaluated to NaN → falsy →
  // silently appended at EOF instead of failing fast.
  it('rejects non-integer --line values', async () => {
    await writeFileEnsuring(
      'frontend/src/modules/mass-balance/views/MbView.ts',
      'export const x = 1\n',
    )
    await expect(
      run(['tag', 'IMP', '--file', 'frontend/src/modules/mass-balance/views/MbView.ts',
          '--line', 'foo'],
         { repoRoot: sandbox }),
    ).rejects.toThrow(/--line must be a positive integer/)
  })
})
