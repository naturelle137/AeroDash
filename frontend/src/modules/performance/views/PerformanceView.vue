<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { useFleetStore } from '@/modules/aircraft/stores/fleet.store'
import AnnotationPanel from '@/modules/annotations/AnnotationPanel.vue'
import ManualRunwayPanel from '@/modules/airport/components/ManualRunwayPanel.vue'
import CorrectionSourcePanel from '../components/CorrectionSourcePanel.vue'
import ManualWindComponentPanel from '../components/ManualWindComponentPanel.vue'
import PerformanceStepPanel from '../components/PerformanceStepPanel.vue'
import UnitPreferencesFieldset from '../components/UnitPreferencesFieldset.vue'
import PerformanceTableBounds from '../components/PerformanceTableBounds.vue'
import { usePerformanceStep } from '../composables/performance-step'
import { massSourceFromText } from '../services/poh-inspection'

const fleet = useFleetStore()
const selectedId = ref('')
const mass = ref('')
const profile = computed(() => fleet.profiles.find((item) => item.id === selectedId.value) ?? null)
// The standalone lookup applies one entered mass to both groups; Flight Prep uses current masses.
const step = usePerformanceStep(() => {
  const source = massSourceFromText(mass.value, 'entered lookup mass')
  return {
    ready: fleet.fleetLoadState === 'READY',
    notReadyReason: 'Load the fleet successfully before computing.',
    profile: profile.value,
    category: null,
    takeoff: source,
    landing: source,
  }
})
onMounted(() => fleet.loadAll())
</script>

<template>
  <main class="performance-view">
    <header>
      <h1>Performance</h1>
      <p class="eyebrow">RAW POH TABLE DISTANCES</p>
      <p>Inspect base distances from your aircraft tables. The raw distances are uncorrected;
        corrected distances and runway comparisons appear separately where an accepted source applies. No flight approval is provided.
        Flight Prep uses the same lookup with your current takeoff and trip-arrival masses.</p>
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
      <PerformanceTableBounds v-if="profile" :tables="step.tables.value" />
      <p v-if="profile?.status === 'draft'" role="status">Draft: explicitly review and verify in Fleet before computation.</p>
    </section>
    <section class="panel" aria-labelledby="lookup-heading">
      <h2 id="lookup-heading">Table lookup conditions</h2>
      <PerformanceStepPanel :step="step" :can-compute="!!profile && fleet.fleetLoadState === 'READY'">
        <template #masses>
          <div class="fields">
            <label>Mass (kg)<input id="performance-mass" v-model="mass" type="text" inputmode="decimal" /></label>
          </div>
          <p>The entered mass is used for both takeoff and landing tables.</p>
        </template>
      </PerformanceStepPanel>
      <AnnotationPanel v-if="profile && fleet.fleetLoadState === 'READY'" :key="profile.id" :aircraft-id="profile.id" :warnings="step.annotationWarnings.value" performance />
    </section>
    <UnitPreferencesFieldset />
    <ManualRunwayPanel />
    <ManualWindComponentPanel />
    <CorrectionSourcePanel v-model:configuration="step.manualConfiguration.value" :profile="profile ?? undefined" :tables-complete="step.tables.value?.status === 'ready'"
      :ready="fleet.fleetLoadState === 'READY'" :inputs-revision="step.inputKey.value" />
  </main>
</template>

<style scoped>
.performance-view { max-width: 960px; margin: auto; padding: 1.25rem; display: grid; gap: 1.25rem; color: var(--color-text-primary); }
h1, h2 { margin: 0 0 .75rem; }
p { line-height: 1.6; }
.eyebrow { font-weight: 700; letter-spacing: .06em; }
.panel { padding: 1.25rem; border: 1px solid var(--color-border); border-radius: 12px; background: var(--color-surface-card); min-width: 0; }
.source-info { overflow-wrap: anywhere; }
.fields { display: grid; grid-template-columns: repeat(auto-fit, minmax(min(100%, 200px), 1fr)); gap: 1rem; }
label { display: grid; gap: .5rem; }
input, select, button { font: inherit; padding: .75rem; min-height: 44px; border-radius: 6px; border: 1px solid var(--color-border); background: var(--color-surface); color: inherit; }
select { width: 100%; margin-top: .5rem; }
button { cursor: pointer; font-weight: 600; }
[role="alert"] { padding: .75rem; border-left: 4px solid var(--color-warning, #ba7b24); }
a { display: inline-flex; align-items: center; min-height: 44px; max-width: 100%; color: var(--color-primary); text-decoration: underline; }
</style>
