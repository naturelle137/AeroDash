<!-- @DES-ARCH-020@ (FROM: @REQ-PF-010@, @REQ-PF-011@, @REQ-PF-012@) -->
# Conservative Extrapolation Control Contract

**Module:** Performance (P1 Safety Core)
**Status:** Baseline — v0.4.0-alpha milestone (Performance Math Core)
**Refs:** REQ-PF-010 · REQ-PF-011 · REQ-PF-012 | H-007 · H-012 · H-013 | IMP-PF-CORE-006…011

---

## 1. Purpose

This document specifies the **conservative extrapolation control** that sits
between the clamping POH-distance lookup
([`trilinearInterpolate` / `computePohDistances`](./performance-bilinear-interpolation-contract.md))
and the [safety-factor pipeline](./performance-safety-factor-pipeline.md). The
trilinear engine *clamps* an out-of-envelope operating point to the nearest POH
boundary and reports only a boolean clamp flag; it never decides whether that
excursion is survivable. This control is that decision layer:

- Past the certified envelope toward **worse** conditions (higher mass, pressure
  altitude, or temperature) extrapolation is permitted only up to a fixed **10%**
  of the boundary value, with a fixed **+20%** distance penalty applied to the
  clamped boundary distance (REQ-PF-010 / H-007, H-012).
- Beyond that 10% band computation is **blocked** — no distance is returned at
  all (REQ-PF-010 / H-012).
- Toward **better** conditions (below the envelope minimum) no benefit is
  granted: the distance is floored at the best-case POH value and can never come
  out shorter than the documented minimum — the **Minimum Distance Rule**
  (REQ-PF-011 / H-013).
- Any permitted extrapolation flags the result as requiring explicit
  pilot-in-command acknowledgment before it may be used (REQ-PF-012 / H-012).

It is the correctness baseline for `performance.extrapolation.ts` and the
contract its unit tests assert against. The control is **pure** and
**deterministic**: identical inputs always produce identical outputs, with no
I/O and no side effects.

The sibling safety-factor contract already records this dependency: the
extrapolation cap / 20% penalty / benefit capping are *"applied upstream by the
POH-distance facade before the base distances reach"* the safety-factor pipeline.
This document is that upstream specification.

---

## 2. Inputs

All distances are in metres (m); axis values are in the POH-native units the
cube declares (mass kg, pressure altitude ft, temperature °C). Unit
normalisation is the caller's responsibility (same contract as the bilinear
engine).

| Field | Type | Constraint |
| :---- | :--- | :--------- |
| `baseDistance` | `number` | finite (m) — the *clamped* POH boundary distance to penalise |
| `conditions.mass` | `number` | finite (kg) — requested operating mass |
| `conditions.pressureAltitude` | `number` | finite (ft) — requested pressure altitude |
| `conditions.temperature` | `number` | finite (°C) — requested outside air temperature |
| `ranges.{mass,pressureAltitude,temperature}.min` | `number` | finite — lowest tabulated break-point on the axis |
| `ranges.{mass,pressureAltitude,temperature}.max` | `number` | finite, `min ≤ max` — highest tabulated break-point on the axis |

`cubeEnvelopeRanges(cube)` derives the three `ranges` directly from a
`PerformanceCube3D`, so the control composes with the trilinear engine's cubes
without the caller re-deriving axis bounds.

---

## 3. Monotonicity assumption

For all four POH distance types the required distance is assumed **non-decreasing
in mass, pressure altitude, and temperature**. Consequently:

- "Above the axis maximum" is always the conservative-penalty direction
  (`worse`), and
- "Below the axis minimum" is always the benefit (floor) direction (`better`).

This assumption is why a single signed penalty/floor rule per axis is sufficient
and why the aggregation in §5 can treat any worse-direction excursion uniformly.

---

## 4. Per-axis classification (REQ-PF-010, REQ-PF-011)

`classifyAxisExcursion(value, range)` places the requested value on one axis:

```text
value > max  → direction = 'worse'   worseFraction = (value − max) / max     (max > 0)
value < min  → direction = 'better'  worseFraction = 0
otherwise    → direction = 'within'  worseFraction = 0

beyondCap ⟺ direction === 'worse' AND worseFraction > 0.10
```

Degenerate axis: when `max ≤ 0` no finite 10% band can be defined, so
`worseFraction = +∞` and the axis is **always** beyond the cap (fail-safe — a
non-positive boundary admits no extrapolation rather than a divide-by-zero
benefit).

Precondition: `value`, `min`, `max` finite and `min ≤ max`. A structural
violation throws `[PF-EXTRAP]` — the same fail-loud contract the sibling engine
uses for malformed grids. The fail-**safe** wrapper is §6.

Boundary: `worseFraction === 0.10` exactly is **within** the cap (penalised, not
blocked) — strictly `> 0.10` blocks. (A pressure altitude of 11,000 ft against a
10,000 ft maximum is the last accepted point; 11,100 ft / +11% blocks — UJ-C-001.)

---

## 5. Aggregate state & acknowledgment gate (REQ-PF-010, REQ-PF-012)

`assessExtrapolation(conditions, ranges)` classifies all three axes and folds
them into one conservative state:

```text
blocked        ⟺ any axis is 'worse' AND beyondCap
extrapolated   ⟺ (not blocked) AND any axis is 'worse'
within_envelope⟺ otherwise

requiresAcknowledgment ⟺ state === 'extrapolated'          (REQ-PF-012)
benefitCapped          ⟺ any axis is 'better'              (REQ-PF-011, §6 floor)
penaltyFactor          = state === 'extrapolated' ? 1.20 : 1.00
```

Aggregation is **conservative**: a single axis beyond the cap blocks the whole
computation; any worse-but-within-cap axis marks the whole result extrapolated
(penalty + acknowledgment); a below-minimum axis only raises `benefitCapped`.

The `requiresAcknowledgment` flag is the P1 half of the REQ-PF-012 barrier; the
enforcement half is the P2 contract in §8.

---

## 6. Penalty, Minimum-Distance floor & fail-safe facade (REQ-PF-010, REQ-PF-011)

`applyExtrapolationPenalty(baseDistance, assessment)`:

```text
penalised = max(baseDistance, baseDistance × penaltyFactor)
```

`penaltyFactor ≥ 1` always, so the `max(…)` is belt-and-braces enforcement of the
Minimum Distance Rule: the result can **never** undercut `baseDistance`. A
non-finite `baseDistance` throws `[PF-EXTRAP]`.

`resolveExtrapolatedDistance(baseDistance, conditions, ranges)` is the **safety
boundary** of the module — it never throws and never returns a distance for a
blocked operating point:

| Outcome | Shape | Carries a distance? |
| :------ | :---- | :------------------ |
| within envelope | `{ state: 'within_envelope', distance, requiresAcknowledgment: false, … }` | yes (unpenalised) |
| extrapolated (≤ cap) | `{ state: 'extrapolated', distance, requiresAcknowledgment: true, … }` | yes (+20%, floored) |
| beyond cap | `{ state: 'blocked', reason: 'extrapolation_exceeds_cap', assessment }` | **no — by type** |
| non-finite input | `{ state: 'blocked', reason: 'invalid_input', assessment: null }` | **no — by type** |

Because the discriminated union gives a `blocked` result no `distance` field, a
blocked operating point **cannot, by construction**, carry a number into a
Go/No-Go decision.

---

## 7. Pipeline placement

```text
trilinearInterpolate (clamp + flag)
        │  baseDistance (clamped to POH boundary), conditions, cubeEnvelopeRanges(cube)
        ▼
resolveExtrapolatedDistance   ← THIS control (block / +20% penalty / floor / ack)
        │  penalised, floored base distances (or a blocked result that halts the operation)
        ▼
computeSafetyFactorPipeline (friction/slope/DA/wind/OSF, CRIT-PF-002, WARN-PF-002)
```

