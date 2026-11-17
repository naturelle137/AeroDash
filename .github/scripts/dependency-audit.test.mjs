import assert from 'node:assert/strict'
import { readFileSync, mkdtempSync, writeFileSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { spawnSync } from 'node:child_process'
import test from 'node:test'
import { evaluateAudit } from './dependency-audit.mjs'

// Captured pnpm 10.32.1 output from the unchanged product lockfile.
const fixture = JSON.parse(readFileSync(new URL('./fixtures/pnpm-audit-picomatch.json', import.meta.url)))
const beforeExpiry = Date.parse('2026-11-23T23:59:59.999Z')
const expiry = Date.parse('2026-11-24T00:00:00Z')
const result = (report, status = 1) => ({ status, stdout: JSON.stringify(report) })
const evaluate = (report, level = 'high', now = beforeExpiry) =>
  evaluateAudit(result(report), level, now)
const advisory = (report) => Object.values(report.advisories)[0]

for (const level of ['high', 'moderate']) {
  test(`${level}: only the captured advisory is temporarily excepted`, () => {
    assert.deepEqual(evaluate(fixture, level), {
      blocked: [], excepted: ['GHSA-fc5q-39xc-vjpf'],
    })
  })
  for (const now of [expiry, expiry + 1]) {
    test(`${level}: exception expires at the exact UTC boundary ${now}`, () => {
      assert.deepEqual(evaluate(fixture, level, now).blocked, ['GHSA-fc5q-39xc-vjpf'])
    })
  }
}

test('clean scan passes even after expiry', () => {
  const report = structuredClone(fixture)
  report.advisories = {}
  report.metadata.vulnerabilities.high = 0
  assert.deepEqual(evaluateAudit(result(report, 0), 'high', expiry), { blocked: [], excepted: [] })
})

for (const severity of ['moderate', 'high', 'critical']) {
  test(`unrelated ${severity} advisory remains blocking at the existing threshold`, () => {
    const report = structuredClone(fixture)
    const unrelated = structuredClone(advisory(report))
    unrelated.github_advisory_id = 'GHSA-unrelated'
    unrelated.module_name = 'other-package'
    unrelated.severity = severity
    unrelated.findings = [{ version: '1.0.0', paths: ['.>other-package'] }]
    report.advisories.other = unrelated
    report.metadata.vulnerabilities[severity] += 1
    assert.deepEqual(evaluate(report, 'moderate').blocked, ['GHSA-unrelated'])
    assert.deepEqual(evaluate(report, 'high').blocked, severity === 'moderate' ? [] : ['GHSA-unrelated'])
  })
}

for (const [key, value] of [
  ['github_advisory_id', 'GHSA-another-picomatch'],
  ['module_name', 'another-package'],
  ['patched_versions', '>=4.0.8'],
  ['severity', 'critical'],
]) {
  test(`exception does not cover changed ${key}`, () => {
    const report = structuredClone(fixture)
    const entry = advisory(report)
    if (key === 'severity') {
      report.metadata.vulnerabilities.high = 0
      report.metadata.vulnerabilities.critical = 2
    }
    entry[key] = value
    assert.equal(evaluate(report).blocked.length, 1)
  })
}

test('dependency version changes require reassessment', () => {
  const report = structuredClone(fixture)
  advisory(report).findings[0].version = '4.0.8'
  assert.equal(evaluate(report).blocked.length, 1)
})

for (const mutate of [
  (report) => { report.error = { code: 'ERR_PNPM_AUDIT_BAD_RESPONSE' } },
  (report) => { delete report.advisories },
  (report) => { delete report.metadata },
  (report) => { report.metadata.vulnerabilities.high = 3 },
  (report) => { report.advisories = {} },
  (report) => { report.muted = ['GHSA-fc5q-39xc-vjpf'] },
  (report) => { delete advisory(report).findings },
  (report) => { advisory(report).findings[0].paths = [] },
  (report) => { advisory(report).severity = 'unknown' },
]) {
  test(`malformed/incomplete report fails: ${mutate.toString()}`, () => {
    const report = structuredClone(fixture)
    mutate(report)
    assert.throws(() => evaluate(report))
  })
}

for (const [index, scannerResult] of [
  { status: 0, stdout: JSON.stringify(fixture) },
  { status: 2, stdout: JSON.stringify(fixture) },
  { status: 1, stdout: '' },
  { status: 1, stdout: 'not JSON' },
  { status: 1, stdout: '{"error":{"code":"network"}}' },
  { status: null, signal: 'SIGTERM', stdout: JSON.stringify(fixture) },
  { status: null, error: new Error('ENOENT'), stdout: JSON.stringify(fixture) },
].entries()) {
  test(`scanner/parse failure is never an exception: ${index + 1}`, () => {
    assert.throws(() => evaluateAudit(scannerResult, 'high', beforeExpiry))
  })
}

test('unsupported policy inputs fail', () => {
  assert.throws(() => evaluate(fixture, 'low'))
  assert.throws(() => evaluate(fixture, 'high', NaN))
})

test('CLI propagates scanner and parse failures to a nonzero process exit', () => {
  const directory = mkdtempSync(join(tmpdir(), 'aerodash-audit-'))
  try {
    writeFileSync(join(directory, 'pnpm'), `#!/bin/sh\nprintf '%s' "$AUDIT_OUTPUT"\nexit "$AUDIT_STATUS"\n`, { mode: 0o755 })
    for (const [output, status] of [['invalid JSON', '1'], [JSON.stringify(fixture), '2'], ['{"error":"network"}', '1']]) {
      const child = spawnSync(process.execPath, [new URL('./dependency-audit.mjs', import.meta.url).pathname, 'high'], {
        encoding: 'utf8',
        env: { ...process.env, PATH: `${directory}:${process.env.PATH}`, AUDIT_OUTPUT: output, AUDIT_STATUS: status },
      })
      assert.equal(child.status, 1)
      assert.match(child.stderr, /Dependency audit failed:/)
    }
  } finally {
    rmSync(directory, { recursive: true, force: true })
  }
})

test('policy expiry matches the unchanged OSV entry', () => {
  const config = readFileSync(new URL('../../osv-scanner.toml', import.meta.url), 'utf8')
  assert.match(config, /id = "GHSA-fc5q-39xc-vjpf"\nignoreUntil = 2026-11-24T00:00:00Z/)
})
