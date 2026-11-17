import { spawnSync } from 'node:child_process'
import { pathToFileURL } from 'node:url'

const severities = ['info', 'low', 'moderate', 'high', 'critical']
const advisoryId = 'GHSA-fc5q-39xc-vjpf'
const expiresAt = Date.parse('2026-11-24T00:00:00Z')

// Same temporary tooling-risk disposition as osv-scanner.toml; not a patch.
// HQ1866/project CTO and the weekly security rotation remove this exception
// with the OSV entry on supported complete upstream repair or expiry.
export function evaluateAudit(result, level, now = Date.now()) {
  if (!['high', 'moderate'].includes(level) || !Number.isFinite(now)) {
    throw new Error('Invalid audit policy input')
  }
  if (result.error || result.signal || ![0, 1].includes(result.status)) {
    throw new Error('Dependency scanner failed')
  }
  const report = JSON.parse(result.stdout)
  const object = (value) => value !== null && typeof value === 'object' && !Array.isArray(value)
  if (!object(report) || report.error || !object(report.advisories) ||
      !object(report.metadata?.vulnerabilities) ||
      !Array.isArray(report.actions) || report.actions.length !== 0 ||
      !Array.isArray(report.muted) || report.muted.length !== 0) {
    throw new Error('Unsupported audit report or scanner error')
  }
  const counts = Object.fromEntries(severities.map((severity) => [severity, 0]))
  const blocked = []
  const excepted = []
  for (const advisory of Object.values(report.advisories)) {
    if (!object(advisory) || !severities.includes(advisory.severity) ||
        typeof advisory.module_name !== 'string' ||
        typeof advisory.github_advisory_id !== 'string' ||
        !Array.isArray(advisory.findings) || advisory.findings.length === 0) {
      throw new Error('Malformed advisory')
    }
    for (const finding of advisory.findings) {
      if (!object(finding) || typeof finding.version !== 'string' ||
          !Array.isArray(finding.paths) || finding.paths.length === 0 ||
          !finding.paths.every((path) => typeof path === 'string' && path.length > 0)) {
        throw new Error('Malformed advisory finding')
      }
      counts[advisory.severity] += finding.paths.length
    }
    if (severities.indexOf(advisory.severity) < severities.indexOf(level)) continue
    const temporary = now < expiresAt &&
      advisory.github_advisory_id === advisoryId && advisory.module_name === 'picomatch' &&
      advisory.severity === 'high' && advisory.patched_versions === '<0.0.0' &&
      advisory.findings.every(({ version }) => ['2.3.2', '4.0.7'].includes(version))
    if (temporary) excepted.push(advisory.github_advisory_id)
    else blocked.push(advisory.github_advisory_id)
  }
  const reported = report.metadata.vulnerabilities
  if (Object.keys(reported).length !== severities.length ||
      severities.some((severity) => !Number.isSafeInteger(reported[severity]) ||
        reported[severity] !== counts[severity])) {
    throw new Error('Incomplete or inconsistent audit report')
  }
  const scannerShouldFail = severities.slice(severities.indexOf(level))
    .some((severity) => counts[severity] > 0)
  if (result.status !== Number(scannerShouldFail)) throw new Error('Inconsistent scanner exit status')
  return { blocked, excepted }
}

export function runAudit(level) {
  const result = spawnSync('pnpm', ['audit', `--audit-level=${level}`, '--json'], {
    encoding: 'utf8', timeout: 120_000, maxBuffer: 16 * 1024 * 1024,
  })
  // Retain the complete raw report, including temporarily excepted findings.
  if (result.stdout) process.stdout.write(result.stdout)
  if (result.stderr) process.stderr.write(result.stderr)
  try {
    const { blocked, excepted } = evaluateAudit(result, level)
    if (excepted.length) {
      console.error(`Temporary unpatched tooling-risk exception: ${excepted.join(', ')}; expires 2026-11-24T00:00:00Z; owner HQ1866/project CTO and weekly security rotation. See docs/security/picomatch-redos-disposition.md.`)
    }
    if (blocked.length) console.error(`Blocking advisories: ${blocked.join(', ')}`)
    return blocked.length ? 1 : 0
  } catch (error) {
    console.error(`Dependency audit failed: ${error.message}`)
    return 1
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  process.exitCode = runAudit(process.argv[2])
}
