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
}

const props = defineProps<Props>()

const statusLabel = computed(() => {
  return props.status === 'Verified' ? 'Verified' : 'Draft'
})

const statusClass = computed(() => ({
  'status-verified': props.status === 'Verified',
  'status-draft': props.status === 'Draft',
}))

const statusTitle = computed(() => {
  if (props.status === 'Verified') {
    return 'Profile has been verified and is safe for calculations.'
  }
  return 'Profile is in Draft status. Verify all data before use in safety-critical calculations.'
})

const ariaLabel = computed(() => `Profile status: ${props.status}`)
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
  background-color: #d1fae5;
  color: #065f46;
  border: 1px solid #6ee7b7;
}

.status-draft {
  background-color: #fef3c7;
  color: #92400e;
  border: 1px solid #fcd34d;
}
</style>
