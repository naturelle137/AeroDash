<script setup lang="ts">
import { computed } from 'vue'
import type {
  MathCoreResult,
  EnvelopePoint,
} from '@/modules/mass-balance/stores/mass-balance.types'
import { useTheme } from '@/shared/composables/useTheme'

const props = defineProps<{
  result: MathCoreResult | null
  envelope: EnvelopePoint[]
  graphType: 'arm' | 'moment'
  severity: 'success' | 'warning' | 'critical' | null
}>()

const { theme } = useTheme()

// ─── SVG layout constants ──────────────────────────────────────────────────

const SVG_W = 600
const SVG_H = 400
const PAD = { top: 25, right: 25, bottom: 45, left: 60 }
const PLOT_W = SVG_W - PAD.left - PAD.right
const PLOT_H = SVG_H - PAD.top - PAD.bottom
const POINT_R = 5
const CROSS_R = 6

// ─── Coordinate helpers ────────────────────────────────────────────────────

function xValOf(pt: { arm: number; moment: number }): number {
  return props.graphType === 'moment' ? pt.moment : pt.arm
}

/**
 * Collects all renderable data points for auto-scaling.
 * MigrationPoint carries both `arm` and `moment` so the path contributes
 * to bounds in either graph mode.
 */
const dataPoints = computed((): { x: number; y: number }[] => {
  const pts: { x: number; y: number }[] = props.envelope.map((ep) => ({
    x: ep.armOrMoment,
    y: ep.mass,
  }))

  if (props.result) {
    const cgs = [
      props.result.zeroFuelCenterOfGravityPoint,
      props.result.takeoffCenterOfGravityPoint,
      props.result.landingCenterOfGravityPoint,
    ]
    for (const cp of cgs) pts.push({ x: xValOf(cp), y: cp.mass })

    for (const mp of props.result.migrationPath) {
      pts.push({ x: xValOf(mp), y: mp.mass })
    }
  }

  return pts
})

const bounds = computed(() => {
  const pts = dataPoints.value
  if (pts.length === 0) return { xMin: 0, xMax: 1, yMin: 0, yMax: 1 }

  let xMin = Infinity
  let xMax = -Infinity
  let yMin = Infinity
  let yMax = -Infinity
  for (const { x, y } of pts) {
    if (x < xMin) xMin = x
    if (x > xMax) xMax = x
    if (y < yMin) yMin = y
    if (y > yMax) yMax = y
  }

  const xPad = (xMax - xMin || 1) * 0.1
  const yPad = (yMax - yMin || 1) * 0.1
  return {
    xMin: xMin - xPad,
    xMax: xMax + xPad,
    yMin: yMin - yPad,
    yMax: yMax + yPad,
  }
})

function sx(v: number): number {
  const { xMin, xMax } = bounds.value
  return PAD.left + ((v - xMin) / (xMax - xMin)) * PLOT_W
}

function sy(v: number): number {
  const { yMin, yMax } = bounds.value
  return PAD.top + PLOT_H - ((v - yMin) / (yMax - yMin)) * PLOT_H
}

// ─── Axis ticks ────────────────────────────────────────────────────────────

function niceTicks(min: number, max: number, target = 6): number[] {
  const range = max - min
  if (range <= 0) return [min]
  const rough = range / (target - 1)
  const exp = Math.floor(Math.log10(rough))
  const base = 10 ** exp
  const frac = rough / base
  const nice = frac < 1.5 ? 1 : frac < 3.5 ? 2 : frac < 7.5 ? 5 : 10
  const step = nice * base
  const start = Math.ceil(min / step) * step
  const ticks: number[] = []
  for (let v = start; v <= max + step * 0.01; v += step) ticks.push(v)
  return ticks
}

function fmtTick(v: number, step: number): string {
  const s = Math.abs(step)
  if (s >= 0.995) return v.toFixed(0)
  if (s >= 0.0995) return v.toFixed(1)
  if (s >= 0.00995) return v.toFixed(2)
  return v.toFixed(3)
}

const xTicks = computed(() => niceTicks(bounds.value.xMin, bounds.value.xMax))
const yTicks = computed(() => niceTicks(bounds.value.yMin, bounds.value.yMax))
const xStep = computed(() => (xTicks.value.length >= 2 ? xTicks.value[1]! - xTicks.value[0]! : 1))
const yStep = computed(() => (yTicks.value.length >= 2 ? yTicks.value[1]! - yTicks.value[0]! : 1))

// ─── Derived SVG geometry ──────────────────────────────────────────────────
// @IMP-MB-UI-001@ (FROM: @REQ-UI-019@)

const envelopePts = computed(() =>
  props.envelope.map((ep) => `${sx(ep.armOrMoment)},${sy(ep.mass)}`).join(' '),
)

