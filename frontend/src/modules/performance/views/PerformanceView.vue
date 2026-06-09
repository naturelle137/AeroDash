<script setup lang="ts">
// @IMP-PF-VIEW-004@ (FROM: @REQ-PF-006@, @REQ-PF-007@, @REQ-PF-012@, @REQ-PF-013@, @REQ-PF-015@, @REQ-PF-016@)
import { computed, onMounted, ref } from 'vue'
import { useFleetStore } from '@/modules/aircraft/stores/fleet.store'
import { usePerformanceStore } from '@/modules/performance/stores/performance.store'
import type { AircraftProfile } from '@/core/adapters/aircraft.schema'
import type { FlightPhase } from '@/core/domain/aircraft.types'
import type { OsfPreset } from '@/modules/performance/stores/performance.types'
import PerformanceResultsTable from '@/modules/performance/components/PerformanceResultsTable.vue'
import ExtrapolationAcknowledgment from '@/modules/performance/components/ExtrapolationAcknowledgment.vue'

const fleetStore = useFleetStore()
const store = usePerformanceStore()

const REQUIRED_PHASES: FlightPhase[] = [
  'TakeoffRoll',
  'TakeoffDistance50ft',
  'LandingRoll',
  'LandingDistance50ft',
]

const OSF_PRESETS: { value: OsfPreset; label: string }[] = [
  { value: 'easa-standard', label: 'EASA Standard (1.25 / 1.43)' },
  { value: 'poh-afm', label: 'POH / AFM specific' },
  { value: 'short-field', label: 'Short field' },
  { value: 'custom', label: 'Custom multiplier' },
]

const selectedId = ref('')

/** A profile is usable for performance only when Verified and carrying all four POH phases. */
function isPerfCapable(p: AircraftProfile): boolean {
  if (p.status !== 'verified') return false
  const present = new Set(
    (p.performanceProfiles ?? []).filter((pp) => pp.dataPoints.length > 0).map((pp) => pp.flightPhase),
  )
  return REQUIRED_PHASES.every((ph) => present.has(ph))
}

const usableProfiles = computed(() => fleetStore.profiles.filter(isPerfCapable))
const hasUsableFleet = computed(() => usableProfiles.value.length > 0)

function optionLabel(p: AircraftProfile): string {
  return `${p.registration} — ${p.manufacturer} ${p.model}`
}

const selectedLabel = computed(() => {
  const p = usableProfiles.value.find((x) => x.id === selectedId.value)
  return p ? optionLabel(p) : ''
})

onMounted(async () => {
  if (fleetStore.fleetLoadState !== 'READY') {
    await fleetStore.loadAll()
  }
})

function onAircraftSelected(event: Event): void {
  const id = (event.target as HTMLSelectElement).value
  selectedId.value = id
  const profile = usableProfiles.value.find((p) => p.id === id)
  if (profile) {
    store.loadProfile(profile)
  } else {
    store.clearProfile()
  }
}

function numFromEvent(event: Event): number | null {
  const raw = (event.target as HTMLInputElement).value
  if (raw.trim() === '') return null
  const n = Number(raw)
  return Number.isFinite(n) ? n : null
}

function onCondition(key: 'mass' | 'pressureAltitude' | 'temperature', event: Event): void {
  store.updateCondition(key, numFromEvent(event))
}
function onAvailable(key: 'takeoff' | 'landing', event: Event): void {
  store.setAvailable(key, numFromEvent(event))
}
function onFactor(
  key: 'friction' | 'slope' | 'densityAltitude' | 'wind',
  event: Event,
): void {
  store.setFactor(key, numFromEvent(event) ?? 1)
}
function onOsfPreset(event: Event): void {
  store.setOsfPreset((event.target as HTMLSelectElement).value as OsfPreset)
}
function onCustomOsf(event: Event): void {
  store.setCustomOsf(numFromEvent(event))
}

const goNoGo = computed(() => {
  const r = store.result
  if (!r || !r.finalized) return null
  return r.goNoGo
})

const stateClass = computed(() => `perf-view--${store.uiState.toLowerCase()}`)
</script>

