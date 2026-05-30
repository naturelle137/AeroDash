/**
 * E2E global Before hook — seeds the disclaimer-acknowledgement record so
 * the first-launch / baseline-change gate (REQ-SYS-016, audit PR-016) does
 * not block every other E2E suite by intercepting pointer events.
 *
 * The seeded record is keyed against the running build's `MAJOR.MINOR`
 * baseline, derived from `frontend/package.json` at test-runner startup. If
 * the build version drifts, the test baseline drifts with it — no manual
 * sync.
 *
 * Suites that specifically validate the gate (first-launch / drift) should
 * clear `aerodash.disclaimer.ack.v1` themselves before navigating.
 */

import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, resolve } from 'node:path'

import { createBdd } from 'playwright-bdd'

const { Before } = createBdd()

const STORAGE_KEY = 'aerodash.disclaimer.ack.v1'

interface PackageJson {
  readonly version?: string
}

function readPackageVersion(): string {
  const here = dirname(fileURLToPath(import.meta.url))
  const pkgPath = resolve(here, '..', '..', '..', 'package.json')
  const raw = readFileSync(pkgPath, 'utf-8')
  const pkg = JSON.parse(raw) as PackageJson
  if (!pkg.version) {
    throw new Error(`disclaimer-seed.hooks: package.json at ${pkgPath} has no version`)
  }
  return pkg.version
}

function computeBaseline(version: string): string {
  // Matches `parseSemVer` / `computeDisclaimerBaseline` in the store: take
  // the leading `MAJOR.MINOR` of a valid SemVer (release or pre-release).
  const match = version.match(/^(\d+)\.(\d+)\./)
  if (!match) {
    throw new Error(`disclaimer-seed.hooks: cannot compute baseline from version "${version}"`)
  }
  return `${match[1]}.${match[2]}`
}

const APP_VERSION = readPackageVersion()
const BASELINE = computeBaseline(APP_VERSION)

Before(async ({ page }) => {
  await page.addInitScript(
    ({ key, version, baseline }) => {
      try {
        const record = {
          schemaVersion: 1,
          acceptedVersion: version,
          acceptedBaseline: baseline,
          acceptedAt: Date.now(),
        }
        window.localStorage.setItem(key, JSON.stringify(record))
      } catch {
        // localStorage unreachable in this browser context — the suite will
        // see the gate, but that is a faithful reproduction of the user
        // experience under the same constraint.
      }
    },
    { key: STORAGE_KEY, version: APP_VERSION, baseline: BASELINE },
  )
})
