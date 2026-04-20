import { describe, it, expect } from 'vitest'
import { mount } from '@vue/test-utils'
import CGEnvelopeChart from '../CGEnvelopeChart.vue'
import type { MathCoreResult, EnvelopePoint } from '@/modules/mass-balance/stores/mass-balance.types'

// ─── Test fixtures ───────────────────────────────────────────────────────────

/** Standard 4-point envelope for a typical single-engine piston aircraft. */
const ENVELOPE: EnvelopePoint[] = [
  { armOrMoment: 1.841, mass: 433 },
  { armOrMoment: 1.841, mass: 630 },
  { armOrMoment: 1.978, mass: 630 },
  { armOrMoment: 1.978, mass: 433 },
]

function buildResult(overrides: Partial<MathCoreResult> = {}): MathCoreResult {
  return {
    success: true,
    violations: [],
    zeroFuelCenterOfGravityPoint: { arm: 1.88, mass: 480, moment: 902.4 },
    takeoffCenterOfGravityPoint: { arm: 1.91, mass: 520, moment: 993.2 },
    landingCenterOfGravityPoint: { arm: 1.89, mass: 490, moment: 925.8 },
    migrationPath: [
      { arm: 1.91, mass: 520, label: 'Takeoff' },
      { arm: 1.89, mass: 490, label: 'Landing' },
    ],
    ...overrides,
  }
}

type Severity = 'success' | 'warning' | 'critical' | null

function mountChart(opts: {
  envelope?: EnvelopePoint[]
  result?: MathCoreResult | null
  graphType?: 'arm' | 'moment'
  severity?: Severity
}) {
  return mount(CGEnvelopeChart, {
    props: {
      envelope: opts.envelope ?? ENVELOPE,
      result: opts.result ?? null,
      graphType: opts.graphType ?? 'arm',
      severity: opts.severity ?? null,
    },
  })
}

// ─── Placeholder vs Chart branch (envelope.length === 0) ────────────────────

describe('CGEnvelopeChart — placeholder', () => {
  it('renders the placeholder when the envelope array is empty', () => {
    const wrapper = mountChart({ envelope: [] })

    expect(wrapper.find('.chart-placeholder').exists()).toBe(true)
    expect(wrapper.find('.chart-wrapper').exists()).toBe(false)
    expect(wrapper.find('.chart-placeholder').text()).toContain('No aircraft selected')
  })

  it('has the correct aria-label on the placeholder', () => {
    const wrapper = mountChart({ envelope: [] })

    expect(wrapper.find('[role="img"]').attributes('aria-label')).toBe(
      'CG Envelope Chart — No aircraft selected',
    )
  })
})

// ─── Chart rendering ─────────────────────────────────────────────────────────

describe('CGEnvelopeChart — chart rendering', () => {
  it('renders the SVG chart wrapper when envelope data is present', () => {
    const wrapper = mountChart({})

    expect(wrapper.find('.chart-wrapper').exists()).toBe(true)
    expect(wrapper.find('.chart-placeholder').exists()).toBe(false)
    expect(wrapper.find('svg.cg-chart').exists()).toBe(true)
  })

  it('shows "Awaiting data" aria-label when envelope exists but result is null', () => {
    const wrapper = mountChart({ result: null })

    expect(wrapper.find('svg').attributes('aria-label')).toBe('CG Envelope Chart — Awaiting data')
  })
})

// ─── ariaLabel computed branches ─────────────────────────────────────────────

describe('CGEnvelopeChart — ariaLabel', () => {
  it('includes SAFE and TOM mass when severity is success', () => {
    const wrapper = mountChart({ result: buildResult(), severity: 'success' })

    expect(wrapper.find('svg').attributes('aria-label')).toContain('SAFE')
    expect(wrapper.find('svg').attributes('aria-label')).toContain('520.0 kg')
  })

  it('includes WARNING when severity is warning', () => {
    const wrapper = mountChart({ result: buildResult(), severity: 'warning' })

    expect(wrapper.find('svg').attributes('aria-label')).toContain('WARNING')
  })

  it('includes CRITICAL when severity is critical', () => {
    const wrapper = mountChart({ result: buildResult(), severity: 'critical' })

    expect(wrapper.find('svg').attributes('aria-label')).toContain('CRITICAL')
  })

  it('includes "pending" when severity is null but result exists', () => {
    const wrapper = mountChart({ result: buildResult(), severity: null })

    expect(wrapper.find('svg').attributes('aria-label')).toContain('pending')
  })
})

