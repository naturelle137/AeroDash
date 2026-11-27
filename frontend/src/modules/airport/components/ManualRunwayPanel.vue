<script setup lang="ts">
import { computed, ref } from 'vue'
import {
  airacCycleStart,
  daysToDeclaredExpiry,
  daysToDeclaredEffect,
  runwayFreshness,
  validateManualRunway,
  MAX_AERODROME_LENGTH,
  MAX_DESIGNATOR_LENGTH,
  SURFACE_CONDITIONS,
  SURFACE_TYPES,
  type ManualRunwayField,
} from '@/core/logic/manual-runway'
import { useManualRunwayStore } from '../stores/manual-runway.store'

const runway = useManualRunwayStore()
const recentStatus = ref('all')
const recentDate = ref('selected')
const recentSearch = ref('')
const recentOrder = ref('recent')
const differingDatesOnly = ref(false)
function countRecent(date: string) {
  const counts = { expired: 0, 'not-yet-effective': 0, 'within-declared-dates': 0, unknown: 0 }
  for (const record of runway.recent) counts[runwayFreshness(record.runway, date)]++
  return counts
}
const recentCounts = computed(() => countRecent(runway.assessmentDate))
const deviceCounts = computed(() => countRecent(runway.today))
const filterDate = computed(() => !runway.automaticDate && recentDate.value === 'device' ? runway.today : runway.assessmentDate)
const visibleRecent = computed(() => runway.recent.filter((record) =>
  (recentStatus.value === 'all' || runwayFreshness(record.runway, filterDate.value) === recentStatus.value)
  && [record.runway.aerodrome, record.runway.designator, record.runway.source ?? ''].some((value) => value.toLowerCase().includes(recentSearch.value.trim().toLowerCase()))
  && (runway.automaticDate || !differingDatesOnly.value || runwayFreshness(record.runway, runway.assessmentDate) !== runwayFreshness(record.runway, runway.today)),
).sort((a, b) => recentOrder.value === 'expiry' || recentOrder.value === 'effective'
  ? (a.runway[recentOrder.value === 'expiry' ? 'expiryDate' : 'effectiveDate'] ?? '9999-99-99').localeCompare(b.runway[recentOrder.value === 'expiry' ? 'expiryDate' : 'effectiveDate'] ?? '9999-99-99')
  : 0))
const freshness = computed(() => runway.current ? runwayFreshness(runway.current.record.runway, runway.assessmentDate) : 'unknown')
const draftDateError = computed(() => {
  if (runway.current) return undefined
  const result = validateManualRunway(runway.draft)
  return result.status === 'invalid' ? result.errors.effectiveDate || result.errors.expiryDate : undefined
})
const draftCheck = computed(() => {
  const result = validateManualRunway(runway.draft)
  const { effectiveDate, expiryDate } = runway.draft
  if (runway.current || (!effectiveDate && !expiryDate && !runway.draft.aerodrome.trim() && !runway.draft.designator.trim())) return null
  if (result.status === 'invalid' && (result.errors.effectiveDate || result.errors.expiryDate)) return null
  return runwayFreshness({ effectiveDate: effectiveDate || undefined, expiryDate: expiryDate || undefined }, runway.assessmentDate)
})
const cycle = computed(() => airacCycleStart(runway.assessmentDate))
const freshnessLabels = { unknown: 'Unknown: declared dates are incomplete or the assessment date is invalid.', 'not-yet-effective': 'Not yet effective according to the declared date.', expired: 'Expired according to the declared date.', 'within-declared-dates': 'Within the declared dates; source currency remains unverified.' }
const surfaceTypeLabels = { paved: 'Paved', unpaved: 'Other / legacy unpaved', grass: 'Grass' } as const
const conditionOptions = computed(() => {
  const type = runway.draft.surfaceType
  return type === 'paved' || type === 'unpaved' || type === 'grass' ? SURFACE_CONDITIONS[type] : []
})
const conditionLabel = computed(() => {
  const record = runway.current?.record
  if (!record) return ''
  return SURFACE_CONDITIONS[record.runway.surface.type].find((option) => option.value === record.runway.surface.condition)?.label ?? ''
})
const savedAt = computed(() => runway.saved ? new Date(runway.saved.savedAt).toLocaleString() : '')
const errorCount = computed(() => Object.keys(runway.errors).length)

