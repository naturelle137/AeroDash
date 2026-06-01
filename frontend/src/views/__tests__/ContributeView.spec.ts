// @UT-UI-VIEW-003@ (FROM: @IMP-UI-VIEW-003@)
import { describe, it, expect, beforeEach } from 'vitest'
import { mount } from '@vue/test-utils'
import ContributeView from '../ContributeView.vue'

function setOnline(online: boolean): void {
  Object.defineProperty(navigator, 'onLine', { configurable: true, value: online })
}

beforeEach(() => {
  setOnline(true)
})

describe('ContributeView — screen switching', () => {
  it('starts on the category screen with all three buttons and the promotion panel', () => {
    const w = mount(ContributeView)
    expect(w.find('[data-testid="contribute-category-grid"]').exists()).toBe(true)
    expect(w.find('[data-testid="category-defect"]').exists()).toBe(true)
    expect(w.find('[data-testid="category-feature"]').exists()).toBe(true)
    expect(w.find('[data-testid="category-security"]').exists()).toBe(true)
    expect(w.find('[data-testid="contribute-promotion"]').exists()).toBe(true)
  })

  it('switches to the defect form when the defect category is picked', async () => {
    const w = mount(ContributeView)
    await w.find('[data-testid="category-defect"]').trigger('click')
    expect(w.find('[data-testid="contribute-bug-form"]').exists()).toBe(true)
    expect(w.find('[data-testid="contribute-category-grid"]').exists()).toBe(false)
  })

  it('switches to the feature form when the feature category is picked', async () => {
    const w = mount(ContributeView)
    await w.find('[data-testid="category-feature"]').trigger('click')
    expect(w.find('[data-testid="contribute-feature-form"]').exists()).toBe(true)
  })

  it('switches to the security card when the security category is picked', async () => {
    const w = mount(ContributeView)
    await w.find('[data-testid="category-security"]').trigger('click')
    expect(w.find('[data-testid="contribute-security-card"]').exists()).toBe(true)
  })

  it('returns to the category screen from the security card', async () => {
    const w = mount(ContributeView)
    await w.find('[data-testid="category-security"]').trigger('click')
    await w.find('[data-testid="security-back"]').trigger('click')
    expect(w.find('[data-testid="contribute-category-grid"]').exists()).toBe(true)
  })

  it('keeps the promotion panel visible across every screen', async () => {
    const w = mount(ContributeView)
    await w.find('[data-testid="category-defect"]').trigger('click')
    expect(w.find('[data-testid="contribute-promotion"]').exists()).toBe(true)
    await w.find('[data-testid="bug-back"]').trigger('click')
    await w.find('[data-testid="category-feature"]').trigger('click')
    expect(w.find('[data-testid="contribute-promotion"]').exists()).toBe(true)
  })
})

describe('ContributeView — heading reflects the current screen', () => {
  it('shows the promo heading on the category screen', () => {
    const w = mount(ContributeView)
    expect(w.find('h1').text()).toContain('Help us improve AeroDash')
  })

  it.each([
    ['defect', 'Report a defect'],
    ['feature', 'Request a feature'],
    ['security', 'Report a security vulnerability'],
  ])('updates the heading when %s is picked', async (cat, expected) => {
    const w = mount(ContributeView)
    await w.find(`[data-testid="category-${cat}"]`).trigger('click')
    expect(w.find('h1').text()).toBe(expected)
  })
})
