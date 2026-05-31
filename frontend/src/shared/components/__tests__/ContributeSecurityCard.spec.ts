// @UT-UI-SHARED-013@ (FROM: @IMP-UI-SHARED-013@)
import { describe, it, expect } from 'vitest'
import { mount } from '@vue/test-utils'
import ContributeSecurityCard from '../ContributeSecurityCard.vue'
import { GITHUB_SECURITY_ADVISORY_URL } from '@/core/logic/github-issue-url'

describe('ContributeSecurityCard', () => {
  it('points the primary link at GitHub\'s private advisory form', () => {
    const w = mount(ContributeSecurityCard)
    const a = w.find('[data-testid="security-open"]')
    expect(a.attributes('href')).toBe(GITHUB_SECURITY_ADVISORY_URL)
    expect(a.attributes('target')).toBe('_blank')
    expect(a.attributes('rel')).toContain('noopener')
  })

  it('explains that the report is handled privately', () => {
    const w = mount(ContributeSecurityCard)
    expect(w.text()).toMatch(/private/i)
    expect(w.text()).toMatch(/not visible/i)
  })

  it('emits "back" when the back button is clicked', async () => {
    const w = mount(ContributeSecurityCard)
    await w.find('[data-testid="security-back"]').trigger('click')
    expect(w.emitted('back')).toHaveLength(1)
  })
})
