<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import CGEnvelopeChart from '@/modules/mass-balance/components/CGEnvelopeChart.vue'
import { assembleMbPrint, canPrintMb, type MbPrintSnapshot, type MbPrintSource } from './mb-print'

const props = defineProps<{ source: MbPrintSource; readSource?: () => MbPrintSource }>()
// Read live dependencies even when the parent render has not flushed before native print.
const currentSource = computed(() => props.readSource?.() ?? props.source)
const snapshot = ref<MbPrintSnapshot | null>(null)
const opened = ref(false)
const showEligibility = ref(false)
const closeButton = ref<HTMLButtonElement>()
const printRoot = ref<HTMLElement>()
let returnFocus: HTMLElement | null = null
const fingerprint = ref('')
const currentKey = computed(() => JSON.stringify(currentSource.value))
const eligibilityReason = computed(() => canPrintMb(currentSource.value)
  ? 'Current Mass & Balance is eligible. Unavailable preparation sections will show their reasons.'
  : 'Current Mass & Balance is not eligible for printing; review aircraft, loading and notifications.')
const eligible = computed(() => canPrintMb(currentSource.value))
// The key check also protects print media before Vue's queued watcher runs.
const currentSnapshot = computed(() => currentKey.value === fingerprint.value ? snapshot.value : null)
function invalidate(): void {
  snapshot.value = null
  // Native printing can capture the DOM before Vue flushes its pending render.
  printRoot.value?.setAttribute('data-print-invalid', 'true')
}
watch(currentKey, invalidate, { flush: 'sync' })

async function open(): Promise<void> {
  const value = assembleMbPrint(currentSource.value, new Date())
  if (!value) { showEligibility.value = true; return }
  returnFocus = document.activeElement instanceof HTMLElement ? document.activeElement : null
  fingerprint.value = currentKey.value
  snapshot.value = value
  printRoot.value?.removeAttribute('data-print-invalid')
  opened.value = true
  await nextTick()
  closeButton.value?.focus()
}
function close(): void {
  opened.value = false
  snapshot.value = null
  returnFocus?.focus()
}
function recheck(): boolean {
  const fresh = assembleMbPrint(currentSource.value, new Date())
  if (!eligible.value || !currentSnapshot.value || fresh?.status !== snapshot.value?.status) {
    invalidate()
    return false
  }
  return true
}
function print(): void {
  if (recheck()) window.print()
}
function keydown(event: KeyboardEvent): void {
  if (!opened.value) return
  if (event.key === 'Escape') { event.preventDefault(); close() }
  if (event.key === 'Tab') {
    const buttons = [...document.querySelectorAll<HTMLButtonElement>('.mb-print-root button:not(:disabled)')]
    const first = buttons[0]
    const last = buttons[buttons.length - 1]
    if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last?.focus() }
    else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first?.focus() }
  }
}
onMounted(() => {
  document.body.classList.add('mb-print-active')
  window.addEventListener('beforeprint', recheck)
  window.addEventListener('keydown', keydown)
})
onBeforeUnmount(() => {
  document.body.classList.remove('mb-print-active')
  window.removeEventListener('beforeprint', recheck)
  window.removeEventListener('keydown', keydown)
})
</script>

