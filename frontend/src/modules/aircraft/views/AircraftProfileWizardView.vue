<!-- @IMP-AC-VIEW-WIZARD-001@ (FROM: @REQ-AC-001@, @REQ-UQ-003@) -->
<template>
  <main class="wizard-view">
    <header class="wizard-header">
      <button type="button" class="btn-back" @click="onNavigateBack">← Back to Fleet</button>
      <h1>Add New Aircraft</h1>
    </header>

    <!-- Step indicator -->
    <nav class="step-indicator" aria-label="Wizard steps">
      <button
        v-for="(step, idx) in STEPS"
        :key="step.id"
        type="button"
        class="step-btn"
        :class="{
          'step-btn--active': idx === currentStep,
          'step-btn--completed': idx < currentStep,
          'step-btn--future': idx > currentStep,
        }"
        :disabled="idx > currentStep"
        :aria-current="idx === currentStep ? 'step' : undefined"
        @click="idx < currentStep ? (currentStep = idx) : undefined"
      >
        <span class="step-number">{{ idx + 1 }}</span>
        <span class="step-label">{{ step.label }}</span>
      </button>
    </nav>

    <!-- Step content -->
    <div class="wizard-body">
      <!-- Step 1: Identity -->
      <section v-if="currentStep === 0" class="wizard-step">
        <h2>Step 1: Aircraft Identity</h2>
        <p class="step-intro">Enter the basic details that identify this aircraft.</p>
        <IdentitySection
          v-model="identityFields"
          :registration-error="registrationError"
          section-id="wizard-identity"
        />
      </section>

      <!-- Step 2: Certification & Envelope -->
      <section v-else-if="currentStep === 1" class="wizard-step">
        <h2>Step 2: Certification &amp; Envelope</h2>
        <p class="step-intro">
          Enter the certification categories and CG envelope from your POH/AFM. This data is
          required for correct Mass &amp; Balance calculations.
        </p>
        <EnvelopeSection
          v-model="certificationCategories"
          section-id="wizard-envelope"
        />
      </section>

      <!-- Step 3: Weighing Reports -->
      <section v-else-if="currentStep === 2" class="wizard-step">
        <h2>Step 3: Weighing Reports</h2>
        <p class="step-intro">
          Enter the aircraft's Basic Empty Mass (BEM) and Empty CG from the latest weighing report
          in your POH/AFM.
        </p>
        <WeighingReportsSection
          v-model="weighingReports"
          section-id="wizard-weighing"
        />
      </section>

      <!-- Step 4: Load Stations -->
      <section v-else-if="currentStep === 3" class="wizard-step">
        <h2>Step 4: Load Stations</h2>
        <p class="step-intro">
          Define the seats, baggage areas, and fuel tanks for this aircraft.
        </p>
        <div v-if="loadPoints.length === 0" class="step-warning" role="note">
          No load stations defined. You can add seats, baggage areas, and fuel tanks later in the
          Fleet editor, but Mass &amp; Balance will have no stations to load until you do.
        </div>
        <LoadPointsSection
          v-model="loadPoints"
          section-id="wizard-loadpoints"
        />
      </section>

      <!-- Step 5: Review & Save -->
      <section v-else-if="currentStep === 4" class="wizard-step">
        <h2>Step 5: Review &amp; Save</h2>
        <p class="step-intro">Review what you've entered before saving.</p>

        <div class="review-panel">
          <div class="review-section">
            <h3>Identity</h3>
            <dl class="review-dl">
              <dt>Registration</dt>
              <dd>{{ identityFields.registration || '—' }}</dd>
              <dt>Manufacturer / Model</dt>
              <dd>{{ identityFields.manufacturer }} {{ identityFields.model }}</dd>
              <dt>ICAO Type</dt>
              <dd>{{ identityFields.icaoTypeDesignator || '—' }}</dd>
              <dt>POH Mass Unit</dt>
              <dd>{{ identityFields.sourceUnit }}</dd>
            </dl>
          </div>

          <div class="review-section">
            <h3>Certification &amp; Envelope</h3>
            <div v-for="(cat, i) in certificationCategories" :key="i" class="review-cat">
              <strong>{{ cat.category }}</strong>: MTOM {{ cat.mtom }}, {{ cat.envelope.length }}
              envelope points
            </div>
          </div>

          <div class="review-section">
            <h3>Weighing Reports</h3>
            <div v-for="(rep, i) in weighingReports" :key="i" class="review-item">
              BEM {{ rep.bem }}, Empty CG {{ rep.emptyCg }}, valid from {{ rep.validFrom }}
            </div>
          </div>

          <div class="review-section">
            <h3>Load Stations</h3>
            <div v-if="loadPoints.length === 0" class="review-empty">No stations defined yet.</div>
            <div v-for="(lp, i) in loadPoints" :key="i" class="review-item">
              {{ lp.name }} — arm {{ lp.arm ?? 'table' }}, unit {{ lp.unit }}
              <span v-if="lp.fuelTank"> (fuel tank)</span>
            </div>
          </div>
        </div>

        <p v-if="saveError" class="field-error" role="alert">{{ saveError }}</p>
      </section>
    </div>

    <!-- Navigation footer -->
    <footer class="wizard-footer">
      <div class="footer-left">
        <button
          v-if="currentStep > 0"
          type="button"
          class="btn btn-secondary"
          @click="goBack"
        >
          ← Back
        </button>
      </div>
      <div class="footer-right">
        <button
          v-if="currentStep < STEPS.length - 1"
          type="button"
          class="btn btn-primary"
          :disabled="!canContinue"
          @click="goNext"
        >
          Continue →
        </button>
        <button
          v-else
          type="button"
          class="btn btn-primary"
          :disabled="!canSave || isSaving"
          @click="onSave"
        >
          {{ isSaving ? 'Saving…' : 'Save as Draft' }}
        </button>
      </div>
    </footer>
  </main>