// ─── Palette / severity branches ─────────────────────────────────────────────

describe('CGEnvelopeChart — severity palette', () => {
  /** The defs section contains one arrowhead <polygon>; the envelope polygon is the second one. */
  function envelopePolygon(wrapper: ReturnType<typeof mountChart>) {
    return wrapper.findAll('polygon')[1]!
  }

  it('applies neutral (grey) fill to the envelope polygon when severity is null', () => {
    const wrapper = mountChart({ result: buildResult(), severity: null })

    const polygon = envelopePolygon(wrapper)
    expect(polygon.attributes('fill')).toBe('rgba(158,158,158,0.08)')
    expect(polygon.attributes('stroke')).toBe('#9e9e9e')
  })

  it('applies success (green) fill to the envelope polygon when severity is success', () => {
    const wrapper = mountChart({ result: buildResult(), severity: 'success' })

    const polygon = envelopePolygon(wrapper)
    expect(polygon.attributes('fill')).toBe('rgba(76,175,80,0.10)')
    expect(polygon.attributes('stroke')).toBe('#388e3c')
  })

  it('applies warning (orange) fill to the envelope polygon when severity is warning', () => {
    const wrapper = mountChart({ result: buildResult(), severity: 'warning' })

    const polygon = envelopePolygon(wrapper)
    expect(polygon.attributes('fill')).toBe('rgba(255,152,0,0.10)')
    expect(polygon.attributes('stroke')).toBe('#ef6c00')
  })

  it('applies critical (red) crosshatch fill to the envelope polygon when severity is critical', () => {
    const wrapper = mountChart({ result: buildResult(), severity: 'critical' })

    const polygon = envelopePolygon(wrapper)
    expect(polygon.attributes('fill')).toBe('url(#cg-crosshatch)')
    expect(polygon.attributes('stroke')).toBe('#d32f2f')
  })
})

// ─── pathDash / pathStroke computed branches ─────────────────────────────────

describe('CGEnvelopeChart — migration path style', () => {
  const resultWithPath = buildResult()

  it('uses a dash pattern of "6,4" and stroke-width 3 for a critical migration path', () => {
    const wrapper = mountChart({ result: resultWithPath, severity: 'critical' })

    const path = wrapper.find('path')
    expect(path.attributes('stroke-dasharray')).toBe('6,4')
    expect(path.attributes('stroke-width')).toBe('3')
  })

  it('uses a dash pattern of "4,3" and stroke-width 2 for a neutral (null severity) migration path', () => {
    const wrapper = mountChart({ result: resultWithPath, severity: null })

    const path = wrapper.find('path')
    expect(path.attributes('stroke-dasharray')).toBe('4,3')
    expect(path.attributes('stroke-width')).toBe('2')
  })

  it('uses no dash ("none") and stroke-width 2 for a success migration path', () => {
    const wrapper = mountChart({ result: resultWithPath, severity: 'success' })

    const path = wrapper.find('path')
    expect(path.attributes('stroke-dasharray')).toBe('none')
    expect(path.attributes('stroke-width')).toBe('2')
  })

  it('uses no dash ("none") and stroke-width 2 for a warning migration path', () => {
    const wrapper = mountChart({ result: resultWithPath, severity: 'warning' })

    const path = wrapper.find('path')
    expect(path.attributes('stroke-dasharray')).toBe('none')
    expect(path.attributes('stroke-width')).toBe('2')
  })
})

// ─── migrationD computed branches ────────────────────────────────────────────

