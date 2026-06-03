<script setup lang="ts">
// @IMP-MB-UI-005@ (FROM: @REQ-UQ-003@, @REQ-UQ-005@, @REQ-UQ-004@)
import { computed } from 'vue'
import type { MathCoreResult } from '@/modules/mass-balance/stores/mass-balance.types'
import {
  formatMassConservative,
  formatArm,
} from '@/core/logic/display-rounding'

interface CategoryLimits {
  maxTakeoffMass: number
  maxZeroFuelMass: number | null
}

const props = defineProps<{
  result: MathCoreResult | null
  limits: CategoryLimits | null
  canExport: boolean
  exportRequiresConfirmation?: boolean
}>()

defineEmits<{
  (e: 'export'): void
}>()

// ─── Limit-proximity highlighting ────────────────────────────────────────────
// @IMP-MB-UI-011@ (FROM: @REQ-UQ-003@, @REQ-UI-018@)
//
// A presentational at-a-glance cue, NOT a Go/No-Go determination — the
// authoritative limit checks remain the math-core notifications (CRIT-MB-002 /
// CRIT-MB-004). Here we only colour the displayed mass so the pilot's eye is
// drawn to a figure that is at/over its limit ("over") or within the warning
// band just below it ("near"). Comparison uses the raw mass, not the
// conservatively-rounded display string, so the band is exact.

/** Fraction of the limit at/above which a mass is flagged "near" (within 2%). */
const NEAR_LIMIT_FRACTION = 0.98

type LimitProximity = 'normal' | 'near' | 'over'

function massProximity(value: number, limit: number | null | undefined): LimitProximity {
  if (limit == null || !(limit > 0)) return 'normal'
  if (value > limit) return 'over'
  if (value >= limit * NEAR_LIMIT_FRACTION) return 'near'
  return 'normal'
}

const takeoffMassProximity = computed<LimitProximity>(() =>
  props.result?.success
    ? massProximity(props.result.takeoffCenterOfGravityPoint.mass, props.limits?.maxTakeoffMass)
    : 'normal',
)

const zeroFuelMassProximity = computed<LimitProximity>(() =>
  props.result?.success
    ? massProximity(props.result.zeroFuelCenterOfGravityPoint.mass, props.limits?.maxZeroFuelMass)
    : 'normal',
)

/** Colour-independent status text for screen readers (never colour alone). */
function proximityLabel(proximity: LimitProximity): string {
  if (proximity === 'over') return 'at or above limit'
  if (proximity === 'near') return 'approaching limit'
  return ''
}
</script>

<template>
  <section v-if="result" class="result-summary" aria-label="Calculation results">
    <h3 class="result-summary__title">Results</h3>

    <div v-if="!result.success" class="result-summary__error" role="alert">
      <p>Input validation failed — correct the highlighted fields to compute results.</p>
    </div>

    <template v-else>
      <dl class="result-summary__grid">
        <div class="result-summary__item">
          <dt>Takeoff Mass</dt>
          <dd>
            <span
              class="result-summary__value"
              :class="`result-summary__value--${takeoffMassProximity}`"
            >
              {{ formatMassConservative(result.takeoffCenterOfGravityPoint.mass, 1) }}
            </span>
            <span class="result-summary__unit">kg</span>
            <span v-if="limits" class="result-summary__limit">
              / {{ formatMassConservative(limits.maxTakeoffMass, 0) }}
            </span>
            <span v-if="takeoffMassProximity !== 'normal'" class="result-summary__sr-only">
              {{ proximityLabel(takeoffMassProximity) }}
            </span>
          </dd>
        </div>

        <div class="result-summary__item">
          <dt>Zero Fuel Mass</dt>
          <dd>
            <span
              class="result-summary__value"
              :class="`result-summary__value--${zeroFuelMassProximity}`"
            >
              {{ formatMassConservative(result.zeroFuelCenterOfGravityPoint.mass, 1) }}
            </span>
            <span class="result-summary__unit">kg</span>
            <span v-if="limits?.maxZeroFuelMass != null" class="result-summary__limit">
              / {{ formatMassConservative(limits.maxZeroFuelMass, 0) }}
            </span>
            <span v-if="zeroFuelMassProximity !== 'normal'" class="result-summary__sr-only">
              {{ proximityLabel(zeroFuelMassProximity) }}
            </span>
          </dd>
        </div>

        <div class="result-summary__item">
          <dt>CG (Takeoff)</dt>
          <dd>
            <span class="result-summary__value">
              {{ formatArm(result.takeoffCenterOfGravityPoint.arm, 3) }}
            </span>
            <span class="result-summary__unit">m</span>
          </dd>
        </div>

        <div class="result-summary__item">
          <dt>CG (Landing)</dt>
          <dd>
            <span class="result-summary__value">
              {{ formatArm(result.landingCenterOfGravityPoint.arm, 3) }}
            </span>
            <span class="result-summary__unit">m</span>
          </dd>
        </div>
      </dl>
    </template>
  </section>
</template>

<style scoped>
.result-summary {
  background: var(--color-surface, #fff);
  border: 1px solid var(--color-border, #e0e0e0);
  border-radius: 0.5rem;
  padding: 1rem;
}

.result-summary__title {
  font-size: 0.8125rem;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.05em;
  color: var(--color-text-secondary, #666);
  margin: 0 0 0.75rem;
  padding-bottom: 0.5rem;
  border-bottom: 1px solid var(--color-border, #e0e0e0);
}

.result-summary__grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 0.75rem 1.5rem;
  margin: 0;
}

.result-summary__item dt {
  font-size: 0.75rem;
  color: var(--color-text-secondary, #666);
  margin-bottom: 0.125rem;
}

.result-summary__item dd {
  margin: 0;
}

.result-summary__value {
  /* safety-critical numerics enlarged from 1.125rem so they read at a glance
     from arm's length in a vibrating cockpit. */
  font-size: 1.5rem;
  font-weight: 600;
  font-variant-numeric: tabular-nums;
  color: var(--color-text-primary, #212121);
}

/* Limit-proximity highlighting — colour is a secondary cue; the `/ limit`
   ratio and the screen-reader status text carry the same information without
   relying on colour. */
.result-summary__value--near {
  color: var(--color-warning, #b45309);
}

.result-summary__value--over {
  color: var(--color-critical, #c62828);
}

.result-summary__sr-only {
  position: absolute;
  width: 1px;
  height: 1px;
  padding: 0;
  margin: -1px;
  overflow: hidden;
  clip: rect(0, 0, 0, 0);
  white-space: nowrap;
  border: 0;
}

.result-summary__unit {
  font-size: 0.75rem;
  color: var(--color-text-secondary, #666);
  margin-left: 0.25rem;
}

.result-summary__limit {
  font-size: 0.75rem;
  color: var(--color-text-secondary, #999);
}

.result-summary__error {
  padding: 0.75rem 1rem;
  background: var(--color-critical-bg, #ffebee);
  border: 1px solid var(--color-critical, #f44336);
  border-radius: 0.25rem;
  color: var(--color-critical, #c62828);
  font-size: 0.875rem;
  font-weight: 500;
}

.result-summary__error p {
  margin: 0;
}
</style>