</template>

<script setup lang="ts">
// @IMP-AC-VIEW-WIZARD-002@ (FROM: @REQ-AC-001@, @REQ-UQ-003@)
import { ref, computed } from 'vue'
import { useRouter, onBeforeRouteLeave } from 'vue-router'
import { v4 as uuidv4 } from 'uuid'
import type {
  AircraftProfileCertificationCategory,
  AircraftProfileLoadPoint,
  AircraftProfileWeighingReport,
} from '@/core/adapters/aircraft.schema'
import { sortEnvelopeCcw } from '@/core/logic/envelope-sort'
import { useFleetStore } from '../stores/fleet.store'
import { validateIcaoRegistration } from '../services/profile.validator'
import IdentitySection, { type IdentityFields } from '../components/IdentitySection.vue'
import EnvelopeSection from '../components/EnvelopeSection.vue'
import WeighingReportsSection from '../components/WeighingReportsSection.vue'
import LoadPointsSection from '../components/LoadPointsSection.vue'

const router = useRouter()
const fleetStore = useFleetStore()

// ─── Step definitions ───────────────────────────────────────────────────────

const STEPS = [
  { id: 'identity', label: 'Identity' },
  { id: 'envelope', label: 'Envelope' },
  { id: 'weighing', label: 'Weighing' },
  { id: 'load-stations', label: 'Load Stations' },
  { id: 'review', label: 'Review' },
] as const

const currentStep = ref(0)
const isSaving = ref(false)
const saveError = ref<string | null>(null)

// ─── Draft state ────────────────────────────────────────────────────────────

const today = new Date().toISOString().slice(0, 10)

const identityFields = ref<IdentityFields>({
  registration: '',
  manufacturer: '',
  model: '',
  icaoTypeDesignator: '',
  sourceUnit: 'kg',
  referenceDatumDescription: '',
  referenceDatumLocation: '',
  shareCode: null,
})

const certificationCategories = ref<AircraftProfileCertificationCategory[]>([
  {
    category: 'Normal',
    mtom: 0,
    maxZeroFuelMass: null,
    graphType: 'arm',
    envelope: [
      { armOrMoment: 0, mass: 0 },
      { armOrMoment: 0, mass: 1 },
      { armOrMoment: 1, mass: 1 },
      { armOrMoment: 1, mass: 0 },
    ],
  },
])

const weighingReports = ref<AircraftProfileWeighingReport[]>([
  { bem: 0, emptyCg: 0, weighingDate: today, validFrom: today },
])

const loadPoints = ref<AircraftProfileLoadPoint[]>([])

// ─── Dirty detection ────────────────────────────────────────────────────────

const isDirty = computed(() => {
  return (
    identityFields.value.registration !== '' ||
    identityFields.value.manufacturer !== '' ||
    identityFields.value.model !== '' ||
    weighingReports.value.some((r) => r.bem > 0) ||
    loadPoints.value.length > 0
  )
})

// ─── Registration validation ────────────────────────────────────────────────

const registrationError = computed<string>(() => {
  const reg = identityFields.value.registration
  if (!reg) return ''
  if (!validateIcaoRegistration(reg)) {
    return 'Invalid registration format. Use 2–7 alphanumeric characters (e.g. D-EBPN).'
  }
  return ''
})

// ─── Step validation ────────────────────────────────────────────────────────

const step0Valid = computed(() => {
  const f = identityFields.value
  return (
    f.registration.trim() !== '' &&
    f.manufacturer.trim() !== '' &&
    f.model.trim() !== '' &&
    f.icaoTypeDesignator.trim() !== '' &&
    registrationError.value === ''
  )
})