const cgMarkers = computed(() => {
  if (!props.result) return null
  const r = props.result

  const zfmX = sx(xValOf(r.zeroFuelCenterOfGravityPoint))
  const zfmY = sy(r.zeroFuelCenterOfGravityPoint.mass)
  const tomX = sx(xValOf(r.takeoffCenterOfGravityPoint))
  const tomY = sy(r.takeoffCenterOfGravityPoint.mass)
  const lmX = sx(xValOf(r.landingCenterOfGravityPoint))
  const lmY = sy(r.landingCenterOfGravityPoint.mass)

  // When two CG points are within PROX pixels on screen, their labels would
  // overlap at the default offsets. Stagger the vertically-adjacent labels so
  // ZFM, TOM, and LM remain legible even for aircraft with no CG migration
  // (electric, or combustion with a full-burn start that leaves CG unchanged).
  const PROX = 12
  const tomNearZfm = Math.hypot(tomX - zfmX, tomY - zfmY) < PROX

  return [
    { key: 'zfm', cx: zfmX, cy: zfmY, label: 'ZFM', labelDy: -10 },
    { key: 'tom', cx: tomX, cy: tomY, label: 'TOM', labelDy: tomNearZfm ? -24 : -10 },
    { key: 'lm', cx: lmX, cy: lmY, label: 'LM', labelDy: 16 },
  ]
})

// @IMP-MB-UI-002@ (FROM: @REQ-UI-010@)
/** SVG marker length in user-space pixels — matches markerWidth on #cg-arrow. */
const ARROW_LENGTH_PX = 8
/** Below this on-screen path length, the arrowhead is suppressed. The line
 *  itself is still drawn — a very short migration is still information — but
 *  the arrowhead is withheld until the line has enough trailing length to
 *  read as a clear directional cue rather than a stray glyph. 3× the arrow
 *  length guarantees the line is visibly longer than the arrowhead before
 *  the arrow starts painting. */
const ARROW_MIN_PX = ARROW_LENGTH_PX * 3

const migrationLengthPx = computed(() => {
  if (!props.result || props.result.migrationPath.length < 2) {
    return 0
  }
  let total = 0
  const path = props.result.migrationPath
  for (let i = 1; i < path.length; i++) {
    const dx = sx(xValOf(path[i]!)) - sx(xValOf(path[i - 1]!))
    const dy = sy(path[i]!.mass) - sy(path[i - 1]!.mass)
    total += Math.hypot(dx, dy)
  }
  return total
})

const migrationD = computed(() => {
  if (!props.result || props.result.migrationPath.length < 2) {
    return null
  }
  return props.result.migrationPath
    .map((mp, i) => `${i === 0 ? 'M' : 'L'}${sx(xValOf(mp))},${sy(mp.mass)}`)
    .join(' ')
})

const showMigrationArrow = computed(() => migrationLengthPx.value >= ARROW_MIN_PX)

// ─── Severity-driven palette ───────────────────────────────────────────────
// @IMP-MB-UI-003@ (FROM: @REQ-UI-018@)

const isCritical = computed(() => props.severity === 'critical')
const isNeutral = computed(() => props.severity === null)

const palette = computed(() => {
  const dark = theme.value === 'dark'
  switch (props.severity) {
    case 'critical':
      return {
        pt: dark ? '#ef9a9a' : '#d32f2f',
        line: dark ? '#ef9a9a' : '#d32f2f',
        envFill: 'url(#cg-crosshatch)',
        envStroke: dark ? '#ef9a9a' : '#d32f2f',
      }
    case 'warning':
      return {
        pt: dark ? '#ffcc80' : '#ef6c00',
        line: dark ? '#ffcc80' : '#ef6c00',
        envFill: dark ? 'rgba(255,204,128,0.12)' : 'rgba(255,152,0,0.10)',
        envStroke: dark ? '#ffcc80' : '#ef6c00',
      }
    case 'success':
      return {
        pt: dark ? '#a5d6a7' : '#2e7d32',
        line: dark ? '#a5d6a7' : '#2e7d32',
        envFill: dark ? 'rgba(165,214,167,0.12)' : 'rgba(76,175,80,0.10)',
        envStroke: dark ? '#a5d6a7' : '#388e3c',
      }
    default:
      return {
        pt: dark ? '#a0a0a0' : '#616161',
        line: dark ? '#b0b0b0' : '#757575',
        envFill: dark ? 'rgba(160,160,160,0.08)' : 'rgba(158,158,158,0.08)',
        envStroke: dark ? '#777777' : '#9e9e9e',
      }
  }
})

const pathDash = computed(() => (isCritical.value ? '6,4' : isNeutral.value ? '4,3' : 'none'))
const pathStroke = computed(() => (isCritical.value ? 3 : 2))

