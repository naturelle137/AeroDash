import { beforeEach, describe, expect, it, vi } from 'vitest'
import { nextTick } from 'vue'

async function load(stored: string | null, prefersDark = false) {
  vi.resetModules()
  localStorage.clear()
  if (stored) localStorage.setItem('aerodash-theme', stored)
  window.matchMedia = vi.fn<() => { matches: boolean }>().mockReturnValue({ matches: prefersDark }) as unknown as typeof window.matchMedia
  const { useTheme } = await import('../useTheme')
  return useTheme()
}

describe('useTheme', () => {
  beforeEach(() => document.documentElement.removeAttribute('data-theme'))

  it('toggles between light and dark and applies data-theme', async () => {
    const { theme, toggleTheme } = await load(null)
    expect(document.documentElement.getAttribute('data-theme')).toBe('light')
    toggleTheme()
    await nextTick()
    expect(theme.value).toBe('dark')
    expect(document.documentElement.getAttribute('data-theme')).toBe('dark')
    toggleTheme()
    await nextTick()
    expect(document.documentElement.getAttribute('data-theme')).toBe('light')
  })

  it('persists the choice', async () => {
    const { toggleTheme } = await load(null)
    toggleTheme()
    await nextTick()
    expect(localStorage.getItem('aerodash-theme')).toBe('dark')
  })

  it('restores a stored preference over the system preference', async () => {
    await load('light', true)
    expect(document.documentElement.getAttribute('data-theme')).toBe('light')
  })

  it('follows the system dark preference when nothing is stored', async () => {
    await load(null, true)
    expect(document.documentElement.getAttribute('data-theme')).toBe('dark')
  })
})