describe('CGEnvelopeChart — migration path rendering', () => {
  it('renders a migration path when graphType is arm and path has ≥ 2 points', () => {
    const wrapper = mountChart({ result: buildResult(), graphType: 'arm', severity: 'success' })

    expect(wrapper.find('path').exists()).toBe(true)
  })

  it('does not render a migration path when graphType is moment', () => {
    const wrapper = mountChart({ result: buildResult(), graphType: 'moment', severity: 'success' })

    expect(wrapper.find('path').exists()).toBe(false)
  })

  it('does not render a migration path when result is null', () => {
    const wrapper = mountChart({ result: null, graphType: 'arm' })

    expect(wrapper.find('path').exists()).toBe(false)
  })

  it('does not render a migration path when migrationPath has fewer than 2 points', () => {
    const result = buildResult({ migrationPath: [{ arm: 1.91, mass: 520 }] })
    const wrapper = mountChart({ result, graphType: 'arm' })

    expect(wrapper.find('path').exists()).toBe(false)
  })

  it('does not render a migration path when migrationPath is empty', () => {
    const result = buildResult({ migrationPath: [] })
    const wrapper = mountChart({ result, graphType: 'arm' })

    expect(wrapper.find('path').exists()).toBe(false)
  })

  it('does not render a migration path when the on-screen length is below 1.5× the arrow length', () => {
    // Start and end points are identical — migration path length = 0 px on
    // screen, which is below the 12 px (1.5 × markerWidth of 8) threshold.
    const result = buildResult({
      takeoffCenterOfGravityPoint: { arm: 1.9, mass: 500, moment: 950 },
      landingCenterOfGravityPoint: { arm: 1.9, mass: 500, moment: 950 },
      migrationPath: [
        { arm: 1.9, mass: 500, label: 'Takeoff' },
        { arm: 1.9, mass: 500, label: 'Landing' },
      ],
    })
    const wrapper = mountChart({ result, graphType: 'arm', severity: 'success' })

    expect(wrapper.find('path').exists()).toBe(false)
  })

  it('renders the migration path when on-screen length exceeds 1.5× the arrow length', () => {
    // Large arm delta → many pixels of screen-space migration → path renders.
    const result = buildResult({
      migrationPath: [
        { arm: 1.85, mass: 520, label: 'Takeoff' },
        { arm: 1.95, mass: 440, label: 'Landing' },
      ],
    })
    const wrapper = mountChart({ result, graphType: 'arm', severity: 'success' })

    expect(wrapper.find('path').exists()).toBe(true)
  })
})

// ─── CG markers — cgMarkers computed and isCritical branch ──────────────────

