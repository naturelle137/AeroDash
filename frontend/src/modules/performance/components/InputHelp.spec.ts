import { mount } from '@vue/test-utils'
import { expect, it } from 'vitest'
import InputHelp from './InputHelp.vue'

it('provides a named disclosure and its explanation', () => {
  const help = mount(InputHelp, { props: { label: 'QNH' }, slots: { default: 'Pressure setting in hPa or inHg.' } })
  expect(help.get('summary').attributes('aria-label')).toBe('QNH help')
  expect(help.get('details').attributes('open')).toBeUndefined()
  expect(help.text()).toContain('Pressure setting in hPa or inHg.')
})
