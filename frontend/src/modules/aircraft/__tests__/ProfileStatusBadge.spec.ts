/**
 * Unit tests for ProfileStatusBadge.vue
 * Covers: rendering, CSS classes, aria-label, and title for Draft/Verified statuses.
 *
 * @see frontend/src/modules/aircraft/components/ProfileStatusBadge.vue
 */

// @UT-AC-VIEW-070@ (FROM: @IMP-AC-VIEW-004@)

import { describe, it, expect } from 'vitest'
import { mount } from '@vue/test-utils'
import ProfileStatusBadge from '../components/ProfileStatusBadge.vue'

/**
 * The component template has a leading HTML comment which creates a fragment root in Vue 3.
 * Scope all attribute/class assertions to the inner badge span via find('[role="status"]').
 */

describe('ProfileStatusBadge — Verified status', () => {
  // @UT-AC-VIEW-070@ (FROM: @IMP-AC-VIEW-004@)
  it('renders "Verified" label for Verified status', () => {
    const wrapper = mount(ProfileStatusBadge, { props: { status: 'verified' } })
    expect(wrapper.text()).toBe('Verified')
  })

  // @UT-AC-VIEW-071@ (FROM: @IMP-AC-VIEW-004@)
  it('applies status-verified CSS class for Verified status', () => {
    const wrapper = mount(ProfileStatusBadge, { props: { status: 'verified' } })
    const badge = wrapper.find('[role="status"]')
    expect(badge.classes()).toContain('status-verified')
    expect(badge.classes()).not.toContain('status-draft')
  })

  // @UT-AC-VIEW-072@ (FROM: @IMP-AC-VIEW-004@)
  it('sets correct aria-label for Verified status', () => {
    const wrapper = mount(ProfileStatusBadge, { props: { status: 'verified' } })
    expect(wrapper.find('[role="status"]').attributes('aria-label')).toBe('Profile status: Verified')
  })

  // @UT-AC-VIEW-073@ (FROM: @IMP-AC-VIEW-004@)
  it('sets informative title for Verified status', () => {
    const wrapper = mount(ProfileStatusBadge, { props: { status: 'verified' } })
    expect(wrapper.find('[role="status"]').attributes('title')).toContain('safe for calculations')
  })

  // @UT-AC-VIEW-074@ (FROM: @IMP-AC-VIEW-004@)
  it('has role="status" for accessibility', () => {
    const wrapper = mount(ProfileStatusBadge, { props: { status: 'verified' } })
    expect(wrapper.find('[role="status"]').exists()).toBe(true)
  })
})

describe('ProfileStatusBadge — Draft status', () => {
  // @UT-AC-VIEW-075@ (FROM: @IMP-AC-VIEW-004@)
  it('renders "Draft" label for Draft status', () => {
    const wrapper = mount(ProfileStatusBadge, { props: { status: 'draft' } })
    expect(wrapper.text()).toBe('Draft')
  })

  // @UT-AC-VIEW-076@ (FROM: @IMP-AC-VIEW-004@)
  it('applies status-draft CSS class for Draft status', () => {
    const wrapper = mount(ProfileStatusBadge, { props: { status: 'draft' } })
    const badge = wrapper.find('[role="status"]')
    expect(badge.classes()).toContain('status-draft')
    expect(badge.classes()).not.toContain('status-verified')
  })

  // @UT-AC-VIEW-077@ (FROM: @IMP-AC-VIEW-004@)
  it('sets correct aria-label for Draft status', () => {
    const wrapper = mount(ProfileStatusBadge, { props: { status: 'draft' } })
    expect(wrapper.find('[role="status"]').attributes('aria-label')).toBe('Profile status: Draft')
  })

  // @UT-AC-VIEW-078@ (FROM: @IMP-AC-VIEW-004@)
  it('sets safety warning in title for Draft status', () => {
    const wrapper = mount(ProfileStatusBadge, { props: { status: 'draft' } })
    const title = wrapper.find('[role="status"]').attributes('title')
    expect(title).toContain('draft')
    expect(title).toContain('safety-critical')
  })
})