describe('CGEnvelopeChart — CG markers', () => {
  it('renders no CG markers when result is null', () => {
    const wrapper = mountChart({ result: null })

    // No circles or cross lines for CG points
    expect(wrapper.findAll('circle').length).toBe(0)
  })

  it('renders three filled circles (non-critical) with labels when result is provided', () => {
    const wrapper = mountChart({ result: buildResult(), severity: 'success' })

    expect(wrapper.findAll('circle').length).toBe(3)
    const labels = wrapper.findAll('text.point-label')
    const labelTexts = labels.map((l) => l.text())
    expect(labelTexts).toContain('ZFM')
    expect(labelTexts).toContain('TOM')
    expect(labelTexts).toContain('LM')
  })

  it('renders cross (×) markers instead of circles when severity is critical', () => {
    const wrapper = mountChart({ result: buildResult(), severity: 'critical' })

    // No circles — crosses are rendered as <g> + <line> pairs
    expect(wrapper.findAll('circle').length).toBe(0)
    // Each cross has 2 lines; 3 markers × 2 lines = 6 cross lines inside translated <g>
    const crossLines = wrapper
      .findAll('g[transform]')
      .filter((g) => g.attributes('transform')?.startsWith('translate('))
    expect(crossLines.length).toBeGreaterThanOrEqual(3)
  })

  it('reduces marker opacity to 0.6 for circles when severity is null (neutral)', () => {
    const wrapper = mountChart({ result: buildResult(), severity: null })

    const circles = wrapper.findAll('circle')
    for (const circle of circles) {
      expect(circle.attributes('opacity')).toBe('0.6')
    }
  })

  it('uses full opacity (1) for circles when severity is success', () => {
    const wrapper = mountChart({ result: buildResult(), severity: 'success' })

    const circles = wrapper.findAll('circle')
    for (const circle of circles) {
      expect(circle.attributes('opacity')).toBe('1')
    }
  })

  it('staggers the TOM label away from ZFM when both markers coincide on screen', () => {
    // Coincident ZFM and TOM (no fuel burned, or electric aircraft): default
    // label offsets would overlap. The chart pushes the TOM label further up.
    const result = buildResult({
      zeroFuelCenterOfGravityPoint: { arm: 1.9, mass: 500, moment: 950 },
      takeoffCenterOfGravityPoint: { arm: 1.9, mass: 500, moment: 950 },
      landingCenterOfGravityPoint: { arm: 1.9, mass: 500, moment: 950 },
      migrationPath: [],
    })
    const wrapper = mountChart({ result, graphType: 'arm', severity: 'success' })

    const labels = wrapper.findAll('text.point-label')
    const zfmLabel = labels.find((l) => l.text() === 'ZFM')!
    const tomLabel = labels.find((l) => l.text() === 'TOM')!

    // Same x (same marker x + 9), but ZFM sits directly above the point and
    // TOM sits further above it — labels must not share a y coordinate.
    expect(zfmLabel.attributes('x')).toBe(tomLabel.attributes('x'))
    expect(zfmLabel.attributes('y')).not.toBe(tomLabel.attributes('y'))
  })

  it('keeps TOM at the default offset when TOM and ZFM are far apart on screen', () => {
    // Distinct ZFM and TOM positions: TOM's label uses the default offset
    // (cy - 10), not the staggered cy - 24 we apply for coincident markers.
    const result = buildResult({
      zeroFuelCenterOfGravityPoint: { arm: 1.85, mass: 460, moment: 851 },
      takeoffCenterOfGravityPoint: { arm: 1.95, mass: 560, moment: 1092 },
    })
    const wrapper = mountChart({ result, graphType: 'arm', severity: 'success' })

    // cgMarkers is emitted in order [zfm, tom, lm] so the corresponding
    // circle and label indices line up.
    const circles = wrapper.findAll('circle')
    const labels = wrapper.findAll('text.point-label')
    const zfmDy = Number(labels[0]!.attributes('y')) - Number(circles[0]!.attributes('cy'))
    const tomDy = Number(labels[1]!.attributes('y')) - Number(circles[1]!.attributes('cy'))

    expect(labels[0]!.text()).toBe('ZFM')
    expect(labels[1]!.text()).toBe('TOM')
    expect(zfmDy).toBe(-10)
    expect(tomDy).toBe(-10)
  })
})

// ─── xAxisLabel computed branch ──────────────────────────────────────────────

describe('CGEnvelopeChart — axis labels', () => {
  it('displays "CG Arm" on the x-axis when graphType is arm', () => {
    const wrapper = mountChart({ graphType: 'arm' })

    const axisLabels = wrapper.findAll('text.axis-label')
    const xLabel = axisLabels[0]!
    expect(xLabel.text()).toBe('CG Arm')
  })

  it('displays "CG Moment" on the x-axis when graphType is moment', () => {
    const wrapper = mountChart({ graphType: 'moment' })

    const axisLabels = wrapper.findAll('text.axis-label')
    const xLabel = axisLabels[0]!
    expect(xLabel.text()).toBe('CG Moment')
  })

  it('always displays "Mass (kg)" on the y-axis', () => {
    const wrapper = mountChart({})

    const axisLabels = wrapper.findAll('text.axis-label')
    expect(axisLabels[1]!.text()).toBe('Mass (kg)')
  })
})

// ─── dataPoints with graphType branch ────────────────────────────────────────

describe('CGEnvelopeChart — dataPoints coordinate mode', () => {
  it('includes migration path points in scale calculation when graphType is arm', () => {
    const result = buildResult({
      migrationPath: [
        { arm: 1.70, mass: 400 },
        { arm: 2.10, mass: 550 },
      ],
    })
    const wrapper = mountChart({ result, graphType: 'arm', severity: 'success' })

    // Chart renders without errors when migration points extend outside envelope bounds
    expect(wrapper.find('svg.cg-chart').exists()).toBe(true)
  })

  it('does not include migration arm points when graphType is moment', () => {
    const result = buildResult({
      zeroFuelCenterOfGravityPoint: { arm: 1.88, mass: 480, moment: 0.5 },
      takeoffCenterOfGravityPoint: { arm: 1.91, mass: 520, moment: 0.6 },
      landingCenterOfGravityPoint: { arm: 1.89, mass: 490, moment: 0.55 },
    })
    const wrapper = mountChart({ result, graphType: 'moment', severity: 'success' })

    expect(wrapper.find('svg.cg-chart').exists()).toBe(true)
  })
})

