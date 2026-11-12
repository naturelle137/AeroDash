import { describe, expect, it } from 'vitest'
import { mount } from '@vue/test-utils'
import AppLogo from '../AppLogo.vue'

describe('AppLogo', () => {
  it('renders the original wordmark artwork for both themes', () => {
    const srcs = mount(AppLogo)
      .findAll('img')
      .map((i) => i.attributes('src'))
    expect(srcs).toEqual(['/brand/logo-light.png', '/brand/logo-dark.png'])
  })

  it('renders icon artwork when icon-only and keeps it decorative', () => {
    const w = mount(AppLogo, { props: { iconOnly: true, size: 56 } })
    expect(w.findAll('img').map((i) => i.attributes('src'))).toEqual([
      '/brand/icon-light.png',
      '/brand/icon-dark.png',
    ])
    expect(w.attributes('aria-hidden')).toBe('true')
    expect(w.find('img').attributes('style')).toContain('height: 56px')
  })
})
