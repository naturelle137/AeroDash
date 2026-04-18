<template>
  <!-- @IMP-AC-VIEW-015@ (FROM: @REQ-AC-001@, @REQ-AC-005@, @REQ-AD-001@, @REQ-AD-004@, @REQ-AD-007@, @REQ-AD-013@, @REQ-AD-014@, @REQ-AD-018@, @REQ-AD-019@) -->
  <main class="profile-editor-view">
    <header class="editor-header">
      <div class="editor-title">
        <button type="button" class="btn-back" @click="onCancel">← Back to Fleet</button>
        <h1>Edit Aircraft</h1>
      </div>
      <div v-if="source" class="editor-subtitle">
        <strong>{{ source.registration }}</strong>
        — {{ source.manufacturer }} {{ source.model }}
        <ProfileStatusBadge :status="source.status" />
      </div>
    </header>

    <div v-if="loadError" class="error-state" role="alert">
      {{ loadError }}
    </div>

    <div v-else-if="!source || !draft" class="loading-state">Loading profile…</div>

    <div v-else class="editor-body">
      <p v-if="source.status === 'verified'" class="verified-note" role="status">
        This profile is <strong>Verified</strong>. Saving will create a new <strong>Draft</strong>
        copy and leave the original untouched (REQ-AC-005).
      </p>

      <AccordionSection
        title="Identity"
        :summary="identitySummary"
        :section-id="`${profileId}-identity`"
        :model-value="openSections.identity"
        @update:model-value="openSections.identity = $event"
      >
        <IdentitySection
          v-model="identityFields"
          :registration-error="registrationError"
          :section-id="`${profileId}-identity`"
        />
      </AccordionSection>

      <AccordionSection
        title="Weighing Reports"
        :summary="weighingSummary"
        :section-id="`${profileId}-weighing`"
        :model-value="openSections.weighing"
        @update:model-value="openSections.weighing = $event"
      >
        <WeighingReportsSection
          v-model="weighingReports"
          :section-id="`${profileId}-weighing`"
        />
      </AccordionSection>

      <p v-if="saveError" class="field-error" role="alert">{{ saveError }}</p>
    </div>

    <footer class="editor-footer">
      <div class="footer-status">
        <span v-if="isDirty" class="status-dirty">Unsaved changes</span>
        <span v-else class="status-clean">No changes</span>
      </div>
      <div class="footer-actions">
        <button type="button" class="btn btn-secondary" :disabled="isSaving" @click="onCancel">
          Cancel
        </button>
        <button
          type="button"
          class="btn btn-primary"
          :disabled="!isDirty || isSaving || !canSave"
          @click="onSave"
        >
          {{ isSaving ? 'Saving…' : saveButtonLabel }}
        </button>
      </div>
    </footer>
  </main>
</template>

