<script setup lang="ts">
import { computed, ref } from 'vue'
import { useMassBalanceStore } from '@/modules/mass-balance/stores/mass-balance.store'
import { AircraftContextSchema } from '@/modules/mass-balance/data/aircraft-context.schema'
import InputGroupCard from '@/modules/mass-balance/components/InputGroupCard.vue'
import MassStationInput from '@/modules/mass-balance/components/MassStationInput.vue'
import CGEnvelopeChart from '@/modules/mass-balance/components/CGEnvelopeChart.vue'
import ResultSummary from '@/modules/mass-balance/components/ResultSummary.vue'
import { AIRCRAFT_CATALOGUE } from '@/modules/mass-balance/data/aircraft-catalogue'

const catalogueError = ref<string | null>(null)

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

    /** M&B section is locked until an aircraft is loaded */
    mbLocked: state === 'INITIAL' || state === 'LOADING',

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
  catalogueError.value = null
  const profile = AIRCRAFT_CATALOGUE.find((a) => a.id === id)
  if (!profile) return

  const validation = AircraftContextSchema.safeParse(profile)
  if (!validation.success) {
    catalogueError.value = `Aircraft profile "${id}" failed validation — data may be corrupted.`
    return
  }

  store.loadProfile(profile)
}
</script>

<template>
  <div class="fp-view" :class="viewModel.stateClass">

    <!-- ═══ Page header ════════════════════════════════════════════════════ -->
    <div class="fp-page-header">
      <h1 class="fp-page-title">Flight Preparation</h1>
      <p class="fp-page-sub">Mass &amp; Balance · Performance · Weather · Fuel</p>
    </div>

    <!-- ═══ AIRCRAFT SELECTION CARD (always visible) ══════════════════════ -->
    <section class="prep-card prep-card--aircraft" aria-label="Aircraft selection">
      <div class="prep-card__header">
        <span class="prep-card__badge">01</span>
        <h2 class="prep-card__title">Aircraft</h2>
        <span v-if="aircraftLabel" class="aircraft-label">{{ aircraftLabel }}</span>
      </div>

      <!-- Catalogue validation error -->
      <div v-if="catalogueError" class="inline-alert inline-alert--critical" role="alert">
        {{ catalogueError }}
      </div>

      <div class="aircraft-selector-row">
        <div class="aircraft-selector-field">
          <label for="aircraft-select" class="field-label">Select aircraft</label>
          <select
            id="aircraft-select"
            aria-label="Select aircraft"
            class="aircraft-select"
            @change="onAircraftSelected"
          >
            <option value="">— choose aircraft —</option>
            <option v-for="aircraft in AIRCRAFT_CATALOGUE" :key="aircraft.id" :value="aircraft.id">
              {{ aircraft.registration }} — {{ aircraft.manufacturer }} {{ aircraft.model }}
            </option>
          </select>
        </div>

        <div v-if="categories.length > 1" class="aircraft-selector-field">
          <label class="field-label" for="category-select">Category</label>
          <select
            id="category-select"
            :value="activeCategory"
            :disabled="viewModel.inputsDisabled"
            aria-label="Certification category"
            class="aircraft-select"
            @change="onCategoryChange(($event.target as HTMLSelectElement).value)"
          >
            <option v-for="cat in categories" :key="cat" :value="cat">
              {{ cat }}
            </option>
          </select>
        </div>
      </div>

      <!-- Loading state -->
      <div v-if="viewModel.isLoading" class="loading-row" aria-busy="true" aria-live="polite">
        <span class="loading-spinner" aria-hidden="true" />
        <span>Loading aircraft profile…</span>
      </div>
    </section>

    <!-- ═══ MASS & BALANCE CARD ════════════════════════════════════════════ -->
    <section
      class="prep-card prep-card--mb"
      :class="{ 'prep-card--locked': viewModel.mbLocked }"
      aria-label="Mass and Balance"
    >
      <div class="prep-card__header">
        <span class="prep-card__badge">02</span>
        <h2 class="prep-card__title">Mass &amp; Balance</h2>
        <span v-if="viewModel.mbLocked" class="locked-badge" aria-label="Select an aircraft to unlock">
          <svg width="14" height="14" viewBox="0 0 14 14" fill="none" aria-hidden="true">
            <rect x="2" y="6" width="10" height="7" rx="1.5" stroke="currentColor" stroke-width="1.2" />
            <path d="M4 6V4a3 3 0 016 0v2" stroke="currentColor" stroke-width="1.2" stroke-linecap="round" />
          </svg>
          Select aircraft to unlock
        </span>
        <span v-else-if="viewModel.bannerSeverity" class="state-badge" :class="`state-badge--${viewModel.bannerSeverity}`">
          {{ viewModel.isSafe ? 'VERIFIED SAFE' : viewModel.isWarning ? 'WARNING' : 'CRITICAL' }}
        </span>
      </div>

      <!-- Locked overlay (INITIAL/LOADING with no aircraft) -->
      <div v-if="viewModel.mbLocked" class="locked-placeholder" aria-hidden="true">
        <svg width="40" height="40" viewBox="0 0 40 40" fill="none" class="locked-icon">
          <rect x="6" y="18" width="28" height="18" rx="4" stroke="currentColor" stroke-width="2" />
          <path d="M12 18V13a8 8 0 0116 0v5" stroke="currentColor" stroke-width="2" stroke-linecap="round" />
          <circle cx="20" cy="27" r="2" fill="currentColor" />
        </svg>
        <p class="locked-hint">Select an aircraft above to start Mass &amp; Balance</p>
      </div>

      <!-- Active M&B content -->
      <template v-else>
        <!-- Status banner (WARNING / ERROR_CRITICAL / VERIFIED_SAFE) -->
        <div
          v-if="viewModel.bannerSeverity"
          class="status-banner"
          :class="`banner--${viewModel.bannerSeverity}`"
          role="alert"
          :aria-live="viewModel.isError ? 'assertive' : 'polite'"
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
        </div>

        <!-- Status hint (UNCONFIGURED / UNVERIFIED) -->
        <p v-if="viewModel.statusHint" class="status-hint" role="status">
          {{ viewModel.statusHint }}
        </p>

        <!-- Two-column (desktop) / stacked (mobile) layout -->
        <div class="mb-layout">
          <!-- Left column: station inputs -->
          <section class="mb-layout__inputs">
            <InputGroupCard>
              <!-- @IMP-MB-UI-007@ (FROM: @REQ-UQ-005@) -->
              <MassStationInput
                v-for="station in stations"
                :key="station.index"
                :station="station"
                :unit="store.aircraft?.loadPoints[station.index]?.unit"
                :disabled="viewModel.inputsDisabled"
                @update:weight="onStationWeightChange(station.index, $event)"
              />
            </InputGroupCard>

            <div class="input-actions">
              <button
                class="reset-btn"
                :disabled="viewModel.inputsDisabled"
                @click="onResetPayload"
              >
                Reset Payload
              </button>
            </div>
          </section>

          <!-- Right column: chart + result summary -->
          <aside class="mb-layout__results">
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
    </section>

    <!-- ═══ COMING SOON: Performance ══════════════════════════════════════ -->
    <section class="prep-card prep-card--soon" aria-label="Performance — coming soon">
      <div class="prep-card__header">
        <span class="prep-card__badge prep-card__badge--soon">03</span>
        <h2 class="prep-card__title prep-card__title--soon">Performance</h2>
        <span class="soon-pill">Coming soon</span>
      </div>
      <p class="soon-desc">
        TOLD calculations — takeoff &amp; landing distances with POH-based correction factors,
        wet/dry/grass surface conditions, operational safety factors.
      </p>
    </section>

    <!-- ═══ COMING SOON: Weather ════════════════════════════════════════════ -->
    <section class="prep-card prep-card--soon" aria-label="Weather — coming soon">
      <div class="prep-card__header">
        <span class="prep-card__badge prep-card__badge--soon">04</span>
        <h2 class="prep-card__title prep-card__title--soon">Weather</h2>
        <span class="soon-pill">Coming soon</span>
      </div>
      <p class="soon-desc">
        METAR &amp; TAF integration, crosswind component, runway surface conditions,
        wind limit advisory.
      </p>
    </section>

    <!-- ═══ COMING SOON: Fuel & Endurance ══════════════════════════════════ -->
    <section class="prep-card prep-card--soon" aria-label="Fuel and Endurance — coming soon">
      <div class="prep-card__header">
        <span class="prep-card__badge prep-card__badge--soon">05</span>
        <h2 class="prep-card__title prep-card__title--soon">Fuel &amp; Endurance</h2>
        <span class="soon-pill">Coming soon</span>
      </div>
      <p class="soon-desc">
        Fuel density correction, endurance vs planned flight time, reserve calculation.
      </p>
    </section>

    <!-- ═══ Operational disclaimer (bottom, non-blocking) ═════════════════ -->
    <div class="disclaimer" role="note" aria-label="Operational disclaimer">
      <strong>Advisory only</strong> — verify all results against the official POH/AFM before
      flight. This tool is not a certified aviation device.
    </div>

  </div>
