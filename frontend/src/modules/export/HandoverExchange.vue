<script setup lang="ts">
import { ref } from 'vue'
import { MAX_HANDOVER_BYTES } from '@/core/domain/handover.schema'

defineProps<{ notice: { kind: 'error' | 'imported'; text: string } | null }>()
const emit = defineEmits<{ export: []; import: [text: string]; dismiss: [] }>()
const input = ref<HTMLInputElement>()

async function onFile(event: Event): Promise<void> {
  const el = event.target as HTMLInputElement
  const file = el.files?.[0]
  el.value = ''
  if (!file) return
  // A huge file is refused by the parser; reading is capped first so it is never fully loaded.
  emit('import', await file.slice(0, MAX_HANDOVER_BYTES + 1).text())
}
</script>

<template>
  <section class="handover-exchange" aria-labelledby="handover-exchange-title" data-testid="handover-exchange">
    <h2 id="handover-exchange-title" class="handover-exchange__title">Hand over this preparation</h2>
    <p class="handover-exchange__hint">
      The file holds the entries as typed and can be edited by anyone. It is unreviewed and unsigned:
      AeroDash records no instructor approval or counter-signature.
    </p>
    <button type="button" data-testid="handover-export" @click="emit('export')">Save handover file</button>
    <button type="button" data-testid="handover-import" @click="input?.click()">Open handover file</button>
    <input ref="input" type="file" accept=".json,application/json" hidden data-testid="handover-file" @change="onFile">
    <p v-if="notice" class="handover-exchange__notice" :data-kind="notice.kind" role="status" data-testid="handover-notice">
      {{ notice.text }}
      <button type="button" @click="emit('dismiss')">Dismiss</button>
    </p>
  </section>
</template>

<style scoped>
.handover-exchange { margin: 0.75rem 0; padding: 0.75rem; border: 1px solid var(--color-border, #888); }
.handover-exchange__title { font-size: 1rem; margin: 0 0 0.25rem; }
.handover-exchange__hint { margin: 0 0 0.5rem; }
.handover-exchange button { min-height: 44px; margin-right: 0.5rem; }
.handover-exchange__notice[data-kind='error'] { font-weight: 700; }
</style>
