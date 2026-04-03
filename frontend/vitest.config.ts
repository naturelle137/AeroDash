import { fileURLToPath } from 'node:url'
import { mergeConfig, defineConfig, configDefaults } from 'vitest/config'
import viteConfig from './vite.config'

export default mergeConfig(
  viteConfig,
  defineConfig({
    test: {
      environment: 'jsdom',
      include: ['src/**/*.spec.ts'],
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