const step1Valid = computed(() => {
  return certificationCategories.value.every(
    (cat) => cat.mtom > 0 && cat.envelope.length >= 4 && cat.envelope.length <= 20,
  )
})

const step2Valid = computed(() => {
  return (
    weighingReports.value.length >= 1 &&
    weighingReports.value.every(
      (r) => Number.isFinite(r.bem) && r.bem > 0 && !!r.weighingDate && !!r.validFrom,
    )
  )
})

// Step 3 (load stations) is optional — always valid
const step3Valid = computed(() => true)

const canContinue = computed(() => {
  switch (currentStep.value) {
    case 0:
      return step0Valid.value
    case 1:
      return step1Valid.value
    case 2:
      return step2Valid.value
    case 3:
      return step3Valid.value
    default:
      return false
  }
})

const canSave = computed(
  () => step0Valid.value && step1Valid.value && step2Valid.value,
)

// ─── Navigation ─────────────────────────────────────────────────────────────

function goNext(): void {
  if (currentStep.value < STEPS.length - 1) {
    currentStep.value++
  }
}

function goBack(): void {
  if (currentStep.value > 0) {
    currentStep.value--
  }
}

function onNavigateBack(): void {
  if (isDirty.value && !confirm('Discard unsaved changes and leave the wizard?')) return
  router.push({ name: 'fleet' })
}

onBeforeRouteLeave(() => {
  if (isDirty.value && !isSaving.value) {
    return confirm('Discard unsaved changes and leave the wizard?')
  }
})

// ─── Save ────────────────────────────────────────────────────────────────────

async function onSave(): Promise<void> {
  if (!canSave.value) return
  saveError.value = null
  isSaving.value = true

  try {
    // Normalise each category's envelope into CCW polygon order before save so
    // the stored vertices never produce a self-intersecting ("bowtie") polygon.
    // The pilot can enter vertices in any order they read off the POH; the
    // sort puts them into winding order around the centroid so both the chart
    // and the P1 ray-cast in mb.envelope agree on what is inside the envelope.
    const sortedCategories = certificationCategories.value.map((cat) => ({
      ...cat,
      envelope: sortEnvelopeCcw(cat.envelope),
    }))

    // For fuel tanks with unusableFuel > 0, a saved defaultQuantity below the
    // unusable floor is invalid — unusable fuel is always on board, so a
    // default of 0 would contradict the POH. Promote default to the unusable
    // amount before persisting.
    const normalizedLoadPoints = loadPoints.value.map((lp) =>
      lp.fuelTank && lp.fuelTank.unusableFuel > 0 && lp.defaultQuantity < lp.fuelTank.unusableFuel
        ? { ...lp, defaultQuantity: lp.fuelTank.unusableFuel }
        : lp,
    )

    await fleetStore.createProfile({
      ownerId: uuidv4(),
      registration: identityFields.value.registration.toUpperCase(),
      manufacturer: identityFields.value.manufacturer || 'Unknown',
      model: identityFields.value.model || 'Unknown',
      icaoTypeDesignator: identityFields.value.icaoTypeDesignator || 'ZZZZ',
      sourceUnit: identityFields.value.sourceUnit || 'kg',
      referenceDatumDescription:
        identityFields.value.referenceDatumDescription || 'To be defined',
      referenceDatumLocation: identityFields.value.referenceDatumLocation || 'Station 0',
      shareCode: identityFields.value.shareCode,
      certificationCategories: sortedCategories,
      weighingReports: weighingReports.value,
      loadPoints: normalizedLoadPoints,
      passengerProfiles: [],
    })

    router.push({ name: 'fleet' })
  } catch (err) {
    saveError.value = err instanceof Error ? err.message : 'Failed to save aircraft profile.'
  } finally {
    isSaving.value = false
  }
}
</script>

