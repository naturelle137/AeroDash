import assert from 'node:assert/strict'
import { globSync } from 'node:fs'
import { test } from 'node:test'
import config from '../../frontend/stryker.config.mjs'

const cwd = new URL('../../frontend/', import.meta.url)

test('mutation gate exercises real P1 code and excludes test data and declarations', () => {
  const included = new Set()
  for (const pattern of config.mutate) {
    for (const file of globSync(pattern.replace(/^!/, ''), { cwd })) {
      if (pattern.startsWith('!')) included.delete(file)
      else included.add(file)
    }
  }
  assert.ok(included.has('src/core/logic/mass-balance.logic.ts'))
  assert.ok(included.has('src/core/logic/performance.bilinear-interpolation.ts'))
  assert.ok(included.size >= 10)
  for (const file of included) {
    assert.doesNotMatch(file, /\.spec\.ts$|\.types\.ts$|-types\.ts$|__fixtures__|__tests__/)
  }
  assert.deepEqual(config.thresholds, { high: 70, low: 70, break: 70 })
  assert.equal(config.vitest.configFile, 'vitest.config.p1.ts')
})
