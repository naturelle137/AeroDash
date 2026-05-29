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
      <!-- Step: Identity -->
      <section v-if="stepId === 'identity'" class="wizard-step">
        <h2>Step {{ stepNumber }}: Aircraft Identity</h2>
        <p class="step-intro">Enter the basic details that identify this aircraft.</p>
        <IdentitySection
          v-model="identityFields"
          :registration-error="registrationError"
          section-id="wizard-identity"
        />
      </section>

      <!-- Step: Certification & Envelope -->
      <section v-else-if="stepId === 'envelope'" class="wizard-step">
        <h2>Step {{ stepNumber }}: Certification &amp; Envelope</h2>
        <p class="step-intro">
          Enter the certification categories and CG envelope from your POH/AFM. This data is
          required for correct Mass &amp; Balance calculations.
        </p>
        <EnvelopeSection
          v-model="certificationCategories"
          section-id="wizard-envelope"
        />
      </section>

      <!-- Step: Weighing Reports -->
      <section v-else-if="stepId === 'weighing'" class="wizard-step">
        <h2>Step {{ stepNumber }}: Weighing Reports</h2>
        <p class="step-intro">
          Enter the aircraft's Basic Empty Mass (BEM) and Empty CG from the latest weighing report
          in your POH/AFM.
        </p>
        <WeighingReportsSection
          v-model="weighingReports"
          section-id="wizard-weighing"
        />
      </section>

      <!-- Step: Load Stations -->
      <section v-else-if="stepId === 'load-stations'" class="wizard-step">
        <h2>Step {{ stepNumber }}: Load Stations</h2>
        <p class="step-intro">
          {{
            isElectric
              ? 'Define the seats and baggage areas for this aircraft. Fuel tanks are not applicable — battery pack capacity is entered on the next step.'
              : 'Define the seats, baggage areas, and fuel tanks for this aircraft.'
          }}
        </p>
        <div v-if="loadPoints.length === 0" class="step-warning" role="note">
          No load stations defined. You can add seats and baggage areas later in the Fleet
          editor, but Mass &amp; Balance will have no stations to load until you do.
        </div>
        <LoadPointsSection
          v-model="loadPoints"
          :available-categories="availableCategoryNames"
          :powertrain="identityFields.powertrain"
          section-id="wizard-loadpoints"
        />
      </section>

      <!-- Step: Battery Pack (electric only) -->
      <section v-else-if="stepId === 'battery-pack'" class="wizard-step">
        <h2>Step {{ stepNumber }}: Battery Pack</h2>
        <p class="step-intro">
          Enter the battery pack description for this electric airframe.
        </p>
        <BatteryPackSection v-model="batteryPack" section-id="wizard-battery" />
      </section>

      <!-- Step: Review & Save -->
      <section v-else-if="stepId === 'review'" class="wizard-step">
        <h2>Step {{ stepNumber }}: Review &amp; Save</h2>
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
              <dt>Powertrain</dt>
              <dd>{{ isElectric ? 'Electric' : 'Combustion' }}</dd>
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

          <div v-if="isElectric" class="review-section">
            <h3>Battery Pack</h3>
            <dl class="review-dl">
              <dt>Usable Energy</dt>
              <dd>{{ batteryPack.usableEnergyKwh }} kWh</dd>
              <dt>Reserve Floor</dt>
              <dd>{{ batteryPack.reserveFloorKwh }} kWh</dd>
              <template v-if="batteryPack.nominalVoltage">
                <dt>Nominal Voltage</dt>
                <dd>{{ batteryPack.nominalVoltage }} V</dd>
              </template>
              <template v-if="batteryPack.chemistry">
                <dt>Chemistry</dt>
                <dd>{{ batteryPack.chemistry }}</dd>
              </template>
            </dl>
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

    <!-- UX-015: in-app exit modal — replaces the iOS-dismissable native confirm() -->
    <ActionChoiceDialog
      :open="showExitDialog"
      title="Leave the aircraft wizard?"
      message="You have unsaved changes. Save this aircraft as a draft, discard it, or keep editing."
      :actions="exitActions"
      @choose="onExitChoice"
      @dismiss="onExitDismiss"
    />

    <!-- UX-012: post-save action chooser — skip the detour back through the fleet list -->
    <ActionChoiceDialog
      :open="savedProfile !== null"
      title="Aircraft saved as draft"
      :message="
        savedProfile
          ? `‘${savedProfile.registration}’ is saved. Start flight prep with it now, verify it first, or return to your fleet.`
          : ''
      "
      :actions="postSaveActions"
      @choose="onPostSaveChoice"
      @dismiss="onPostSaveDismiss"
    />
  </main>
