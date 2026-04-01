<script setup lang="ts">
import { computed } from 'vue'
import { useMassBalanceStore } from '@/modules/mass-balance/stores/mass-balance.store'
import InputGroupCard from '@/modules/mass-balance/components/InputGroupCard.vue'
import MassStationInput from '@/modules/mass-balance/components/MassStationInput.vue'
import CGEnvelopeChart from '@/modules/mass-balance/components/CGEnvelopeChart.vue'
import ResultSummary from '@/modules/mass-balance/components/ResultSummary.vue'
import { AIRCRAFT_CATALOGUE } from '@/modules/mass-balance/data/aircraft-catalogue'

// ---------------------------------------------------------------------------
// Store connection (single source of truth)
// ---------------------------------------------------------------------------

const store = useMassBalanceStore()

// ---------------------------------------------------------------------------
// Data bindings — direct store projections for child component props
// ---------------------------------------------------------------------------

const stations = computed(() => store.availableStations)
const notifications = computed(() => store.notifications)
const lastResult = computed(() => store.lastResult)

const aircraftLabel = computed(() => {
  if (!store.aircraft) return ''
  return `${store.aircraft.registration} — ${store.aircraft.manufacturer} ${store.aircraft.model}`
})

const categories = computed(
  () => store.aircraft?.certificationCategories.map((c) => c.category) ?? [],
)
const activeCategory = computed(() => store.activeCategory)

const envelope = computed(() => store.activeCategoryDef?.envelope ?? [])
const graphType = computed(() => store.activeCategoryDef?.graphType ?? 'arm')

const categoryLimits = computed(() => {
  const def = store.activeCategoryDef
  if (!def) return null
  return {
    maxTakeoffMass: def.maxTakeoffMass,
    maxZeroFuelMass: def.maxZeroFuelMass,
  }
})

// ---------------------------------------------------------------------------
// ViewModel — single deterministic mapping of uiState → presentational flags
//
// Every UI rendering decision lives here. A test can set store.uiState to any
// value and snapshot the entire viewModel to verify correctness.
// ---------------------------------------------------------------------------

// @IMP-MB-UI-004@ (FROM: @REQ-UI-018@)
const viewModel = computed(() => {
  const state = store.uiState

  const bannerSeverity: 'success' | 'warning' | 'critical' | null =
    state === 'VERIFIED_SAFE'
      ? 'success'
      : state === 'WARNING'
        ? 'warning'
        : state === 'ERROR_CRITICAL'
          ? 'critical'
          : null

  return {
    stateClass: `state--${state}` as const,

    isInitial: state === 'INITIAL',
    isLoading: state === 'LOADING',
    isError: state === 'ERROR_CRITICAL',
    isWarning: state === 'WARNING',
    isSafe: state === 'VERIFIED_SAFE',

    inputsDisabled: state === 'INITIAL' || state === 'LOADING',

    statusHint:
      state === 'UNCONFIGURED'
        ? 'Complete required fields'
        : state === 'UNVERIFIED'
          ? 'Review and verify inputs'
          : null,

    bannerSeverity,

    canExport: state === 'VERIFIED_SAFE' || state === 'WARNING',
    exportRequiresConfirmation: state === 'UNVERIFIED',

    showChart: state !== 'INITIAL' && state !== 'LOADING',
    showResultSummary: store.lastResult !== null,
  }
})

// ---------------------------------------------------------------------------
// Event handlers — pure delegation to store actions
// ---------------------------------------------------------------------------

function onStationWeightChange(stationIndex: number, weight: number): void {
  store.updateStationWeight(stationIndex, weight)
}

function onCategoryChange(category: string): void {
  store.changeCertificationCategory(category)
}

function onResetPayload(): void {
  store.resetPayload()
}

function onAircraftSelected(event: Event): void {
  const id = (event.target as HTMLSelectElement).value
  if (!id) return
  const profile = AIRCRAFT_CATALOGUE.find((a) => a.id === id)
  if (profile) store.loadProfile(profile)
}
</script>

