<script setup lang="ts">
import { computed, onMounted, reactive, ref, watch } from 'vue'
import { useFleetStore } from '@/modules/aircraft/stores/fleet.store'
import ManualRunwayPanel from '@/modules/airport/components/ManualRunwayPanel.vue'
import CorrectionSourcePanel from '../components/CorrectionSourcePanel.vue'
import {
  ELEVATION_SUPPORTED_FT,
  PA_ELEVATION_UNITS,
  QNH_ADVISORY_HPA,
  QNH_SUPPORTED_HPA,
  QNH_UNITS,
  type PressureAltitudeField,
} from '@/core/logic/pressure-altitude'
import { inspectPohDistances, inspectTables, type InspectionResult } from '../services/poh-inspection'
import { usePressureAltitudeInput } from '../composables/pressure-altitude-input'

const fleet = useFleetStore()
const selectedId = ref('')
const inputs = reactive({ mass: '', temperature: '' })
const pa = usePressureAltitudeInput()
const result = ref<InspectionResult | null>(null)
/** Pressure altitude actually used by the displayed result. */
const lookupBasis = ref('')
const showPaErrors = ref(false)
const profile = computed(() => fleet.profiles.find((item) => item.id === selectedId.value))
const tables = computed(() => profile.value ? inspectTables(profile.value) : null)
const distances = [
  { key: 'takeoffRoll', label: 'TOR — Takeoff roll' },
  { key: 'takeoffDistance50ft', label: 'TOD — Takeoff distance to 50 ft' },
  { key: 'landingRoll', label: 'LR — Landing roll' },
  { key: 'landingDistance50ft', label: 'LD — Landing distance from 50 ft' },
] as const

const sourceInputsRevision = computed(() => JSON.stringify([inputs.mass, inputs.temperature, pa.revision.value]))
// Results belong to one exact set of inputs and one persisted snapshot.
watch([profile, inputs, () => fleet.fleetLoadState, pa.revision], () => { result.value = null }, { deep: true, flush: 'sync' })
onMounted(() => fleet.loadAll())
function paError(field: PressureAltitudeField): string | undefined {
  const derivation = pa.derivation.value
  if (derivation.status !== 'invalid') return undefined
  // Once the pilot starts the derivation, every missing or invalid part is named.
  const started = Object.values(pa.draft).some((value) => value !== '')
  return showPaErrors.value || started ? derivation.errors[field] : undefined
}
function compute(): void {
  showPaErrors.value = true
  if (fleet.fleetLoadState !== 'READY') {
    result.value = { status: 'blocked', reason: 'profile', message: 'Load the fleet successfully before computing.' }
    return
  }
  const resolved = pa.resolution.value
  if (resolved.status === 'blocked') {
    result.value = { status: 'blocked', reason: 'input', message: resolved.message }
    return
  }
  result.value = inspectPohDistances(profile.value, { ...inputs, pressureAltitude: resolved.value }, new Date())
  lookupBasis.value = resolved.method === 'direct'
    ? `${resolved.value.trim()} ft, entered directly`
    : `${resolved.displayFt} ft, derived from QNH and field elevation (unrounded value used)`
}
</script>