function selectRecent(record: (typeof runway.recent)[number]): void {
  if (window.confirm('Replace the current runway form with this saved declaration? Unsaved changes will be lost.')) runway.selectRecent(record)
}

function error(field: ManualRunwayField): string | undefined {
  return runway.showErrors ? runway.errors[field] : undefined
}
function describedBy(field: ManualRunwayField): string | undefined {
  return error(field) ? `manual-runway-${field}-error` : undefined
}

// Synchronous local storage: restore before first render so no empty form flashes.
if (!runway.loaded) runway.load()
</script>

<template>
  <form class="panel manual-runway" novalidate aria-labelledby="manual-runway-heading" @submit.prevent="runway.save()">
    <h2 id="manual-runway-heading">Manual runway</h2>
    <p class="provenance"><strong>User-entered — not validated against airport data.</strong>
      Copy declared distances, elevation and the current surface condition from official sources
      (AIP/aerodrome chart, NOTAM). No airport database or online lookup is used.</p>
    <p v-if="runway.storageError" role="alert" class="storage-error">{{ runway.storageError }}</p>
    <p v-if="runway.recentError" role="alert" class="storage-error">Recent runway declarations could not be read or saved. Existing data was not replaced; manual runway entry remains available.</p>

    <section aria-label="Runway date check">
      <div class="field"><label for="runway-assessment-date">Check date</label><input id="runway-assessment-date" :value="runway.assessmentDate" type="date" @input="runway.selectAssessmentDate(($event.target as HTMLInputElement).value)" /></div>
      <button type="button" @click="runway.useToday()">Use today’s local date</button>
      <p class="hint">{{ runway.automaticDate ? 'Today updates with the device’s local date.' : 'The selected date stays fixed.' }} Check your device date.</p>
      <p v-if="!runway.automaticDate && runway.current">Device date {{ runway.today }}: {{ freshnessLabels[runwayFreshness(runway.current.record.runway, runway.today)] }} This is a declared date check, not source verification.</p>
      <p v-if="draftDateError" role="alert">Unsaved declaration date check unavailable: {{ draftDateError }}</p>
      <p v-if="draftCheck" role="status"><strong>Unsaved declaration date check:</strong> {{ freshnessLabels[draftCheck] }} Source and currency remain unverified; NOTAM/SUP coverage is unknown.</p>
      <p v-if="draftCheck && !runway.automaticDate">Unsaved declaration on device date {{ runway.today }}: {{ freshnessLabels[runwayFreshness({ effectiveDate: runway.draft.effectiveDate || undefined, expiryDate: runway.draft.expiryDate || undefined }, runway.today)] }}</p>
      <template v-if="draftCheck">
        <p>Days to declared effect: {{ daysToDeclaredEffect(runway.draft, runway.assessmentDate) ?? 'Unknown' }} (negative means after the declared effective date).</p>
        <p>Days to declared expiry: {{ daysToDeclaredExpiry(runway.draft, runway.assessmentDate) ?? 'Unknown' }} (negative means past inclusive expiry).</p>
        <p v-if="!runway.automaticDate">Unsaved declaration from device date {{ runway.today }}: days to declared effect: {{ daysToDeclaredEffect(runway.draft, runway.today) ?? 'Unknown' }} · days to inclusive expiry: {{ daysToDeclaredExpiry(runway.draft, runway.today) ?? 'Unknown' }}. Source remains unverified.</p>
      </template>
    </section>
    <section v-if="runway.recent.length" aria-label="Recently used airports">
      <h3>Recently used airports</h3>
      <label for="recent-search">Search aerodrome, runway or source reference</label>
      <input id="recent-search" v-model="recentSearch" type="search" />
      <label for="recent-order">Order declarations</label>
      <select id="recent-order" v-model="recentOrder">
        <option value="recent">Most recently used</option>
        <option value="expiry">Expiry date (unknown last)</option>
        <option value="effective">Effective date (unknown last)</option>
      </select>
      <p>Declared date check for {{ runway.assessmentDate || 'an invalid date' }}. Source and currency remain unverified; NOTAM/SUP coverage is unknown.</p>
      <p aria-label="Recent declaration date check totals">All recent declarations: {{ runway.recent.length }} · Expired: {{ recentCounts.expired }} · Not yet effective: {{ recentCounts['not-yet-effective'] }} · Within declared dates: {{ recentCounts['within-declared-dates'] }} · Unknown: {{ recentCounts.unknown }}</p>
      <p v-if="!runway.automaticDate" aria-label="Recent device date check totals">Device date {{ runway.today }} — all recent declarations: {{ runway.recent.length }} · Expired: {{ deviceCounts.expired }} · Not yet effective: {{ deviceCounts['not-yet-effective'] }} · Within declared dates: {{ deviceCounts['within-declared-dates'] }} · Unknown: {{ deviceCounts.unknown }}</p>
      <template v-if="!runway.automaticDate">
        <label for="recent-date">Filter date</label>
        <select id="recent-date" v-model="recentDate">
          <option value="selected">Selected check date ({{ runway.assessmentDate || 'invalid' }})</option>
          <option value="device">Device date ({{ runway.today }})</option>
        </select>
      </template>
      <label for="recent-status">Filter by declared date check</label>
      <select id="recent-status" v-model="recentStatus">
        <option value="all">All declarations</option>
        <option value="expired">Expired</option>
        <option value="not-yet-effective">Not yet effective</option>
        <option value="within-declared-dates">Within declared dates</option>
        <option value="unknown">Unknown</option>
      </select>
      <p v-if="!visibleRecent.length">No declarations match the current filters.</p>
      <p v-if="!runway.automaticDate"><label><input v-model="differingDatesOnly" type="checkbox" /> Only show declarations with different selected and device date checks</label></p>
      <p v-if="recentStatus !== 'all'">Filter uses {{ filterDate || 'an invalid date' }}; each entry still shows the selected date check.</p>
      <ul class="recent-runways"><li v-for="record in visibleRecent" :key="JSON.stringify([record.runway.aerodrome, record.runway.designator])">
        <button type="button" class="select-recent" @click="selectRecent(record)">{{ record.runway.aerodrome }} — {{ record.runway.designator }}: {{ freshnessLabels[runwayFreshness(record.runway, runway.assessmentDate)] }}</button>
        <button type="button" :aria-label="`Remove ${record.runway.aerodrome} runway ${record.runway.designator} from recent airports`" @click="runway.removeRecent(record)">Remove from recents</button>
        <p v-if="!runway.automaticDate">Device date {{ runway.today }}: {{ freshnessLabels[runwayFreshness(record.runway, runway.today)] }}</p>
        <p>Source: {{ record.runway.source || 'Unknown' }} (user-declared, unverified) · Effective: {{ record.runway.effectiveDate || 'Unknown' }} · Expiry (inclusive): {{ record.runway.expiryDate || 'Unknown' }}</p>
        <p>Days to declared effect: {{ daysToDeclaredEffect(record.runway, runway.assessmentDate) ?? 'Unknown' }} (negative means after the declared effective date; source remains unverified).</p>
        <p>Days to declared expiry: {{ daysToDeclaredExpiry(record.runway, runway.assessmentDate) ?? 'Unknown' }} (negative means past expiry; source remains unverified).</p>
        <p v-if="!runway.automaticDate">From device date {{ runway.today }}: days to declared effect: {{ daysToDeclaredEffect(record.runway, runway.today) ?? 'Unknown' }} · days to inclusive expiry: {{ daysToDeclaredExpiry(record.runway, runway.today) ?? 'Unknown' }}. Source remains unverified.</p>
      </li></ul>
    </section>
    <div class="fields">
      <div class="field">
        <label for="manual-runway-aerodrome">Aerodrome</label>
        <input id="manual-runway-aerodrome" v-model="runway.draft.aerodrome" type="text" autocomplete="off"
          :maxlength="MAX_AERODROME_LENGTH" :aria-invalid="!!error('aerodrome')" :aria-describedby="describedBy('aerodrome')" />
      </div>
      <div class="field">
        <label for="manual-runway-designator">Runway designator</label>
        <input id="manual-runway-designator" v-model="runway.draft.designator" type="text" autocomplete="off"
          :maxlength="MAX_DESIGNATOR_LENGTH" :aria-invalid="!!error('designator')" :aria-describedby="describedBy('designator')" />
      </div>
    </div>
    <p v-if="error('aerodrome')" :id="describedBy('aerodrome')" class="field-error">{{ error('aerodrome') }}</p>
    <p v-if="error('designator')" :id="describedBy('designator')" class="field-error">{{ error('designator') }}</p>

    <fieldset>
      <legend>Declared available distances</legend>
      <div class="value-unit">
        <div class="field">
          <label for="manual-runway-tora">TORA — takeoff run available</label>
          <input id="manual-runway-tora" v-model="runway.draft.tora" type="text" inputmode="decimal"
            :aria-invalid="!!error('tora')" :aria-describedby="describedBy('tora')" />
        </div>
        <div class="field">
          <label class="sr-only" for="manual-runway-tora-unit">TORA unit</label>
          <select id="manual-runway-tora-unit" v-model="runway.draft.toraUnit" :aria-invalid="!!error('toraUnit')" :aria-describedby="describedBy('toraUnit')">
            <option value="">Select unit</option><option value="m">m</option><option value="ft">ft</option>
          </select>
        </div>
      </div>
      <p v-if="error('tora')" :id="describedBy('tora')" class="field-error">{{ error('tora') }}</p>
      <p v-if="error('toraUnit')" :id="describedBy('toraUnit')" class="field-error">{{ error('toraUnit') }}</p>
      <div class="value-unit">
        <div class="field">
          <label for="manual-runway-lda">LDA — landing distance available</label>
          <input id="manual-runway-lda" v-model="runway.draft.lda" type="text" inputmode="decimal"
            :aria-invalid="!!error('lda')" :aria-describedby="describedBy('lda')" />
        </div>
        <div class="field">
          <label class="sr-only" for="manual-runway-lda-unit">LDA unit</label>
          <select id="manual-runway-lda-unit" v-model="runway.draft.ldaUnit" :aria-invalid="!!error('ldaUnit')" :aria-describedby="describedBy('ldaUnit')">
            <option value="">Select unit</option><option value="m">m</option><option value="ft">ft</option>
          </select>
        </div>
      </div>
      <p v-if="error('lda')" :id="describedBy('lda')" class="field-error">{{ error('lda') }}</p>
      <p v-if="error('ldaUnit')" :id="describedBy('ldaUnit')" class="field-error">{{ error('ldaUnit') }}</p>
      <div class="value-unit">
        <div class="field">
          <label for="manual-runway-toda">TODA — takeoff distance available (optional)</label>
          <input id="manual-runway-toda" v-model="runway.draft.toda" type="text" inputmode="decimal"
            :aria-invalid="!!error('toda')" :aria-describedby="describedBy('toda')" />
        </div>
        <div class="field">
          <label class="sr-only" for="manual-runway-toda-unit">TODA unit</label>
          <select id="manual-runway-toda-unit" v-model="runway.draft.todaUnit" :aria-invalid="!!error('todaUnit')" :aria-describedby="describedBy('todaUnit')">
            <option value="">Select unit</option><option value="m">m</option><option value="ft">ft</option>
          </select>
        </div>
      </div>
      <p v-if="error('toda')" :id="describedBy('toda')" class="field-error">{{ error('toda') }}</p>
      <p v-if="error('todaUnit')" :id="describedBy('todaUnit')" class="field-error">{{ error('todaUnit') }}</p>
    </fieldset>

    <fieldset>
      <legend>Field elevation</legend>
      <div class="value-unit">
        <div class="field">
          <label for="manual-runway-elevation">Field elevation</label>
          <input id="manual-runway-elevation" v-model="runway.draft.fieldElevation" type="text" inputmode="text"
            :aria-invalid="!!error('fieldElevation')" :aria-describedby="describedBy('fieldElevation')" />
        </div>
        <div class="field">
          <label class="sr-only" for="manual-runway-elevation-unit">Field elevation unit</label>
          <select id="manual-runway-elevation-unit" v-model="runway.draft.fieldElevationUnit" :aria-invalid="!!error('fieldElevationUnit')" :aria-describedby="describedBy('fieldElevationUnit')">
            <option value="">Select unit</option><option value="m">m</option><option value="ft">ft</option>
          </select>
        </div>
      </div>
      <p v-if="error('fieldElevation')" :id="describedBy('fieldElevation')" class="field-error">{{ error('fieldElevation') }}</p>
      <p v-if="error('fieldElevationUnit')" :id="describedBy('fieldElevationUnit')" class="field-error">{{ error('fieldElevationUnit') }}</p>
      <p class="hint">Elevation above mean sea level; values below sea level are allowed. It is not pressure
        altitude and is not used for the table lookup.</p>
    </fieldset>

    <fieldset>
      <legend>Runway surface</legend>
      <div class="fields">
        <div class="field">
          <label for="manual-runway-surface-type">Surface type</label>
          <select id="manual-runway-surface-type" v-model="runway.draft.surfaceType" :aria-invalid="!!error('surfaceType')" :aria-describedby="describedBy('surfaceType')">
            <option value="">Select surface type</option>
            <option v-for="type in SURFACE_TYPES" :key="type" :value="type">{{ surfaceTypeLabels[type] }}</option>
          </select>
        </div>
        <div class="field">
          <label for="manual-runway-surface-condition">Surface condition</label>
          <select id="manual-runway-surface-condition" v-model="runway.draft.surfaceCondition" @change="runway.chooseSurface()" :disabled="!conditionOptions.length"
            :aria-invalid="!!error('surfaceCondition')" :aria-describedby="describedBy('surfaceCondition')">
            <option value="">Select surface condition</option>
            <option v-for="option in conditionOptions" :key="option.value" :value="option.value">{{ option.label }}</option>
          </select>
        </div>
      </div>
      <p v-if="runway.weatherSurface" role="status">{{ runway.draft.surfaceCondition === 'soft-ground' ? 'Soft ground' : 'Wet' }} suggested by {{ runway.weatherSurface.source ?? 'METAR' }} {{ runway.weatherSurface.station }} · {{ runway.weatherSurface.time }}<span v-if="runway.weatherSurface.source === 'TAF'"> · valid {{ runway.weatherSurface.validFrom }} to {{ runway.weatherSurface.validTo }}</span>. Verify the actual surface and select another condition if needed. Saving confirms your surface declaration.</p>
      <p v-if="error('surfaceType')" :id="describedBy('surfaceType')" class="field-error">{{ error('surfaceType') }}</p>
      <p v-if="error('surfaceCondition')" :id="describedBy('surfaceCondition')" class="field-error">{{ error('surfaceCondition') }}</p>
    </fieldset>

    <fieldset>
      <legend>Source details (optional)</legend>
      <div class="field"><label for="runway-source">Source reference</label><input id="runway-source" v-model="runway.draft.source" maxlength="200" :aria-invalid="!!error('source')" :aria-describedby="describedBy('source')" /><p v-if="error('source')" :id="describedBy('source')" class="field-error">{{ error('source') }}</p></div>
      <p>Enter dates only when stated by your source. The expiry date is inclusive.</p>
      <div class="fields">
        <div class="field"><label for="runway-effective">Effective date</label><input id="runway-effective" v-model="runway.draft.effectiveDate" type="date" :aria-invalid="!!error('effectiveDate')" :aria-describedby="describedBy('effectiveDate')" /><p v-if="error('effectiveDate')" :id="describedBy('effectiveDate')" class="field-error">{{ error('effectiveDate') }}</p></div>
        <div class="field"><label for="runway-expiry">Expiry date</label><input id="runway-expiry" v-model="runway.draft.expiryDate" type="date" :aria-invalid="!!error('expiryDate')" :aria-describedby="describedBy('expiryDate')" /><p v-if="error('expiryDate')" :id="describedBy('expiryDate')" class="field-error">{{ error('expiryDate') }}</p></div>
      </div>
    </fieldset>

    <p v-if="runway.showErrors && errorCount" role="alert">Runway inputs not saved: correct {{ errorCount }}
      {{ errorCount === 1 ? 'field' : 'fields' }}.</p>
    <div class="actions">
      <button type="submit">Save runway inputs</button>
      <button v-if="runway.hasUnsavedChanges" type="button" @click="runway.revert()">Discard changes</button>
      <button type="button" class="secondary" @click="runway.clear()">Clear runway inputs</button>
    </div>
    <p v-if="runway.notice" role="status">{{ runway.notice }}</p>
    <p v-if="runway.hasUnsavedChanges" role="status" class="unsaved">Unsaved changes: the saved runway
      ({{ runway.saved?.runway.aerodrome }} {{ runway.saved?.runway.designator }}) is not shown as current until you save or discard.</p>

    <section v-if="runway.current" aria-label="Saved manual runway" class="summary">
      <h3>{{ runway.current.record.runway.aerodrome }} — runway {{ runway.current.record.runway.designator }}</h3>
      <p class="provenance">User-entered, not airport-validated · saved {{ savedAt }}</p>
      <dl>
        <div><dt>Source reference</dt><dd>{{ runway.current.record.runway.source || 'Unknown' }} (user-declared, unverified)</dd></div>
        <div><dt>Declared effective date</dt><dd>{{ runway.current.record.runway.effectiveDate || 'Unknown' }}</dd></div>
        <div><dt>Declared expiry date (inclusive)</dt><dd>{{ runway.current.record.runway.expiryDate || 'Unknown' }}</dd></div>
        <div><dt>TORA</dt><dd>{{ runway.current.record.runway.tora.value }} {{ runway.current.record.runway.tora.unit }}
          <span class="normalized">({{ runway.current.display.toraM }} m)</span></dd></div>
        <div><dt>LDA</dt><dd>{{ runway.current.record.runway.lda.value }} {{ runway.current.record.runway.lda.unit }}
          <span class="normalized">({{ runway.current.display.ldaM }} m)</span></dd></div>
        <div v-if="runway.current.record.runway.toda"><dt>TODA</dt><dd>{{ runway.current.record.runway.toda.value }} {{ runway.current.record.runway.toda.unit }}
          <span class="normalized">({{ runway.current.display.todaM }} m)</span></dd></div>
        <div><dt>Field elevation</dt><dd>{{ runway.current.record.runway.fieldElevation.value }} {{ runway.current.record.runway.fieldElevation.unit }}
          <span class="normalized">({{ runway.current.record.runway.fieldElevation.unit === 'ft' ? `${runway.current.display.fieldElevationM} m` : `${runway.current.display.fieldElevationFt} ft` }})</span></dd></div>
        <div><dt>Surface</dt><dd>{{ surfaceTypeLabels[runway.current.record.runway.surface.type] }} · {{ conditionLabel }}<span v-if="runway.current.record.weatherSurface"> · {{ runway.current.record.weatherSurface.source ?? 'METAR' }} via wxdecoder.com {{ runway.current.record.weatherSurface.station }} · {{ runway.current.record.weatherSurface.time }} <span v-if="runway.current.record.weatherSurface.source === 'TAF'"> · valid {{ runway.current.record.weatherSurface.validFrom }} to {{ runway.current.record.weatherSurface.validTo }}</span> (saved weather; verify current conditions)</span></dd></div>
      </dl>
      <p role="status"><strong>Source date check:</strong> {{ freshnessLabels[freshness] }}</p>
      <p>Days to declared effect: {{ daysToDeclaredEffect(runway.current.record.runway, runway.assessmentDate) ?? 'Unknown' }} (negative means after the declared effective date; source remains unverified).</p>
      <p>Days to declared expiry: {{ daysToDeclaredExpiry(runway.current.record.runway, runway.assessmentDate) ?? 'Unknown' }} (negative means past expiry; source remains unverified).</p>
      <p v-if="!runway.automaticDate">From device date {{ runway.today }}: days to declared effect: {{ daysToDeclaredEffect(runway.current.record.runway, runway.today) ?? 'Unknown' }} · days to inclusive expiry: {{ daysToDeclaredExpiry(runway.current.record.runway, runway.today) ?? 'Unknown' }}. Source remains unverified.</p>
      <p v-if="cycle">AIRAC cycle starting {{ cycle }} (calendar date only).</p>
      <p v-else>AIRAC cycle unavailable for this date; consult the published calendar.</p>
      <p class="hint">A cycle change does not expire or verify a record. NOTAM/SUP coverage is unknown; check dates and restrictions against official sources.</p>
      <p class="hint">Converted values use 1 ft = 0.3048 m; available distances are rounded down.</p>
    </section>
    <p role="status" class="assessment"><strong>Manual runway declaration.</strong>
      Comparisons appear in Performance only when the source and current inputs support them.
      Verify the declared distances and applicable aircraft manual; no Go/No-Go decision is provided.</p>
  </form>