// ─── bounds computed — empty pts guard ───────────────────────────────────────

describe('CGEnvelopeChart — bounds with envelope data', () => {
  it('renders tick labels and grid lines when envelope has points', () => {
    const wrapper = mountChart({})

    expect(wrapper.findAll('.tick-text').length).toBeGreaterThan(0)
  })

  it('renders tick marks for both axes', () => {
    const wrapper = mountChart({})

    const tickMarks = wrapper.findAll('.tick-mark')
    expect(tickMarks.length).toBeGreaterThan(0)
  })
})

// ─── fmtTick branches via rendered tick labels ────────────────────────────────

describe('CGEnvelopeChart — tick label formatting', () => {
  it('formats mass (y-axis) ticks as integers for large mass ranges', () => {
    const wrapper = mountChart({ result: buildResult(), severity: 'success' })

    // Mass tick labels (y-axis) should be whole numbers like "433", "630" etc.
    const tickTexts = wrapper.findAll('text.tick-text').map((el) => el.text())
    const integerPattern = /^\d+$/
    expect(tickTexts.some((t) => integerPattern.test(t))).toBe(true)
  })

  it('formats arm (x-axis) ticks with decimal places for sub-unit arm ranges', () => {
    const wrapper = mountChart({ result: buildResult(), severity: 'success' })

    // Arm tick labels (x-axis) should show decimals like "1.85", "1.90", "1.95" etc.
    const tickTexts = wrapper.findAll('text.tick-text').map((el) => el.text())
    const decimalPattern = /^\d+\.\d+$/
    expect(tickTexts.some((t) => decimalPattern.test(t))).toBe(true)
  })

  it('formats moment (x-axis) ticks with one decimal place for small moment ranges', () => {
    // Use tiny moment values to force a step in the 0.1 range → fmtTick 1 decimal
    const envelope: EnvelopePoint[] = [
      { armOrMoment: 0.9, mass: 433 },
      { armOrMoment: 0.9, mass: 630 },
      { armOrMoment: 1.4, mass: 630 },
      { armOrMoment: 1.4, mass: 433 },
    ]
    const result = buildResult({
      zeroFuelCenterOfGravityPoint: { arm: 1.0, mass: 480, moment: 1.0 },
      takeoffCenterOfGravityPoint: { arm: 1.1, mass: 520, moment: 1.1 },
      landingCenterOfGravityPoint: { arm: 1.05, mass: 490, moment: 1.05 },
    })
    const wrapper = mount(CGEnvelopeChart, {
      props: { envelope, result, graphType: 'moment', severity: 'success' },
    })

    const tickTexts = wrapper.findAll('text.tick-text').map((el) => el.text())
    // Expect some tick to have exactly one decimal digit (e.g. "1.0", "1.1")
    const oneDecimalPattern = /^\d+\.\d$/
    expect(tickTexts.some((t) => oneDecimalPattern.test(t))).toBe(true)
  })
})

// ─── Envelope polygon opacity ─────────────────────────────────────────────────

describe('CGEnvelopeChart — envelope polygon opacity', () => {
  /** The defs section contains one arrowhead <polygon>; the envelope polygon is the second one. */
  function envelopePolygon(wrapper: ReturnType<typeof mountChart>) {
    return wrapper.findAll('polygon')[1]!
  }

  it('renders the envelope polygon with 0.7 opacity when severity is null (neutral)', () => {
    const wrapper = mountChart({ severity: null })

    expect(envelopePolygon(wrapper).attributes('opacity')).toBe('0.7')
  })

  it('renders the envelope polygon with full opacity (1) when severity is not null', () => {
    const wrapper = mountChart({ result: buildResult(), severity: 'success' })

    expect(envelopePolygon(wrapper).attributes('opacity')).toBe('1')
  })
})
