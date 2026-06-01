import { mkdtemp, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import path from 'node:path'

import { afterAll, beforeAll, describe, expect, it } from 'vitest'

import { diffAgainstBaseline, loadBaseline, projectFindings } from '../lib/baseline.mjs'

describe('comment-discipline / projectFindings', () => {
  it('reduces per-line findings into stable (file, match, count) tuples', () => {
    const out = projectFindings([
      { file: 'a.ts', line: 1, match: 'refs #1' },
      { file: 'a.ts', line: 5, match: 'refs #1' },
      { file: 'a.ts', line: 9, match: 'CS-001' },
      { file: 'b.ts', line: 2, match: 'refs #1' },
    ])
    expect(out).toEqual([
      { file: 'a.ts', match: 'CS-001', count: 1 },
      { file: 'a.ts', match: 'refs #1', count: 2 },
      { file: 'b.ts', match: 'refs #1', count: 1 },
    ])
  })
})

describe('comment-discipline / loadBaseline', () => {
  let dir: string

  beforeAll(async () => {
    dir = await mkdtemp(path.join(tmpdir(), 'comment-discipline-baseline-'))
  })

  afterAll(async () => {
    await rm(dir, { recursive: true, force: true })
  })

  it('returns an empty baseline when the file is absent', async () => {
    const result = await loadBaseline(path.join(dir, 'missing.json'))
    expect(result).toEqual({ findings: [] })
  })

  it('parses a well-formed baseline file', async () => {
    const file = path.join(dir, 'baseline.json')
    await writeFile(file, JSON.stringify({ findings: [{ file: 'a.ts', match: 'refs #1', count: 2 }] }))
    const result = await loadBaseline(file)
    expect(result.findings).toEqual([{ file: 'a.ts', match: 'refs #1', count: 2 }])
  })

  it('throws on a malformed baseline file (missing findings array)', async () => {
    const file = path.join(dir, 'bad.json')
    await writeFile(file, JSON.stringify({}))
    await expect(loadBaseline(file)).rejects.toThrow(/findings/)
  })
})

describe('comment-discipline / diffAgainstBaseline', () => {
  it('returns no findings when current is fully grandfathered', () => {
    const raw = [
      { file: 'a.ts', line: 1, match: 'refs #1' },
      { file: 'a.ts', line: 5, match: 'refs #1' },
    ]
    const current = projectFindings(raw)
    const baseline = { findings: [{ file: 'a.ts', match: 'refs #1', count: 2 }] }
    expect(diffAgainstBaseline(current, baseline, raw)).toEqual([])
  })

  it('surfaces only the excess count beyond the baseline', () => {
    const raw = [
      { file: 'a.ts', line: 1, match: 'refs #1' },
      { file: 'a.ts', line: 5, match: 'refs #1' },
      { file: 'a.ts', line: 9, match: 'refs #1' },
    ]
    const current = projectFindings(raw)
    const baseline = { findings: [{ file: 'a.ts', match: 'refs #1', count: 2 }] }
    const out = diffAgainstBaseline(current, baseline, raw)
    expect(out).toHaveLength(1)
    expect(out[0]).toMatchObject({ file: 'a.ts', match: 'refs #1' })
  })

  it('treats a brand-new (file, match) pair as fully new', () => {
    const raw = [{ file: 'newfile.ts', line: 12, match: 'CS-099' }]
    const current = projectFindings(raw)
    const out = diffAgainstBaseline(current, { findings: [] }, raw)
    expect(out).toEqual([{ file: 'newfile.ts', line: 12, match: 'CS-099' }])
  })

  it('does not regress when the current count drops below the baseline', () => {
    const raw = [{ file: 'a.ts', line: 1, match: 'refs #1' }]
    const current = projectFindings(raw)
    const baseline = { findings: [{ file: 'a.ts', match: 'refs #1', count: 5 }] }
    expect(diffAgainstBaseline(current, baseline, raw)).toEqual([])
  })
})
