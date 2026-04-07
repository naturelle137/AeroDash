<!-- @DES-ARCH-006@ (FROM: @REQ-PF-002@) -->

# Performance Bilinear Interpolation Contract

**Module:** Performance (P1 Safety Core)
**Status:** Baseline — v0.3.0 milestone exit criterion
**Refs:** REQ-PF-002 | IMP-PF-CORE-001 | issues #155, #169

---

## 1. Purpose

This document specifies the bilinear interpolation algorithm used to derive
aircraft performance distances (TOR, TOD, LR, LD) from 2-D POH lookup tables.
It forms the **correctness baseline** for v0.4.0 performance distance
calculations. The canonical test vectors in
`frontend/src/core/logic/performance.bilinear-interpolation.spec.ts`
are derived from this contract and serve as the CI gate.

---

## 2. Scope

The algorithm applies to any POH distance table whose output is a function of
two continuous variables: **aircraft mass** (kg) and **pressure altitude** (ft).

Four distance types are in scope:

| Symbol | Name | Unit |
| :----- | :--- | :--- |
| TOR | Takeoff Roll | m |
| TOD | Takeoff Distance to 50 ft obstacle | m |
| LR | Landing Roll | m |
| LD | Landing Distance from 50 ft obstacle | m |

---

## 3. Input Contract

### 3.1 `PerformanceTable`

| Field | Type | Constraint |
| :---- | :--- | :--------- |
| `massAxis` | `number[]` | ≥ 1 entry; strictly ascending; unit: **kg** |
| `altitudeAxis` | `number[]` | ≥ 1 entry; strictly ascending; unit: **ft pressure altitude** |
| `values` | `number[][]` | Dimensions: `altitudeAxis.length × massAxis.length`; unit: **m** |

`values[altitudeIndex][massIndex]` is the distance at that (altitude, mass)
grid point. The table need not be uniform; non-uniform grid spacing is
supported.

### 3.2 `BilinearLookupInput`

| Field | Type | Constraint |
| :---- | :--- | :--------- |
| `mass` | `number` | kg; any finite value |
| `pressureAltitude` | `number` | ft; any finite value |
| `table` | `PerformanceTable` | Validated at entry |

---

## 4. Output Contract

### 4.1 `BilinearLookupResult`

| Field | Type | Meaning |
| :---- | :--- | :------ |
| `distance` | `number` | Interpolated distance (m) |
| `massClamped` | `boolean` | Input mass was outside table range |
| `altitudeClamped` | `boolean` | Input altitude was outside table range |

A `distance` value is always returned; it is never `NaN` or `Infinity` for a
valid table.

---

## 5. Algorithm

### 5.1 Validation

Before interpolation, the algorithm validates:

1. `massAxis.length ≥ 1`
2. `altitudeAxis.length ≥ 1`
3. `values.length === altitudeAxis.length`
4. For each row `i`, `values[i].length === massAxis.length`

Any violation throws an `Error` with prefix `[PF-BILINEAR]`.

### 5.2 Boundary Clamping

**Rule:** When an input is outside the table range it is clamped to the
nearest boundary value.

```text
clampedMass = clamp(mass, massAxis[0], massAxis[last])
clampedAlt  = clamp(pressureAltitude, altitudeAxis[0], altitudeAxis[last])
```

`massClamped` / `altitudeClamped` are set to `true` whenever clamping occurs.

**Rationale:** POH tables are defined for the certified envelope of the
aircraft. Extrapolation outside the table is not validated by the aircraft
manufacturer and is not permitted. Clamping to the boundary entry is
conservative: boundary entries are typically the highest-performance
(longest-distance) values at the edge of the operating envelope.

### 5.3 Degenerate Case (1 × 1 table)

When `massAxis.length === 1` and `altitudeAxis.length === 1` the single table
value is returned directly. No interpolation is performed.

### 5.4 Bilinear Interpolation

Given clamped inputs, locate the surrounding grid cell:

```text
massLo, massHi, tMass = findBounds(massAxis, clampedMass)
altLo,  altHi,  tAlt  = findBounds(altitudeAxis, clampedAlt)
```

where `findBounds` returns the lower index, upper index, and the
interpolation fraction `t ∈ [0, 1]`:

```text
t = (value - axis[lo]) / (axis[hi] - axis[lo])
```

Retrieve the four surrounding values:

```text
z11 = values[altLo][massLo]   (low altitude, low mass)
z12 = values[altLo][massHi]   (low altitude, high mass)
z21 = values[altHi][massLo]   (high altitude, low mass)
z22 = values[altHi][massHi]   (high altitude, high mass)
```

Interpolate along the **mass axis** at each altitude level:

```text
zAtAltLo = lerp(z11, z12, tMass)
zAtAltHi = lerp(z21, z22, tMass)
```

Interpolate along the **altitude axis** between the two mass-interpolated
values:

