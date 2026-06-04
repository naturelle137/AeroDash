<!-- @DES-ARCH-019@ (FROM: @REQ-PF-004@, @REQ-PF-006@, @REQ-PF-007@, @REQ-PF-015@, @REQ-PF-016@) -->
# Performance Safety-Factor Pipeline Contract

**Module:** Performance (P1 Safety Core)
**Status:** Baseline — v0.4.0-alpha milestone (Performance Math Core)
**Refs:** REQ-PF-004 · REQ-PF-006 · REQ-PF-007 · REQ-PF-015 · REQ-PF-016 | H-008 · H-016 | IMP-PF-CORE-006…

---

## 1. Purpose

This document specifies how the four base POH distances (TOR, TOD, LR, LD,
produced by [`computePohDistances`](./performance-bilinear-interpolation-contract.md#94-computepohdistancesprofile-conditions--verified-only-facade))
are turned into **operational required distances**, compared against the
available runway, and surfaced as Go/No-Go violations and a safety margin.

It is the correctness baseline for `performance.safety-factor.ts` and the
contract its unit tests assert against.

The pipeline is **pure** and **deterministic**: identical inputs always
produce identical outputs, with no I/O and no side effects.

---

## 2. Inputs

All distances are in metres (m); all factors are dimensionless multipliers.
Unit normalisation is the caller's responsibility (same contract as the
bilinear engine).

| Field | Type | Constraint |
| :---- | :--- | :--------- |
| `base.takeoffRoll` (TOR₀) | `number` | finite, > 0 (m) |
| `base.takeoffDistance50ft` (TOD₀) | `number` | finite, > 0 (m) |
| `base.landingRoll` (LR₀) | `number` | finite, > 0 (m) |
| `base.landingDistance50ft` (LD₀) | `number` | finite, > 0 (m) |
| `factors.friction` (f) | `number` | finite, > 0 — ground roll only |
| `factors.slope` (s) | `number` | finite, > 0 — ground roll only |
| `factors.densityAltitude` (d) | `number` | finite, > 0 — full distance |
| `factors.wind` (w) | `number` | finite, > 0 — full distance |
| `osf.preset` | `'easa-standard' \| 'poh-afm' \| 'short-field' \| 'custom'` | — |
| `osf.customMultiplier` | `number?` | required when `preset === 'custom'`; `1.00 ≤ m ≤ 3.00` (REQ-PF-006) |
| `osf.pohMandatedFactor` | `{ takeoff?: number; landing?: number }?` | finite, ≥ 1.0 when present (same floor as `customMultiplier`) |
| `available.takeoff` (Aₜₒ) | `number` | finite, ≥ 0 (m) — TORA |
| `available.landing` (A_ld) | `number` | finite, ≥ 0 (m) — LDA |

The factor **values** themselves (POH-vs-FSM 3/75 derivation, REQ-PF-003) are
out of scope here — this pipeline *applies* already-derived factors.
Extrapolation cap / 20 % penalty / benefit capping (REQ-PF-010/011) are applied
upstream by the POH-distance facade before the base distances reach this module.

---

## 3. Correction Application Isolation (REQ-PF-004)

Combined factors:

```text
g = friction × slope            (ground-roll correction)
e = densityAltitude × wind      (full-distance correction)
```

**Ground-roll distances** (TOR, LR) — friction/slope **and** DA/wind apply to
the whole value:

```text
TOR_req = TOR₀ × g × e × osf_takeoff
LR_req  = LR₀  × g × e × osf_landing
```

**Full distances** (TOD, LD) — friction/slope apply **only to the ground-roll
portion**; the airborne climb segment is exempt (REQ-PF-004 rationale: *"friction
does not affect the airborne climb segment"*). DA/wind apply to the entire
distance:

```text
airborne_TO = max(0, TOD₀ − TOR₀)
TOD_req     = (TOR₀ × g + airborne_TO) × e × osf_takeoff

airborne_LD = max(0, LD₀ − LR₀)
LD_req      = (LR₀ × g + airborne_LD) × e × osf_landing
```

Properties:

- When `g = 1` (no friction/slope correction) the full distance reduces to
  `TOD₀ × e × osf` — friction/slope are a no-op, as required.
- `TOD_req ≥ TOR_req` and `LD_req ≥ LR_req` for all valid inputs (the airborne
  term is non-negative and `e, osf > 0`), so the corrected full distance can
  never collapse below its own ground roll. The `max(0, …)` guard makes a
  malformed `TOD₀ < TOR₀` profile degrade safely to `TOD_req = TOR_req`
  rather than invert.

---

## 4. Operational Safety Factor presets (REQ-PF-006)

`resolveOsf(preset, operation)` returns the multiplier applied above:

| Preset | Takeoff | Landing |
| :----- | :------ | :------ |
| `easa-standard` | 1.25 | 1.43 |
| `short-field` | 1.25 | 1.15 |
| `poh-afm` | `pohMandatedFactor.takeoff ?? 1.25` | `pohMandatedFactor.landing ?? 1.43` |
| `custom` | `customMultiplier` | `customMultiplier` |

Decision **D3**: no sub-baseline short-field *takeoff* factor is defined by
REQ-PF-006 (only short-field *landing* 1.15). Short-field takeoff therefore
retains the 1.25 regulatory baseline. Because short-field landing (1.15) is
below the 1.43 landing baseline, selecting it correctly raises WARN-PF-002
(§6) — consistent with H-016 (pilot lowering the safety factor).

Decision **D4**: `poh-afm` falls back to the regulatory baseline when the
profile carries no POH-mandated factor for that operation.

---

## 5. Go/No-Go gate & Runway Insufficient (REQ-PF-015 → CRIT-PF-002)

The **operational required distance** that gates Go/No-Go for an operation is
the **full** distance over the 50 ft obstacle (TOD for takeoff, LD for
landing) — the limiting distance. Decision **D2**: gating on the full distance
(not the shorter ground roll) is the conservative choice for H-008 — it can
never produce a false *Go* relative to gating on the ground roll. The
ground-roll required distances are still returned for display.

```text
takeoff.insufficient  = TOD_req > available.takeoff
landing.insufficient  = LD_req  > available.landing
```

Each `insufficient` operation emits a `RUNWAY_INSUFFICIENT` violation
(notification id **CRIT-PF-002**, CRITICAL, **blocking**). The aggregate gate:

```text
goNoGo = (no blocking violation present)
```

Boundary: `required === available` is **sufficient** (margin 0) — not a
violation. Strictly `>` triggers CRIT-PF-002.

---

## 6. Low Safety Factor Warning (REQ-PF-016 → WARN-PF-002)

Per operation, the warning threshold is the greater of the POH-mandated factor
and the regulatory baseline (Takeoff 1.25, Landing 1.43):

```text
baseline(takeoff) = 1.25      baseline(landing) = 1.43
threshold(op)     = max(baseline(op), pohMandatedFactor[op] ?? baseline(op))

warn(op) ⟺ resolveOsf(op) < threshold(op)
```

A breach emits an `OSF_BELOW_MINIMUM` violation (notification id
**WARN-PF-002**, WARNING, **advisory** — never blocks Go/No-Go). Boundary:
`resolveOsf === threshold` does **not** warn.

---

## 7. Safety Margin (REQ-PF-007)

Per operation, against the **full** operational required distance:

```text
marginAbsolute = available − fullRequired                       (m)
marginPercent  = fullRequired > 0 ? marginAbsolute / fullRequired × 100 : null
```

Decision **D5**: the percentage is the buffer expressed relative to the
required distance ("how much spare runway relative to what is needed"). It is
`null` only for the degenerate `fullRequired ≤ 0` case (no valid required
distance to divide by). A negative margin mirrors `insufficient = true`.

---

## 8. Validation & failure surface

External inputs are validated with Zod **before** any math runs
(`performance.safety-factor.adapter.ts`). A parse failure returns a typed
`failure` carrying an `INVALID_INPUT` violation (notification id
`ERR-SYS-001`) — the function never throws on a call site.

| Rejected | Reason |
| :------- | :----- |
| any non-finite `base` / `factors` / `available` value | not a usable number |
| `base` distance ≤ 0 | zero POH distance has no physical meaning |
| `factor ≤ 0` | a zero/negative correction is optimistic-unsafe |
| `custom` preset without `customMultiplier`, or outside `[1.00, 3.00]` | REQ-PF-006 bound |
| `pohMandatedFactor` < 1.0 when present | sub-unity POH factor would produce a false Go |

---

## 9. Notification mapping

P1 emits raw violations (domain vocabulary); P2 maps them to the centralised
notification contract ([notification_schema.md](./notification_schema.md)).

| Violation `type` | Notification id | Severity | Go/No-Go |
| :--------------- | :-------------- | :------- | :------- |
| `RUNWAY_INSUFFICIENT` | `CRIT-PF-002` | CRITICAL | blocking |
| `OSF_BELOW_MINIMUM` | `WARN-PF-002` | WARNING | advisory |
| `INVALID_INPUT` | `ERR-SYS-001` | ERROR | n/a |

---

## 10. Safety considerations

- The Go/No-Go gate is conservative: it gates on the longer obstacle-clearance
  distance and treats the `required === available` boundary as sufficient by
  the requirement's strict-`>` wording, while `marginAbsolute` exposes the
  zero-margin condition to the UI.
- No corrected distance can be shorter than its own ground roll (§3), so a
  malformed profile degrades safely rather than producing an optimistic value.
- A factor of `0` (which would zero a required distance) is rejected at the Zod
  boundary, not silently applied.
- The module performs no rounding — display rounding is a P2/UI concern
  (`display-rounding.ts`); the pilot-facing Go/No-Go decision is made on the
  unrounded value.
