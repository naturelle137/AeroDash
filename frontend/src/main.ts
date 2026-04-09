import { createApp } from 'vue'
import { createPinia } from 'pinia'

import './assets/theme.css'
import App from './App.vue'
import router from './router'
import { createLogger } from './shared/utils/logger'

// @IMP-SYS-APP-002@ (FROM: @REQ-SYS-001@, @REQ-SYS-005@)
import { registerSW } from 'virtual:pwa-register'
import { usePwaUpdateStore } from './stores/pwa-update.store'

const logger = createLogger('App')

const app = createApp(App)

app.use(createPinia())
app.use(router)

app.config.errorHandler = (err) => {
  const message = err instanceof Error ? err.message : String(err)
  logger.error('Unhandled error', { message })
}

app.mount('#app')

// Register Service Worker after mount — must not block initial render.
// registerType: 'prompt' is enforced in vite.config.ts (REQ-SYS-005).
const pwaStore = usePwaUpdateStore()

const updateSW = registerSW({
  onOfflineReady() {
    pwaStore.onOfflineReady()
    logger.info('PWA offline ready — app shell cached')
  },
  onNeedRefresh() {
    pwaStore.onNeedsRefresh()
    logger.info('PWA update available — user consent required (INFO-SYS-001)')
  },
  onRegisteredSW(swUrl, registration) {
    logger.info('Service Worker registered', { swUrl, scope: registration?.scope })
  },
  onRegisterError(error: unknown) {
    logger.error('Service Worker registration failed', { message: String(error) })
  },
})

// Expose the updateSW callback so the store can trigger reload with consent.
pwaStore.setUpdateSW(updateSW)