<template>
  <div class="briefing-action">
    <button type="button" class="mb-preview-action" aria-describedby="briefing-eligibility" @click="open">Briefing Pack</button>
    <p v-if="showEligibility || !eligible" id="briefing-eligibility" role="status">{{ eligibilityReason }}</p>
    <p v-else id="briefing-eligibility">Current preparation · Preview and print</p>
  </div>
  <Teleport to="body">
    <div ref="printRoot" class="mb-print-root" :class="{ 'mb-print-root--open': opened }">
      <section v-if="opened" role="dialog" aria-modal="true" aria-label="Briefing Pack preview" class="mb-print-sheet">
        <nav class="mb-print-controls" aria-label="Print controls">
          <button ref="closeButton" type="button" @click="close">Back to preparation</button>
          <button type="button" :disabled="!currentSnapshot || !eligible" @click="print">Print Briefing Pack</button>
        </nav>
        <template v-if="currentSnapshot">
          <h1>Flight Preparation Briefing Pack</h1>
          <p>{{ currentSnapshot.identity }}{{ currentSnapshot.marker }} · {{ currentSnapshot.category }}</p>
          <p>Generated: {{ currentSnapshot.generated }}</p>
          <p v-if="currentSnapshot.unverified"><strong>Calculation based on unverified external data. Pilot in Command assumes full responsibility.</strong></p>
          <h2>Current loading</h2>
          <table><thead><tr><th>Station</th><th>Quantity</th></tr></thead><tbody>
            <tr v-for="(row, index) in currentSnapshot.loading" :key="index"><td>{{ row.name }}</td><td>{{ row.quantity }}</td></tr>
          </tbody></table>
          <h2>M&amp;B results</h2>
          <table><thead><tr><th>Endpoint</th><th>Mass</th><th>CG arm</th><th>Applicable limit</th></tr></thead><tbody>
            <tr v-for="row in currentSnapshot.points" :key="row.label"><td>{{ row.label }}</td><td>{{ row.mass }}</td><td>{{ row.cg }}</td><td>{{ row.limit }}</td></tr>
          </tbody></table>
          <figure class="briefing-chart">
            <h2>Loading envelope chart</h2>
            <CGEnvelopeChart :result="currentSnapshot.chart.result" :envelope="currentSnapshot.chart.envelope" :graph-type="currentSnapshot.graphType" :severity="currentSnapshot.chart.severity" print />
            <figcaption>TOM: takeoff · ZFM: zero fuel · LM: all usable fuel burned endpoint. Mass in kg; {{ currentSnapshot.graphType === 'arm' ? 'CG arm in m' : 'moment in kg·m' }}{{ currentSnapshot.marker }}. The line joins calculated burn points.</figcaption>
          </figure>
          <section v-if="currentSnapshot.notifications.length" aria-label="Current M&B notifications">
            <h2>Current M&amp;B notifications</h2>
            <ul><li v-for="(note, index) in currentSnapshot.notifications" :key="index"><strong>{{ note.severity }} · {{ note.id }} · {{ note.context ?? 'MassBalance' }}</strong>: {{ note.message }}</li></ul>
          </section>
          <section v-if="currentSnapshot.fuel" aria-label="Current fuel plan and estimated trip arrival">
            <h2>Current fuel plan and estimated trip arrival</h2>
            <p v-if="currentSnapshot.fuel.method">Manual method: {{ currentSnapshot.fuel.method === 'duration' ? 'Duration and consumption' : 'Direct Trip Fuel (kg)' }}.</p>
            <p v-if="currentSnapshot.fuelReason">Fuel plan / trip arrival unavailable: {{ currentSnapshot.fuelReason }}</p>
            <table v-if="currentSnapshot.fuel.rows.length"><thead><tr><th>Parameter</th><th>Value</th></tr></thead><tbody>
              <tr v-for="row in currentSnapshot.fuel.rows" :key="row.label"><td>{{ row.label }}</td><td>{{ row.value }}</td></tr>
            </tbody></table>
            <p v-if="currentSnapshot.fuel.sequence">Selected arrival CG burn sequence: {{ currentSnapshot.fuel.sequence }}</p>
            <p v-if="currentSnapshot.fuel.cgReason">Estimated arrival CG unavailable: {{ currentSnapshot.fuel.cgReason }}</p>
            <ul v-if="currentSnapshot.fuel.warnings.length"><li v-for="warning in currentSnapshot.fuel.warnings" :key="warning">{{ warning }}</li></ul>
            <p v-if="currentSnapshot.fuel.method === 'duration'">User-supplied consumption is assumed constant. Reserve is user chosen; no regulatory minimum is supplied.</p>
            <p v-else-if="currentSnapshot.fuel.method === 'direct'">Direct Trip Fuel is the explicit mass expected to burn during the trip. No duration, consumption, endurance or reserve budget is calculated.</p>
          </section>
          <p v-if="!currentSnapshot.fuel">Fuel plan / trip arrival unavailable: {{ currentSnapshot.fuelReason }}</p>
          <section aria-label="Current manual runway">
            <h2>Manual runway declarations</h2>
            <template v-if="currentSnapshot.performance?.runway.status === 'declared'">
              <p>{{ currentSnapshot.performance.runway.label }}</p>
              <table><tbody><tr v-for="row in currentSnapshot.performance.runway.rows" :key="row.label"><th>{{ row.label }}</th><td>{{ row.value }}</td></tr></tbody></table>
              <p>{{ currentSnapshot.performance.runway.note }}</p>
            </template>
            <p v-else>{{ currentSnapshot.performance?.runway.reason ?? 'No current manual runway declaration is available.' }}</p>
          </section>
          <section aria-label="Current Performance">
            <h2>Current Performance</h2>
            <template v-if="currentSnapshot.performance">
              <p v-if="currentSnapshot.performance.reason">{{ currentSnapshot.performance.reason }}</p>
              <table><tbody><tr v-for="row in currentSnapshot.performance.inputs" :key="row.label"><th>{{ row.label }}</th><td>{{ row.value }}</td></tr></tbody></table>
              <p v-if="currentSnapshot.performance.conditions">Calculation basis: {{ currentSnapshot.performance.conditions.pressureAltitude }} · {{ currentSnapshot.performance.conditions.temperature }}</p>
              <section v-for="group in currentSnapshot.performance.groups" :key="group.id">
                <h3>{{ group.title }}</h3>
                <p v-if="group.mass">{{ group.mass }}</p>
                <p v-if="group.reason">{{ group.reason }}</p>
                <p v-else-if="group.status !== 'success'">No current {{ group.title.toLowerCase() }} distances computed.</p>
                <table v-if="group.rows.length"><tbody><tr v-for="row in group.rows" :key="row.label"><th>{{ row.label }}</th><td>{{ row.value }}<p v-if="row.note">{{ row.note }}</p></td></tr></tbody></table>
              </section>
              <h3>Operational assessment unavailable</h3>
              <p>{{ currentSnapshot.performance.operational.reason }}</p>
              <ul v-if="currentSnapshot.performance.operational.rows.length"><li v-for="(row, index) in currentSnapshot.performance.operational.rows" :key="index">{{ row.label }}: {{ row.value }}<ul><li v-for="(reason, n) in row.reasons" :key="n">{{ reason }}</li></ul></li></ul>
              <p v-for="scope in currentSnapshot.performance.scope" :key="scope">{{ scope }}</p>
            </template>
            <p v-else>Current Performance inputs and results are unavailable.</p>
          </section>
        </template>
        <p v-else role="status">Preview invalidated. Return to preparation, review the current inputs and open a new Briefing Pack preview.</p>
      </section>
      <p class="mb-print-guard">Preview unavailable or invalidated. Return to Flight Preparation and open an eligible current Briefing Pack preview.</p>
      <p v-if="!opened" class="mb-print-blocked">Open an eligible current Briefing Pack preview from Flight Preparation before printing.</p>
    </div>
  </Teleport>