</template>

<script setup lang="ts">
// @IMP-AC-VIEW-WIZARD-002@ (FROM: @REQ-AC-001@, @REQ-UQ-003@)
import { ref, computed, watch } from 'vue'
import { useRouter, onBeforeRouteLeave } from 'vue-router'
import { v4 as uuidv4 } from 'uuid'
import type {
  AircraftProfile,
  AircraftProfileBatteryPack,
  AircraftProfileCertificationCategory,
  AircraftProfileLoadPoint,
  AircraftProfileWeighingReport,
} from '@/core/adapters/aircraft.schema'
import { sortEnvelopeCcw } from '@/core/logic/envelope-sort'
import { useFleetStore } from '../stores/fleet.store'
import { useActiveAircraftStore } from '../stores/active-aircraft.store'
import { validateIcaoRegistration } from '../services/profile.validator'
import IdentitySection, { type IdentityFields } from '../components/IdentitySection.vue'
import EnvelopeSection from '../components/EnvelopeSection.vue'
import WeighingReportsSection from '../components/WeighingReportsSection.vue'
import LoadPointsSection from '../components/LoadPointsSection.vue'
import BatteryPackSection from '../components/BatteryPackSection.vue'
import ActionChoiceDialog, { type DialogAction } from '@/shared/components/ActionChoiceDialog.vue'

const router = useRouter()
const fleetStore = useFleetStore()
const activeStore = useActiveAircraftStore()

// ─── Step definitions ───────────────────────────────────────────────────────
//
// @IMP-AC-VIEW-WIZARD-003@ (FROM: @REQ-AD-020@)
// Steps are composed dynamically from a static base list so that the Battery
// Pack step only appears for electric airframes. Keeping the list explicit
// (rather than, say, a flag on each step) means the `step-indicator` can render
// the right count without having to reason about whether the pilot chose
// electric halfway through.

const BASE_STEPS = [
  { id: 'identity', label: 'Identity' },
  { id: 'envelope', label: 'Envelope' },
  { id: 'weighing', label: 'Weighing' },
  { id: 'load-stations', label: 'Load Stations' },
  { id: 'review', label: 'Review' },
] as const

const BATTERY_STEP = { id: 'battery-pack', label: 'Battery Pack' } as const
type StepId = (typeof BASE_STEPS)[number]['id'] | typeof BATTERY_STEP.id
type WizardStep = { id: StepId; label: string }

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
  powertrain: 'combustion',
  shareCode: null,
})

// @IMP-AC-VIEW-WIZARD-004@ (FROM: @REQ-AD-020@, @REQ-AD-021@)
// Battery pack draft. Seeded with zero so DecimalInput has a number to bind to;
// schema validation (`usableEnergyKwh > 0`, `reserveFloorKwh < usableEnergyKwh`)
// is the final guard at save time. The field-level validations in
// BatteryPackSection catch the obvious cases earlier in the flow.
const batteryPack = ref<AircraftProfileBatteryPack>({
  usableEnergyKwh: 0,
  reserveFloorKwh: 0,
})

const isElectric = computed(() => identityFields.value.powertrain === 'electric')

const STEPS = computed<readonly WizardStep[]>(() => {
  if (!isElectric.value) return BASE_STEPS
  // Insert Battery Pack between Load Stations and Review for electric builds.
  const idx = BASE_STEPS.findIndex((s) => s.id === 'review')
  return [...BASE_STEPS.slice(0, idx), BATTERY_STEP, ...BASE_STEPS.slice(idx)]
})

const stepId = computed<StepId>(() => STEPS.value[currentStep.value]?.id ?? 'identity')

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

// Distinct certification category names (Normal / Utility / Aerobatic) feeding
// the per-station category-restriction UI. Deduplicated in case the pilot adds
// two envelope entries for the same category (e.g. two Normal envelopes) —
// both should collapse to a single checkbox.
const availableCategoryNames = computed<AircraftProfileCertificationCategory['category'][]>(
  () => Array.from(new Set(certificationCategories.value.map((c) => c.category))),
)

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

const identityValid = computed(() => {
  const f = identityFields.value
  return (
    f.registration.trim() !== '' &&
    f.manufacturer.trim() !== '' &&
    f.model.trim() !== '' &&
    f.icaoTypeDesignator.trim() !== '' &&
    registrationError.value === ''
  )
})

