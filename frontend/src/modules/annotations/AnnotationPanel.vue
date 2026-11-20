<script setup lang="ts">
import { computed, ref } from 'vue'
import { useAnnotationStore } from './annotation.store'
import { ANNOTATION_ANCHORS, AUTHOR_MAX, TEXT_MAX, anchorLabel, type AnnotationAnchor } from './annotations'

const props = defineProps<{ aircraftId: string }>()
const store = useAnnotationStore()
const notes = computed(() => store.forAircraft(props.aircraftId))
const editingId = ref<string | null>(null)
const anchor = ref<AnnotationAnchor>('takeoff')
const author = ref('')
const text = ref('')
const error = ref<string | null>(null)

function reset(): void { editingId.value = null; text.value = ''; error.value = null }
function edit(id: string): void {
  const n = notes.value.find(a => a.id === id)
  if (!n) return
  editingId.value = id; anchor.value = n.anchor; author.value = n.author; text.value = n.text; error.value = null
}
function save(): void {
  error.value = editingId.value
    ? store.update(editingId.value, author.value, text.value)
    : store.add(props.aircraftId, anchor.value, author.value, text.value)
  if (!error.value) reset()
}
</script>

<template>
  <section class="annotation-panel" aria-labelledby="annotation-title" data-testid="annotation-panel">
    <h3 id="annotation-title">Instructor notes</h3>
    <p class="annotation-panel__hint">Advisory teaching notes, stored on this device only. The author name is self-declared and unverified. A note never clears or changes a system warning.</p>
    <ul v-if="notes.length" class="annotation-panel__list">
      <li v-for="n in notes" :key="n.id" data-testid="annotation-item">
        <strong>Instructor note on {{ anchorLabel(n.anchor) }}</strong> · {{ n.author }} (self-declared) · {{ n.updatedAt.slice(0, 16).replace('T', ' ') }} UTC
        <p>{{ n.text }}</p>
        <button type="button" :aria-label="`Edit note on ${anchorLabel(n.anchor)} by ${n.author}`" @click="edit(n.id)">Edit</button>
        <button type="button" :aria-label="`Delete note on ${anchorLabel(n.anchor)} by ${n.author}`" @click="store.remove(n.id)">Delete</button>
      </li>
    </ul>
    <p v-else>No instructor notes for this aircraft.</p>
    <form class="annotation-panel__form" @submit.prevent="save">
      <label>Result
        <select v-model="anchor" :disabled="!!editingId">
          <option v-for="a in ANNOTATION_ANCHORS" :key="a.id" :value="a.id">{{ a.label }}</option>
        </select>
      </label>
      <label>Author <input v-model="author" type="text" :maxlength="AUTHOR_MAX" autocomplete="off"></label>
      <label>Note <textarea v-model="text" :maxlength="TEXT_MAX" rows="3" /></label>
      <p v-if="error" role="alert">{{ error }}</p>
      <p v-if="store.persistError" role="alert">Notes could not be saved on this device.</p>
      <button type="submit">{{ editingId ? 'Save note' : 'Add note' }}</button>
      <button v-if="editingId" type="button" @click="reset">Cancel</button>
    </form>
  </section>
</template>

<style scoped>
.annotation-panel { margin-top: 1rem; padding: 0.75rem; border: 1px dashed currentColor; border-radius: 6px; }
.annotation-panel__hint { font-size: 0.85em; }
.annotation-panel__list { padding-left: 1rem; }
.annotation-panel__form { display: grid; gap: 0.5rem; }
.annotation-panel__form label { display: grid; gap: 0.25rem; }
.annotation-panel button { min-height: 44px; min-width: 44px; }
</style>
