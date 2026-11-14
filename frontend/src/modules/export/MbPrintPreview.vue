<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { assembleMbPrint, canPrintMb, type MbPrintSnapshot, type MbPrintSource } from './mb-print'

const props = defineProps<{ source: MbPrintSource; readSource?: () => MbPrintSource }>()
// Read live dependencies even when the parent render has not flushed before native print.
const currentSource = computed(() => props.readSource?.() ?? props.source)
const includeFuel = ref(false)
const snapshot = ref<MbPrintSnapshot | null>(null)
const opened = ref(false)
const closeButton = ref<HTMLButtonElement>()
const printRoot = ref<HTMLElement>()
let returnFocus: HTMLElement | null = null
let fingerprint = ''
const currentKey = computed(() => JSON.stringify([currentSource.value, includeFuel.value]))
const inclusionReason = computed(() => !canPrintMb(currentSource.value)
  ? 'Current Mass & Balance is not eligible for printing; review loading and notifications.'
  : currentSource.value.fuel?.reason ?? (!currentSource.value.fuel ? 'Current fuel plan is unavailable.' : null))
const eligible = computed(() => canPrintMb(currentSource.value) && (!includeFuel.value || (!!currentSource.value.fuel && !currentSource.value.fuel.reason)))
// The key check also protects print media before Vue's queued watcher runs.
const currentSnapshot = computed(() => currentKey.value === fingerprint ? snapshot.value : null)
function invalidate(): void {
  snapshot.value = null
  // Native printing can capture the DOM before Vue flushes its pending render.
  printRoot.value?.setAttribute('data-print-invalid', 'true')
}
watch(currentKey, invalidate, { flush: 'sync' })

