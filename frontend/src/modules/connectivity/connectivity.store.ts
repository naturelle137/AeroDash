import { onBeforeUnmount, onMounted, readonly, ref } from 'vue'

const online = ref(typeof navigator === 'undefined' || navigator.onLine)
let users = 0
function refresh(): void { online.value = navigator.onLine }

export function useConnectivityStore() {
  if (typeof navigator !== 'undefined') refresh()
  onMounted(() => {
    refresh()
    if (users++ === 0) {
      window.addEventListener('online', refresh)
      window.addEventListener('offline', refresh)
      window.addEventListener('pageshow', refresh)
    }
  })
  onBeforeUnmount(() => {
    if (--users === 0) {
      window.removeEventListener('online', refresh)
      window.removeEventListener('offline', refresh)
      window.removeEventListener('pageshow', refresh)
    }
  })
  return { online: readonly(online) }
}
