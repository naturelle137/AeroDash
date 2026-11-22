<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import CGEnvelopeChart from '@/modules/mass-balance/components/CGEnvelopeChart.vue'
import { renderBriefingPdf } from './briefing-pdf'
import { disclaimerBlocks } from './disclaimer-text'
import { anchorLabel, type Annotation } from '@/modules/annotations/annotations'
import { assembleMbPrint, canPrintMb, unverifiedGate, type MbPrintSnapshot, type MbPrintSource } from './mb-print'

const disclaimerContent = disclaimerBlocks()
const props = defineProps<{ source: MbPrintSource; readSource?: () => MbPrintSource; annotations?: Annotation[] }>()
// Read live dependencies even when the parent render has not flushed before native print.
const currentSource = computed(() => props.readSource?.() ?? props.source)
const snapshot = ref<MbPrintSnapshot | null>(null)
const opened = ref(false)
const closeButton = ref<HTMLButtonElement>()
const printRoot = ref<HTMLElement>()
let returnFocus: HTMLElement | null = null
const fingerprint = ref('')
const acknowledged = ref(false)
const gating = ref(false)
const pendingAction = ref<'print' | 'pdf'>('print')
const exporting = ref(false)
const handover = ref(false)
const studentName = ref('')
const instructorName = ref('')
const handoverNote = ref('')
const gate = computed(() => currentSnapshot.value ? unverifiedGate(currentSnapshot.value) : null)
const currentKey = computed(() => JSON.stringify(currentSource.value))
const eligible = computed(() => canPrintMb(currentSource.value))
// The key check also protects print media before Vue's queued watcher runs.
const currentSnapshot = computed(() => currentKey.value === fingerprint.value ? snapshot.value : null)
function invalidate(): void {
  snapshot.value = null
  acknowledged.value = false
  gating.value = false
  // Native printing can capture the DOM before Vue flushes its pending render.
  printRoot.value?.setAttribute('data-print-invalid', 'true')
}
watch(currentKey, invalidate, { flush: 'sync' })

