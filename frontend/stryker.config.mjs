// @ts-check
/** @type {import('@stryker-mutator/api/core').PartialStrykerOptions} */

/**
 * Stryker Mutation Testing — P1 Safety Core gate (issue #260, TECH-007/PR-015).
 *
 * Mutation testing acts as the *second* line of defence behind P1 unit-test
 * coverage: 90% line/branch/function coverage proves the tests *execute*
 * every path; the mutation score proves they *catch* defects on those paths.
 *
 * The scope is intentionally narrow — only `frontend/src/core/**` — because
 * a surviving mutant in the Safety Core can yield an incorrect Go/No-Go
 * advisory (H-class hazards), whereas a surviving mutant in UI code does
 * not. Widening the scope dilutes the signal and inflates runtime.
 *
 * References:
 *   - docs/testing/TESTING.md §7 (Mutation Testing — P1 Safety Core gate)
 *   - docs/architecture/adr/314-DEV-dependency-isolation.md (P1 isolation)
 *   - issue #260 (defer from v0.3.0-alpha release audit)
 */

const config = {
  packageManager: 'pnpm',
  testRunner: 'vitest',
  checkers: ['typescript'],
  tsconfigFile: 'tsconfig.stryker.json',

  // Plugins must be enumerated explicitly so Stryker resolves them through
  // the pnpm symlink tree rather than walking node_modules heuristically.
  plugins: ['@stryker-mutator/vitest-runner', '@stryker-mutator/typescript-checker'],

  tempDirName: '.stryker-tmp',
  symlinkNodeModules: true,

  // Drive the vitest runner with the P1-isolated config (Node env, no jsdom,
  // no Vue/Pinia). This mirrors `pnpm --filter frontend test:p1` and keeps
  // the mutation runtime free of P2/P3 framework imports.
  vitest: {
    configFile: 'vitest.config.p1.ts',
  },

  // Mutate ONLY the P1 Safety Core. Glob-negation excludes test files,
  // fixtures, type-only declarations, and shared test helpers — none of
  // which can produce an incorrect Go/No-Go output, and which would
  // otherwise distort the score with un-killable mutants (e.g. mutating
  // a fixture constant). See docs/testing/TESTING.md §7 for the rationale.
  mutate: [
    'src/core/**/*.ts',
    '!src/core/**/*.spec.ts',
    '!src/core/**/*.int.spec.ts',
    '!src/core/**/*.e2e.spec.ts',
    '!src/core/**/*.types.ts',
    '!src/core/**/__fixtures__/**',
    '!src/core/**/__tests__/**',
  ],

  // Mutation-score gate (percentage of mutants killed):
  //   ≥ high  → green; target score for P1 Safety Core
  //   ≥ low   → amber; reported but not failing
  //   < break → CI failure (gate fails; no continue-on-error)
  // Break is set to 70 to give existing P1 tests headroom while still
  // forcing them to assert behaviour, not just execute lines. Tightening
  // the bar past v1.0.0 is tracked separately.
  thresholds: {
    high: 85,
    low: 70,
    break: 70,
  },

  reporters: ['progress', 'clear-text', 'html'],
  htmlReporter: {
    fileName: 'reports/mutation/mutation.html',
  },

  // Per-mutant timeout — long enough for the slowest P1 vector-driven test
  // (bilinear interpolation against canonical vectors) without masking real
  // infinite loops introduced by a mutant.
  timeoutMS: 60000,
  concurrency: 4,
}

export default config