</template>

<style>
 .briefing-action { position: fixed; bottom: 1rem; right: 1.5rem; z-index: 210; max-width: min(30rem, calc(100vw - 2rem)); padding: .5rem 1rem; border: 1px solid var(--color-divider, #888); border-radius: .5rem; background: var(--color-surface, white); box-shadow: 0 2px 12px #0003; }
.briefing-action p { margin: 0; font-size: .8rem; }
.mb-preview-action { width: 100%; }
.fp-view { padding-bottom: 11rem; }
.briefing-chart { margin: 1rem 0; break-inside: avoid; --chart-grid: #ddd; --chart-axis: #555; --chart-tick-text: #333; --chart-label: #222; }
.briefing-chart figcaption { font-size: .85em; }
@media (max-width: 767.98px) {
  .briefing-action { bottom: calc(var(--nav-bottom-height, 56px) + env(safe-area-inset-bottom, 0px)); right: 0; left: 0; max-width: none; border-radius: 0; padding: .5rem 1rem; }
  .fp-view { padding-bottom: calc(12rem + env(safe-area-inset-bottom, 0px)); }
}
.mb-preview-action, .mb-print-controls button { padding: .75rem; margin: .5rem 0; font: inherit; }
.mb-print-root { display: none; }
.mb-print-root--open { display: block; position: fixed; inset: 0; z-index: 10000; overflow: auto; background: #eef1f4; color: #111; padding: 1rem; }
.mb-print-sheet { max-width: 52rem; margin: auto; padding: 1.5rem; background: white; overflow-wrap: anywhere; }
.mb-print-sheet h1 { font-size: 1.5rem; }
.mb-print-sheet h2 { font-size: 1.125rem; margin-top: 1.5rem; }
.mb-print-sheet table { width: 100%; border-collapse: collapse; table-layout: fixed; }
.mb-print-sheet th, .mb-print-sheet td { text-align: left; border-bottom: 1px solid #888; padding: .4rem; vertical-align: top; }
.mb-print-sheet dd { margin: 0 0 .5rem; }
.mb-print-controls { display: flex; flex-wrap: wrap; justify-content: space-between; gap: .5rem; }
.mb-print-blocked, .mb-print-guard { display: none; }
@media (max-width: 480px) { .mb-print-root--open { padding: .25rem; } .mb-print-sheet { padding: .75rem; } }
@media print {
  @page { size: A4; margin: 15mm; }
  body.mb-print-active > :not(.mb-print-root) { display: none !important; }
  body > .mb-print-root { display: block; position: static; overflow: visible; padding: 0; background: white; color: black; }
  .mb-print-sheet { max-width: none; padding: 0; margin: 0; font: 10pt/1.4 sans-serif; }
  .mb-print-controls, .briefing-action { display: none; }
  .briefing-chart .cg-chart { max-height: 100mm; width: 100%; }
  .mb-print-blocked { display: block; }
  .mb-print-root[data-print-invalid] .mb-print-sheet, .mb-print-root[data-print-invalid] .mb-print-blocked { display: none; }
  .mb-print-root[data-print-invalid] .mb-print-guard { display: block; }
  .mb-print-sheet h1, .mb-print-sheet h2, .mb-print-sheet thead { break-after: avoid; }
  .mb-print-sheet thead { display: table-header-group; }
  .mb-print-sheet tr { break-inside: avoid; }
  .mb-print-sheet p, .mb-print-sheet li { orphans: 3; widows: 3; }
}
</style>