```text
distance = lerp(zAtAltLo, zAtAltHi, tAlt)
```

where `lerp(a, b, t) = a + t × (b − a)`.

---

## 6. Boundary Conditions Summary

| Scenario | Behaviour |
| :------- | :-------- |
| Input at exact grid point | Returns exact table value (no rounding) |
| Input between two grid points on one axis | 1-D linear interpolation along that axis |
| Input between grid points on both axes | Full bilinear interpolation |
| Input below table minimum | Clamped to minimum; `massClamped` or `altitudeClamped = true` |
| Input above table maximum | Clamped to maximum; same flags |
| Table has a single mass column | Altitude-only 1-D interpolation |
| Table has a single altitude row | Mass-only 1-D interpolation |
| 1 × 1 table | Single value returned; clamping flags still set if inputs differ |
| Malformed table | Throws `Error` prefixed `[PF-BILINEAR]` |

---

## 7. Canonical POH Validation Test Vectors

The following 4 × 3 grid represents synthetic-but-aviation-realistic values
for a C172S-class aircraft (MTOM ≈ 1157 kg, service ceiling ≈ 6000 ft).
Values are consistent across distance types and verified by manual calculation.

### 7.1 TOR (Takeoff Roll) — values in metres

| PA / Mass | 850 kg | 1000 kg | 1157 kg |
| :-------- | :----: | :-----: | :-----: |
| **0 ft** | 210 | 270 | 340 |
| **2000 ft** | 255 | 325 | 410 |
| **4000 ft** | 305 | 390 | 490 |
| **6000 ft** | 365 | 465 | 585 |

### 7.2 TOD (Takeoff Distance to 50 ft) — values in metres

| PA / Mass | 850 kg | 1000 kg | 1157 kg |
| :-------- | :----: | :-----: | :-----: |
| **0 ft** | 340 | 435 | 545 |
| **2000 ft** | 410 | 520 | 655 |
| **4000 ft** | 490 | 625 | 785 |
| **6000 ft** | 585 | 745 | 940 |

### 7.3 LR (Landing Roll) — values in metres

| PA / Mass | 850 kg | 1000 kg | 1157 kg |
| :-------- | :----: | :-----: | :-----: |
| **0 ft** | 185 | 220 | 260 |
| **2000 ft** | 195 | 230 | 275 |
| **4000 ft** | 205 | 245 | 290 |
| **6000 ft** | 215 | 260 | 310 |

### 7.4 LD (Landing Distance from 50 ft) — values in metres

| PA / Mass | 850 kg | 1000 kg | 1157 kg |
| :-------- | :----: | :-----: | :-----: |
| **0 ft** | 315 | 375 | 440 |
| **2000 ft** | 330 | 390 | 465 |
| **4000 ft** | 350 | 415 | 495 |
| **6000 ft** | 365 | 440 | 525 |

### 7.5 Sample hand-computed verifications

**VEC-TOR-008** — Full bilinear at (925 kg, 1000 ft):

```text
t_mass = (925 - 850) / (1000 - 850) = 75 / 150 = 0.500
t_alt  = (1000 - 0)  / (2000 - 0)   = 0.500

z11 = TOR(0 ft,    850 kg) = 210
z12 = TOR(0 ft,   1000 kg) = 270
z21 = TOR(2000 ft, 850 kg) = 255
z22 = TOR(2000 ft,1000 kg) = 325

zAtPA0    = lerp(210, 270, 0.5) = 240.0
zAtPA2000 = lerp(255, 325, 0.5) = 290.0
distance  = lerp(240, 290, 0.5) = 265.0 m
```

**VEC-TOR-009** — Full bilinear at (1078.5 kg, 3000 ft):

```text
t_mass = (1078.5 - 1000) / (1157 - 1000) = 78.5 / 157 = 0.500
t_alt  = (3000 - 2000)   / (4000 - 2000) = 0.500

z11 = TOR(2000 ft, 1000 kg) = 325
z12 = TOR(2000 ft, 1157 kg) = 410
z21 = TOR(4000 ft, 1000 kg) = 390
z22 = TOR(4000 ft, 1157 kg) = 490

zAtPA2000 = lerp(325, 410, 0.5) = 367.5
zAtPA4000 = lerp(390, 490, 0.5) = 440.0
distance  = lerp(367.5, 440.0, 0.5) = 403.75 m
```

---

## 8. Safety Considerations

- Clamping replaces extrapolation — no performance distance is computed beyond
  the certified envelope.
- The `massClamped` and `altitudeClamped` flags must be surfaced to the pilot
  in the performance module UI (future REQ-PF-XXX).
- Negative distances and `NaN` cannot be produced by a valid table and valid
  input; callers must not expect them.
- Unit conversion (lbs to kg, hPa to ft PA, etc.) is the caller's
  responsibility and must happen before calling this function.
- This function is **pure** and **deterministic**: identical inputs always
  produce identical outputs. It has no side effects.
