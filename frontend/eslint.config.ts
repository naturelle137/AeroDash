import { globalIgnores } from 'eslint/config'
import {
  defineConfigWithVueTs,
  vueTsConfigs,
  configureVueProject,
} from '@vue/eslint-config-typescript'

configureVueProject({
  rootDir: import.meta.dirname,
})

import pluginVue from 'eslint-plugin-vue'
import pluginPlaywright from 'eslint-plugin-playwright'
import pluginVitest from '@vitest/eslint-plugin'
import pluginOxlint from 'eslint-plugin-oxlint'
import skipFormatting from 'eslint-config-prettier/flat'

import noE2eTagInTs from './eslint-rules/no-e2e-tag-in-ts.js'

const aerodashPlugin = {
  rules: {
    'no-e2e-tag-in-ts': noE2eTagInTs,
  },
}

// To allow more languages other than `ts` in `.vue` files, uncomment the following lines:
// import { configureVueProject } from '@vue/eslint-config-typescript'
// configureVueProject({ scriptLangs: ['ts', 'tsx'] })
// More info at https://github.com/vuejs/eslint-config-typescript/#advanced-setup

export default defineConfigWithVueTs(
  {
    name: 'app/files-to-lint',
    files: ['**/*.{vue,ts,mts,tsx}'],
  },

  {
    name: 'app/parser-options',
    languageOptions: {
      parserOptions: {
        tsconfigRootDir: import.meta.dirname,
      },
    },
  },

  {
    ignores: ['**/.tools/shtracer**'],
  },

  globalIgnores([
    '**/dist/**',
    '**/dist-ssr/**',
    '**/coverage/**',
    '**/node_modules/**',
    '**/stryker-tmp/**',
    '**/playwright-report/**',
    // Fixtures that deliberately violate `aerodash/no-e2e-tag-in-ts` and
    // are linted programmatically by the rule's own spec. Excluding them
    // from the regular lint pass keeps `pnpm lint` green while the spec
    // still proves the rule fires.
    'eslint-rules/__fixtures__/**',
  ]),

  ...pluginVue.configs['flat/essential'],
  vueTsConfigs.recommended,

  {
    ...pluginPlaywright.configs['flat/recommended'],
    files: ['e2e/**/*.{test,spec}.{js,ts,jsx,tsx}'],
  },

  {
    ...pluginVitest.configs.recommended,
    files: ['src/**/__tests__/*'],
  },

  {
    name: 'app/no-raw-console',
    rules: {
      'no-console': 'error',
    },
  },

  {
    name: 'app/logger-console-override',
    files: ['src/shared/utils/logger.ts'],
    rules: {
      'no-console': 'off',
    },
  },

  // P1 Safety Core boundary: src/core/** must not import from framework
  // packages or from any higher-layer directory (modules/, shared/, stores/,
  // plugins/, router/). Enforces ADR 314-DEV-dependency-isolation.
  {
    name: 'core/p1-boundary-isolation',
    files: ['src/core/**/*.ts'],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          patterns: [
            {
              group: ['vue', 'vue/**', 'pinia', 'pinia/**', 'vue-router', 'vue-router/**'],
              message:
                '[P1-ISOLATION] The Safety Core (src/core/) must be framework-agnostic. ' +
                'Do not import Vue, Pinia, or Vue-Router packages. ' +
                'See ADR 314-DEV-dependency-isolation and CONTRIBUTING.md §10.',
            },
            {
              group: ['**/modules/**', '@/modules/**'],
              message:
                '[P1-ISOLATION] The Safety Core (src/core/) must not depend on feature modules (P2). ' +
                'Expose a pure-TS interface in src/core/domain/ instead. ' +
                'See ADR 314-DEV-dependency-isolation.',
            },
            {
              group: ['**/shared/**', '@/shared/**'],
              message:
                '[P1-ISOLATION] The Safety Core (src/core/) must not depend on the shared app shell (P3). ' +
                'See ADR 314-DEV-dependency-isolation.',
            },
            {
              group: ['**/stores/**', '@/stores/**'],
              message:
                '[P1-ISOLATION] The Safety Core (src/core/) must not depend on global Pinia stores (P2/P3). ' +
                'See ADR 314-DEV-dependency-isolation.',
            },
            {
              group: ['**/plugins/**', '@/plugins/**'],
              message:
                '[P1-ISOLATION] The Safety Core (src/core/) must not depend on plugins (P3). ' +
                'See ADR 314-DEV-dependency-isolation.',
            },
            {
              group: ['**/router/**', '@/router/**'],
              message:
                '[P1-ISOLATION] The Safety Core (src/core/) must not depend on the router (P3). ' +
                'See ADR 314-DEV-dependency-isolation.',
            },
          ],
        },
      ],
    },
  },

  // Traceability: `@E2E-…@` tags must live in `.feature` files, not in
  // TypeScript sources. See issue #265 and `docs/stc.md` §3.
  {
    name: 'aerodash/no-e2e-tag-in-ts',
    files: ['**/*.ts', '**/*.mts', '**/*.tsx'],
    plugins: {
      aerodash: aerodashPlugin,
    },
    rules: {
      'aerodash/no-e2e-tag-in-ts': 'error',
    },
  },

  ...pluginOxlint.buildFromOxlintConfigFile('.oxlintrc.json'),

  skipFormatting,
)
