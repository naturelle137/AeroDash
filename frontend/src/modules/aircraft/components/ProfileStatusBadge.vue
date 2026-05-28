<template>
  <!-- @IMP-AC-VIEW-004@ (FROM: @REQ-AC-005@) -->
  <span
    class="profile-status-badge"
    :class="statusClass"
    :title="statusTitle"
    role="status"
    :aria-label="ariaLabel"
  >
    {{ statusLabel }}
  </span>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import type { AircraftProfileStatus } from '@/core/adapters/aircraft.schema'

interface Props {
  status: AircraftProfileStatus
  /**
   * When the profile is `verified` but its sign-off has expired (aged out or
   * source-changed), the badge surfaces an "Expired" state in the critical
   * colour so a stale verification is not mistaken for a live one (REQ-AC-007).
   * Omitted / false ⇒ the badge behaves exactly as the plain Draft/Verified badge.
   */
  expired?: boolean
}

const props = defineProps<Props>()

const isExpired = computed(() => props.status === 'verified' && props.expired === true)

const statusLabel = computed(() => {
  if (isExpired.value) return 'Expired'
  return props.status === 'verified' ? 'Verified' : 'Draft'
})

const statusClass = computed(() => ({
  'status-verified': props.status === 'verified' && !isExpired.value,
  'status-draft': props.status === 'draft',
  'status-expired': isExpired.value,
}))

const statusTitle = computed(() => {
  if (isExpired.value) {
    return 'Verification has expired — re-verify against the current POH before safety-critical use.'
  }
  if (props.status === 'verified') {
    return 'Profile has been verified and is safe for calculations.'
  }
  return 'Profile is in draft status. Verify all data before use in safety-critical calculations.'
})

const ariaLabel = computed(() => `Profile status: ${statusLabel.value}`)
</script>

<style scoped>
.profile-status-badge {
  display: inline-block;
  padding: 0.25rem 0.5rem;
  border-radius: 4px;
  font-size: 0.75rem;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.05em;
}

.status-verified {
  background-color: var(--color-success-bg, #d1fae5);
  color: var(--color-success, #065f46);
  border: 1px solid var(--color-success, #6ee7b7);
}

.status-draft {
  background-color: var(--color-warning-bg, #fef3c7);
  color: var(--color-warning, #92400e);
  border: 1px solid var(--color-warning, #fcd34d);
}

.status-expired {
  background-color: var(--color-critical-bg, #fef2f2);
  color: var(--color-critical, #991b1b);
  border: 1px solid var(--color-critical, #fecaca);
}
</style>
