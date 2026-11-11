// @ts-check
/** @type {import('@stryker-mutator/api/core').PartialStrykerOptions} */
const config = {
  packageManager: 'pnpm',
  testRunner: 'vitest',
  checkers: ['typescript'],
  tsconfigFile: 'tsconfig.stryker.json',

  plugins: ['@stryker-mutator/vitest-runner', '@stryker-mutator/typescript-checker'],

  tempDirName: '.stryker-tmp',
  symlinkNodeModules: true,

  vitest: {
    configFile: 'vitest.config.p1.ts',
  },

  mutate: [
    'src/core*.spec.ts',
    '!src/core*.e2e.spec.ts',
    '!src/core*-types.ts',
    '!src/core__tests__/**',
  ],

  thresholds: {
    high: 70,
    low: 70,
    break: 70,
  },

  reporters: ['progress', 'clear-text', 'html'],
  htmlReporter: {
    fileName: 'reports/mutation/mutation.html',
  },

  timeoutMS: 60000,
}

export default config