The control is applied **per distance type** (TOR, TOD, LR, LD) before that base
distance reaches the safety-factor pipeline. A `blocked` outcome on **any**
required distance halts the operation that depends on it — no penalised distance
and no safety factors are computed for a blocked point.

---

## 8. P1 → P2 acknowledgment-gate contract (REQ-PF-012)

P1 decides; P2 enforces and renders. The Performance UI module **must** honour
this contract so the REQ-PF-012 legal-safety barrier is real and not advisory:

1. **Block is terminal.** A `blocked` result is surfaced as an error
   ("conditions exceed the maximum extrapolation boundary"); the UI presents
   **no** distance, margin, or Go/No-Go advisory for that operation.
2. **Acknowledgment withholds acceptance.** When `requiresAcknowledgment === true`
   the UI displays a prominent "performance data is extrapolated beyond the AFM
   limits" warning and an explicit *"Pilot-in-Command acknowledges extrapolated
   data"* control. Until the pilot acknowledges, the extrapolated result is
   **not finalised** — it is not accepted as a usable Go/No-Go input and is not
   exported.
3. **Acknowledgment is per computation.** Changing any input that re-runs the
   assessment clears a prior acknowledgment; a stale acknowledgment must never
   carry over to a different operating point.
4. **The floor is invisible-but-safe.** A `benefitCapped` (below-minimum)
   result needs no acknowledgment — it is already conservative — but the UI may
   still flag that the figure is floored at the best documented AFM value
   (UJ-E-003).

The acknowledgment UI, its E2E coverage (UJ-C-001, UJ-E-003), and the
notification wiring are delivered by the Performance UI module task, **not** by
this P1 contract.

---

## 9. Immutable constants (REQ-PF-010, architecture constraint)

The 10% cap and 20% penalty are fixed by regulatory intent and **must not be
user-configurable**:

```text
EXTRAPOLATION_CAP_FRACTION     = 0.10
EXTRAPOLATION_PENALTY_FRACTION = 0.20
EXTRAPOLATION_LIMITS           = Object.freeze({ capFraction, penaltyFraction })
```

The `Object.freeze` makes accidental runtime mutation fail loudly in strict
mode. No input, profile field, or setting may override either value.

---

## 10. Safety considerations

- The control only ever makes a distance **longer or equal**, never shorter:
  `+20%` penalty in the worse direction, `max(…)` floor in the better direction.
  No path can produce an optimistic (shorter-than-POH) figure.
- The `blocked` branch is fail-**safe** by type: no distance escapes a beyond-cap
  or invalid-input operating point into a Go/No-Go advisory.
- The 10% boundary is inclusive (penalised) and the breach is strict-`>`
  (blocked), matching the requirement wording and UJ-C-001's 11,000 ft-vs-11,100 ft
  distinction.
- Degenerate (`max ≤ 0`) axes block rather than divide by zero.
- The module performs no rounding — display rounding is a P2/UI concern; the
  pilot-facing decision is made on the unrounded penalised value.

---

## 11. Traceability & implementation status

| Layer | Tag(s) | State |
| :---- | :----- | :---- |
| Hazard | H-007, H-012, H-013 | — |
| Requirement | REQ-PF-010, REQ-PF-011, REQ-PF-012 | Approved |
| Design | this document | Baseline |
| Implementation (P1) | IMP-PF-CORE-006…011 (`performance.extrapolation.ts`) | **Done** — cap/penalty/floor/state + fail-safe facade |
| Journey | UJ-C-001 (Hot & High + Extrapolation), UJ-E-003 (Deep Winter floor) | authored |
| E2E | UJ-C-001, UJ-E-003 | **Pending** — needs the Performance UI module + acknowledgment-gate (§8) |

The P1 control (cap / +20% penalty / Minimum-Distance floor / `requiresAcknowledgment`
state) is implemented and unit-tested. The runtime enforcement of §8 (a result
that is *not accepted* without explicit acknowledgment) and the UJ-C-001 / UJ-E-003
E2E coverage depend on the Performance UI module, which is tracked separately and
is **not** part of this design artifact.
