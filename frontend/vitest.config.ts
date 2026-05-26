import { fileURLToPath } from 'node:url'
import { mergeConfig, defineConfig, configDefaults } from 'vitest/config'
import viteConfig from './vite.config'

export default mergeConfig(
  viteConfig,
  defineConfig({
    test: {
      environment: 'jsdom',
      // Scripts/trace CLI tests sit alongside the dev tooling under
      // `scripts/trace/__tests__/` and exercise pure-node modules; they
      // share the same unit-test gate but contribute no coverage to the
      // `src/` thresholds (coverage.include only collects from `src/`).
      include: ['src/**/*.spec.ts', 'scripts/**/*.spec.ts'],
      exclude: [
        ...configDefaults.exclude,
        'tests/e2e/**',
        'tests/integration/**',
        '**/*.int.spec.ts',
        '**/*.e2e.spec.ts',
      ],
      coverage: {
        provider: 'v8',
        include: ['src/**/*.ts', 'src/**/*.vue'],
        exclude: [
          'tests/**',
          '**/*.spec.ts',
          '**/*.int.spec.ts',
          '**/*.e2e.spec.ts',
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
