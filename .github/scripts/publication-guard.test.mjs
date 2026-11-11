import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { test } from 'node:test'

test('technical promotion cannot publish on main, regardless of version or existing tags', () => {
  const workflow = readFileSync(new URL('../workflows/publish-release.yml', import.meta.url), 'utf8')
  const publish = workflow.split('\n  publish:\n')[1]
  assert.ok(publish)
  assert.match(publish, /^    #.*\n    if: \$\{\{ false \}\}\n/)
})
