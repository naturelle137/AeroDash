/**
 * Vitest configuration for integration tests.
 *
 * Runs *.int.spec.ts files in jsdom environment.
 * Integration tests may use multiple internal modules together.
 * External APIs must be mocked (MSW/fixtures).
 *
 * Usage: pnpm --filter frontend test:integration
 *
 * @see docs/testing/TESTING.md
 */
import { fileURLToPath } from 'node:url'
import { mergeConfig, defineConfig, configDefaults } from 'vitest/config'
import viteConfig from './vite.config'

export default mergeConfig(
  viteConfig,
  defineConfig({
    test: {
      environment: 'jsdom',
      include: ['src/**/*.int.spec.ts', 'tests/integration/**/*.spec.ts'],
      exclude: [...configDefaults.exclude, 'tests/e2e/**'],
      coverage: {
        provider: 'v8',
        include: ['src/**/*.ts', 'src/**/*.vue'],
        exclude: [
          'tests/**',
          '**/*.spec.ts',
          'src/main.ts',
          'src/App.vue',
          '**/*.*types.ts',
        ],
        reporter: ['text', 'html', 'lcov'],
      },
      root: fileURLToPath(new URL('./', import.meta.url)),
    },
  }),
)