// ─── Colour-independent severity signalling ─────────────────────────────────
// @IMP-MB-UI-009@ (FROM: @REQ-UI-019@)
// DES-UX §3.3: colour must never be the sole differentiator of a safety
// state. Each severity maps to a distinct marker SHAPE so SAFE, WARNING, and
// CRITICAL stay tellable apart under cockpit glare and for colour-blind
// pilots — not just by hue:
//   success / neutral → circle ·  warning → triangle (▲) ·  critical → cross (×)
const TRI_R = 7

const markerShape = computed<'cross' | 'triangle' | 'circle'>(() =>
  props.severity === 'critical' ? 'cross'
  : props.severity === 'warning' ? 'triangle'
  : 'circle',
)

/** Equilateral upward "caution" triangle (circumradius TRI_R) centred on (cx, cy). */
function trianglePoints(cx: number, cy: number): string {
  const dx = TRI_R * 0.866
  const dy = TRI_R * 0.5
  return `${cx},${cy - TRI_R} ${cx + dx},${cy + dy} ${cx - dx},${cy + dy}`
}

const xAxisLabel = computed(() => (props.graphType === 'moment' ? 'CG Moment' : 'CG Arm'))

// ─── Accessibility ─────────────────────────────────────────────────────────

const ariaLabel = computed(() => {
  if (props.envelope.length === 0) return 'CG Envelope Chart — No aircraft selected'
  if (!props.result) return 'CG Envelope Chart — Awaiting data'
  const tag =
    props.severity === 'critical' ? 'CRITICAL'
    : props.severity === 'warning' ? 'WARNING'
    : props.severity === 'success' ? 'SAFE'
    : 'pending'
  return `CG Envelope Chart — ${tag}, TOM ${props.result.takeoffCenterOfGravityPoint.mass.toFixed(1)} kg`
})
</script>

