// @UT-UI-SHARED-019@ (FROM: @IMP-UI-SHARED-012@)
import { describe, it, expect, beforeEach } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'
import ContributeFeatureForm from '../ContributeFeatureForm.vue'

function setOnline(online: boolean): void {
  Object.defineProperty(navigator, 'onLine', { configurable: true, value: online })
}

beforeEach(() => {
  setOnline(true)
})

async function fillRequired(w: ReturnType<typeof mount>): Promise<void> {
  await w.find('[data-testid="feature-title"]').setValue('Wind arrow on runway')
  await w.find('[data-testid="feature-problem"]').setValue('As a pilot, I want…')
  await w.find('[data-testid="feature-solution"]').setValue('Render an arrow')
  await w.find('[data-testid="feature-dod"]').setValue('- [ ] Arrow renders')
}

describe('ContributeFeatureForm', () => {
  it('disables submit until every required field is filled', async () => {
    const w = mount(ContributeFeatureForm)
    await flushPromises()
    const submit = w.find('[data-testid="feature-submit"]')
    expect((submit.element as HTMLButtonElement).disabled).toBe(true)
    await fillRequired(w)
    expect((submit.element as HTMLButtonElement).disabled).toBe(false)
  })

  it('refuses to submit when DoD is only the seed', async () => {
    const w = mount(ContributeFeatureForm)
    await flushPromises()
    await w.find('[data-testid="feature-title"]').setValue('T')
    await w.find('[data-testid="feature-problem"]').setValue('P')
    await w.find('[data-testid="feature-solution"]').setValue('S')
    // DoD still holds the seed "- [ ] " — submit must stay disabled
    expect((w.find('[data-testid="feature-submit"]').element as HTMLButtonElement).disabled).toBe(
      true,
    )
  })

  it('emits "submit" with a typed FeatureRequestInput', async () => {
    const w = mount(ContributeFeatureForm)
    await flushPromises()
    await fillRequired(w)
    await w.find('[data-testid="feature-submit"]').trigger('submit')
    const emitted = w.emitted('submit') ?? []
    expect(emitted).toHaveLength(1)
    const [first] = emitted
    expect(first?.[0]).toMatchObject({
      title: 'Wind arrow on runway',
      problem: 'As a pilot, I want…',
      solution: 'Render an arrow',
      dod: '- [ ] Arrow renders',
    })
    const firstArg = first?.[0] as { req_id?: string; safety_impact?: string } | undefined
    expect(firstArg?.req_id).toBeUndefined()
    expect(firstArg?.safety_impact).toBeUndefined()
  })

  it('includes req_id and safety_impact when filled', async () => {
    const w = mount(ContributeFeatureForm)
    await flushPromises()
    await fillRequired(w)
    await w.find('details').trigger('toggle')
    await w.find('[data-testid="feature-req-id"]').setValue('REQ-PF-001')
    await w.find('[data-testid="feature-safety-impact"]').setValue('Possible')
    await w.find('[data-testid="feature-submit"]').trigger('submit')
    const submitted = (w.emitted('submit') ?? [])[0]
    const out = submitted?.[0] as { req_id?: string; safety_impact?: string } | undefined
    expect(out?.req_id).toBe('REQ-PF-001')
    expect(out?.safety_impact).toBe('Possible')
  })

  it('emits "back" when the back button is clicked', async () => {
    const w = mount(ContributeFeatureForm)
    await w.find('[data-testid="feature-back"]').trigger('click')
    expect(w.emitted('back')).toHaveLength(1)
  })

  it('blocks submit when offline', async () => {
    setOnline(false)
    const w = mount(ContributeFeatureForm)
    await flushPromises()
    await fillRequired(w)
    expect((w.find('[data-testid="feature-submit"]').element as HTMLButtonElement).disabled).toBe(
      true,
    )
  })

  it('guards against double-submit — a second click does not re-emit', async () => {
    const w = mount(ContributeFeatureForm)
    await flushPromises()
    await fillRequired(w)
    await w.find('[data-testid="feature-submit"]').trigger('submit')
    await w.find('[data-testid="feature-submit"]').trigger('submit')
    expect(w.emitted('submit')).toHaveLength(1)
    expect((w.find('[data-testid="feature-submit"]').element as HTMLButtonElement).disabled).toBe(
      true,
    )
  })

  it('removes online/offline listeners on unmount', async () => {
    const removed: string[] = []
    const originalRemove = window.removeEventListener.bind(window)
    const spy = (
      type: string,
      listener: EventListenerOrEventListenerObject,
      options?: boolean | EventListenerOptions,
    ): void => {
      removed.push(type)
      originalRemove(type, listener, options)
    }
    window.removeEventListener = spy as typeof window.removeEventListener
    try {
      const w = mount(ContributeFeatureForm)
      await flushPromises()
      w.unmount()
      expect(removed).toContain('online')
      expect(removed).toContain('offline')
    } finally {
      window.removeEventListener = originalRemove
    }
  })
})