<template>
  <main class="performance-view">
    <header>
      <h1>Performance</h1>
      <p class="eyebrow">RAW POH TABLE DISTANCES</p>
      <p>Inspect base distances from your aircraft tables. No wind, surface, slope or operational
        factors are applied. No runway assessment or flight approval is provided.</p>
    </header>
    <section class="panel" aria-labelledby="aircraft-heading">
      <h2 id="aircraft-heading">Aircraft and source</h2>
      <p><RouterLink to="/fleet">Open Fleet to import, review or verify a profile</RouterLink>.</p>
      <p>Import an aircraft exchange JSON with all four <code>performanceProfiles</code> tables.
        Fleet provides import help and a read-only table review. Imported profiles remain Draft.</p>
      <p v-if="fleet.fleetLoadState === 'LOADING'" role="status">Loading fleet…</p>
      <div v-else-if="fleet.fleetLoadState === 'ERROR'" role="alert">
        Could not load fleet. {{ fleet.fleetLoadError }}
        <button type="button" @click="fleet.loadAll()">Retry</button>
      </div>
      <template v-else>
        <p v-if="!fleet.profiles.length">No aircraft profiles. Import your own sourced data in Fleet.</p>
        <label for="performance-aircraft">Aircraft profile</label>
        <select id="performance-aircraft" v-model="selectedId">
          <option value="">Select a profile</option>
          <option v-for="item in fleet.profiles" :key="item.id" :value="item.id">
            {{ item.registration }} — {{ item.model }} ({{ item.status }})
          </option>
        </select>
      </template>
      <div v-if="profile" class="source-info">
        <p>{{ profile.manufacturer }} {{ profile.model }} · {{ profile.registration }} · {{ profile.status }}</p>
        <p>Snapshot ID: <code>{{ profile.id }}</code> · Schema version {{ profile.schemaVersion }}</p>
        <p v-if="profile.verification">User review: {{ profile.verification.verifiedBy }} on
          {{ profile.verification.verifiedOn }} · POH/AFM {{ profile.verification.pohRevision }}</p>
        <p v-else>No POH/AFM revision sign-off recorded.</p>
        <p>Verified records user review, not aviation certification. Check applicability, table
          conditions and results against the aircraft's official POH/AFM and independent reference cases.
          No aircraft-specific operational validation is supplied by AeroDash.</p>
      </div>
      <p v-if="tables?.status === 'blocked'" role="alert">{{ tables.message }}</p>
      <div v-if="tables?.status === 'ready'" class="bounds">
        <h3>Common supported table envelope</h3>
        <p>Mass: {{ tables.bounds.mass.min }} to {{ tables.bounds.mass.max }} kg · Pressure altitude:
          {{ tables.bounds.pressureAltitude.min }} to {{ tables.bounds.pressureAltitude.max }} ft · Temperature:
          {{ tables.bounds.temperature.min }} to {{ tables.bounds.temperature.max }} °C</p>
        <p>All four tables must support the point. Outside values are blocked.</p>
      </div>
      <p v-if="profile?.status === 'draft'" role="status">Draft: explicitly review and verify in Fleet before computation.</p>
    </section>
    <form class="panel" novalidate @submit.prevent="compute">
      <h2>Table lookup conditions</h2>
      <div class="fields">
        <label>Mass (kg)<input v-model="inputs.mass" type="text" inputmode="decimal" /></label>
        <label>Temperature (°C)<input v-model="inputs.temperature" type="text" inputmode="decimal" /></label>
      </div>
      <fieldset class="pa-method">
        <legend>Pressure altitude source</legend>
        <label class="choice"><input v-model="pa.method.value" type="radio" name="pa-method" value="direct" />
          Enter pressure altitude directly</label>
        <label class="choice"><input v-model="pa.method.value" type="radio" name="pa-method" value="qnh-elevation" />
          Derive from QNH and field elevation</label>
        <p v-if="!pa.method.value">No method selected. Choose one; nothing is assumed.</p>
        <div v-if="pa.method.value === 'direct'" class="fields">
          <label>Pressure altitude (ft)<input id="pa-direct" v-model="pa.direct.value" type="text" inputmode="decimal" /></label>
        </div>
        <p v-if="pa.method.value === 'direct'">Used exactly as entered. Field elevation is never treated as pressure altitude.</p>
        <section v-if="pa.method.value === 'qnh-elevation'" aria-label="QNH and field elevation">
          <div class="fields">
            <label for="pa-qnh">QNH<input id="pa-qnh" v-model="pa.draft.qnh" type="text" inputmode="decimal" :aria-invalid="!!paError('qnh')" /></label>
            <div class="field">
              <label for="pa-qnh-unit">QNH unit</label>
              <select id="pa-qnh-unit" v-model="pa.draft.qnhUnit" :aria-invalid="!!paError('qnhUnit')">
                <option value="">Select unit</option>
                <option v-for="unit in QNH_UNITS" :key="unit" :value="unit">{{ unit }}</option>
              </select>
            </div>
            <label for="pa-elevation">Pressure-altitude field elevation<input id="pa-elevation" v-model="pa.draft.elevation" type="text" inputmode="decimal" :aria-invalid="!!paError('elevation')" /></label>
            <div class="field">
              <label for="pa-elevation-unit">Pressure-altitude field elevation unit</label>
              <select id="pa-elevation-unit" v-model="pa.draft.elevationUnit" :aria-invalid="!!paError('elevationUnit')">
                <option value="">Select unit</option>
                <option v-for="unit in PA_ELEVATION_UNITS" :key="unit" :value="unit">{{ unit }}</option>
              </select>
            </div>
          </div>
          <p v-for="field in (['qnh', 'qnhUnit', 'elevation', 'elevationUnit'] as const)" v-show="paError(field)" :key="field" class="field-error">{{ paError(field) }}</p>
          <p>Enter the current QNH yourself from an official source; AeroDash has no weather default.
            Supported model range: QNH {{ QNH_SUPPORTED_HPA.min }}–{{ QNH_SUPPORTED_HPA.max }} hPa, field elevation
            {{ ELEVATION_SUPPORTED_FT.min }} to {{ ELEVATION_SUPPORTED_FT.max }} ft.</p>
          <button type="button" class="secondary" :disabled="!pa.savedRunway.value" @click="pa.useRunwayElevation()">
            Use saved manual runway elevation</button>
          <p v-if="!pa.savedRunway.value">No saved, unchanged manual runway is available to copy from.</p>
          <p v-if="pa.notice.value" role="status">{{ pa.notice.value }}</p>
          <p v-if="pa.draft.elevation">Field elevation source: {{ pa.elevationProvenance.value }}</p>
          <p v-if="pa.derivation.value.status === 'valid' && pa.derivation.value.warnings.qnhOutsideAdvisoryRange" role="alert">
            WARNING WARN-UI-001: QNH {{ pa.derivation.value.qnh.value }} hPa is outside the standard
            {{ QNH_ADVISORY_HPA.min }}–{{ QNH_ADVISORY_HPA.max }} hPa range. Check the value.</p>
          <div v-if="pa.derivation.value.status === 'valid'" aria-label="Derived pressure altitude" class="derived">
            <p>Derived pressure altitude: <strong>{{ pa.derivation.value.displayPressureAltitudeFt }} ft</strong></p>
            <p>From QNH {{ pa.derivation.value.qnh.value }} {{ pa.derivation.value.qnh.unit }} and field elevation
              {{ pa.derivation.value.elevation.value }} {{ pa.derivation.value.elevation.unit }}
              ({{ pa.derivation.value.elevationFt.toFixed(1) }} ft). The lookup uses the unrounded value.</p>
          </div>
          <p v-else>No derived pressure altitude. Enter QNH and field elevation with units.</p>
          <p class="method-limits">Method: NOAA/NWS altimeter-setting and pressure-altitude formulas, solved for
            the station pressure P whose altimeter setting at this elevation equals the QNH (including the
            published 0.3 hPa term); PA = 145366.45 × (1 − (P / 1013.25)^0.190284) ft. With QNH 1013.25 hPa this
            gives about 8 ft below the elevation. It assumes the QNH is the current altimeter setting for this
            aerodrome and the elevation is where you need pressure altitude.
            It is not the 30 ft/hPa rule of thumb, not an aircraft model and not validated against your POH/AFM.
            These inputs are not stored.</p>
        </section>
      </fieldset>
      <p>Mass is in kg; pressure altitude in ft; outside air temperature in °C. Source tables are converted to
        these lookup units; no wind, surface or slope correction is applied.</p>
      <button type="submit" :disabled="!profile || fleet.fleetLoadState !== 'READY'">Compute raw distances</button>
      <p v-if="result?.status === 'blocked'" role="alert">{{ result.message }}</p>
      <section v-if="result?.status === 'success'" aria-label="Raw POH table distances" aria-live="polite">
        <h2>RAW POH TABLE DISTANCES</h2>
        <dl class="results">
          <div v-for="distance in distances" :key="distance.key">
            <dt>{{ distance.label }}</dt><dd>{{ result.distances[distance.key].toFixed(1) }} m</dd>
          </div>
        </dl>
        <p>Pressure altitude used: {{ lookupBasis }}.</p>
        <p>Interpolated base table values only. No corrections, margins or runway comparison.</p>
      </section>
      <p v-else role="status">No distances displayed. Select a reviewed profile and compute with valid conditions.</p>
    </form>
    <ManualRunwayPanel />
    <CorrectionSourcePanel :profile="profile" :tables-complete="tables?.status === 'ready'"
      :ready="fleet.fleetLoadState === 'READY'" :inputs-revision="sourceInputsRevision" />
  </main>
