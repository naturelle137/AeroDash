<script setup lang="ts">
// @IMP-MB-UI-005@ (FROM: @REQ-UQ-003@, @REQ-UQ-005@)
import type { MathCoreResult } from '@/modules/mass-balance/stores/mass-balance.types'

interface CategoryLimits {
  maxTakeoffMass: number
  maxZeroFuelMass: number | null
}

defineProps<{
  result: MathCoreResult | null
  limits: CategoryLimits | null
  canExport: boolean
  exportRequiresConfirmation?: boolean
}>()

defineEmits<{
  (e: 'export'): void
}>()
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
            <span class="result-summary__value">
              {{ result.takeoffCenterOfGravityPoint.mass.toFixed(1) }}
            </span>
            <span class="result-summary__unit">kg</span>
            <span v-if="limits" class="result-summary__limit">
              / {{ limits.maxTakeoffMass.toFixed(0) }}
            </span>
          </dd>
        </div>

        <div class="result-summary__item">
          <dt>Zero Fuel Mass</dt>
          <dd>
            <span class="result-summary__value">
              {{ result.zeroFuelCenterOfGravityPoint.mass.toFixed(1) }}
            </span>
            <span class="result-summary__unit">kg</span>
            <span v-if="limits?.maxZeroFuelMass != null" class="result-summary__limit">
              / {{ limits.maxZeroFuelMass.toFixed(0) }}
            </span>
          </dd>
        </div>

        <div class="result-summary__item">
          <dt>CG (Takeoff)</dt>
          <dd>
            <span class="result-summary__value">
              {{ result.takeoffCenterOfGravityPoint.arm.toFixed(3) }}
            </span>
            <span class="result-summary__unit">m</span>
          </dd>
        </div>

        <div class="result-summary__item">
          <dt>CG (Landing)</dt>
          <dd>
            <span class="result-summary__value">
              {{ result.landingCenterOfGravityPoint.arm.toFixed(3) }}
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
  font-size: 1.125rem;
  font-weight: 600;
  font-variant-numeric: tabular-nums;
  color: var(--color-text-primary, #212121);
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
