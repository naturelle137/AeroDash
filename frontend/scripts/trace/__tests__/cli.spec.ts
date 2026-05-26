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
})
