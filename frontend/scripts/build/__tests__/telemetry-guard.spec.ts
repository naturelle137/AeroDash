import { mkdtemp, rm, writeFile } from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'

import { loadEnv } from 'vite'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'

import {
  TELEMETRY_GUARD_ABORT_MESSAGE,
  assertNoTelemetryInProductionBuild,
} from '../telemetry-guard'

describe('assertNoTelemetryInProductionBuild', () => {
  it('passes when VITE_LOG_TELEMETRY is absent', () => {
    expect(() => assertNoTelemetryInProductionBuild({})).not.toThrow()
  })

  it('passes when VITE_LOG_TELEMETRY is undefined', () => {
    expect(() =>
      assertNoTelemetryInProductionBuild({ VITE_LOG_TELEMETRY: undefined }),
    ).not.toThrow()
  })

  it('passes for explicit falsy strings', () => {
    for (const value of ['false', '0', 'no', 'off', '', 'maybe', 'truthy']) {
      expect(() =>
        assertNoTelemetryInProductionBuild({ VITE_LOG_TELEMETRY: value }),
      ).not.toThrow()
    }
  })

  it('throws for every accepted truthy form (case-insensitive, trim-tolerant)', () => {
    for (const value of [
      'true',
      'TRUE',
      'True',
      '1',
      'yes',
      'YES',
      'on',
      'ON',
      '  true  ',
      '\ttrue\n',
    ]) {
      expect(() =>
        assertNoTelemetryInProductionBuild({ VITE_LOG_TELEMETRY: value }),
      ).toThrow(TELEMETRY_GUARD_ABORT_MESSAGE)
    }
  })

  it('quotes the safety rationale in the abort message so the operator knows why', () => {
    expect(TELEMETRY_GUARD_ABORT_MESSAGE).toMatch(/DP-004/)
    expect(TELEMETRY_GUARD_ABORT_MESSAGE).toMatch(/CS-012/)
    expect(TELEMETRY_GUARD_ABORT_MESSAGE).toMatch(/bypasses the PII redactor/i)
    expect(TELEMETRY_GUARD_ABORT_MESSAGE).toMatch(/pnpm build/)
  })
})

/**
 * Integration with `loadEnv()` — pins the contract that the guard, when
 * fed by `loadEnv()` (as `vite.config.ts` does), DOES see values placed in
 * `.env*` files. This is a regression test verifying the guard sees values
 * in `.env*` files: a previous version of the guard read `process.env` directly
 * and silently no-op'd when `VITE_LOG_TELEMETRY=true` was placed in
 * `.env.production` / `.env.local`, because Vite does not load `.env*`
 * into `process.env` at config-eval time.
 */
describe('vite loadEnv() + assertNoTelemetryInProductionBuild — full chain', () => {
  let tmpDir: string

  beforeEach(async () => {
    tmpDir = await mkdtemp(path.join(os.tmpdir(), 'aerodash-telemetry-guard-'))
  })

  afterEach(async () => {
    await rm(tmpDir, { recursive: true, force: true })
  })

  it('aborts when VITE_LOG_TELEMETRY=true lives in .env.production', async () => {
    await writeFile(path.join(tmpDir, '.env.production'), 'VITE_LOG_TELEMETRY=true\n')
    const env = loadEnv('production', tmpDir, 'VITE_')
    expect(() => assertNoTelemetryInProductionBuild(env)).toThrow(
      TELEMETRY_GUARD_ABORT_MESSAGE,
    )
  })

  it('aborts when VITE_LOG_TELEMETRY=true lives in .env.local (production mode)', async () => {
    // `.env.local` is loaded for every mode and beats `.env`; this is the
    // most natural "I just want telemetry on my dev box" path that an
    // unsuspecting developer would take, so the guard MUST catch it before
    // shipping.
    await writeFile(path.join(tmpDir, '.env.local'), 'VITE_LOG_TELEMETRY=true\n')
    const env = loadEnv('production', tmpDir, 'VITE_')
    expect(() => assertNoTelemetryInProductionBuild(env)).toThrow(
      TELEMETRY_GUARD_ABORT_MESSAGE,
    )
  })

  it('aborts when VITE_LOG_TELEMETRY=true lives in plain .env', async () => {
    await writeFile(path.join(tmpDir, '.env'), 'VITE_LOG_TELEMETRY=true\n')
    const env = loadEnv('production', tmpDir, 'VITE_')
    expect(() => assertNoTelemetryInProductionBuild(env)).toThrow(
      TELEMETRY_GUARD_ABORT_MESSAGE,
    )
  })

  it('passes when .env.production explicitly disables telemetry', async () => {
    await writeFile(path.join(tmpDir, '.env.production'), 'VITE_LOG_TELEMETRY=false\n')
    const env = loadEnv('production', tmpDir, 'VITE_')
    expect(() => assertNoTelemetryInProductionBuild(env)).not.toThrow()
  })

  it('passes when no .env* file is present', async () => {
    const env = loadEnv('production', tmpDir, 'VITE_')
    expect(() => assertNoTelemetryInProductionBuild(env)).not.toThrow()
  })
})