</template>

<style scoped>
/* ─── Page shell ─────────────────────────────────────────────────────────── */

.fp-view {
  display: flex;
  flex-direction: column;
  gap: var(--space-4);
  padding: var(--space-6);
  max-width: 1280px;
  margin: 0 auto;
}

/* ─── Page header ─────────────────────────────────────────────────────────── */

.fp-page-header {
  padding-bottom: var(--space-2);
}

.fp-page-title {
  font-size: var(--text-2xl);
  font-weight: 700;
  color: var(--color-text-primary);
  margin: 0 0 var(--space-1);
  letter-spacing: -0.02em;
}

.fp-page-sub {
  font-size: var(--text-xs);
  color: var(--color-text-secondary);
  text-transform: uppercase;
  letter-spacing: 0.06em;
  margin: 0;
}

/* ─── Prep cards (sections) ─────────────────────────────────────────────── */

.prep-card {
  background: var(--color-surface-card);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-xl);
  box-shadow: var(--shadow-sm);
  padding: var(--space-5) var(--space-6);
  transition: border-color var(--transition-normal);
}

.prep-card--aircraft {
  border-left: 3px solid var(--color-primary);
}

.prep-card--mb:not(.prep-card--locked) {
  border-left: 3px solid var(--color-primary);
}

.prep-card--mb.prep-card--locked {
  border-left: 3px solid var(--color-border);
  opacity: 0.7;
}

