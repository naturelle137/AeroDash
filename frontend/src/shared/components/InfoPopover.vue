<script setup lang="ts">
import { onBeforeUnmount, ref, useId, watch } from 'vue'
import { infoTerm, type InfoTermId } from '../i18n/info-terms'

const props = defineProps<{ term: InfoTermId }>()
const open = ref(false)
const root = ref<HTMLElement | null>(null)
const button = ref<HTMLButtonElement | null>(null)
const id = `info-${useId()}`

const text = () => infoTerm(props.term)

function close(restoreFocus: boolean) {
  open.value = false
  if (restoreFocus) button.value?.focus()
}
function onKey(event: KeyboardEvent) {
  if (event.key === 'Escape') close(true)
}
function onOutside(event: Event) {
  if (root.value && !root.value.contains(event.target as Node)) close(false)
}
function unlisten() {
  document.removeEventListener('keydown', onKey)
  document.removeEventListener('pointerdown', onOutside)
}
watch(open, (isOpen) => {
  unlisten()
  if (!isOpen) return
  document.addEventListener('keydown', onKey)
  document.addEventListener('pointerdown', onOutside)
})
onBeforeUnmount(unlisten)
</script>

<template>
  <span ref="root" class="info-popover">
    <button ref="button" type="button" class="info-popover__button" :aria-expanded="open" :aria-controls="id"
      :aria-label="`${text().label} info`" @click="open = !open">
      <span aria-hidden="true">ⓘ</span>
    </button>
    <span v-show="open" :id="id" class="info-popover__body" role="note">
      <strong>{{ text().label }}</strong> {{ text().explanation }}
    </span>
  </span>
</template>

<style scoped>
.info-popover { display: inline-block; position: relative; vertical-align: middle; }
.info-popover__button { min-width: 44px; min-height: 44px; padding: 0; font: inherit; cursor: pointer; border: 0; background: transparent; color: inherit; }
.info-popover__button:focus-visible { outline: 2px solid currentColor; outline-offset: 2px; }
/* In normal flow so the pop-over can never cover an adjacent warning. */
.info-popover__body { display: block; max-width: 36rem; padding: .5rem .75rem; margin: .25rem 0; border: 1px solid var(--color-border); border-radius: 6px; background: var(--color-surface-card); line-height: 1.5; overflow-wrap: anywhere; }
</style>