async function open(): Promise<void> {
  const value = assembleMbPrint(currentSource.value, new Date(), includeFuel.value)
  if (!value) return
  returnFocus = document.activeElement instanceof HTMLElement ? document.activeElement : null
  fingerprint = currentKey.value
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
  const fresh = assembleMbPrint(currentSource.value, new Date(), includeFuel.value)
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
  <label class="mb-fuel-choice"><input v-model="includeFuel" type="checkbox" /> Include current fuel plan</label>
  <p v-if="includeFuel && inclusionReason" role="status">Fuel inclusion blocked: {{ inclusionReason }}</p>
  <button type="button" :disabled="!eligible" class="mb-preview-action" @click="open">M&amp;B print preview</button>
  <Teleport to="body">
    <div ref="printRoot" class="mb-print-root" :class="{ 'mb-print-root--open': opened }">
      <section v-if="opened" role="dialog" aria-modal="true" aria-label="M&B print preview" class="mb-print-sheet">
        <nav class="mb-print-controls" aria-label="Print controls">
          <button ref="closeButton" type="button" @click="close">Back to preparation</button>
          <button type="button" :disabled="!currentSnapshot || !eligible" @click="print">{{ includeFuel ? 'Print M&B + fuel' : 'Print M&B' }}</button>
        </nav>
        <template v-if="currentSnapshot">
          <h1>{{ currentSnapshot.fuel ? 'Mass & Balance + current fuel plan' : 'Mass & Balance only' }}</h1>
          <p>{{ currentSnapshot.identity }}{{ currentSnapshot.marker }} · {{ currentSnapshot.category }}</p>
          <p>Generated: {{ currentSnapshot.generated }}</p>
          <h2>Profile and source status</h2>
          <p>{{ currentSnapshot.status }}</p>
          <p>Profile verification is a recorded user check, not operational approval. Acknowledging a draft selection does not verify its data.</p>
          <p v-if="currentSnapshot.unverified"><strong>Calculation based on unverified external data. Pilot in Command assumes full responsibility.</strong></p>
          <p>Check all calculations against the aircraft's official POH/AFM before flight. The official handbook takes precedence.</p>
          <dl v-if="currentSnapshot.provenance">
            <dt>POH/AFM revision</dt><dd>{{ currentSnapshot.provenance.revision }}</dd>
            <dt>Verified on</dt><dd>{{ currentSnapshot.provenance.verifiedOn }}</dd>
            <dt>Source weighing report valid from</dt><dd>{{ currentSnapshot.provenance.sourceDate }}</dd>
            <dt>Verification expires</dt><dd>{{ currentSnapshot.provenance.expiresOn ?? 'Not available' }}</dd>
          </dl>
          <p v-else>Verification provenance: not recorded.</p>
          <p>Profile source units: {{ currentSnapshot.sourceUnit }}. Datum: {{ currentSnapshot.datum }}{{ currentSnapshot.marker }}.</p>
          <ul><li v-for="(report, index) in currentSnapshot.weighingReports" :key="index">Weighing date {{ report.date }}, valid from {{ report.validFrom }}: BEM {{ report.mass }}, empty CG {{ report.cg }} (normalized SI).</li></ul>
          <h2>Current loading</h2>
          <table><thead><tr><th>Station</th><th>Quantity</th></tr></thead><tbody>
            <tr v-for="(row, index) in currentSnapshot.loading" :key="index"><td>{{ row.name }}</td><td>{{ row.quantity }}</td></tr>
          </tbody></table>
          <h2>M&amp;B results</h2>
          <table><thead><tr><th>Endpoint</th><th>Mass</th><th>CG arm</th></tr></thead><tbody>
            <tr v-for="row in currentSnapshot.points" :key="row.label"><td>{{ row.label }}</td><td>{{ row.mass }}</td><td>{{ row.cg }}</td></tr>
          </tbody></table>
          <p>The all-usable-fuel-burned endpoint is not the trip-specific arrival. This summary does not assess full-flight or landing suitability and provides no Go/No-Go advisory.</p>
          <h2>Current M&amp;B notifications</h2>
          <ul v-if="currentSnapshot.notifications.length"><li v-for="(note, index) in currentSnapshot.notifications" :key="index"><strong>{{ note.severity }} · {{ note.id }} · {{ note.context ?? 'MassBalance' }}</strong>: {{ note.message }}</li></ul>
          <p v-else>No current M&amp;B notifications.</p>
          <h2>Applicable category limits</h2>
          <p>Maximum takeoff mass: {{ currentSnapshot.mtom }}. Maximum zero-fuel mass: {{ currentSnapshot.mzfm }}.</p>
          <p>Envelope vertices ({{ currentSnapshot.graphType }} graph, closed polygon; tabular presentation only):</p>
          <table><thead><tr><th>Mass</th><th>Envelope coordinate</th></tr></thead><tbody>
            <tr v-for="(row, index) in currentSnapshot.envelope" :key="index"><td>{{ row.mass }}</td><td>{{ row.horizontal }}</td></tr>
          </tbody></table>
          <section v-if="currentSnapshot.fuel" aria-label="Current fuel plan and estimated trip arrival">
            <h2>Current fuel plan and estimated trip arrival</h2>
            <p>Manual method: {{ currentSnapshot.fuel.method === 'duration' ? 'Duration and consumption' : 'Direct Trip Fuel (kg)' }}.</p>
            <table><thead><tr><th>Parameter</th><th>Value</th></tr></thead><tbody>
              <tr v-for="row in currentSnapshot.fuel.rows" :key="row.label"><td>{{ row.label }}</td><td>{{ row.value }}</td></tr>
            </tbody></table>
            <p v-if="currentSnapshot.fuel.sequence">Selected arrival CG burn sequence: {{ currentSnapshot.fuel.sequence }}</p>
            <p v-if="currentSnapshot.fuel.cgReason">Estimated arrival CG unavailable: {{ currentSnapshot.fuel.cgReason }}</p>
            <ul v-if="currentSnapshot.fuel.warnings.length"><li v-for="warning in currentSnapshot.fuel.warnings" :key="warning">{{ warning }}</li></ul>
            <p v-if="currentSnapshot.fuel.method === 'duration'">User-supplied consumption is assumed constant. Reserve is user chosen; no regulatory minimum is supplied.</p>
            <p v-else>Direct Trip Fuel is the explicit mass expected to burn during the trip. No duration, consumption, endurance or reserve budget is calculated.</p>
            <p>Arithmetic planning aid only. Verify against your aircraft POH/AFM. Reserve remains aboard; usable fuel remaining on arrival is before reserve budgeting and differs from the margin after trip + reserve. Trip arrival is separate from the all-usable-fuel-burned M&amp;B endpoint. This does not assess operational suitability, landing suitability or the full burn path/envelope and provides no Go/No-Go advisory.</p>
          </section>
          <p>No Performance, runway or weather results are included.<template v-if="!currentSnapshot.fuel"> No fuel/endurance planning results are included.</template></p>
        </template>
        <p v-else role="status">Preview invalidated. Return to preparation, review the current inputs and open a new M&amp;B print preview.</p>
      </section>
      <p class="mb-print-guard">Preview unavailable or invalidated. Return to Flight Preparation and open an eligible current M&amp;B print preview.</p>
      <p v-if="!opened" class="mb-print-blocked">Open an eligible current M&amp;B print preview from Flight Preparation before printing.</p>
    </div>
  </Teleport>
</template>

<style>
.mb-fuel-choice { display: flex; align-items: center; gap: .75rem; min-height: 44px; padding: .5rem 0; width: fit-content; }
.mb-fuel-choice input { width: 24px; height: 24px; }
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
  .mb-print-controls { display: none; }
  .mb-print-blocked { display: block; }
  .mb-print-root[data-print-invalid] .mb-print-sheet, .mb-print-root[data-print-invalid] .mb-print-blocked { display: none; }
  .mb-print-root[data-print-invalid] .mb-print-guard { display: block; }
  .mb-print-sheet h1, .mb-print-sheet h2, .mb-print-sheet thead { break-after: avoid; }
  .mb-print-sheet thead { display: table-header-group; }
  .mb-print-sheet tr { break-inside: avoid; }
  .mb-print-sheet p, .mb-print-sheet li { orphans: 3; widows: 3; }
}
</style>
