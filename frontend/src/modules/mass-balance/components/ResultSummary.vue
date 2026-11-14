<script setup lang="ts">
import { computed } from 'vue'
import type { MathCoreResult } from '@/modules/mass-balance/stores/mass-balance.types'
import {
  formatMassConservative,
  formatMassLimitConservative,
  formatArm,
} from '@/core/logic/display-rounding'
import {
  massLimitDifference,
  massLimitDifferenceText,
} from '@/modules/mass-balance/utils/mass-limit-difference'

interface CategoryLimits {
  maxTakeoffMass: number
  maxZeroFuelMass: number | null
}

const props = withDefaults(defineProps<{
  result: MathCoreResult | null
  limits: CategoryLimits | null
  canExport: boolean
  exportRequiresConfirmation?: boolean
  /** False while the shown figures are not for the current, acknowledged selection. */
  showLimitDifference?: boolean
}>(), { showLimitDifference: true })

defineEmits<{
  (e: 'export'): void
}>()

// ─── Above-limit highlighting ────────────────────────────────────────────────
//
// A presentational cue, NOT a Go/No-Go determination — the authoritative limit
// checks remain the math-core notifications. Only a raw mass strictly above its
// entered limit is coloured; there is no proximity band, because no applicable
// source defines a marginal threshold below a limit.

function isAboveLimit(value: number, limit: number | null | undefined): boolean {
  return massLimitDifference(value, limit)?.relation === 'above'
}

const takeoffMassAbove = computed(() =>
  props.result?.success
    ? isAboveLimit(props.result.takeoffCenterOfGravityPoint.mass, props.limits?.maxTakeoffMass)
    : false,
)

const zeroFuelMassAbove = computed(() =>
  props.result?.success
    ? isAboveLimit(props.result.zeroFuelCenterOfGravityPoint.mass, props.limits?.maxZeroFuelMass)
    : false,
)

const takeoffDifference = computed(() =>
  props.showLimitDifference && props.result?.success
    ? massLimitDifference(props.result.takeoffCenterOfGravityPoint.mass, props.limits?.maxTakeoffMass)
    : null,
)

const zeroFuelDifference = computed(() =>
  props.showLimitDifference && props.result?.success
    ? massLimitDifference(props.result.zeroFuelCenterOfGravityPoint.mass, props.limits?.maxZeroFuelMass)
    : null,
)

// Raw equality only (from the unrounded comparison); a rounded display that
// reads like the limit must never produce this prompt.
const exactLimitNames = computed(() =>
  [
    takeoffDifference.value?.relation === 'at' ? 'MTOM' : null,
    zeroFuelDifference.value?.relation === 'at' ? 'MZFM' : null,
  ].filter((name): name is string => name !== null),
)
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
              :class="{ 'result-summary__value--over': takeoffMassAbove }"
            >
              {{ formatMassConservative(result.takeoffCenterOfGravityPoint.mass, 1) }}
            </span>
            <span class="result-summary__unit">kg</span>
            <span v-if="limits" class="result-summary__limit">
              / MTOM {{ formatMassLimitConservative(limits.maxTakeoffMass, 1) }} kg
            </span>
            <span v-if="takeoffMassAbove" class="result-summary__sr-only">above limit</span>
            <p
              v-if="takeoffDifference"
              class="result-summary__difference"
              :class="`result-summary__difference--${takeoffDifference.relation}`"
              data-testid="takeoff-limit-difference"
            >
              {{ massLimitDifferenceText(takeoffDifference, 'MTOM') }}
            </p>
          </dd>
        </div>

        <div class="result-summary__item">
          <dt>Zero Fuel Mass</dt>
          <dd>
            <span
              class="result-summary__value"
              :class="{ 'result-summary__value--over': zeroFuelMassAbove }"
            >
              {{ formatMassConservative(result.zeroFuelCenterOfGravityPoint.mass, 1) }}
            </span>
            <span class="result-summary__unit">kg</span>
            <span v-if="limits?.maxZeroFuelMass != null" class="result-summary__limit">
              / MZFM {{ formatMassLimitConservative(limits.maxZeroFuelMass, 1) }} kg
            </span>
            <span v-if="zeroFuelMassAbove" class="result-summary__sr-only">above limit</span>
            <p
              v-if="zeroFuelDifference"
              class="result-summary__difference"
              :class="`result-summary__difference--${zeroFuelDifference.relation}`"
              data-testid="zero-fuel-limit-difference"
            >
              {{ massLimitDifferenceText(zeroFuelDifference, 'MZFM') }}
            </p>
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
      <p
        v-if="exactLimitNames.length > 0"
        class="result-summary__exact"
        data-testid="exact-limit-cross-check"
      >
        Exactly at {{ exactLimitNames.join(' and ') }}: no arithmetic mass difference remains.
        Re-check the loading and the entered category/profile
        {{ exactLimitNames.length > 1 ? 'limits' : 'limit' }} against the POH/AFM.
      </p>
      <p v-if="takeoffDifference || zeroFuelDifference" class="result-summary__scope">
        Arithmetic comparison with the mass limits entered in the aircraft profile; not
        additional permissible payload and not a flight-suitability or Go/No-Go
        determination. Cross-check against the POH/AFM.
      </p>
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

/* Colour is a secondary cue; the visible difference text and the
   screen-reader status text carry the same information. */
.result-summary__value--over {
  color: var(--color-critical, #c62828);
}

.result-summary__difference {
  margin: 0.25rem 0 0;
  font-size: 0.875rem;
  font-weight: 600;
  color: var(--color-text-primary, #212121);
}

.result-summary__difference--above {
  color: var(--color-critical, #c62828);
}

.result-summary__exact {
  margin: 0.75rem 0 0;
  padding: 0.5rem 0.75rem;
  border: 1px solid var(--color-border, #e0e0e0);
  border-left: 4px solid var(--color-text-secondary, #666);
  border-radius: 0.25rem;
  background: var(--color-surface-alt, #f5f5f5);
  font-size: 0.875rem;
  font-weight: 500;
  color: var(--color-text-primary, #212121);
}

.result-summary__scope {
  margin: 0.75rem 0 0;
  font-size: 0.75rem;
  color: var(--color-text-secondary, #666);
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
