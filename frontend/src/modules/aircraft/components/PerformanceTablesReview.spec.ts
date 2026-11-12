import { mount } from '@vue/test-utils'
import { expect, it } from 'vitest'
import { testPohAircraft } from '../../../../tests/fixtures/poh-aircraft'
import PerformanceTablesReview from './PerformanceTablesReview.vue'

it('shows original declarations, provenance and independently normalized values for review', () => {
  const profile = testPohAircraft()
  profile.performanceProfiles = [{ flightPhase: 'TakeoffRoll',
    sourceUnits: { mass: 'lb', pressureAltitude: 'm', temperature: '°F', distance: 'ft' },
    sourceReference: 'Synthetic example only',
    dataPoints: [{ mass: 2000, pressureAltitude: 304.8, temperature: 50, distance: 1000 }],
  }]
  const view = mount(PerformanceTablesReview, { props: { profile } })
  expect(view.text()).toContain('Synthetic example only')
  expect(view.findAll('table')[0]!.text()).toContain('Temperature (°F)')
  expect(view.findAll('tbody tr')[0]!.findAll('td').map((cell) => cell.text())).toEqual(['2000', '304.8', '50', '1000'])
  expect(view.findAll('tbody tr')[1]!.findAll('td').map((cell) => cell.text())).toEqual(['907.18474', '1000', '10', '304.8'])
})

it('labels the undeclared legacy contract independently of M&B sourceUnit', () => {
  const profile = testPohAircraft()
  profile.sourceUnit = 'lb'
  const view = mount(PerformanceTablesReview, { props: { profile } })
  expect(view.text()).toContain('Legacy undeclared table: explicit kg / ft / °C / m contract')
  expect(view.text()).toContain('Not supplied')
  expect(view.findAll('table')[0]!.text()).toContain('Mass (kg)')
})
