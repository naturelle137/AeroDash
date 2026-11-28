import { expect, it } from 'vitest'
import { assessObstacle, emptyObstacleInput, obstacleNotification } from './obstacle-constraint'

const input = (over: Partial<ReturnType<typeof emptyObstacleInput>>) => ({ ...emptyObstacleInput(), ...over })

it('treats blank entries as no obstacle and emits no warning', () => {
  const none = assessObstacle(emptyObstacleInput())
  expect(none).toEqual({ status: 'none' })
  expect(obstacleNotification(none)).toEqual([])
})

it('activates a valid obstacle with units and a persistent non-dismissible warning (REQ-PF-009)', () => {
  const active = assessObstacle(input({ height: '50', distance: '600', distanceUnit: 'm' }))
  expect(active).toMatchObject({ status: 'active', height: 50, heightUnit: 'ft', distance: 600, distanceUnit: 'm' })
  expect(obstacleNotification(active)).toMatchObject([{ id: 'WARN-PF-001', severity: 'WARNING', persistent: true, dismissible: false }])
  expect(obstacleNotification(active)[0]!.message).toContain('not calculated or verified')
})

it.each([['0', '100'], ['-5', '100'], ['abc', '100'], ['50', ''], ['', '100'], ['50', 'Infinity'], ['50', '0x10']])(
  'never activates height %j distance %j', (height, distance) => {
    const result = assessObstacle(input({ height, distance }))
    expect(result.status).toBe('invalid')
    expect(obstacleNotification(result)).toEqual([])
  })
