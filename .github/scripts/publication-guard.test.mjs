import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { test } from 'node:test'

test('technical promotion cannot publish on main, regardless of version or existing tags', () => {
  const workflow = readFileSync(new URL('../workflows/publish-release.yml', import.meta.url), 'utf8')
  const publish = workflow.split('\n  publish:\n')[1]
  assert.ok(publish)
  assert.match(publish, /^    #.*\n    if: \$\{\{ false \}\}\n/)
})

test('main promotion cannot publish a container or deploy public reports', () => {
  const container = readFileSync(new URL('../workflows/publish-devcontainer.yml', import.meta.url), 'utf8')
  const reports = readFileSync(new URL('../workflows/deploy-reports.yml', import.meta.url), 'utf8')
  assert.match(container, /build-and-push:\n    if: \$\{\{ github\.event_name != 'push' \|\| github\.ref != 'refs\/heads\/main' \}\}/)
  assert.match(reports, /generate-and-deploy:\n    if: \$\{\{ github\.event_name == 'workflow_dispatch' \}\}/)
})