<style scoped>
.wizard-view {
  max-width: 900px;
  margin: 0 auto;
  padding: 1.5rem 1.5rem 5rem;
  display: flex;
  flex-direction: column;
  gap: 1.25rem;
  color: var(--color-text, #212121);
  min-height: 100vh;
}

.wizard-header {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}

.btn-back {
  background: none;
  border: none;
  color: var(--color-primary, #3b82f6);
  font-size: 0.875rem;
  cursor: pointer;
  padding: 0;
  align-self: flex-start;
}

h1 {
  margin: 0;
  font-size: 1.5rem;
  font-weight: 700;
}

/* ─── Step indicator ─────────────────────────────────────────────────────── */

.step-indicator {
  display: flex;
  gap: 0;
  overflow-x: auto;
  border: 1px solid var(--color-border, #e5e7eb);
  border-radius: 6px;
  background: var(--color-surface, #ffffff);
}

.step-btn {
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 0.25rem;
  padding: 0.625rem 0.5rem;
  background: none;
  border: none;
  border-right: 1px solid var(--color-border, #e5e7eb);
  cursor: pointer;
  font-size: 0.75rem;
  color: var(--color-text-secondary, #6b7280);
  transition: background 0.1s;
}

.step-btn:last-child {
  border-right: none;
}

.step-btn--active {
  background: var(--color-primary-bg, #eff6ff);
  color: var(--color-primary, #2563eb);
  font-weight: 600;
}

.step-btn--completed {
  color: var(--color-success, #16a34a);
}

.step-btn--future {
  opacity: 0.5;
  cursor: not-allowed;
}

.step-number {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 1.5rem;
  height: 1.5rem;
  border-radius: 50%;
  background: var(--color-border, #e5e7eb);
  font-size: 0.75rem;
  font-weight: 700;
}

.step-btn--active .step-number {
  background: var(--color-primary, #2563eb);
  color: #ffffff;
}

.step-btn--completed .step-number {
  background: var(--color-success, #16a34a);
  color: #ffffff;
}

.step-label {
  font-size: 0.6875rem;
  text-transform: uppercase;
  letter-spacing: 0.03em;
}

/* ─── Wizard body ─────────────────────────────────────────────────────────── */

.wizard-body {
  flex: 1;
}

.wizard-step {
  display: flex;
  flex-direction: column;
  gap: 1rem;
}

.wizard-step h2 {
  margin: 0;
  font-size: 1.25rem;
  font-weight: 700;
  color: var(--color-text, #111827);
}

.step-intro {
  margin: 0;
  font-size: 0.9375rem;
  color: var(--color-text-secondary, #6b7280);
}

.step-warning {
  padding: 0.75rem 1rem;
  border: 1px solid var(--color-warning, #fcd34d);
  background: var(--color-warning-bg, #fef3c7);
  border-radius: 6px;
  font-size: 0.875rem;
  color: var(--color-warning, #92400e);
}

/* ─── Review panel ────────────────────────────────────────────────────────── */

.review-panel {
  display: flex;
  flex-direction: column;
  gap: 1.25rem;
}

.review-section {
  padding: 1rem;
  border: 1px solid var(--color-border, #e5e7eb);
  border-radius: 6px;
  background: var(--color-surface-alt, #f9fafb);
}

.review-section h3 {
  margin: 0 0 0.75rem;
  font-size: 1rem;
  font-weight: 600;
  color: var(--color-text, #111827);
}

.review-dl {
  display: grid;
  grid-template-columns: 10rem 1fr;
  gap: 0.25rem 1rem;
  margin: 0;
  font-size: 0.875rem;
}

.review-dl dt {
  font-weight: 500;
  color: var(--color-text-secondary, #6b7280);
}

.review-dl dd {
  margin: 0;
  color: var(--color-text, #111827);
}

.review-cat,
.review-item {
  font-size: 0.875rem;
  color: var(--color-text, #111827);
  padding: 0.125rem 0;
}

.review-empty {
  font-size: 0.875rem;
  color: var(--color-text-secondary, #6b7280);
  font-style: italic;
}

/* ─── Footer ─────────────────────────────────────────────────────────────── */

.wizard-footer {
  position: sticky;
  bottom: 0;
  left: 0;
  right: 0;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 1rem;
  padding: 0.75rem 1rem;
  background: var(--color-surface, #ffffff);
  border-top: 1px solid var(--color-border, #e5e7eb);
  box-shadow: 0 -2px 6px rgba(0, 0, 0, 0.04);
  margin: 0 -1.5rem;
  z-index: 10;
}

.footer-left,
.footer-right {
  display: flex;
  gap: 0.5rem;
}

.btn {
  padding: 0.5rem 1.25rem;
  border: none;
  border-radius: 4px;
  font-size: 0.9375rem;
  cursor: pointer;
  font-weight: 600;
}

.btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.btn-primary {
  background: var(--color-primary, #3b82f6);
  color: var(--color-primary-text, #ffffff);
}

.btn-primary:hover:not(:disabled) {
  background: var(--color-primary-hover, #2563eb);
}

.btn-secondary {
  background: var(--color-surface-alt, #f3f4f6);
  color: var(--color-text, #212121);
  border: 1px solid var(--color-border, #d1d5db);
}

.field-error {
  margin: 0;
  padding: 0.5rem 0.75rem;
  color: var(--color-critical, #991b1b);
  background: var(--color-critical-bg, #fef2f2);
  border: 1px solid var(--color-critical, #fecaca);
  border-radius: 6px;
  font-size: 0.875rem;
}
</style>
