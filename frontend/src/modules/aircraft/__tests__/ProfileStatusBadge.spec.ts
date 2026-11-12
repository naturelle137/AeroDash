/**
 * Unit tests for ProfileStatusBadge.vue
 * Covers: rendering, CSS classes, aria-label, and title for Draft/Verified statuses.
 *
 * @see frontend/src/modules/aircraft/components/ProfileStatusBadge.vue
 */


import { describe, it, expect } from 'vitest'
import { mount } from '@vue/test-utils'
import ProfileStatusBadge from '../components/ProfileStatusBadge.vue'

/**
 * The component template has a leading HTML comment which creates a fragment root in Vue 3.
 * Scope all attribute/class assertions to the inner badge span via find('[role="status"]').
 */

describe('ProfileStatusBadge — Verified status', () => {
  it('renders "Verified" label for Verified status', () => {
    const wrapper = mount(ProfileStatusBadge, { props: { status: 'verified' } })
    expect(wrapper.text()).toBe('Verified')
  })

  it('applies status-verified CSS class for Verified status', () => {
    const wrapper = mount(ProfileStatusBadge, { props: { status: 'verified' } })
    const badge = wrapper.find('[role="status"]')
    expect(badge.classes()).toContain('status-verified')
    expect(badge.classes()).not.toContain('status-draft')
  })

  it('sets correct aria-label for Verified status', () => {
    const wrapper = mount(ProfileStatusBadge, { props: { status: 'verified' } })
    expect(wrapper.find('[role="status"]').attributes('aria-label')).toBe('Profile status: Verified')
  })

  it('sets informative title for Verified status', () => {
    const wrapper = mount(ProfileStatusBadge, { props: { status: 'verified' } })
    expect(wrapper.find('[role="status"]').attributes('title')).toContain('safe for calculations')
  })

  it('has role="status" for accessibility', () => {
    const wrapper = mount(ProfileStatusBadge, { props: { status: 'verified' } })
    expect(wrapper.find('[role="status"]').exists()).toBe(true)
  })
})

describe('ProfileStatusBadge — Draft status', () => {
  it('renders "Draft" label for Draft status', () => {
    const wrapper = mount(ProfileStatusBadge, { props: { status: 'draft' } })
    expect(wrapper.text()).toBe('Draft')
  })

  it('applies status-draft CSS class for Draft status', () => {
    const wrapper = mount(ProfileStatusBadge, { props: { status: 'draft' } })
    const badge = wrapper.find('[role="status"]')
    expect(badge.classes()).toContain('status-draft')
    expect(badge.classes()).not.toContain('status-verified')
  })

  it('sets correct aria-label for Draft status', () => {
    const wrapper = mount(ProfileStatusBadge, { props: { status: 'draft' } })
    expect(wrapper.find('[role="status"]').attributes('aria-label')).toBe('Profile status: Draft')
  })

  it('sets safety warning in title for Draft status', () => {
    const wrapper = mount(ProfileStatusBadge, { props: { status: 'draft' } })
    const title = wrapper.find('[role="status"]').attributes('title')
    expect(title).toContain('draft')
    expect(title).toContain('safety-critical')
  })
})

describe('ProfileStatusBadge — expired verification (REQ-AC-007)', () => {
  it('renders an "Expired" badge with the critical class when a verified profile is expired', () => {
    const wrapper = mount(ProfileStatusBadge, { props: { status: 'verified', expired: true } })
    const badge = wrapper.find('[role="status"]')
    expect(wrapper.text()).toBe('Expired')
    expect(badge.classes()).toContain('status-expired')
    expect(badge.classes()).not.toContain('status-verified')
    expect(badge.attributes('aria-label')).toBe('Profile status: Expired')
    expect(badge.attributes('title')).toContain('expired')
  })

  it('ignores the expired flag for a Draft (only verified can expire)', () => {
    const wrapper = mount(ProfileStatusBadge, { props: { status: 'draft', expired: true } })
    expect(wrapper.text()).toBe('Draft')
    expect(wrapper.find('[role="status"]').classes()).toContain('status-draft')
  })
})