const envelopeValid = computed(() => {
  return certificationCategories.value.every(
    (cat) => cat.mtom > 0 && cat.envelope.length >= 4 && cat.envelope.length <= 20,
  )
})

const weighingValid = computed(() => {
  return (
    weighingReports.value.length >= 1 &&
    weighingReports.value.every(
      (r) => Number.isFinite(r.bem) && r.bem > 0 && !!r.weighingDate && !!r.validFrom,
    )
  )
})

// Load stations is optional.
const loadStationsValid = computed(() => true)

// Battery pack only needs to validate when present (electric). Usable energy
// must be > 0 and reserve must be strictly below usable energy — mirrors the
// schema's `RESERVE_EXCEEDS_USABLE_ENERGY` guard so users see blocked Continue
// before hitting the save path.
const batteryPackValid = computed(() => {
  const bp = batteryPack.value
  return (
    Number.isFinite(bp.usableEnergyKwh) &&
    bp.usableEnergyKwh > 0 &&
    Number.isFinite(bp.reserveFloorKwh) &&
    bp.reserveFloorKwh >= 0 &&
    bp.reserveFloorKwh < bp.usableEnergyKwh
  )
})

function isStepValid(id: StepId): boolean {
  switch (id) {
    case 'identity':
      return identityValid.value
    case 'envelope':
      return envelopeValid.value
    case 'weighing':
      return weighingValid.value
    case 'load-stations':
      return loadStationsValid.value
    case 'battery-pack':
      return batteryPackValid.value
    case 'review':
      return true
  }
}

const stepNumber = computed(() => currentStep.value + 1)

const canContinue = computed(() => isStepValid(stepId.value))

const canSave = computed(
  () =>
    identityValid.value &&
    envelopeValid.value &&
    weighingValid.value &&
    (!isElectric.value || batteryPackValid.value),
)

// ─── Navigation ─────────────────────────────────────────────────────────────

function goNext(): void {
  if (currentStep.value < STEPS.value.length - 1) {
    currentStep.value++
  }
}

function goBack(): void {
  if (currentStep.value > 0) {
    currentStep.value--
  }
}

// When the pilot flips the powertrain mid-wizard the step list changes length.
// Clamp currentStep so it can never point past the last step. We intentionally
// do NOT try to preserve "the step the user was on" across the transition —
// the Battery Pack step only appears for electric, and sliding backwards when
// switching to combustion is safer than risking an out-of-bounds index.
watch(STEPS, (next) => {
  if (currentStep.value > next.length - 1) {
    currentStep.value = next.length - 1
  }
})

// ─── In-app wizard exit modal (UX-015) ───────────────────────────────────────
// @IMP-AC-VIEW-032@ (FROM: @REQ-AC-001@, @REQ-UI-011@)
//
// Replaces the native `window.confirm()` exit prompt, which the iOS Safari
// back-gesture can dismiss out from under the pilot — silently discarding an
// in-progress aircraft build. The in-app modal offers three explicit choices
// (Save draft / Discard / Keep editing) and is driven through `onBeforeRouteLeave`
// so both the "← Back to Fleet" button AND a hardware/gesture back are gated by
// the same flow. `allowLeave` is the escape hatch: it is set once the pilot
// chooses Discard, or once a save succeeds, so the guard never re-prompts for a
// navigation the pilot has already authorised.

const showExitDialog = ref(false)
const allowLeave = ref(false)
let leaveResolver: ((allow: boolean) => void) | null = null

const exitActions = computed<DialogAction[]>(() => {
  const actions: DialogAction[] = []
  // "Save draft" is only meaningful once the entered data is valid enough to
  // persist — otherwise the schema would reject it. Hide it rather than offer a
  // dead button.
  if (canSave.value) {
    actions.push({ id: 'save', label: 'Save draft', variant: 'primary' })
  }
  actions.push({ id: 'discard', label: 'Discard changes', variant: 'danger' })
  // Keep editing is the safe default — focus lands here so a stray tap under
  // turbulence cannot discard the build.
  actions.push({ id: 'keep', label: 'Keep editing', variant: 'secondary', default: true })
  return actions
})

function resolveLeave(allow: boolean): void {
  const resolve = leaveResolver
  leaveResolver = null
  resolve?.(allow)
}

function onNavigateBack(): void {
  // The route-leave guard owns the dirty-check + exit modal.
  router.push({ name: 'fleet' })
}

