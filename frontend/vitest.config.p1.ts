/**
 * Vitest configuration for P1 Safety Core isolation testing.
 *
 * Runs ONLY tests inside src/core/** in a pure Node.js environment (no jsdom).
 * This proves that P1 logic has zero dependency on browser APIs or framework
 * packages and can be verified independently of P2/P3 modules.
 *
 * Usage: pnpm --filter frontend test:p1
 *
 * @see docs/architecture/adr/314-DEV-dependency-isolation.md
 */
import { fileURLToPath } from 'node:url'
import { mergeConfig, defineConfig, configDefaults } from 'vitest/config'
import viteConfig from './vite.config'

export default mergeConfig(
  viteConfig,
  defineConfig({
    test: {
      // Pure Node.js environment — no browser globals injected.
      // If a P1 test ever fails here due to missing browser APIs it signals
      // an isolation violation that must be fixed before merging.
      environment: 'node',
      include: ['src/core/**/*.spec.ts'],
      exclude: [
        ...configDefaults.exclude,
        '**/*.int.spec.ts',
        '**/*.e2e.spec.ts',
      ],
      coverage: {
        provider: 'v8',
        include: ['src/core/**/*.ts'],
        exclude: ['**/*.spec.ts', '**/*.int.spec.ts'],
      },
      root: fileURLToPath(new URL('./', import.meta.url)),
    },
  }),
)