<template>
  <div class="mass-balance-view" :class="viewModel.stateClass">
    <!-- ─── INITIAL: aircraft selector ──────────────────────────────── -->
    <div v-if="viewModel.isInitial" class="placeholder">
      <label class="aircraft-select-label" for="aircraft-select">Select aircraft</label>
      <select
        id="aircraft-select"
        aria-label="Select aircraft"
        class="aircraft-select"
        @change="onAircraftSelected"
      >
        <option value="">— choose —</option>
        <option v-for="aircraft in AIRCRAFT_CATALOGUE" :key="aircraft.id" :value="aircraft.id">
          {{ aircraft.registration }} — {{ aircraft.manufacturer }} {{ aircraft.model }}
        </option>
      </select>
    </div>

    <!-- ─── LOADING: skeleton / spinner ──────────────────────────────── -->
    <div v-else-if="viewModel.isLoading" class="loading" aria-busy="true">
      <p>Loading aircraft profile…</p>
    </div>

    <!-- ─── Active states ────────────────────────────────────────────── -->
    <template v-else>
      <!-- State banner (WARNING / ERROR_CRITICAL / VERIFIED_SAFE) -->
      <header
        v-if="viewModel.bannerSeverity"
        class="state-banner"
        :class="`banner--${viewModel.bannerSeverity}`"
        role="alert"
      >
        <div
          v-for="n in notifications"
          :key="n.id"
          class="notification"
          :class="`notification--${n.severity.toLowerCase()}`"
        >
          {{ n.message }}
        </div>
        <div v-if="viewModel.isSafe" class="notification notification--success">
          Mass &amp; Balance verified — safe for flight
        </div>
      </header>

      <!-- Status hint (UNCONFIGURED / UNVERIFIED) -->
      <p v-if="viewModel.statusHint" class="status-hint" role="status">
        {{ viewModel.statusHint }}
      </p>

      <!-- Aircraft header + category selector -->
      <div class="aircraft-header">
        <span class="aircraft-label">{{ aircraftLabel }}</span>
        <select
          v-if="categories.length > 1"
          :value="activeCategory"
          :disabled="viewModel.inputsDisabled"
          aria-label="Certification category"
          @change="onCategoryChange(($event.target as HTMLSelectElement).value)"
        >
          <option v-for="cat in categories" :key="cat" :value="cat">
            {{ cat }}
          </option>
        </select>
      </div>

      <!-- Two-column (desktop) / stacked (mobile) layout -->
      <div class="layout">
        <!-- Left column: station inputs -->
        <section class="layout__inputs">
          <InputGroupCard>
            <MassStationInput
              v-for="station in stations"
              :key="station.index"
              :station="station"
              :disabled="viewModel.inputsDisabled"
              @update:weight="onStationWeightChange(station.index, $event)"
            />
          </InputGroupCard>

          <div class="input-actions">
            <button :disabled="viewModel.inputsDisabled" @click="onResetPayload">
              Reset Payload
            </button>
          </div>
        </section>

        <!-- Right column: chart + result summary -->
        <aside class="layout__results">
          <CGEnvelopeChart
            v-if="viewModel.showChart"
            :result="lastResult"
            :envelope="envelope"
            :graph-type="graphType"
            :severity="viewModel.bannerSeverity"
          />

          <ResultSummary
            v-if="viewModel.showResultSummary"
            :result="lastResult"
            :limits="categoryLimits"
            :can-export="viewModel.canExport"
            :export-requires-confirmation="viewModel.exportRequiresConfirmation"
          />
        </aside>
      </div>
    </template>
  </div>
</template>

<style scoped>
.mass-balance-view {
  display: flex;
  flex-direction: column;
  min-height: 100vh;
  padding: 1rem;
}

/* ─── Placeholder / Loading ──────────────────────────────────────────── */

.placeholder,
.loading {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 1rem;
  min-height: 60vh;
  color: var(--color-text-secondary, #999);
  font-size: 1.125rem;
}

.aircraft-select-label {
  font-weight: 600;
  color: var(--color-text, #333);
}

.aircraft-select {
  padding: 0.5rem 1rem;
  font-size: 1rem;
  border: 1px solid var(--color-border, #ccc);
  border-radius: 0.375rem;
  min-width: 18rem;
  background: var(--color-surface, #fff);
  cursor: pointer;
}

/* ─── State banner ───────────────────────────────────────────────────── */

.state-banner {
  padding: 0.75rem 1rem;
  border-radius: 0.25rem;
  margin-bottom: 1rem;
}

.banner--success {
  background-color: var(--color-success-bg, #e8f5e9);
  border: 1px solid var(--color-success, #4caf50);
}

.banner--warning {
  background-color: var(--color-warning-bg, #fff3e0);
  border: 1px solid var(--color-warning, #ff9800);
}

.banner--critical {
  background-color: var(--color-critical-bg, #ffebee);
  border: 1px solid var(--color-critical, #f44336);
}

/* ─── Status hint ────────────────────────────────────────────────────── */

.status-hint {
  padding: 0.5rem 1rem;
  color: var(--color-text-secondary, #666);
  font-style: italic;
  margin: 0 0 0.5rem;
}

/* ─── Aircraft header ────────────────────────────────────────────────── */

.aircraft-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0.5rem 0;
  margin-bottom: 1rem;
  gap: 1rem;
  flex-wrap: wrap;
}

.aircraft-label {
  font-weight: 600;
}

/* ─── Layout ─────────────────────────────────────────────────────────── */

.layout {
  display: flex;
  flex-direction: column;
  flex: 1;
  gap: 1rem;
}

.layout__inputs {
  flex: 1;
}

.input-actions {
  display: flex;
  gap: 0.5rem;
  padding: 0.75rem 0;
}

/* ─── Desktop (≥768px): side-by-side ─────────────────────────────────── */

@media (min-width: 768px) {
  .layout {
    flex-direction: row;
  }

  .layout__inputs {
    flex: 1 1 50%;
    overflow-y: auto;
    max-height: calc(100vh - 12rem);
  }

  .layout__results {
    flex: 1 1 50%;
    position: sticky;
    top: 1rem;
    align-self: flex-start;
  }
}

/* ─── Mobile (<768px): sticky result footer ──────────────────────────── */

@media (max-width: 767.98px) {
  .layout__results {
    position: sticky;
    bottom: 0;
    background: var(--color-surface, #fff);
    z-index: 10;
    padding: 0.5rem;
    border-top: 1px solid var(--color-border, #e0e0e0);
  }
}
</style>
