<script setup lang="ts">
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

const emit = defineEmits<{
  (e: 'export'): void
}>()
</script>

<template>
  <section v-if="result" class="result-summary" aria-label="Calculation results">
    <h3 class="result-summary__title">Results</h3>

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

    <div class="result-summary__actions">
      <button
        type="button"
        class="result-summary__export-btn"
        :disabled="!canExport"
        @click="emit('export')"
      >
        {{ exportRequiresConfirmation ? 'Export (Confirm)' : 'Export' }}
      </button>
    </div>
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

.result-summary__actions {
  margin-top: 1rem;
  padding-top: 0.75rem;
  border-top: 1px solid var(--color-border, #e0e0e0);
  display: flex;
  justify-content: flex-end;
}

.result-summary__export-btn {
  min-height: 2.75rem;
  padding: 0 1.25rem;
  border: none;
  border-radius: 0.25rem;
  background: var(--color-primary, #1976d2);
  color: #fff;
  font-size: 0.875rem;
  font-weight: 500;
  cursor: pointer;
  transition: background 0.15s ease;
}

.result-summary__export-btn:hover:not(:disabled) {
  background: var(--color-primary-dark, #1565c0);
}

.result-summary__export-btn:disabled {
  opacity: 0.4;
  cursor: not-allowed;
}
</style>