<template>
  <div class="perf-view" :class="stateClass">
    <header class="perf-view__header">
      <h1>Performance</h1>
      <p class="perf-view__subtitle">POH take-off &amp; landing distances with safety factors.</p>
    </header>

    <!-- Aircraft selection -->
    <section class="perf-card" aria-labelledby="perf-aircraft-heading">
      <h2 id="perf-aircraft-heading" class="perf-card__title">Aircraft</h2>
      <p v-if="!hasUsableFleet" class="perf-empty">
        No Verified aircraft with performance data in your fleet. Add POH performance tables and
        verify the profile to compute distances.
      </p>
      <div v-else class="perf-field">
        <label for="perf-aircraft-select" class="perf-field__label">
          {{ store.profile ? 'Aircraft' : 'Select aircraft' }}
        </label>
        <select
          id="perf-aircraft-select"
          :value="selectedId"
          aria-label="Select aircraft"
          class="perf-select"
          @change="onAircraftSelected"
        >
          <option value="">— choose aircraft —</option>
          <option v-for="p in usableProfiles" :key="p.id" :value="p.id">
            {{ optionLabel(p) }}
          </option>
        </select>
        <span v-if="selectedLabel" class="aircraft-label">{{ selectedLabel }}</span>
      </div>
    </section>

    <!-- Conditions + runway form -->
    <section v-if="store.profile" class="perf-card" aria-labelledby="perf-conditions-heading">
      <h2 id="perf-conditions-heading" class="perf-card__title">Conditions</h2>
      <div class="perf-grid">
        <div class="perf-field">
          <label for="perf-mass" class="perf-field__label">Mass (kg)</label>
          <input id="perf-mass" type="number" inputmode="decimal" class="perf-input"
            :value="store.conditions.mass ?? ''" @input="onCondition('mass', $event)" />
        </div>
        <div class="perf-field">
          <label for="perf-pa" class="perf-field__label">Pressure altitude (ft)</label>
          <input id="perf-pa" type="number" inputmode="decimal" class="perf-input"
            :value="store.conditions.pressureAltitude ?? ''" @input="onCondition('pressureAltitude', $event)" />
        </div>
        <div class="perf-field">
          <label for="perf-temp" class="perf-field__label">Temperature (°C)</label>
          <input id="perf-temp" type="number" inputmode="decimal" class="perf-input"
            :value="store.conditions.temperature ?? ''" @input="onCondition('temperature', $event)" />
        </div>
        <div class="perf-field">
          <label for="perf-tora" class="perf-field__label">Available take-off (TORA, m)</label>
          <input id="perf-tora" type="number" inputmode="decimal" class="perf-input"
            :value="store.available.takeoff ?? ''" @input="onAvailable('takeoff', $event)" />
        </div>
        <div class="perf-field">
          <label for="perf-lda" class="perf-field__label">Available landing (LDA, m)</label>
          <input id="perf-lda" type="number" inputmode="decimal" class="perf-input"
            :value="store.available.landing ?? ''" @input="onAvailable('landing', $event)" />
        </div>
      </div>

      <h3 class="perf-card__subtitle">Operational safety factor</h3>
      <div class="perf-grid">
        <div class="perf-field">
          <label for="perf-osf" class="perf-field__label">Preset</label>
          <select id="perf-osf" class="perf-select" :value="store.osfPreset" @change="onOsfPreset">
            <option v-for="o in OSF_PRESETS" :key="o.value" :value="o.value">{{ o.label }}</option>
          </select>
        </div>
        <div v-if="store.osfPreset === 'custom'" class="perf-field">
          <label for="perf-osf-custom" class="perf-field__label">Custom multiplier (1.00–3.00)</label>
          <input id="perf-osf-custom" type="number" step="0.01" inputmode="decimal" class="perf-input"
            :value="store.customOsf ?? ''" @input="onCustomOsf" />
        </div>
      </div>

      <h3 class="perf-card__subtitle">Correction factors</h3>
      <div class="perf-grid">
        <div class="perf-field">
          <label for="perf-friction" class="perf-field__label">Friction (ground roll)</label>
          <input id="perf-friction" type="number" step="0.01" inputmode="decimal" class="perf-input"
            :value="store.factors.friction" @input="onFactor('friction', $event)" />
        </div>
        <div class="perf-field">
          <label for="perf-slope" class="perf-field__label">Slope (ground roll)</label>
          <input id="perf-slope" type="number" step="0.01" inputmode="decimal" class="perf-input"
            :value="store.factors.slope" @input="onFactor('slope', $event)" />
        </div>
        <div class="perf-field">
          <label for="perf-da" class="perf-field__label">Density altitude (full)</label>
          <input id="perf-da" type="number" step="0.01" inputmode="decimal" class="perf-input"
            :value="store.factors.densityAltitude" @input="onFactor('densityAltitude', $event)" />
        </div>
        <div class="perf-field">
          <label for="perf-wind" class="perf-field__label">Wind (full)</label>
          <input id="perf-wind" type="number" step="0.01" inputmode="decimal" class="perf-input"
            :value="store.factors.wind" @input="onFactor('wind', $event)" />
        </div>
      </div>
    </section>

    <!-- Notifications -->
    <section v-if="store.notifications.length > 0" class="perf-notifications" aria-label="Performance alerts">
      <div
        v-for="n in store.notifications"
        :key="`${n.id}-${n.message}`"
        class="notification"
        :class="`notification--${n.severity.toLowerCase()}`"
      >
        <span class="notification__id">{{ n.id }}</span>
        <span class="notification__message">{{ n.message }}</span>
      </div>
    </section>

    <!-- Extrapolation acknowledgment gate -->
    <ExtrapolationAcknowledgment
      v-if="store.awaitingAcknowledgment"
      @acknowledge="store.acknowledgeExtrapolation()"
    />

    <!-- Results -->
    <section v-if="store.result" class="perf-card" aria-labelledby="perf-results-heading">
      <h2 id="perf-results-heading" class="perf-card__title">Results</h2>

      <div v-if="goNoGo !== null" class="perf-advisory" :class="goNoGo ? 'perf-advisory--go' : 'perf-advisory--nogo'">
        {{ goNoGo ? 'GO — runway sufficient' : 'NO-GO — runway insufficient' }}
      </div>
      <div v-else class="perf-advisory perf-advisory--pending">
        Advisory withheld — acknowledge the extrapolated data to finalize.
      </div>

      <PerformanceResultsTable :result="store.result" />
    </section>
  </div>
