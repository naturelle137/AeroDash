import { describe, expect, it } from 'vitest'
import { tripPathWithinEnvelope } from './trip-envelope'

// Synthetic geometry only, not aircraft data.
const concave = [
  { armOrMoment: 0, mass: 1 }, { armOrMoment: 4, mass: 1 },
  { armOrMoment: 4, mass: 4 }, { armOrMoment: 3, mass: 4 },
  { armOrMoment: 3, mass: 2 }, { armOrMoment: 1, mass: 2 },
  { armOrMoment: 1, mass: 4 }, { armOrMoment: 0, mass: 4 },
]
describe('continuous trip envelope', () => {
  it('detects an exit and re-entry between inside endpoints', () => {
    expect(tripPathWithinEnvelope([{ mass: 3, moment: 0.5 }, { mass: 3, moment: 3.5 }], concave, 'moment')).toBe(false)
  })
  it('handles tank-switch points, boundary and zero burn', () => {
    expect(tripPathWithinEnvelope([{ mass: 1, moment: 0 }, { mass: 1, moment: 2 }, { mass: 1, moment: 4 }], concave, 'moment')).toBe(true)
    expect(tripPathWithinEnvelope([{ mass: 3, moment: 0.5 }], concave, 'moment')).toBe(true)
    expect(tripPathWithinEnvelope([{ mass: 3, moment: 2 }], concave, 'moment')).toBe(false)
  })
  it('checks the curved arm path and unavailable geometry', () => {
    expect(tripPathWithinEnvelope([{ mass: 3, moment: 1.5 }, { mass: 1, moment: 0.5 }], concave, 'arm')).toBe(true)
    expect(tripPathWithinEnvelope([{ mass: 0, moment: 0 }], concave, 'arm')).toBeNull()
    expect(tripPathWithinEnvelope([{ mass: 3, moment: 1 }], [], 'arm')).toBeNull()
    expect(tripPathWithinEnvelope([{ mass: 3, moment: 1 }], [concave[0]!, concave[2]!, concave[1]!, concave[3]!], 'arm')).toBeNull()
  })
})
