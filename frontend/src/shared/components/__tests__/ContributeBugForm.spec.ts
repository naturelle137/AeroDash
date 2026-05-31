// @UT-UI-SHARED-011@ (FROM: @IMP-UI-SHARED-011@)
import { describe, it, expect, beforeEach } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'
import ContributeBugForm from '../ContributeBugForm.vue'

function setOnline(online: boolean): void {
  Object.defineProperty(navigator, 'onLine', { configurable: true, value: online })
}

beforeEach(() => {
  setOnline(true)
})

async function fillRequired(w: ReturnType<typeof mount>): Promise<void> {
  await w.find('[data-testid="bug-title"]').setValue('Wrong CG')
  await w.find('[data-testid="bug-description"]').setValue('Some description')
  await w.find('[data-testid="bug-reproduction"]').setValue('1. Steps')
  await w.find('[data-testid="bug-severity"]').setValue(
    'Major: Core functionality impaired, no workaround',
  )
  await w.find('[data-testid="bug-environment"]').setValue('Chrome on Windows')
}

describe('ContributeBugForm', () => {
  it('disables submit until every required field is filled', async () => {
    const w = mount(ContributeBugForm)
    await flushPromises()
    const submit = w.find('[data-testid="bug-submit"]')
    expect((submit.element as HTMLButtonElement).disabled).toBe(true)

    await fillRequired(w)
    expect((submit.element as HTMLButtonElement).disabled).toBe(false)
  })

  it('emits "submit" with a typed BugReportInput on click', async () => {
    const w = mount(ContributeBugForm)
    await flushPromises()
    await fillRequired(w)
    await w.find('[data-testid="bug-submit"]').trigger('submit')

    const emitted = w.emitted('submit') ?? []
    expect(emitted).toHaveLength(1)
    const [first] = emitted
    expect(first?.[0]).toMatchObject({
      title: 'Wrong CG',
      description: 'Some description',
      reproduction: '1. Steps',
      severity: 'Major: Core functionality impaired, no workaround',
      environment: 'Chrome on Windows',
    })
    const firstArg = first?.[0] as { hazard_ref?: string } | undefined
    expect(firstArg?.hazard_ref).toBeUndefined()
  })

  it('includes hazard_ref when filled', async () => {
    const w = mount(ContributeBugForm)
    await flushPromises()
    await fillRequired(w)
    // Open the advanced disclosure and set the field
    const details = w.find('details')
    await details.trigger('toggle')
    await w.find('[data-testid="bug-hazard-ref"]').setValue('H-014')
    await w.find('[data-testid="bug-submit"]').trigger('submit')
    const submitted = (w.emitted('submit') ?? [])[0]
    const submittedArg = submitted?.[0] as { hazard_ref?: string } | undefined
    expect(submittedArg?.hazard_ref).toBe('H-014')
  })

  it('emits "back" when the back button is clicked', async () => {
    const w = mount(ContributeBugForm)
    await w.find('[data-testid="bug-back"]').trigger('click')
    expect(w.emitted('back')).toHaveLength(1)
  })

  it('blocks submit and shows a note when offline', async () => {
    setOnline(false)
    const w = mount(ContributeBugForm)
    await flushPromises()
    await fillRequired(w)
    expect((w.find('[data-testid="bug-submit"]').element as HTMLButtonElement).disabled).toBe(true)
    expect(w.find('[data-testid="bug-offline-note"]').exists()).toBe(true)
  })

  it('auto-fills the environment textarea on mount', async () => {
    Object.defineProperty(navigator, 'userAgent', {
      configurable: true,
      value: 'TestUA/1.0',
    })
    const w = mount(ContributeBugForm)
    await flushPromises()
    const env = (w.find('[data-testid="bug-environment"]').element as HTMLTextAreaElement).value
    expect(env).toContain('User-Agent: TestUA/1.0')
  })

  it('flags an overly-long title and refuses to submit', async () => {
    const w = mount(ContributeBugForm)
    await flushPromises()
    await fillRequired(w)
    const tooLong = 'X'.repeat(220)
    await w.find('[data-testid="bug-title"]').setValue(tooLong)
    expect((w.find('[data-testid="bug-submit"]').element as HTMLButtonElement).disabled).toBe(true)
  })
})