.prep-card--soon {
  border-style: dashed;
  opacity: 0.5;
}

.prep-card__header {
  display: flex;
  align-items: center;
  gap: var(--space-3);
  margin-bottom: var(--space-4);
  flex-wrap: wrap;
}

.prep-card__badge {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 24px;
  height: 24px;
  background: var(--color-primary-bg);
  color: var(--color-primary);
  border-radius: var(--radius-full);
  font-size: var(--text-xs);
  font-weight: 700;
  flex-shrink: 0;
}

.prep-card__badge--soon {
  background: var(--color-tag-soon-bg);
  color: var(--color-tag-soon-text);
}

.prep-card__title {
  font-size: var(--text-lg);
  font-weight: 700;
  color: var(--color-text-primary);
  margin: 0;
}

.prep-card__title--soon {
  color: var(--color-text-secondary);
}

/* ─── Aircraft label (shown after selection, kept for E2E) ───────────────── */

.aircraft-label {
  font-size: var(--text-sm);
  font-weight: 600;
  color: var(--color-primary);
  flex: 1;
  text-align: right;
}

/* ─── Inline alert ───────────────────────────────────────────────────────── */

.inline-alert {
  padding: var(--space-3) var(--space-4);
  border-radius: var(--radius-md);
  font-size: var(--text-sm);
  font-weight: 500;
  margin-bottom: var(--space-4);
}