</template>

<style scoped>
.performance-view { max-width: 960px; margin: auto; padding: 1.25rem; display: grid; gap: 1.25rem; color: var(--color-text-primary); }
h1, h2, h3 { margin: 0 0 .75rem; }
p { line-height: 1.6; }
.eyebrow { font-weight: 700; letter-spacing: .06em; }
.panel { padding: 1.25rem; border: 1px solid var(--color-border); border-radius: 12px; background: var(--color-surface-card); min-width: 0; }
.source-info { overflow-wrap: anywhere; }
.fields, .results { display: grid; grid-template-columns: repeat(auto-fit, minmax(min(100%, 200px), 1fr)); gap: 1rem; }
label { display: grid; gap: .5rem; }
input, select, button { font: inherit; padding: .75rem; min-height: 44px; border-radius: 6px; border: 1px solid var(--color-border); background: var(--color-surface); color: inherit; }
select { width: 100%; margin-top: .5rem; }
button { cursor: pointer; font-weight: 600; }
.pa-method { border: 1px solid var(--color-border); border-radius: 8px; padding: 1rem; margin: 1rem 0; display: grid; gap: .5rem; min-width: 0; }
.field { display: grid; gap: .5rem; align-content: start; }
.field select { margin-top: 0; }
.choice { display: flex; align-items: center; gap: .5rem; min-height: 44px; padding: .5rem; cursor: pointer; }
.choice input { min-height: 24px; }
.secondary { justify-self: start; font-weight: 500; }
.field-error { color: var(--color-error, #b3261e); margin: 0; }
.derived strong { font-size: 1.25rem; }
.method-limits { font-size: .9rem; overflow-wrap: anywhere; }
button:disabled { opacity: .5; cursor: default; }
dd { margin: .5rem 0; font-size: 1.5rem; font-weight: 700; }
[role="alert"] { padding: .75rem; border-left: 4px solid var(--color-warning, #ba7b24); }
a { display: inline-flex; align-items: center; min-height: 44px; max-width: 100%; color: var(--color-primary); text-decoration: underline; }
</style>
