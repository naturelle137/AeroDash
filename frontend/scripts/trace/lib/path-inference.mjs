/**
 * Path-driven inference for module + layer segments.
 *
 * Per the issue spec, the developer should be able to write
 *   trace tag IMP
 * and have the CLI fill in the module and layer from the file's path,
 * leaving only the sequential number to be computed. The mapping below
 * is deterministic and conservative: it never invents a segment the STC
 * does not define (§1.3 / §1.5).
 */

import { LAYERS, MODULES, PHASES } from './config.mjs'

/**
 * Folder-name → module/layer/phase mapping. Multiple aliases per ID make
 * the rules forgiving for legacy AeroDash directory names while staying
 * deterministic (first match wins, scanning the path from deepest segment
 * to shallowest).
 */
const MODULE_ALIASES = {
  AC: ['aircraft', 'ac'],
  AP: ['airport', 'ap'],
  AD: ['aircraft-data', 'detailed-aircraft', 'ad'],
  FE: ['fuel-endurance', 'fuel', 'fe'],
  MB: ['mass-balance', 'mb'],
  PF: ['performance', 'pf'],
  WX: ['weather', 'wx'],
  UI: ['ui'],
  UQ: ['usability', 'quality', 'uq'],
  SYS: ['system', 'sys', 'app'],
  DOC: ['export', 'documentation', 'doc'],
  SC: ['sync', 'cloud-sync', 'sc'],
}

const LAYER_ALIASES = {
  CORE: ['core'],
  STORE: ['stores', 'store'],
  VIEW: ['views', 'view', 'components'],
  ROUTE: ['router', 'route'],
  PLUGIN: ['plugins', 'plugin'],
  SHARED: ['shared'],
}

const PHASE_ALIASES = {
  A: ['phase-a', 'fleet-management'],
  B: ['phase-b', 'flight-prep'],
  C: ['phase-c', 'performance-safety'],
  D: ['phase-d', 'system-pwa', 'system-usability'],
  E: ['phase-e', 'weather'],
  F: ['phase-f', 'fuel'],
  G: ['phase-g', 'onboarding-sync'],
  STRESS: ['stress', 'phase-stress'],
}

/**
 * Normalise a path into lowercase, slash-delimited segments. Underscores
 * are mapped to hyphens (so `mass_balance.md` matches the `mass-balance`
 * alias) and the basename without extension is appended as the deepest
 * synthetic segment — that way a file like
 * `docs/journeys/phase-a-fleet-management.md` exposes both the directory
 * `journeys` AND the filename `phase-a-fleet-management` to the matcher.
 *
 * @param {string} filePath
 * @returns {string[]}
 */
function pathSegments(filePath) {
  const cleaned = filePath
    .replace(/^[./\\]+/, '')
    .split(/[/\\]/)
    .map((s) => s.toLowerCase().replace(/_/g, '-'))
    .filter(Boolean)
  if (cleaned.length === 0) return cleaned
  const last = cleaned[cleaned.length - 1]
  // Add the basename without extension so callers can match against
  // filename-encoded module/phase hints (e.g. mass-balance.md).
  const dotIdx = last.lastIndexOf('.')
  if (dotIdx > 0) {
    cleaned[cleaned.length - 1] = last.slice(0, dotIdx)
  }
  return cleaned
}

/**
 * Search a {ID → aliases} dictionary, returning the first ID whose alias
 * matches a segment (exact match or prefix-with-`-` match — e.g. the alias
 * `phase-a` matches the segment `phase-a-fleet-management`).
 *
 * @param {Record<string,string[]>} dict
 * @param {string[]} segments
 * @returns {string|undefined}
 */
function matchFromSegments(dict, segments) {
  for (let i = segments.length - 1; i >= 0; i -= 1) {
    const seg = segments[i]
    for (const [id, aliases] of Object.entries(dict)) {
      if (aliases.includes(seg)) return id
      // Prefix match: alias "phase-a" matches segment "phase-a-…".
      if (aliases.some((alias) => seg.startsWith(`${alias}-`))) return id
    }
  }
  return undefined
}

/**
 * Infer the module segment from a `frontend/src/...` (or test) path.
 *
 * @param {string} filePath
 * @returns {string|undefined}
 */
export function inferModule(filePath) {
  return matchFromSegments(MODULE_ALIASES, pathSegments(filePath))
}

/**
 * Infer the layer segment from a `frontend/src/...` path. Defaults to
 * `CORE` when the path includes `src/core/...`.
 *
 * @param {string} filePath
 * @returns {string|undefined}
 */
export function inferLayer(filePath) {
  return matchFromSegments(LAYER_ALIASES, pathSegments(filePath))
}

/**
 * Infer the phase segment from a `frontend/tests/e2e/...` feature path.
 *
 * @param {string} filePath
 * @returns {string|undefined}
 */
export function inferPhase(filePath) {
  return matchFromSegments(PHASE_ALIASES, pathSegments(filePath))
}

/**
 * Validate that the given module/layer/phase is part of the STC ontology.
 * Returns the canonical uppercase form or throws.
 *
 * @param {'module'|'layer'|'phase'} kind
 * @param {string} value
 */
export function assertCanonical(kind, value) {
  const upper = value.toUpperCase()
  const set = kind === 'module' ? MODULES : kind === 'layer' ? LAYERS : PHASES
  if (!set.includes(upper)) {
    throw new Error(`Unknown ${kind}: ${value}. Expected one of: ${set.join(', ')}`)
  }
  return upper
}

/**
 * One-shot inference for a tag-type + file-path pair. Returns the segment
 * list the caller can hand to `formatTag`. Throws when a required segment
 * cannot be inferred — the CLI surfaces this so the dev supplies it
 * explicitly.
 *
 * @param {import('./config.mjs').TagType} type
 * @param {string} filePath
 * @returns {string[]}
 */
export function inferSegments(type, filePath) {
  switch (type) {
    case 'H':
      return []
    case 'REQ':
    case 'IMP':
    case 'UT':
    case 'IT': {
      const mod = inferModule(filePath)
      if (!mod) throw new Error(`Cannot infer module from path: ${filePath}`)
      if (type === 'REQ') return [mod]
      const layer = inferLayer(filePath)
      if (!layer) throw new Error(`Cannot infer layer from path: ${filePath}`)
      return [mod, layer]
    }
    case 'UJ':
    case 'E2E': {
      const phase = inferPhase(filePath)
      if (!phase) throw new Error(`Cannot infer phase from path: ${filePath}`)
      return [phase]
    }
    case 'DES':
      throw new Error('DES segment cannot be inferred from path — pass --subtype')
    default:
      throw new Error(`Unsupported tag type: ${type}`)
  }
}
