import { createApp } from 'vue'
import { createPinia } from 'pinia'

import './assets/theme.css'
import App from './App.vue'
import router from './router'
import { createLogger } from './shared/utils/logger'

const logger = createLogger('App')

const app = createApp(App)

app.use(createPinia())
app.use(router)

app.config.errorHandler = (err) => {
  const message = err instanceof Error ? err.message : String(err)
  logger.error('Unhandled error', { message })
}

app.mount('#app')