<script setup lang="ts">
import { computed, onMounted, reactive, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import type {
  AircraftProfile,
  AircraftProfileWeighingReport,
} from '@/core/adapters/aircraft.schema'
import { useFleetStore } from '../stores/fleet.store'
import { validateIcaoRegistration } from '../services/profile.validator'
import AccordionSection from '../components/AccordionSection.vue'
import IdentitySection, { type IdentityFields } from '../components/IdentitySection.vue'
import WeighingReportsSection from '../components/WeighingReportsSection.vue'
import ProfileStatusBadge from '../components/ProfileStatusBadge.vue'

// @IMP-AC-VIEW-016@ (FROM: @REQ-AC-001@, @REQ-AC-005@, @REQ-AD-001@, @REQ-AD-004@, @REQ-AD-007@, @REQ-AD-013@, @REQ-AD-014@, @REQ-AD-018@, @REQ-AD-019@)

const route = useRoute()
const router = useRouter()
const fleetStore = useFleetStore()

const profileId = computed(() => String(route.params.id ?? ''))

const loadError = ref<string | null>(null)
const saveError = ref<string | null>(null)
const registrationError = ref<string>('')
const isSaving = ref(false)

const source = ref<AircraftProfile | null>(null)
const draft = ref<AircraftProfile | null>(null)

const openSections = reactive({ identity: true, weighing: true })

const identityFields = computed<IdentityFields>({
  get(): IdentityFields {
    const d = draft.value
    if (!d) {
      return {
        registration: '',
        manufacturer: '',
        model: '',
        icaoTypeDesignator: '',
        ownerId: '',
        sourceUnit: '',
        referenceDatumDescription: '',
        referenceDatumLocation: '',
        shareCode: null,
      }
    }
    return {
      registration: d.registration,
      manufacturer: d.manufacturer,
      model: d.model,
      icaoTypeDesignator: d.icaoTypeDesignator,
      ownerId: d.ownerId,
      sourceUnit: d.sourceUnit,
      referenceDatumDescription: d.referenceDatumDescription,
      referenceDatumLocation: d.referenceDatumLocation,
      shareCode: d.shareCode,
    }
  },
  set(next: IdentityFields): void {
    if (!draft.value) return
    draft.value = { ...draft.value, ...next }
  },
})

const weighingReports = computed<AircraftProfileWeighingReport[]>({
  get(): AircraftProfileWeighingReport[] {
    return draft.value?.weighingReports ?? []
  },
  set(next: AircraftProfileWeighingReport[]): void {
    if (!draft.value) return
    draft.value = { ...draft.value, weighingReports: next }
  },
})

const identitySummary = computed(() => {
  const d = draft.value
  if (!d) return ''
  const reg = d.registration || '—'
  const make = [d.manufacturer, d.model].filter(Boolean).join(' ') || '—'
  return `${reg} · ${make}`
})

const weighingSummary = computed(() => {
  const n = draft.value?.weighingReports.length ?? 0
  return n === 1 ? '1 report' : `${n} reports`
})

const isDirty = computed(() => {
  if (!source.value || !draft.value) return false
  return JSON.stringify(source.value) !== JSON.stringify(draft.value)
})

const canSave = computed(() => {
  const d = draft.value
  if (!d) return false
  if (!validateIcaoRegistration(d.registration)) return false
  if (d.weighingReports.length < 1) return false
  return d.weighingReports.every(
    (r) => Number.isFinite(r.bem) && r.bem > 0 && !!r.weighingDate && !!r.validFrom,
  )
})

const saveButtonLabel = computed(() => {
  if (!source.value) return 'Save'
  return source.value.status === 'verified' ? 'Save as New Draft' : 'Save Draft'
})

// ─── Load profile on mount ───────────────────────────────────────────────────

async function hydrate(): Promise<void> {
  loadError.value = null
  if (fleetStore.fleetLoadState === 'LOADING' || fleetStore.profiles.length === 0) {
    await fleetStore.loadAll()
  }
  const found = fleetStore.profiles.find((p) => p.id === profileId.value)
  if (!found) {
    loadError.value = `Profile not found: ${profileId.value}`
    return
  }
  source.value = found
  draft.value = JSON.parse(JSON.stringify(found)) as AircraftProfile
}

onMounted(() => {
  hydrate()
})

watch(
  () => draft.value?.registration,
  (reg) => {
    if (!reg) {
      registrationError.value = 'Registration is required.'
      return
    }
    if (!validateIcaoRegistration(reg)) {
      registrationError.value =
        'Invalid registration format. Use 2–7 alphanumeric characters (e.g. D-EBPN).'
    } else {
      registrationError.value = ''
    }
  },
)

// ─── Actions ────────────────────────────────────────────────────────────────

function onCancel(): void {
  if (isDirty.value && !confirm('Discard unsaved changes?')) return
  router.push({ name: 'fleet' })
}

async function onSave(): Promise<void> {
  if (!source.value || !draft.value) return
  saveError.value = null
  isSaving.value = true
  try {
    const changes: Partial<AircraftProfile> = { ...draft.value }
    // id/status/schemaVersion are managed by the store — do not overwrite.
    delete (changes as { id?: string }).id
    delete (changes as { status?: AircraftProfile['status'] }).status
    delete (changes as { schemaVersion?: number }).schemaVersion

    if (source.value.status === 'verified') {
      await fleetStore.editVerifiedProfile(source.value.id, changes)
    } else {
      await fleetStore.updateProfile(source.value.id, changes)
    }
    router.push({ name: 'fleet' })
  } catch (err) {
    saveError.value = err instanceof Error ? err.message : 'Failed to save profile.'
  } finally {
    isSaving.value = false
  }
}
</script>

<style scoped>
.profile-editor-view {
  max-width: 900px;
  margin: 0 auto;
  padding: 1.5rem 1.5rem 5rem;
  display: flex;
  flex-direction: column;
  gap: 1rem;
  color: var(--color-text, #212121);
  min-height: 100vh;
}

.editor-header {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}

.editor-title {
  display: flex;
  align-items: center;
  gap: 0.75rem;
}

.btn-back {
  background: none;
  border: none;
  color: var(--color-primary, #3b82f6);
  font-size: 0.875rem;
  cursor: pointer;
  padding: 0;
}

h1 {
  margin: 0;
  font-size: 1.5rem;
  font-weight: 700;
}

.editor-subtitle {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  color: var(--color-text-secondary, #6b7280);
  font-size: 0.9375rem;
}

.verified-note {
  margin: 0;
  padding: 0.5rem 0.75rem;
  border: 1px solid var(--color-warning, #fcd34d);
  background: var(--color-warning-bg, #fef3c7);
  color: var(--color-warning, #92400e);
  border-radius: 6px;
  font-size: 0.875rem;
}

.editor-body {
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
}

.loading-state,
.error-state {
  padding: 1rem;
  text-align: center;
  color: var(--color-text-secondary, #6b7280);
}

.error-state {
  color: var(--color-critical, #991b1b);
  background: var(--color-critical-bg, #fef2f2);
  border: 1px solid var(--color-critical, #fecaca);
  border-radius: 6px;
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

.editor-footer {
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

.footer-status {
  font-size: 0.875rem;
}

.status-dirty {
  color: var(--color-warning, #92400e);
  font-weight: 500;
}

.status-clean {
  color: var(--color-text-secondary, #6b7280);
}

.footer-actions {
  display: flex;
  gap: 0.5rem;
}

.btn {
  padding: 0.5rem 1rem;
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
</style>
