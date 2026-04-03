// @ts-check
/** @type {import('@stryker-mutator/api/core').PartialStrykerOptions} */

const config = {
  packageManager: 'pnpm',
  testRunner: 'vitest',
  checkers: ['typescript'],
  tsconfigFile: 'tsconfig.stryker.json',

  // ADD THIS: Force Stryker to load plugins correctly in a pnpm environment
  plugins: ['@stryker-mutator/vitest-runner', '@stryker-mutator/typescript-checker'],

  // Ensure the temp directory is created relative to the frontend package
  tempDirName: '.stryker-tmp',

  // This is crucial for pnpm symlinks
  symlinkNodeModules: true,
}

export default config
