import { defineStore } from 'pinia'
import { ref } from 'vue'
import { STORAGE_KEY, parseStored, validateDraft, type Annotation, type AnnotationAnchor } from './annotations'

function load(): Annotation[] {
  try { return parseStored(localStorage.getItem(STORAGE_KEY)) } catch { return [] }
}

export const useAnnotationStore = defineStore('annotations', () => {
  const items = ref<Annotation[]>(load())
  const persistError = ref(false)

  function persist(): void {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(items.value))
      persistError.value = false
    } catch {
      persistError.value = true
    }
  }
  const forAircraft = (aircraftId: string | null | undefined): Annotation[] =>
    aircraftId ? items.value.filter(a => a.aircraftId === aircraftId) : []

  /** Returns an error message, or null on success. */
  function add(aircraftId: string, anchor: AnnotationAnchor, author: string, text: string): string | null {
    const error = validateDraft(author, text)
    if (error) return error
    const now = new Date().toISOString()
    items.value.push({ id: crypto.randomUUID(), aircraftId, anchor, author: author.trim(), text: text.trim(), createdAt: now, updatedAt: now })
    persist()
    return null
  }
  function update(id: string, author: string, text: string): string | null {
    const error = validateDraft(author, text)
    if (error) return error
    const item = items.value.find(a => a.id === id)
    if (!item) return 'Note no longer exists.'
    item.author = author.trim()
    item.text = text.trim()
    item.updatedAt = new Date().toISOString()
    persist()
    return null
  }
  function remove(id: string): void {
    items.value = items.value.filter(a => a.id !== id)
    persist()
  }
  return { items, persistError, forAircraft, add, update, remove }
})
