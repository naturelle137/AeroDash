import process from 'node:process'
import { pathToFileURL } from 'node:url'

export const MANDATORY_JOBS = [
  'lint',
  'lint-markdown',
  'type-check',
  'unit-tests',
  'integration',
  'build',
  'e2e',
  'security',
  'changes',
]

const MUTATION_JOB = 'mutation'

export function evaluate(needs) {
  const reasons = []
  if (needs === null || typeof needs !== 'object' || Array.isArray(needs)) {
    return { ok: false, reasons: ['needs context missing or malformed'] }
  }

  for (const job of MANDATORY_JOBS) {
    const result = needs[job]?.result
    if (result !== 'success') {
      reasons.push(`${job}: ${result === undefined ? 'missing' : result}`)
    }
  }

  const detector = needs.changes?.outputs?.mutation_required
  const mutation = needs[MUTATION_JOB]?.result
  if (detector === 'true') {
    if (mutation !== 'success') {
      reasons.push(`${MUTATION_JOB}: required but ${mutation === undefined ? 'missing' : mutation}`)
    }
  } else if (detector === 'false') {
    if (mutation !== 'skipped' && mutation !== 'success') {
      reasons.push(`${MUTATION_JOB}: exempt but reported ${mutation === undefined ? 'missing' : mutation}`)
    }
  } else {
    reasons.push(`${MUTATION_JOB}: applicability decision missing (changes.mutation_required=${detector})`)
  }

  return { ok: reasons.length === 0, reasons }
}

function main() {
  let needs
  try {
    needs = JSON.parse(process.env.NEEDS_JSON ?? '')
  } catch {
    needs = null
  }
  const { ok, reasons } = evaluate(needs)
  if (ok) {
    console.log('CI Required: all mandatory jobs succeeded')
    return 0
  }
  console.error('CI Required: BLOCKED')
  for (const reason of reasons) console.error(`  - ${reason}`)
  return 1
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  process.exit(main())
}
