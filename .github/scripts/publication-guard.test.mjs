import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { test } from 'node:test'
import { spawnSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'

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

// Exercise Netlify's inverted ignore exit convention and build-hook fallback.
// Keep this unconditional while CI449/E3 publication authority is withheld.
test('Netlify cancels automatic builds and fails closed when ignore is bypassed', () => {
  const config = readFileSync(new URL('../../netlify.toml', import.meta.url), 'utf8')
  const active = config.split('\n').filter((line) => !line.trim().startsWith('#')).join('\n')
  assert.deepEqual(active.match(/^\[.+\]$/gm), ['[build]'])
  assert.match(active, /^  base = "\."$/m)
  const ignore = active.match(/^  ignore = "([^"]+)"$/m)?.[1]
  const command = active.match(/^  command = "([^"]+)"$/m)?.[1]
  assert.ok(ignore)
  assert.ok(command)
  for (const context of ['production', 'deploy-preview', 'branch-deploy', 'dev', '']) {
    for (const cwd of ['../../', '../../frontend/']) {
      const options = {
        cwd: fileURLToPath(new URL(cwd, import.meta.url)),
        env: { ...process.env, CONTEXT: context, BRANCH: context === 'production' ? 'main' : 'hotfix/ci449-job213' },
        encoding: 'utf8',
      }
      const skip = spawnSync('bash', ['-c', ignore], options)
      assert.equal(skip.status, 0, `cancel automatic Netlify build: ${context}`)
      assert.match(skip.stdout, /CI449: Netlify publication disabled/)
      const fallback = spawnSync('bash', ['-c', command], options)
      assert.equal(fallback.status, 1, `block build-hook bypass: ${context}`)
      assert.match(fallback.stderr, /CI449: Netlify publication disabled/)
    }
  }
})