</template>

<style scoped>
.panel { padding: 1.25rem; border: 1px solid var(--color-border); border-radius: 12px; background: var(--color-surface-card); min-width: 0; display: grid; gap: .75rem; }
.panel > section { min-width: 0; }
h2, h3 { margin: 0; }
p { margin: 0; line-height: 1.6; }
fieldset { border: 1px solid var(--color-border); border-radius: 8px; padding: .75rem 1rem 1rem; margin: 0; display: grid; gap: .5rem; min-width: 0; }
legend { font-weight: 700; padding: 0 .25rem; }
.fields { display: grid; grid-template-columns: repeat(auto-fit, minmax(min(100%, 200px), 1fr)); gap: 1rem; }
.value-unit > * { min-width: 0; }
.value-unit input, .value-unit select { width: 100%; box-sizing: border-box; }
.value-unit label { overflow-wrap: anywhere; }
.value-unit { display: grid; grid-template-columns: minmax(0, 1fr) auto; gap: .5rem; align-items: end; }
.value-unit > :last-child { max-width: 6rem; }
.sr-only { position: absolute; width: 1px; height: 1px; padding: 0; margin: -1px; overflow: hidden; clip: rect(0, 0, 0, 0); white-space: nowrap; border: 0; }
.field { display: grid; gap: .5rem; align-content: start; }
input, select, button { font: inherit; padding: .75rem; min-height: 44px; border-radius: 6px; border: 1px solid var(--color-border); background: var(--color-surface); color: inherit; min-width: 0; }
select:disabled { opacity: .6; }
[aria-invalid="true"] { border-color: var(--color-danger, #c0392b); border-width: 2px; }
.field-error { color: var(--color-danger, #c0392b); font-weight: 600; }
.field-error::before { content: '⚠ '; }
.actions { display: flex; flex-wrap: wrap; gap: .75rem; }
.recent-runways { list-style: none; padding: 0; display: grid; gap: .75rem; overflow-wrap: anywhere; }
#recent-order { max-width: 100%; }
button { cursor: pointer; font-weight: 600; }
.provenance, .unsaved { overflow-wrap: anywhere; }
.summary { border-left: 4px solid var(--color-primary); padding-left: .75rem; display: grid; gap: .5rem; overflow-wrap: anywhere; }
dl { display: grid; grid-template-columns: repeat(auto-fit, minmax(min(100%, 180px), 1fr)); gap: .75rem; margin: 0; }
dt { font-weight: 600; }
dd { margin: .25rem 0 0; font-size: 1.25rem; font-weight: 700; }
.normalized { font-size: 1rem; font-weight: 400; }
.hint { font-size: .95rem; }
[role="alert"] { padding: .75rem; border-left: 4px solid var(--color-warning, #ba7b24); }
.assessment { padding: .75rem; border: 1px dashed var(--color-border); border-radius: 8px; }
</style>
