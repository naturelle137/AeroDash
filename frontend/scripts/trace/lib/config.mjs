/**
 * Single Source of Truth for the trace CLI scan configuration.
 *
 * Mirrors the shtracer configuration in `.tools/.shtracer.md` and the
 * ontology defined in `docs/stc.md`. The CLI reads exclusively from this
 * module — never re-parses `.shtracer.md` — so the JavaScript representation
 * stays self-contained and unit-testable.
 *
 * Paths are repo-root-relative. The CLI receives a repoRoot argument and
 * resolves them at scan time.
 */

/** @typedef {'H'|'REQ'|'UJ'|'DES'|'IMP'|'UT'|'IT'|'E2E'} TagType */

/**
 * @typedef {Object} TagSourceConfig
 * @property {TagType} type            Node-type prefix.
 * @property {string[]} paths          Repo-relative directories to scan.
 * @property {string[]} extensions     Allowed file extensions (".md", ".ts").
 * @property {RegExp} tagRegex         Strict tag pattern with anchored boundaries.
 * @property {RegExp} commentRegex     Comment-line shape that may contain a tag.
 * @property {string[]} [ignoreNames]  Filename-only ignore list.
 * @property {RegExp} [ignoreSuffix]   Extra suffix exclusion (e.g. *.spec.ts for IMP).
 */

/** STC §1.3 — module identifiers */
export const MODULES = ['AC', 'AP', 'AD', 'FE', 'MB', 'PF', 'WX', 'UI', 'UQ', 'SYS', 'DOC', 'SC']

/** STC §1.4 — phase identifiers */
export const PHASES = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'STRESS']

/** STC §1.5 — architectural layers */
export const LAYERS = ['CORE', 'STORE', 'VIEW', 'ROUTE', 'PLUGIN', 'SHARED']

/** STC §1.2 — DES subtypes */
export const DES_SUBTYPES = ['ARCH', 'UX', 'API']

/**
 * Comment-line gate for Markdown documents. The parser already splits the
 * file into individual lines, so a single-line pattern is sufficient — we
 * only need to know "is this line a comment line that may carry a tag".
 *
 * The opener-only shape (`<!--` at line start, no closing `-->` required)
 * avoids the bad-HTML-filter CodeQL signature and is strictly equivalent
 * in practice: the per-type `tagRegex` still has to match before any
 * occurrence is recorded.
 */
const MD_COMMENT_REGEX = /^\s*<!--/

/**
 * Comment-line gate for `.ts`, `.vue`, and Gherkin files. Matches either a
 * `//` line comment (TypeScript / Vue `<script>` blocks) or an HTML-style
 * comment opener (Vue `<template>` blocks).
 */
const TS_VUE_COMMENT_REGEX = /^\s*(\/\/|<!--)/

/**
 * Scan rules per tag type. Anchored with `(?<![A-Z0-9-])` / `(?![A-Z0-9-])`
 * so a longer-tag prefix (e.g. `@IMP-MB-CORE-001@` does not match the REQ
 * regex `@REQ-MB-001@`).
 *
 * @type {TagSourceConfig[]}
 */
export const SCAN_CONFIG = [
  {
    type: 'H',
    paths: ['docs/risk_management'],
    extensions: ['.md'],
    tagRegex: /(?<![A-Z0-9-])@H-(\d+)@(?![A-Z0-9-])/g,
    commentRegex: MD_COMMENT_REGEX,
  },
  {
    type: 'REQ',
    paths: ['docs/requirements'],
    extensions: ['.md'],
    ignoreNames: ['README.md', 'traceability_matrix.md'],
    tagRegex: /(?<![A-Z0-9-])@REQ-([A-Z]+)-(\d+)@(?![A-Z0-9-])/g,
    commentRegex: MD_COMMENT_REGEX,
  },
  {
    type: 'UJ',
    paths: ['docs/journeys'],
    extensions: ['.md'],
    ignoreNames: ['README.md'],
    tagRegex: /(?<![A-Z0-9-])@UJ-([A-Z]+)-(\d+)@(?![A-Z0-9-])/g,
    commentRegex: MD_COMMENT_REGEX,
  },
  {
    type: 'DES',
    paths: ['docs/architecture', 'docs/ux', 'docs/api'],
    extensions: ['.md'],
    ignoreNames: ['000-template.md', 'README.md'],
    tagRegex: /(?<![A-Z0-9-])@DES-([A-Z]+)-(\d+)@(?![A-Z0-9-])/g,
    commentRegex: MD_COMMENT_REGEX,
  },
  {
    type: 'IMP',
    paths: ['frontend/src'],
    extensions: ['.ts', '.vue'],
    ignoreSuffix: /\.(spec|int\.spec|e2e\.spec)\.ts$/,
    tagRegex: /(?<![A-Z0-9-])@IMP-([A-Z]+)-([A-Z]+)-(\d+)@(?![A-Z0-9-])/g,
    commentRegex: TS_VUE_COMMENT_REGEX,
  },
  {
    type: 'UT',
    paths: ['frontend/src'],
    extensions: ['.spec.ts'],
    ignoreSuffix: /\.(int\.spec|e2e\.spec)\.ts$/,
    tagRegex: /(?<![A-Z0-9-])@UT-([A-Z]+)-([A-Z]+)-(\d+)@(?![A-Z0-9-])/g,
    commentRegex: /^\s*\/\/.*$/,
  },
  {
    type: 'IT',
    paths: ['frontend/src', 'frontend/tests/integration'],
    extensions: ['.int.spec.ts'],
    tagRegex: /(?<![A-Z0-9-])@IT-([A-Z]+)-([A-Z]+)-(\d+)@(?![A-Z0-9-])/g,
    commentRegex: /^\s*\/\/.*$/,
  },
  {
    type: 'E2E',
    paths: ['frontend/tests/e2e'],
    extensions: ['.feature'],
    tagRegex: /(?<![A-Z0-9-])@E2E-([A-Z]+)-(\d+)@(?![A-Z0-9-])/g,
    commentRegex: /^\s*#.*$/,
  },
]

/**
 * Tag types that participate in the code-level registry tree under
 * `trace/`. Used by `sync` and `check` to decide which YAML files
 * require maintenance.
 */
export const REGISTRY_TARGETS = {
  REQ: { dir: 'trace/requirements', groupBy: 'module' },
  UJ: { dir: 'trace/journeys', groupBy: 'phase' },
  DES: { dir: 'trace/design', groupBy: 'subtype' },
  IMP: { dir: 'trace/implementation', groupBy: 'module' },
  UT: { dir: 'trace/unit_test', groupBy: 'module' },
  IT: { dir: 'trace/integration_test', groupBy: 'module' },
  E2E: { dir: 'trace/e2e', groupBy: 'phase' },
}

/**
 * Resolve the scan config for a single tag type.
 *
 * @param {TagType} type
 * @returns {TagSourceConfig|undefined}
 */
export function configFor(type) {
  return SCAN_CONFIG.find((c) => c.type === type)
}

/**
 * Return the set of file extensions referenced by any scanner. Used as a
 * defensive guard by `sync` so it never removes a registry entry that
 * points to a file outside the current scanner's reach (e.g. a `.json`
 * fixture or an as-yet-unsupported language).
 *
 * @returns {Set<string>}
 */
export function knownExtensions() {
  const set = new Set()
  for (const cfg of SCAN_CONFIG) for (const e of cfg.extensions) set.add(e)
  return set
}