.inline-alert--critical {
  background: var(--color-critical-bg);
  border: 1px solid var(--color-critical);
  color: var(--color-critical);
}

/* ─── Aircraft selector row ──────────────────────────────────────────────── */

.aircraft-selector-row {
  display: flex;
  gap: var(--space-4);
  flex-wrap: wrap;
}

.aircraft-selector-field {
  display: flex;
  flex-direction: column;
  gap: var(--space-1);
  flex: 1;
  min-width: 220px;
}

.field-label {
  font-size: var(--text-xs);
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.05em;
  color: var(--color-text-secondary);
}

.aircraft-select {
  padding: var(--space-2) var(--space-3);
  font-size: var(--text-base);
  font-family: inherit;
  border: 1px solid var(--color-border);
  border-radius: var(--radius-md);
  background: var(--color-surface);
  color: var(--color-text);
  cursor: pointer;
  min-height: 44px;
  transition: border-color var(--transition-fast), box-shadow var(--transition-fast);
}

.aircraft-select:hover {
  border-color: var(--color-primary);
}

.aircraft-select:focus-visible {
  outline: 2px solid var(--color-focus);
  outline-offset: 2px;
  border-color: var(--color-primary);
}

/* ─── Loading row ────────────────────────────────────────────────────────── */

.loading-row {
  display: flex;
  align-items: center;
  gap: var(--space-2);
  color: var(--color-text-secondary);
  font-size: var(--text-sm);
  margin-top: var(--space-3);
}

.loading-spinner {
  width: 16px;
  height: 16px;
  border: 2px solid var(--color-border);
  border-top-color: var(--color-primary);
  border-radius: 50%;
  animation: spin 0.8s linear infinite;
}

@keyframes spin {
  to { transform: rotate(360deg); }
}

/* ─── Locked badges ─────────────────────────────────────────────────────── */

.locked-badge {
  display: inline-flex;
  align-items: center;
  gap: var(--space-1);
  font-size: var(--text-xs);
  color: var(--color-text-secondary);
  font-weight: 500;
}

.state-badge {
  display: inline-flex;
  align-items: center;
  font-size: var(--text-xs);
  font-weight: 700;
  letter-spacing: 0.05em;
  padding: 0.2em 0.6em;
  border-radius: var(--radius-full);
}

.state-badge--success {
  background: var(--color-success-bg);
  color: var(--color-success);
}

.state-badge--warning {
  background: var(--color-warning-bg);
  color: var(--color-warning);
}

.state-badge--critical {
  background: var(--color-critical-bg);
  color: var(--color-critical);
}

/* ─── Locked placeholder ─────────────────────────────────────────────────── */

.locked-placeholder {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: var(--space-3);
  padding: var(--space-8) var(--space-4);
  color: var(--color-text-secondary);
}

.locked-icon {
  opacity: 0.3;
}

.locked-hint {
  font-size: var(--text-sm);
  margin: 0;
}

/* ─── Status banner ──────────────────────────────────────────────────────── */

.status-banner {
  padding: var(--space-3) var(--space-4);
  border-radius: var(--radius-md);
  margin-bottom: var(--space-4);
  display: flex;
  flex-direction: column;
  gap: var(--space-1);
}

.banner--success {
  background: var(--color-success-bg);
  border: 1px solid var(--color-success);
}

.banner--warning {
  background: var(--color-warning-bg);
  border: 1px solid var(--color-warning);
}

