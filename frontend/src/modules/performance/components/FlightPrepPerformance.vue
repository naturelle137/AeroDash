<script setup lang="ts">
import ManualRunwayPanel from '@/modules/airport/components/ManualRunwayPanel.vue'
import CorrectionSourcePanel from './CorrectionSourcePanel.vue'
import ManualWindComponentPanel from './ManualWindComponentPanel.vue'
import PerformanceStepPanel from './PerformanceStepPanel.vue'
import PerformanceTableBounds from './PerformanceTableBounds.vue'
import UnitPreferencesFieldset from './UnitPreferencesFieldset.vue'
import type { PerformanceStep, PerformanceStepContext } from '../composables/performance-step'
import { formatNumber } from '../services/performance-presentation'

const props = defineProps<{ step: PerformanceStep; context: PerformanceStepContext }>()
const { tables, inputKey, manualConfiguration } = props.step
</script>

<template>
  <div class="flight-prep-performance">
    <p v-if="!context.profile" role="status">{{ context.ready ? 'Select an aircraft in section 01.' : context.notReadyReason }}</p>
    <template v-else>
      <p class="aircraft">{{ context.profile.registration }} — {{ context.profile.manufacturer }} {{ context.profile.model }}
        <template v-if="context.category"> · {{ context.category }}</template>
        · {{ context.profile.status === 'verified' ? 'Verified' : 'Draft' }}</p>
      <p>Uses the aircraft, category and masses already entered in Flight Prep.
        <RouterLink to="/fleet">Open Fleet</RouterLink> to import, review or verify performance tables.</p>
      <PerformanceTableBounds :tables="tables" />
    </template>
    <section class="panel" aria-labelledby="fp-performance-lookup">
      <h3 id="fp-performance-lookup">Performance lookup</h3>
      <PerformanceStepPanel :step="step" :can-compute="context.ready && !!context.profile">
        <template #masses>
          <dl class="masses" aria-label="Masses used">
            <div>
              <dt>Takeoff mass (TOR, TOD)</dt>
              <dd v-if="context.takeoff.status === 'ready'">{{ formatNumber(context.takeoff.massKg) }} kg — {{ context.takeoff.origin }}</dd>
              <dd v-else class="unavailable">Unavailable: {{ context.takeoff.reason }}</dd>
            </div>
            <div>
              <dt>Landing mass (LR, LD)</dt>
              <dd v-if="context.landing.status === 'ready'">{{ formatNumber(context.landing.massKg) }} kg — {{ context.landing.origin }}</dd>
              <dd v-else class="unavailable">Unavailable: {{ context.landing.reason }}</dd>
            </div>
          </dl>
        </template>
      </PerformanceStepPanel>
    </section>
    <UnitPreferencesFieldset />
    <ManualRunwayPanel />
    <ManualWindComponentPanel />
    <CorrectionSourcePanel v-model:configuration="manualConfiguration" :profile="context.profile ?? undefined" :tables-complete="tables?.status === 'ready'"
      :ready="context.ready" :inputs-revision="inputKey" />
  </div>
</template>

<style scoped>
.flight-prep-performance { display: grid; gap: 1rem; min-width: 0; }
p { margin: 0; line-height: 1.6; overflow-wrap: anywhere; }
.aircraft { font-weight: 600; }
.panel { padding: 1rem; border: 1px solid var(--color-border); border-radius: 12px; min-width: 0; }
h3 { margin: 0 0 .75rem; }
.masses { display: grid; grid-template-columns: repeat(auto-fit, minmax(min(100%, 240px), 1fr)); gap: .75rem; margin: 0; }
dt { font-weight: 600; }
dd { margin: .25rem 0 0; overflow-wrap: anywhere; }
.unavailable { padding-left: .5rem; border-left: 4px solid var(--color-warning, #ba7b24); }
a { color: var(--color-primary); text-decoration: underline; }
[role="alert"] { padding: .75rem; border-left: 4px solid var(--color-warning, #ba7b24); }
</style>
