import { expect, it } from 'vitest'
import { obstacleGradient } from './obstacle-gradient'

it('calculates the geometric gradient in mixed units', () => {
  expect(obstacleGradient(50, 'ft', 600, 'm')).toBeCloseTo(2.54)
  expect(obstacleGradient(15.24, 'm', 600, 'm')).toBeCloseTo(2.54)
  expect(obstacleGradient(100, 'm', 1000, 'ft')).toBeCloseTo(32.80839895)
})

it.each([[0, 1], [-1, 1], [1, 0], [1, -1], [Infinity, 1], [1, NaN], [1e308, 1e-308], [1e-308, 1e308]])(
  'rejects invalid or unrepresentable values %s and %s', (height, distance) => {
    expect(obstacleGradient(height!, 'm', distance!, 'm')).toBeNull()
  })
