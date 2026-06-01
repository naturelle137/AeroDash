// @UT-UI-SHARED-017@ (FROM: @IMP-UI-SHARED-010@)
import { describe, it, expect } from 'vitest'
import { mount } from '@vue/test-utils'
import ContributeCategoryGrid from '../ContributeCategoryGrid.vue'

describe('ContributeCategoryGrid', () => {
  it('renders three category buttons with plain-language labels', () => {
    const w = mount(ContributeCategoryGrid)
    expect(w.find('[data-testid="category-defect"]').text()).toContain('Report a defect')
    expect(w.find('[data-testid="category-feature"]').text()).toContain('Request a feature')
    expect(w.find('[data-testid="category-security"]').text()).toContain('Report a security vulnerability')
  })

  it('exposes the tooltip text via aria-describedby for screen readers', () => {
    const w = mount(ContributeCategoryGrid)
    const defectBtn = w.find('[data-testid="category-defect"]')
    const describedBy = defectBtn.attributes('aria-describedby')
    expect(describedBy).toBe('tooltip-defect')
    expect(w.find('#tooltip-defect').text()).toMatch(/wrong number|button does nothing|crashes/i)
  })

  it.each([
    ['defect'],
    ['feature'],
    ['security'],
  ])('emits "pick" with the category id when %s button is clicked', async (id) => {
    const w = mount(ContributeCategoryGrid)
    await w.find(`[data-testid="category-${id}"]`).trigger('click')
    expect(w.emitted('pick')).toEqual([[id]])
  })
})