<template>
  <!-- No envelope data → placeholder -->
  <div
    v-if="envelope.length === 0"
    class="chart-placeholder"
    role="img"
    aria-label="CG Envelope Chart — No aircraft selected"
  >
    <p>No aircraft selected</p>
  </div>

  <!-- Chart -->
  <div v-else class="chart-wrapper">
    <svg
      :viewBox="`0 0 ${SVG_W} ${SVG_H}`"
      class="cg-chart"
      role="img"
      :aria-label="ariaLabel"
      preserveAspectRatio="xMidYMid meet"
    >
      <!-- ─── Defs ──────────────────────────────────────────────────────── -->
      <defs>
        <!-- CRITICAL fill: a dense, true crosshatch (two perpendicular line
             sets, 5px tile, raised opacity). Pattern-fills the breach so it
             reads as unsafe in monochrome / colour-blind / glare conditions,
             independent of the red hue (DES-UX §3.3). -->
        <pattern
          id="cg-crosshatch"
          patternUnits="userSpaceOnUse"
          width="5"
          height="5"
          patternTransform="rotate(45)"
        >
          <line x1="0" y1="0" x2="0" y2="5" :stroke="palette.envStroke" stroke-width="1.2" opacity="0.4" />
          <line x1="0" y1="0" x2="5" y2="0" :stroke="palette.envStroke" stroke-width="1.2" opacity="0.4" />
        </pattern>
        <marker id="cg-arrow" markerWidth="8" markerHeight="6" refX="8" refY="3" orient="auto">
          <polygon points="0,0 8,3 0,6" :fill="palette.line" />
        </marker>
      </defs>

      <!-- ─── Grid ──────────────────────────────────────────────────────── -->
      <g class="grid" aria-hidden="true">
        <line
          v-for="t in xTicks"
          :key="'gx' + t"
          :x1="sx(t)"
          :y1="PAD.top"
          :x2="sx(t)"
          :y2="PAD.top + PLOT_H"
        />
        <line
          v-for="t in yTicks"
          :key="'gy' + t"
          :x1="PAD.left"
          :y1="sy(t)"
          :x2="PAD.left + PLOT_W"
          :y2="sy(t)"
        />
      </g>

      <!-- ─── Axes ─────────────────────────────────────────────────────── -->
      <g class="axes" aria-hidden="true">
        <line :x1="PAD.left" :y1="PAD.top" :x2="PAD.left" :y2="PAD.top + PLOT_H" />
        <line
          :x1="PAD.left"
          :y1="PAD.top + PLOT_H"
          :x2="PAD.left + PLOT_W"
          :y2="PAD.top + PLOT_H"
        />
      </g>

      <!-- ─── Tick labels ──────────────────────────────────────────────── -->
      <g class="tick-labels" aria-hidden="true">
        <g v-for="t in xTicks" :key="'xt' + t">
          <line
            :x1="sx(t)"
            :y1="PAD.top + PLOT_H"
            :x2="sx(t)"
            :y2="PAD.top + PLOT_H + 4"
            class="tick-mark"
          />
          <text :x="sx(t)" :y="PAD.top + PLOT_H + 17" text-anchor="middle" class="tick-text">
            {{ fmtTick(t, xStep) }}
          </text>
        </g>

        <g v-for="t in yTicks" :key="'yt' + t">
          <line
            :x1="PAD.left - 4"
            :y1="sy(t)"
            :x2="PAD.left"
            :y2="sy(t)"
            class="tick-mark"
          />
          <text
            :x="PAD.left - 7"
            :y="sy(t)"
            text-anchor="end"
            dominant-baseline="middle"
            class="tick-text"
          >
            {{ fmtTick(t, yStep) }}
          </text>
        </g>
      </g>

      <!-- ─── Axis labels ──────────────────────────────────────────────── -->
      <text
        :x="PAD.left + PLOT_W / 2"
        :y="SVG_H - 4"
        text-anchor="middle"
        class="axis-label"
      >
        {{ xAxisLabel }}
      </text>
      <text
        :x="14"
        :y="PAD.top + PLOT_H / 2"
        text-anchor="middle"
        class="axis-label"
        :transform="`rotate(-90,14,${PAD.top + PLOT_H / 2})`"
      >
        Mass (kg)
      </text>

      <!-- ─── Envelope polygon ─────────────────────────────────────────── -->
      <polygon
        :points="envelopePts"
        :fill="palette.envFill"
        :stroke="palette.envStroke"
        stroke-width="1.5"
        :opacity="isNeutral ? 0.7 : 1"
      />

      <!-- ─── Migration path ──────────────────────────────────────────── -->
      <path
        v-if="migrationD"
        :d="migrationD"
        fill="none"
        :stroke="palette.line"
        :stroke-width="pathStroke"
        :stroke-dasharray="pathDash"
        :marker-end="showMigrationArrow ? 'url(#cg-arrow)' : undefined"
      />

      <!-- ─── CG point markers ────────────────────────────────────────── -->
      <template v-if="cgMarkers">
        <template v-for="m in cgMarkers" :key="m.key">
          <!-- Critical → cross (×): boundary breach — shape independent of colour -->
          <g
            v-if="markerShape === 'cross'"
            class="cg-point-marker cg-point-marker--cross"
            :transform="`translate(${m.cx},${m.cy})`"
          >
            <line
              :x1="-CROSS_R"
              :y1="-CROSS_R"
              :x2="CROSS_R"
              :y2="CROSS_R"
              :stroke="palette.pt"
              stroke-width="2.5"
            />
            <line
              :x1="CROSS_R"
              :y1="-CROSS_R"
              :x2="-CROSS_R"
              :y2="CROSS_R"
              :stroke="palette.pt"
              stroke-width="2.5"
            />
          </g>

          <!-- Warning → triangle (▲): out-of-standard-range caution, distinct
               from the SAFE circle by shape, not just colour (DES-UX §3.3) -->
          <polygon
            v-else-if="markerShape === 'triangle'"
            class="cg-point-marker cg-point-marker--triangle"
            :points="trianglePoints(m.cx, m.cy)"
            :fill="palette.pt"
          />

          <!-- Safe / neutral → filled circle -->
          <circle
            v-else
            class="cg-point-marker cg-point-marker--circle"
            :cx="m.cx"
            :cy="m.cy"
            :r="POINT_R"
            :fill="palette.pt"
            :opacity="isNeutral ? 0.6 : 1"
          />

          <!-- Point label (always) -->
          <text
            :x="m.cx + 9"
            :y="m.cy + m.labelDy"
            class="point-label"
            :fill="palette.pt"
          >
            {{ m.label }}
          </text>
        </template>
      </template>
    </svg>
  </div>
</template>

<style scoped>
.chart-wrapper {
  width: 100%;
}

.cg-chart {
  width: 100%;
  height: auto;
  display: block;
}

.chart-placeholder {
  display: flex;
  align-items: center;
  justify-content: center;
  min-height: 200px;
  border: 1px dashed var(--color-border, #ccc);
  border-radius: 0.5rem;
  color: var(--color-text-secondary, #999);
  font-size: 0.875rem;
}

.grid line {
  stroke: var(--chart-grid, #e8e8e8);
  stroke-width: 0.5;
}

.axes line {
  stroke: var(--chart-axis, #bdbdbd);
  stroke-width: 1;
}

.tick-mark {
  stroke: var(--chart-axis, #bdbdbd);
  stroke-width: 1;
}

.tick-text {
  font-size: 10px;
  fill: var(--chart-tick-text, #757575);
  font-family: inherit;
}

.axis-label {
  font-size: 11px;
  fill: var(--chart-label, #616161);
  font-family: inherit;
}

.point-label {
  font-size: 10px;
  font-weight: 600;
  font-family: inherit;
}
</style>
