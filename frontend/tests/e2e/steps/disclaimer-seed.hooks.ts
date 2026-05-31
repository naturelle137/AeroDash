// E2E global Before hook — seeds the disclaimer acknowledgement record so the
// gate does not block every other suite. Suites that validate the gate itself
// must clear the storage key before navigating.

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
  // Mirrors computeDisclaimerBaseline in the store: leading MAJOR.MINOR.
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
