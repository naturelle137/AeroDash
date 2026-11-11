import assert from 'node:assert/strict'
import { spawnSync } from 'node:child_process'
import { readFileSync } from 'node:fs'
import { test } from 'node:test'
import { fileURLToPath } from 'node:url'
import { MANDATORY_JOBS, evaluate } from './ci-required.mjs'

const script = fileURLToPath(new URL('./ci-required.mjs', import.meta.url))

function green(mutationRequired = 'false', mutation = 'skipped') {
  const needs = {}
  for (const job of MANDATORY_JOBS) needs[job] = { result: 'success', outputs: {} }
  needs.changes.outputs = { mutation_required: mutationRequired }
  needs.mutation = { result: mutation, outputs: {} }
  return needs
}

test('all mandatory green with valid non-P1 exemption passes', () => {
  assert.equal(evaluate(green('false', 'skipped')).ok, true)
})

test('P1 change with mutation success passes', () => {
  assert.equal(evaluate(green('true', 'success')).ok, true)
})

for (const bad of ['failure', 'cancelled', 'skipped']) {
  for (const job of MANDATORY_JOBS) {
    test(`${job} ${bad} blocks`, () => {
      const needs = green()
      needs[job].result = bad
      assert.equal(evaluate(needs).ok, false)
    })
  }
  test(`required mutation ${bad} blocks`, () => {
    assert.equal(evaluate(green('true', bad)).ok, false)
  })
}

for (const job of MANDATORY_JOBS) {
  test(`${job} missing blocks`, () => {
    const needs = green()
    delete needs[job]
    assert.equal(evaluate(needs).ok, false)
  })
  test(`${job} unknown result blocks`, () => {
    const needs = green()
    needs[job].result = 'neutral'
    assert.equal(evaluate(needs).ok, false)
  })
}

test('required mutation missing blocks', () => {
  const needs = green('true')
  delete needs.mutation
  assert.equal(evaluate(needs).ok, false)
})

test('exempt mutation that failed blocks', () => {
  assert.equal(evaluate(green('false', 'failure')).ok, false)
})

test('detector output missing or unknown cannot exempt mutation', () => {
  for (const value of [undefined, '', 'maybe', 'TRUE']) {
    const needs = green('false', 'skipped')
    needs.changes.outputs = value === undefined ? {} : { mutation_required: value }
    assert.equal(evaluate(needs).ok, false)
  }
})

test('failed detector blocks even when outputs claim exemption', () => {
  const needs = green('false', 'skipped')
  needs.changes.result = 'failure'
  assert.equal(evaluate(needs).ok, false)
})

test('empty, null and malformed needs block', () => {
  assert.equal(evaluate({}).ok, false)
  assert.equal(evaluate(null).ok, false)
  assert.equal(evaluate([]).ok, false)
  assert.equal(evaluate('x').ok, false)
})

function run(env) {
  return spawnSync(process.execPath, [script], { env: { PATH: process.env.PATH, ...env }, encoding: 'utf8' })
}

test('CLI exits 0 only for green input', () => {
  assert.equal(run({ NEEDS_JSON: JSON.stringify(green()) }).status, 0)
})

test('CLI exits non-zero for unset, invalid or failing input', () => {
  assert.notEqual(run({}).status, 0)
  assert.notEqual(run({ NEEDS_JSON: 'not json' }).status, 0)
  assert.notEqual(run({ NEEDS_JSON: '{}' }).status, 0)
  const failing = green()
  failing.e2e.result = 'cancelled'
  assert.notEqual(run({ NEEDS_JSON: JSON.stringify(failing) }).status, 0)
})

function ciRequiredNeeds() {
  const yml = readFileSync(new URL('../workflows/ci.yml', import.meta.url), 'utf8')
  const block = yml.split(/\n  ci-required:\n/)[1]?.split(/\n    needs:\n/)[1]
  assert.ok(block, 'ci-required needs block not found in ci.yml')
  const needs = []
  for (const line of block.split('\n')) {
    const match = /^      - ([\w-]+)$/.exec(line)
    if (!match) break
    needs.push(match[1])
  }
  return needs
}

test('ci.yml CI Required needs list matches evaluator job set', () => {
  assert.deepEqual(ciRequiredNeeds().sort(), [...MANDATORY_JOBS, 'mutation'].sort())
})

test('ci.yml mutation job is gated on detector applicability output', () => {
  const yml = readFileSync(new URL('../workflows/ci.yml', import.meta.url), 'utf8')
  assert.match(yml, /if: \$\{\{ needs\.changes\.outputs\.mutation_required == 'true' \}\}/)
})
