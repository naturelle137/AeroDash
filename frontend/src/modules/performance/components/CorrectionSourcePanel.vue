<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import type { AircraftProfile } from '@/core/adapters/aircraft.schema'
import {
  CORRECTION_KINDS,
  assessCorrectionSources,
  assessmentBasisKey,
  profileFacts,
  type CorrectionAssessment,
  type RunwayFacts,
  type SourceAssessment,
} from '@/core/logic/performance.correction-sources'
import { useManualRunwayStore } from '@/modules/airport/stores/manual-runway.store'
import {
  BLOCKER_MESSAGES,
  CORRECTION_LABELS,
  INPUT_GAP_MESSAGES,
  OPERATION_LABELS,
  SUMMARY_MESSAGES,
  conditionLabel,
  reasonMessage,
  requirementMessage,
} from '../services/correction-source-messages'

const props = defineProps<{
  profile: AircraftProfile | undefined
  /** All four POH base tables are complete and valid. */
  tablesComplete: boolean
  ready: boolean
  /** Lookup inputs; any change makes a shown assessment stale. */
  inputsRevision: string
}>()

const runway = useManualRunwayStore()
if (!runway.loaded) runway.load()

/** Only a saved runway identical to the form is a current declaration. */
const runwayFacts = computed<RunwayFacts | null>(() => {
  const record = runway.current?.record
  if (!record) return null
  return { label: `${record.runway.aerodrome} ${record.runway.designator}`, surface: record.runway.surface }
})
const basisKey = computed(() => assessmentBasisKey(props.profile, runwayFacts.value,
  [props.inputsRevision, props.ready, props.tablesComplete, runway.saved?.savedAt ?? null, { ...runway.draft }]))
const assessment = ref<SourceAssessment | null>(null)

// An assessment belongs to one profile snapshot, runway declaration and input set.
watch(basisKey, () => { assessment.value = null }, { flush: 'sync' })

function assess(): void {
  if (!props.profile || !props.ready) return
  assessment.value = assessCorrectionSources(profileFacts(props.profile, props.tablesComplete), runwayFacts.value)
}

const groups = computed(() => {
  const result = assessment.value
  if (result?.status !== 'assessed') return []
  return CORRECTION_KINDS.map((correction) => ({
    correction,
    rows: result.corrections.filter((entry) => entry.correction === correction),
  }))
})

const anyIdentified = computed(() => assessment.value?.status === 'assessed'
  && assessment.value.corrections.some((entry) => entry.status === 'source-identified'))

function candidatesOf(rows: CorrectionAssessment[]) {
  // One block per document section; reasons listed per operation.
  const byId = new Map<string, { title: string; revision: string; section: string; origin: string; kind: string; perOperation: { operation: string; reasons: string[] }[] }>()
  for (const row of rows) {
    for (const { candidate, reasons } of row.candidates) {
      const entry = byId.get(candidate.id) ?? {
        title: candidate.document.title, revision: `${candidate.document.identifier}, ${candidate.document.revision}`,
        section: candidate.section, origin: candidate.document.origin,
        kind: candidate.document.kind === 'aircraft-manual' ? 'Aircraft manual candidate' : 'Generic guidance candidate',
        perOperation: [],
      }
      entry.perOperation.push({ operation: OPERATION_LABELS[row.operation], reasons: reasons.map(reasonMessage) })
      byId.set(candidate.id, entry)
    }
  }
  // Identical takeoff and landing reasons are shown once to keep the list short.
  return [...byId.entries()].map(([id, value]) => {
    const [first, ...rest] = value.perOperation
    const same = first && rest.every((item) => item.reasons.join('\n') === first.reasons.join('\n'))
    const perOperation = same && rest.length ? [{ operation: 'Takeoff and landing', reasons: first.reasons }] : value.perOperation
    return { id, ...value, perOperation }
  })
}
</script>

