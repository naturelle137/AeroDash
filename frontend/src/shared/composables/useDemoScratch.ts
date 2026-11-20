import { watch } from 'vue'
import { useMassBalanceStore } from '@/modules/mass-balance/stores/mass-balance.store'

/**
 * Session-only inputs live in composables, not in the Mass & Balance store.
 * Capture them synchronously when a demo starts and restore them when it ends,
 * so a discarded what-if never leaves its edits behind. Capture must return plain
 * data; restore must not rely on reactive side effects of the individual writes.
 */
export function useDemoScratch<T>(capture: () => T, restore: (saved: T) => void): void {
  const store = useMassBalanceStore()
  let saved: { value: T } | null = null
  watch(
    () => store.isDemoActive,
    (active) => {
      if (active) {
        saved = { value: capture() }
      } else if (saved) {
        const { value } = saved
        saved = null
        restore(value)
      }
    },
    { flush: 'sync' },
  )
}

/** Deep copy for the plain string/number state held by session-only inputs. */
export const plainCopy = <T>(value: T): T => JSON.parse(JSON.stringify(value)) as T