async function open(): Promise<void> {
  const value = assembleMbPrint(currentSource.value, new Date())
  if (!value) return
  returnFocus = document.activeElement instanceof HTMLElement ? document.activeElement : null
  fingerprint.value = currentKey.value
  snapshot.value = value
  acknowledged.value = false
  gating.value = false
  handover.value = false
  studentName.value = ''
  instructorName.value = ''
  handoverNote.value = ''
  printRoot.value?.removeAttribute('data-print-invalid')
  opened.value = true
  await nextTick()
  closeButton.value?.focus()
}
function close(): void {
  opened.value = false
  snapshot.value = null
  acknowledged.value = false
  gating.value = false
  returnFocus?.focus()
}
function recheck(): boolean {
  const fresh = assembleMbPrint(currentSource.value, new Date())
  if (!eligible.value || !currentSnapshot.value || fresh?.status !== snapshot.value?.status) {
    invalidate()
    return false
  }
  // Native print (Ctrl+P) must not bypass the acknowledgment.
  if (gate.value && !acknowledged.value) { invalidate(); return false }
  return true
}
function print(): void {
  if (gate.value && !acknowledged.value) { pendingAction.value = 'print'; gating.value = true; return }
  if (recheck()) window.print()
}
async function downloadPdf(): Promise<void> {
  if (exporting.value) return
  if (gate.value && !acknowledged.value) { pendingAction.value = 'pdf'; gating.value = true; return }
  if (!recheck() || !printRoot.value) return
  const sheet = printRoot.value.querySelector('.mb-print-sheet')
  const key = currentKey.value
  if (!sheet || !snapshot.value) return
  exporting.value = true
  try {
    const bytes = await renderBriefingPdf(sheet, 'Flight Preparation Briefing Pack')
    // Inputs may change while the chart is rasterized; a stale snapshot must not be saved.
    if (key !== currentKey.value || !currentSnapshot.value) { invalidate(); return }
    const stamp = snapshot.value.generated.replace(/\D/g, '').slice(0, 12)
    const url = URL.createObjectURL(new Blob([bytes as BlobPart], { type: 'application/pdf' }))
    const link = document.createElement('a')
    link.href = url
    link.download = `aerodash-briefing-pack-${stamp}.pdf`
    document.body.appendChild(link)
    link.click()
    link.remove()
    setTimeout(() => URL.revokeObjectURL(url), 1000)
  } finally {
    exporting.value = false
  }
}
function acknowledge(): void {
  acknowledged.value = true
  gating.value = false
  if (pendingAction.value === 'pdf') void downloadPdf()
  else print()
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
    <button type="button" class="cta-btn" :disabled="!eligible" @click="open">Briefing Pack</button>
  </div>
  <Teleport to="body">
    <div ref="printRoot" class="mb-print-root" :class="{ 'mb-print-root--open': opened }">
      <section v-if="opened" role="dialog" aria-modal="true" aria-label="Briefing Pack preview" class="mb-print-sheet">
        <nav class="mb-print-controls" aria-label="Print controls">
          <button ref="closeButton" type="button" @click="close">Back to preparation</button>
          <button type="button" :disabled="!currentSnapshot || !eligible" @click="print">Print Briefing Pack</button>
          <button type="button" :disabled="!currentSnapshot || !eligible || exporting" @click="downloadPdf">Download PDF</button>
          <button type="button" :disabled="!currentSnapshot || exporting" :aria-pressed="handover" @click="handover = !handover">{{ handover ? 'Remove handover label' : 'Prepare unapproved handover copy' }}</button>
        </nav>
        <fieldset v-if="handover" class="mb-print-controls">
          <legend>Handover names (optional, printed as unverified, not stored)</legend>
          <label>Student name <input v-model.trim="studentName" type="text" maxlength="80" autocomplete="off"></label>
          <label>Instructor name <input v-model.trim="instructorName" type="text" maxlength="80" autocomplete="off"></label>
          <label>Handover note (optional, unverified, not stored) <textarea v-model.trim="handoverNote" maxlength="500"></textarea></label>
        </fieldset>
        <section v-if="gating && gate" role="alertdialog" aria-modal="true" aria-labelledby="crit-ui-001-title" class="briefing-gate">
          <h2 id="crit-ui-001-title">{{ gate.notification.id }} · {{ gate.notification.message }}</h2>
          <p>The Briefing Pack contains unverified data ({{ gate.status }}). {{ pendingAction === 'pdf' ? 'The PDF download' : 'Printing' }} proceeds only after acknowledgment; every unverified value is then marked [UNVERIFIED] inline.</p>
          <ul aria-label="Unverified fields"><li v-for="field in gate.parameters" :key="field"><code>{{ field }}</code></li></ul>
          <button type="button" @click="acknowledge">{{ pendingAction === 'pdf' ? 'Acknowledge unverified data and download PDF' : 'Acknowledge unverified data and print' }}</button>
          <button type="button" @click="gating = false">Cancel</button>
        </section>
        <template v-if="currentSnapshot">
          <h1>Flight Preparation Briefing Pack</h1>
          <p v-if="handover"><strong>Student handover copy — UNAPPROVED. Instructor review and authenticated counter-signature are not recorded by AeroDash.</strong></p>
          <template v-if="handover">
            <p>Prepared by (self-declared, unverified): {{ studentName || '________________' }}</p>
            <p>Instructor review outside AeroDash (self-declared, unverified): {{ instructorName || '________________' }} · Date: ________ · Signature: ________________</p>
            <p v-if="handoverNote">Handover note (self-declared, unverified): {{ handoverNote }}</p>
          </template>
          <p>{{ currentSnapshot.identity }}{{ currentSnapshot.marker }} · {{ currentSnapshot.category }}</p>
          <p>Generated: {{ currentSnapshot.generated }}</p>
          <p v-if="currentSnapshot.unverified"><strong>Calculation based on unverified external data. Pilot in Command assumes full responsibility.</strong></p>
          <p v-if="currentSnapshot.lowSafetyMargin"><strong>Calculation based on low safety margin. Pilot in Command assumes full responsibility.</strong></p>
          <h2>Current loading</h2>
          <table><thead><tr><th>Station</th><th>Quantity</th></tr></thead><tbody>
            <tr v-for="(row, index) in currentSnapshot.loading" :key="index"><td>{{ row.name }}</td><td :class="{ 'briefing-warning': row.warnings.length }">{{ row.quantity }}<p v-for="(note, n) in row.warnings" :key="n">{{ note.severity }}: {{ note.message }}</p></td></tr>
          </tbody></table>
          <h2>M&amp;B results</h2>
          <table><thead><tr><th>Endpoint</th><th>Mass</th><th>CG arm</th><th>Applicable limit</th></tr></thead><tbody>
            <tr v-for="row in currentSnapshot.points" :key="row.label"><td>{{ row.label }}</td><td :class="{ 'briefing-warning': row.massWarnings.length, 'briefing-critical': row.massWarnings.some(n => n.severity === 'CRITICAL') }">{{ row.mass }}<p v-for="(note, n) in row.massWarnings" :key="n">{{ note.severity }}: {{ note.message }}</p></td><td :class="{ 'briefing-warning': row.cgWarnings.length, 'briefing-critical': row.cgWarnings.some(n => n.severity === 'CRITICAL') }">{{ row.cg }}<p v-for="(note, n) in row.cgWarnings" :key="n">{{ note.severity }}: {{ note.message }}</p></td><td>{{ row.limit }}</td></tr>
          </tbody></table>
          <section v-if="currentSnapshot.cgTrajectoryWarnings.length" aria-label="CG trajectory warnings">
            <h3>CG trajectory warnings</h3>
            <p v-for="(note, index) in currentSnapshot.cgTrajectoryWarnings" :key="index" class="briefing-warning" :class="{ 'briefing-critical': note.severity === 'CRITICAL' }">{{ note.severity }}: {{ note.message }}</p>
          </section>
          <figure class="briefing-chart">
            <h2>Loading envelope chart</h2>
            <CGEnvelopeChart :result="currentSnapshot.chart.result" :envelope="currentSnapshot.chart.envelope" :graph-type="currentSnapshot.graphType" :severity="currentSnapshot.chart.severity" print />
            <figcaption>TOM: takeoff · ZFM: zero fuel · LM: all usable fuel burned endpoint. Mass in kg; {{ currentSnapshot.graphType === 'arm' ? 'CG arm in m' : 'moment in kg·m' }}{{ currentSnapshot.marker }}. The line joins calculated burn points.</figcaption>
          </figure>
          <section v-if="currentSnapshot.notifications.length" aria-label="Current M&B notifications">
            <h2>Current M&amp;B notifications</h2>
            <ul><li v-for="(note, index) in currentSnapshot.notifications" :key="index"><strong>{{ note.severity }} · {{ note.context ?? 'MassBalance' }}</strong>: {{ note.message }}</li></ul>
          </section>
          <section v-if="annotations?.length" aria-label="Instructor notes">
            <h2>Instructor notes (advisory; not system notifications)</h2>
            <ul><li v-for="n in annotations" :key="n.id"><strong>Instructor note on {{ anchorLabel(n.anchor) }}</strong> · {{ n.author }} (self-declared, unverified): {{ n.text }}</li></ul>
            <p>Instructor notes do not clear, replace or change any warning above.</p>
          </section>
          <section v-if="currentSnapshot.energy" aria-label="Estimated energy budget">
            <h2>Estimated energy budget</h2>
            <p>Manual estimate assumes constant pilot-entered consumption. Verify against the aircraft POH/AFM. Battery use does not change aircraft mass.</p>
            <p v-if="currentSnapshot.energy.reason">Energy budget unavailable: {{ currentSnapshot.energy.reason }}</p>
            <table v-else><tbody><tr v-for="row in currentSnapshot.energy.rows" :key="row.label"><td>{{ row.label }}</td><td :class="{ 'briefing-warning': currentSnapshot.energy.warning && ['Estimated remaining energy', 'Difference to reserve floor'].includes(row.label) }">{{ row.value }}<p v-if="currentSnapshot.energy.warning && ['Estimated remaining energy', 'Difference to reserve floor'].includes(row.label)">{{ currentSnapshot.energy.warning }}</p></td></tr></tbody></table>
            <p v-if="currentSnapshot.energy.warning">{{ currentSnapshot.energy.warning }}</p>
          </section>
          <section v-if="currentSnapshot.fuel" aria-label="Current fuel plan and estimated trip arrival">
            <h2>Current fuel plan and estimated trip arrival</h2>
            <p v-if="currentSnapshot.fuel.method">Manual method: {{ currentSnapshot.fuel.method === 'duration' ? 'Duration and consumption' : 'Direct Trip Fuel (kg)' }}.</p>
            <p v-if="currentSnapshot.fuelReason">Fuel plan / trip arrival unavailable: {{ currentSnapshot.fuelReason }}</p>
            <table v-if="currentSnapshot.fuel.rows.length"><thead><tr><th>Parameter</th><th>Value</th></tr></thead><tbody>
              <tr v-for="row in currentSnapshot.fuel.rows" :key="row.label"><td>{{ row.label }}</td><td :class="{ 'briefing-warning': row.warnings?.length }">{{ row.value }}<p v-for="warning in row.warnings" :key="warning">{{ warning }}</p></td></tr>
            </tbody></table>
            <p v-if="currentSnapshot.fuel.sequence">Selected arrival CG burn sequence: {{ currentSnapshot.fuel.sequence }}</p>
            <p v-if="currentSnapshot.fuel.cgReason">Estimated arrival CG unavailable: {{ currentSnapshot.fuel.cgReason }}</p>
            <ul v-if="currentSnapshot.fuel.warnings.length"><li v-for="warning in currentSnapshot.fuel.warnings" :key="warning">{{ warning }}</li></ul>
            <p v-if="currentSnapshot.fuel.method === 'duration'">User-supplied consumption is assumed constant. Reserve is user chosen; no regulatory minimum is supplied.</p>
            <p v-else-if="currentSnapshot.fuel.method === 'direct'">Direct Trip Fuel is the explicit mass expected to burn during the trip. No duration, consumption, endurance or reserve budget is calculated.</p>
          </section>
          <p v-if="!currentSnapshot.fuel && !currentSnapshot.energy">Fuel plan / trip arrival unavailable: {{ currentSnapshot.fuelReason }}</p>
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
              <section v-if="currentSnapshot.performance.notifications.length" aria-label="Performance notifications">
                <h3>Performance notifications</h3>
                <p v-for="note in currentSnapshot.performance.notifications" :key="note.id" class="briefing-warning"><strong>{{ note.severity }} · {{ note.id }}</strong>: {{ note.message }}</p>
              </section>
              <section v-if="currentSnapshot.performance.extrapolation" aria-label="Extrapolated performance data">
                <h3>Extrapolated performance data</h3>
                <p class="briefing-warning"><strong>{{ currentSnapshot.performance.extrapolation.warning }}</strong></p>
                <p>{{ currentSnapshot.performance.extrapolation.acknowledged ? 'Acknowledged by the pilot in command.' : 'Not acknowledged by the pilot in command: extrapolated results are withheld.' }}</p>
                <ul><li v-for="detail in currentSnapshot.performance.extrapolation.details" :key="detail">{{ detail }}</li></ul>
              </section>
              <table><tbody><tr v-for="row in currentSnapshot.performance.inputs" :key="row.label"><th>{{ row.label }}</th><td :class="{ 'briefing-warning': ['Unverified obstacle constraint', 'Required geometric gradient'].includes(row.label) && currentSnapshot.performance.notifications.some(n => n.context === 'Performance.Obstacles') }">{{ row.value }}<template v-if="['Unverified obstacle constraint', 'Required geometric gradient'].includes(row.label)"><p v-for="note in currentSnapshot.performance.notifications.filter(n => n.context === 'Performance.Obstacles')" :key="note.id">{{ note.severity }}: {{ note.message }}</p></template></td></tr></tbody></table>
              <p v-if="currentSnapshot.performance.conditions">Calculation basis: {{ currentSnapshot.performance.conditions.pressureAltitude }} · {{ currentSnapshot.performance.conditions.temperature }}</p>
              <section v-for="group in currentSnapshot.performance.groups" :key="group.id">
                <h3>{{ group.title }}</h3>
                <p v-if="group.mass">{{ group.mass }}{{ currentSnapshot.marker }}</p>
                <p v-if="group.reason">{{ group.reason }}</p>
                <p v-else-if="group.status !== 'success'">No current {{ group.title.toLowerCase() }} distances computed.</p>
                <table v-if="group.rows.length"><tbody><tr v-for="row in group.rows" :key="row.label"><th>{{ row.label }}</th><td :class="{ 'briefing-warning': row.warnings?.length || row.note?.includes('EXTRAPOLATED') }">{{ row.value }}{{ currentSnapshot.marker }}<p v-for="warning in row.warnings" :key="warning">{{ warning }}</p><p v-if="row.note">{{ row.note }}</p><p v-if="row.note?.includes('EXTRAPOLATED') && currentSnapshot.performance.extrapolation">{{ currentSnapshot.performance.extrapolation.warning }}</p></td></tr></tbody></table>
              </section>
              <section v-for="item in currentSnapshot.performance.corrected" :key="item.operation">
                <h3>{{ item.title }} {{ item.status === 'applied' && item.partial ? 'partially corrected' : 'corrected' }} distances</h3>
                <p v-if="item.status === 'unavailable'">Not corrected: {{ item.reason }}</p>
                <template v-else>
                  <p>Source: {{ item.source }}</p>
                  <table><tbody><tr v-for="row in item.rows" :key="row.label"><th>{{ row.label }}</th><td :class="{ 'briefing-warning': item.safetyFactorWarning || currentSnapshot.performance.groups.find(group => group.id === item.operation)?.rows.find(base => base.label === row.label)?.warnings?.length || currentSnapshot.performance.groups.find(group => group.id === item.operation)?.rows.find(base => base.label === row.label)?.note }">{{ row.factored }}{{ currentSnapshot.marker }} (raw {{ row.raw }}{{ currentSnapshot.marker }}, corrected {{ row.corrected }}{{ currentSnapshot.marker }})<p v-for="warning in currentSnapshot.performance.groups.find(group => group.id === item.operation)?.rows.find(base => base.label === row.label)?.warnings" :key="warning">{{ warning }}</p><p v-if="currentSnapshot.performance.groups.find(group => group.id === item.operation)?.rows.find(base => base.label === row.label)?.note">{{ currentSnapshot.performance.groups.find(group => group.id === item.operation)?.rows.find(base => base.label === row.label)?.note }}</p><p v-if="currentSnapshot.performance.groups.find(group => group.id === item.operation)?.rows.find(base => base.label === row.label)?.note?.includes('EXTRAPOLATED') && currentSnapshot.performance.extrapolation">{{ currentSnapshot.performance.extrapolation.warning }}</p><p v-if="item.safetyFactorWarning">{{ item.safetyFactorWarning }}</p></td></tr></tbody></table>
                  <p>Safety factor: {{ item.safetyFactor }}</p>
                  <p v-if="item.safetyFactorWarning" class="briefing-warning">{{ item.safetyFactorWarning }}</p>
                  <p :class="{ 'briefing-warning': item.comparison.status === 'insufficient' }">{{ item.comparison.summary }} Required {{ item.comparison.required }}; {{ item.comparison.availableLabel }} {{ item.comparison.available }}; margin {{ item.comparison.margin }}.</p>
                  <p v-for="note in item.notes" :key="note">{{ note }}</p>
                </template>
              </section>
              <h3>Operational assessment unavailable</h3>
              <p>{{ currentSnapshot.performance.operational.reason }}</p>
              <ul v-if="currentSnapshot.performance.operational.rows.length"><li v-for="(row, index) in currentSnapshot.performance.operational.rows" :key="index">{{ row.label }}: {{ row.value }}<ul><li v-for="(reason, n) in row.reasons" :key="n">{{ reason }}</li></ul></li></ul>
              <p v-for="scope in currentSnapshot.performance.scope" :key="scope">{{ scope }}</p>
            </template>
            <p v-else>Current Performance inputs and results are unavailable.</p>
          </section>
          <section v-if="currentSnapshot.wind" aria-label="Manual wind components">
            <h2>Manual wind components</h2>
            <p>User-entered — advisory only. No weather retrieved or performance correction applied. Heading and wind direction use the same magnetic or true reference.</p>
            <p>Runway heading: {{ currentSnapshot.wind.input.runwayHeading }}°; wind from: {{ currentSnapshot.wind.input.windDirection || 'calm' }}; speed: {{ currentSnapshot.wind.input.windSpeed }} {{ currentSnapshot.wind.result.unit }}.</p>
            <p v-for="(note, index) in currentSnapshot.wind.notifications.filter(n => n.provenance === 'manual wind' && n.component === 'MaxTotalWind')" :key="index" class="briefing-warning" :class="{ 'briefing-critical': note.severity === 'CRITICAL' }">{{ note.severity }}: {{ note.message }}</p>
            <p v-if="currentSnapshot.wind.input.gustSpeed">Pilot-entered gust: {{ currentSnapshot.wind.input.gustSpeed }} {{ currentSnapshot.wind.result.unit }}.</p>
            <p v-for="(note, index) in currentSnapshot.wind.notifications.filter(n => n.provenance === 'manual gust')" :key="index" class="briefing-warning" :class="{ 'briefing-critical': note.severity === 'CRITICAL' }">{{ note.severity }}: {{ note.message }}</p>
            <p v-if="Number(currentSnapshot.wind.input.windSpeed.replace(',', '.')) === 0">Calm wind.</p>
            <p>{{ currentSnapshot.wind.result.headwind >= 0 ? 'Headwind' : 'Tailwind' }}: {{ Math.abs(currentSnapshot.wind.result.headwind).toFixed(1) }} {{ currentSnapshot.wind.result.unit }}.</p>
            <p v-for="(note, index) in currentSnapshot.wind.notifications.filter(n => n.provenance === 'manual wind' && n.component === 'MaxTailwind')" :key="index" class="briefing-warning" :class="{ 'briefing-critical': note.severity === 'CRITICAL' }">{{ note.severity }}: {{ note.message }}</p>
            <p>Crosswind: {{ Math.abs(currentSnapshot.wind.result.crosswind).toFixed(1) }} {{ currentSnapshot.wind.result.unit }}<template v-if="currentSnapshot.wind.result.crosswind"> from the {{ currentSnapshot.wind.result.crosswind > 0 ? 'right' : 'left' }}</template>.</p>
            <p v-for="(note, index) in currentSnapshot.wind.notifications.filter(n => n.provenance === 'manual wind' && n.component === 'MaxCrosswind')" :key="index" class="briefing-warning" :class="{ 'briefing-critical': note.severity === 'CRITICAL' }">{{ note.severity }}: {{ note.message }}</p>
            <p>Rounded to 0.1. Check all limits yourself; missing or invalid gusts are not assessed and no suitability verdict is given. Pilot in command remains responsible.</p>
          </section>
          <section aria-label="Disclaimer">
            <h2>Disclaimer</h2>
            <template v-for="(block, index) in disclaimerContent" :key="index">
              <h3 v-if="block.kind === 'heading'">{{ block.text }}</h3>
              <p v-else>{{ block.text }}</p>
            </template>
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
.briefing-chart { margin: 1rem 0; break-inside: avoid; --chart-grid: #ddd; --chart-axis: #555; --chart-tick-text: #333; --chart-label: #222; }
.briefing-chart figcaption { font-size: .85em; }
@media (max-width: 767.98px) {
  .briefing-action { bottom: calc(var(--nav-bottom-height, 56px) + env(safe-area-inset-bottom, 0px)); right: 0; left: 0; max-width: none; border-radius: 0; padding: .5rem 1rem; }
}
.mb-print-controls button { padding: .75rem; margin: .5rem 0; font: inherit; }
.mb-print-root { display: none; }
.mb-print-root--open { display: block; position: fixed; inset: 0; z-index: 10000; overflow: auto; background: #eef1f4; color: #111; padding: 1rem; }
.mb-print-sheet { max-width: 52rem; margin: auto; padding: 1.5rem; background: white; overflow-wrap: anywhere; }
.mb-print-sheet h1 { font-size: 1.5rem; }
.mb-print-sheet h2 { font-size: 1.125rem; margin-top: 1.5rem; }
.mb-print-sheet table { width: 100%; border-collapse: collapse; table-layout: fixed; }
.mb-print-sheet th, .mb-print-sheet td { text-align: left; border-bottom: 1px solid #888; padding: .4rem; vertical-align: top; }
.briefing-gate { margin: 1rem 0; padding: .75rem; border: 2px solid #b71c1c; background: #ffebee; }
.briefing-gate button { padding: .75rem; margin: .5rem .5rem 0 0; font: inherit; }
@media print { .briefing-gate { display: none; } }
.briefing-warning { color: #a34500; border-left: 4px solid #ef6c00; background: #fff3e0; }
.briefing-critical { color: #b71c1c; border-left-color: #d32f2f; background: #ffebee; }
.briefing-warning p { font-size: .85em; font-weight: 600; margin: .4rem 0; }
.mb-print-sheet, .briefing-chart svg { print-color-adjust: exact; -webkit-print-color-adjust: exact; }
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