.banner--critical {
  background: var(--color-critical-bg);
  border: 1px solid var(--color-critical);
}

.notification {
  font-size: var(--text-sm);
  font-weight: 500;
}

.notification--success {
  color: var(--color-success);
}

.notification--warning {
  color: var(--color-warning);
}

.notification--critical {
  color: var(--color-critical);
}

/* ─── Status hint ────────────────────────────────────────────────────────── */

.status-hint {
  padding: var(--space-2) var(--space-4);
  color: var(--color-text-secondary);
  font-style: italic;
  font-size: var(--text-sm);
  margin: 0 0 var(--space-3);
}

/* ─── M&B layout ─────────────────────────────────────────────────────────── */

.mb-layout {
  display: flex;
  flex-direction: column;
  gap: var(--space-4);
}

.mb-layout__inputs {
  flex: 1;
}

.input-actions {
  display: flex;
  gap: var(--space-2);
  padding: var(--space-3) 0 0;
}

.reset-btn {
  padding: var(--space-2) var(--space-4);
  font-size: var(--text-sm);
  font-family: inherit;
  font-weight: 500;
  border: 1px solid var(--color-border);
  border-radius: var(--radius-md);
  background: var(--color-surface-alt);
  color: var(--color-text);
  cursor: pointer;
  min-height: 44px;
  transition:
    background var(--transition-fast),
    border-color var(--transition-fast);
}

.reset-btn:hover:not(:disabled) {
  background: var(--color-surface-hover);
  border-color: var(--color-primary);
  color: var(--color-primary);
}

.reset-btn:disabled {
  opacity: 0.4;
  cursor: not-allowed;
}

.reset-btn:focus-visible {
  outline: 2px solid var(--color-focus);
  outline-offset: 2px;
}

/* ─── Desktop: side-by-side M&B layout ──────────────────────────────────── */

@media (min-width: 900px) {
  .mb-layout {
    flex-direction: row;
    align-items: flex-start;
  }

  .mb-layout__inputs {
    flex: 0 0 42%;
    overflow-y: auto;
    max-height: calc(100vh - 16rem);
  }

  .mb-layout__results {
    flex: 1;
    position: sticky;
    top: calc(var(--nav-header-height) + var(--space-4));
    display: flex;
    flex-direction: column;
    gap: var(--space-3);
  }
}

/* ─── Mobile: sticky result footer ──────────────────────────────────────── */

@media (max-width: 899.98px) {
  .mb-layout__results {
    position: sticky;
    bottom: var(--nav-bottom-height);
    background: var(--color-surface-card);
    z-index: 10;
    padding: var(--space-2);
    border-top: 1px solid var(--color-border);
    margin: 0 calc(-1 * var(--space-6));
  }
}

/* ─── Coming soon sections ────────────────────────────────────────────────── */

.soon-pill {
  font-size: 0.625rem;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.06em;
  padding: 0.2em 0.5em;
  background: var(--color-tag-soon-bg);
  color: var(--color-tag-soon-text);
  border-radius: var(--radius-full);
}

.soon-desc {
  font-size: var(--text-sm);
  color: var(--color-text-secondary);
  margin: 0;
  line-height: 1.6;
}

/* ─── Disclaimer ─────────────────────────────────────────────────────────── */

.disclaimer {
  padding: var(--space-3) var(--space-4);
  background: var(--color-warning-bg);
  border: 1px solid var(--color-warning);
  border-radius: var(--radius-md);
  font-size: var(--text-xs);
  color: var(--color-text-primary);
  opacity: 0.8;
}

/* ─── Mobile ─────────────────────────────────────────────────────────────── */

@media (max-width: 767.98px) {
  .fp-view {
    padding: var(--space-4);
  }

  .prep-card {
    padding: var(--space-4);
  }

  .aircraft-selector-row {
    flex-direction: column;
  }

  .aircraft-selector-field {
    min-width: 0;
  }
}
</style>