<template>
  <section class="panel correction-sources" aria-labelledby="correction-sources-heading">
    <h2 id="correction-sources-heading">Correction sources</h2>
    <p>Check which source would have to supply the wind, surface and slope corrections for the selected
      profile and saved runway. Nothing is corrected: the raw distances stay uncorrected table values.</p>
    <p v-if="runwayFacts">Runway: {{ runwayFacts.label }} — {{ runwayFacts.surface.type === 'paved' ? 'Paved' : 'Grass / unpaved' }},
      {{ conditionLabel(runwayFacts.surface.condition) }} (user-entered).</p>
    <p v-else-if="runway.hasUnsavedChanges">The manual runway has unsaved changes. Save it to include its surface condition.</p>
    <p v-else>No saved manual runway. The surface source cannot be matched without a runway condition.</p>
    <button type="button" :disabled="!profile || !ready" @click="assess">Assess correction sources</button>

    <section v-if="assessment" aria-label="Correction source assessment" aria-live="polite">
      <p v-if="assessment.status === 'blocked'" role="alert">{{ BLOCKER_MESSAGES[assessment.reason] }}</p>
      <template v-else>
        <p v-if="!anyIdentified" class="verdict" role="alert">No correction source is available for
          {{ assessment.profile.registration }}. No wind, surface or slope correction can be applied.</p>
        <p v-else class="verdict" role="alert">Corrections are not applied in this version, even where a source is identified.</p>
        <p v-if="assessment.legacyFactorsIgnored">This profile stores surface factors without source, target or range
          evidence. They are not used.</p>
        <article v-for="group in groups" :key="group.correction" class="correction" :aria-label="`${CORRECTION_LABELS[group.correction]} source`">
          <h3>{{ CORRECTION_LABELS[group.correction] }}</h3>
          <dl>
            <div v-for="row in group.rows" :key="row.operation">
              <dt>{{ OPERATION_LABELS[row.operation] }}</dt>
              <dd>{{ SUMMARY_MESSAGES[row.summary] }}</dd>
            </div>
          </dl>
          <p class="required">{{ requirementMessage(group.rows[0]!.required, group.correction) }}</p>
          <p v-if="group.rows[0]!.inputGap">{{ INPUT_GAP_MESSAGES[group.rows[0]!.inputGap] }}</p>
          <details>
            <summary>Source details</summary>
            <p v-if="!group.rows.some((row) => row.candidates.length)">No inspected source covers this correction.</p>
            <div v-for="candidate in candidatesOf(group.rows)" :key="candidate.id" class="candidate">
              <p><strong>{{ candidate.kind }} — not applied</strong></p>
              <p>{{ candidate.title }} · {{ candidate.revision }}</p>
              <p>Section: {{ candidate.section }}</p>
              <p>{{ candidate.origin }}</p>
              <div v-for="operation in candidate.perOperation" :key="operation.operation">
                <p>{{ operation.operation }} — why it cannot be used:</p>
                <ul><li v-for="reason in operation.reasons" :key="reason">{{ reason }}</li></ul>
              </div>
            </div>
          </details>
        </article>
        <p>No source above is selected or approved. Use your aircraft's official POH/AFM for corrections.</p>
      </template>
    </section>
  </section>
</template>

<style scoped>
.panel { padding: 1.25rem; border: 1px solid var(--color-border); border-radius: 12px; background: var(--color-surface-card); min-width: 0; overflow-wrap: anywhere; }
h2, h3 { margin: 0 0 .75rem; }
p { line-height: 1.6; }
button { font: inherit; padding: .75rem; min-height: 44px; border-radius: 6px; border: 1px solid var(--color-border); background: var(--color-surface); color: inherit; cursor: pointer; font-weight: 600; }
button:disabled { opacity: .5; cursor: default; }
.correction { border-top: 1px solid var(--color-border); padding-top: 1rem; margin-top: 1rem; }
dl { display: grid; grid-template-columns: repeat(auto-fit, minmax(min(100%, 240px), 1fr)); gap: .75rem; margin: 0; }
dt { font-weight: 700; }
dd { margin: .25rem 0 0; }
.required { font-size: .95rem; }
details { margin-top: .5rem; }
summary { cursor: pointer; min-height: 44px; display: flex; align-items: center; font-weight: 600; }
.candidate { border-left: 3px solid var(--color-border); padding-left: .75rem; margin: .75rem 0; }
.candidate p { margin: .25rem 0; }
ul { margin: .25rem 0 .5rem; padding-left: 1.25rem; }
[role="alert"] { padding: .75rem; border-left: 4px solid var(--color-warning, #ba7b24); }
</style>
