/**
 * Unit conversion constants — single source of truth for inter-unit factors
 * used by the P1 Safety Core.
 *
 * Centralising these here prevents slow drift between independent
 * constants (e.g. two definitions of US gallons → litres in `fuel-mass.ts`
 * and `unit-normalization.ts`) under future precision updates.
 *
 * Pure literal exports — no framework dependencies. P1 Safety Core.
 */

// @IMP-SYS-CORE-014@ (FROM: @REQ-SYS-003@)

/** 1 US liquid gallon = 3.785411784 L exactly (NIST). */
export const US_GAL_TO_L = 3.785411784 as const

/** 1 Imperial gallon = 4.54609 L exactly (UK Weights and Measures Act 1985). */
export const IMP_GAL_TO_L = 4.54609 as const

/** 1 lb = 0.45359237 kg exactly (international avoirdupois pound). */
export const LB_TO_KG = 0.45359237 as const

/** 1 in = 0.0254 m exactly (international inch). */
export const IN_TO_M = 0.0254 as const

/** 1 ft = 0.3048 m exactly. */
export const FT_TO_M = 0.3048 as const
