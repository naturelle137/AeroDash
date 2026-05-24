// @IMP-SYS-SHARED-004@ (FROM: @REQ-UI-011@)
import { ref, watch, onMounted } from 'vue'

export type Theme = 'light' | 'dark'

const STORAGE_KEY = 'aerodash-theme'

const currentTheme = ref<Theme>('light')

function applyTheme(theme: Theme): void {
  if (typeof document !== 'undefined') {
    document.documentElement.setAttribute('data-theme', theme)
  }
}

function resolveInitialTheme(): Theme {
  try {
    const stored = localStorage.getItem(STORAGE_KEY)
    if (stored === 'light' || stored === 'dark') return stored
  } catch {
    /* localStorage may be unavailable (e.g. private browsing) */
  }

  try {
    if (
      typeof window !== 'undefined' &&
      typeof window.matchMedia === 'function' &&
      window.matchMedia('(prefers-color-scheme: dark)').matches
    ) {
      return 'dark'
    }
  } catch {
    /* matchMedia may throw in certain test environments */
  }

  return 'light'
}

let initialized = false

export function useTheme() {
  if (!initialized) {
    currentTheme.value = resolveInitialTheme()
    applyTheme(currentTheme.value)
    initialized = true
  }

  onMounted(() => {
    applyTheme(currentTheme.value)
  })

  watch(currentTheme, (t) => {
    applyTheme(t)
    try {
      localStorage.setItem(STORAGE_KEY, t)
    } catch {
      /* best-effort persistence */
    }
  })

  function toggleTheme(): void {
    currentTheme.value = currentTheme.value === 'light' ? 'dark' : 'light'
  }

  return {
    theme: currentTheme,
    toggleTheme,
  }
}
