/**
 * Fixture for `aerodash/no-e2e-tag-in-ts` (see issue #265). This file
 * deliberately violates the rule via TypeScript comments (line + block)
 * and is excluded from the regular ESLint pass via `globalIgnores` in
 * `eslint.config.ts`. The rule spec lints it programmatically to verify
 * the rule fires.
 */

// @E2E-A-001@ this line MUST trip the rule (line-comment carrier)

/* @E2E-STRESS-042@ block-comment carrier — also tripped */

// IMP-MB-CORE-001 is fine (REQ/IMP ids are out of scope for this rule)

export const stringWithE2ePattern =
  // string literal carriers are inert (trace scanner only reads comments)
  // and so they are intentionally NOT covered by the rule
  '@E2E-A-007@'