onBeforeRouteLeave(() => {
  if (allowLeave.value || !isDirty.value || isSaving.value) return true
  showExitDialog.value = true
  return new Promise<boolean>((resolve) => {
    leaveResolver = resolve
  })
})

async function onExitChoice(id: string): Promise<void> {
  if (id === 'keep') {
    showExitDialog.value = false
    resolveLeave(false)
    return
  }
  if (id === 'discard') {
    showExitDialog.value = false
    allowLeave.value = true
    resolveLeave(true)
    return
  }
  // id === 'save'
  const created = await persistProfile()
  showExitDialog.value = false
  if (created) {
    allowLeave.value = true
    resolveLeave(true)
  } else {
    // Save failed — stay on the wizard so the pilot sees the error.
    resolveLeave(false)
  }
}

function onExitDismiss(): void {
  // Escape / backdrop tap is treated as "Keep editing" — never destructive.
  showExitDialog.value = false
  resolveLeave(false)
}

// ─── Post-save action chooser (UX-012) ───────────────────────────────────────
// @IMP-AC-VIEW-033@ (FROM: @REQ-AC-001@, @REQ-AC-005@)
//
// Saving previously dumped the pilot back to the fleet list — four extra taps
// before they could start planning with the aircraft they just entered. The
// chooser short-circuits that: it offers to verify the fresh draft, or to make
// it the active aircraft and jump straight into flight prep, while still leaving
// a plain "Back to Fleet" path. The newly-created draft is captured so
// "Start flight prep" can set it active (emitting the WARN-AC-002 draft notice).

const savedProfile = ref<AircraftProfile | null>(null)

const postSaveActions: readonly DialogAction[] = [
  { id: 'fly', label: 'Start flight prep', variant: 'primary', default: true },
  { id: 'verify', label: 'Verify now', variant: 'secondary' },
  { id: 'fleet', label: 'Back to Fleet', variant: 'secondary' },
]

function onPostSaveChoice(id: string): void {
  const profile = savedProfile.value
  savedProfile.value = null
  if (id === 'fly' && profile) {
    // Hot-swap the active aircraft and route into Mass & Balance. The draft
    // warning surfaces in the M&B view so the pilot is reminded it is unverified.
    activeStore.setActiveProfile(profile)
    fleetStore.checkDraftWarning(profile)
    router.push({ name: 'mass-balance' })
    return
  }
  // 'verify' and 'fleet' both land on the fleet list, where the new draft shows
  // a Verify control.
  router.push({ name: 'fleet' })
}

function onPostSaveDismiss(): void {
  savedProfile.value = null
  router.push({ name: 'fleet' })
}

// ─── Save ────────────────────────────────────────────────────────────────────

/**
 * Persist the wizard's draft to the fleet store. Returns the created profile on
 * success, or null on validation/persistence failure (with `saveError` set).
 * Routing is the caller's responsibility — both the footer Save action and the
 * exit modal's "Save draft" reuse this.
 */
async function persistProfile(): Promise<AircraftProfile | null> {
  if (!canSave.value) return null
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
    //
    // Electric airframes additionally drop any `fuelTank` extension — the
    // schema's ELECTRIC_AIRCRAFT_HAS_FUEL_TANK guard would otherwise reject
    // the payload and we want the wizard to succeed even if the pilot flipped
    // the powertrain after configuring a tank earlier in the flow.
    const normalizedLoadPoints = loadPoints.value.map((lp) => {
      if (isElectric.value && lp.fuelTank) {
        return { ...lp, fuelTank: null }
      }
      return lp.fuelTank &&
        lp.fuelTank.unusableFuel > 0 &&
        lp.defaultQuantity < lp.fuelTank.unusableFuel
        ? { ...lp, defaultQuantity: lp.fuelTank.unusableFuel }
        : lp
    })

    const created = await fleetStore.createProfile({
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
      powertrain: identityFields.value.powertrain,
      ...(isElectric.value ? { batteryPack: { ...batteryPack.value } } : {}),
    })

    return created
  } catch (err) {
    saveError.value = err instanceof Error ? err.message : 'Failed to save aircraft profile.'
    return null
  } finally {
    isSaving.value = false
  }
}

/**
 * Footer "Save as Draft" action. Persists the draft, then — instead of dropping
 * the pilot back on the fleet list — opens the post-save chooser. `allowLeave`
 * is raised so the post-save navigation is not re-gated by the exit modal.
 */
async function onSave(): Promise<void> {
  const created = await persistProfile()
  if (created) {
    allowLeave.value = true
    savedProfile.value = created
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