</template>

<style scoped>
.perf-view {
  max-width: 60rem;
  margin: 0 auto;
  padding: 1rem;
}

.perf-view__header {
  margin-bottom: 1rem;
}

.perf-view__subtitle {
  color: #6b7280;
  margin: 0.25rem 0 0;
}

.perf-card {
  background: #fff;
  border: 1px solid #e5e7eb;
  border-radius: 0.5rem;
  padding: 1rem 1.25rem;
  margin-bottom: 1rem;
}

.perf-card__title {
  margin: 0 0 0.75rem;
  font-size: 1.05rem;
}

.perf-card__subtitle {
  margin: 1rem 0 0.5rem;
  font-size: 0.9rem;
  color: #374151;
}

.perf-empty {
  color: #6b7280;
}

.perf-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(12rem, 1fr));
  gap: 0.75rem 1rem;
}

.perf-field {
  display: flex;
  flex-direction: column;
  gap: 0.25rem;
}

.perf-field__label {
  font-size: 0.8rem;
  color: #374151;
}

.perf-input,
.perf-select {
  min-height: 44px;
  padding: 0.4rem 0.6rem;
  border: 1px solid #d1d5db;
  border-radius: 0.375rem;
  font-size: 1rem;
}

.aircraft-label {
  margin-top: 0.5rem;
  font-weight: 600;
}

.perf-notifications {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
  margin-bottom: 1rem;
}

.notification {
  display: flex;
  gap: 0.6rem;
  align-items: baseline;
  padding: 0.6rem 0.8rem;
  border-radius: 0.375rem;
  border-left: 4px solid #9ca3af;
  background: #f3f4f6;
}

.notification__id {
  font-weight: 700;
  font-size: 0.75rem;
  white-space: nowrap;
}

.notification--warning {
  background: #fffbeb;
  border-left-color: #f59e0b;
  color: #92400e;
}

.notification--critical {
  background: #fef2f2;
  border-left-color: #dc2626;
  color: #991b1b;
}

.notification--error {
  background: #fef2f2;
  border-left-color: #b91c1c;
  color: #991b1b;
}

.notification--info {
  background: #eff6ff;
  border-left-color: #3b82f6;
  color: #1e40af;
}

.perf-advisory {
  font-weight: 700;
  padding: 0.6rem 0.8rem;
  border-radius: 0.375rem;
  margin-bottom: 0.75rem;
}

.perf-advisory--go {
  background: #ecfdf5;
  color: #065f46;
  border: 1px solid #34d399;
}

.perf-advisory--nogo {
  background: #fef2f2;
  color: #991b1b;
  border: 1px solid #f87171;
}

.perf-advisory--pending {
  background: #fffbeb;
  color: #92400e;
  border: 1px solid #f59e0b;
}
</style>
