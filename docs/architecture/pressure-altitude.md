# Pressure altitude from QNH and field elevation

Performance lookup needs pressure altitude (PA) in ft. The pilot explicitly
chooses one of two methods; there is no default:

- **Direct**: the PA text is passed unchanged to the raw table lookup.
- **QNH and field elevation**: P1 `core/logic/pressure-altitude.ts` derives PA.

Switching method never overwrites the other method's input. Field elevation is
never treated as PA.

## Model and source

The NOAA/NWS (El Paso) formula sheets define, with `n = 0.190284`:

- [Pressure altitude](https://www.weather.gov/media/epz/wxcalc/pressureAltitude.pdf):
  `h_alt = 145366.45 × (1 − (P / 1013.25)^n)` ft, `P` station pressure in hPa (mb).
- [Altimeter setting](https://www.weather.gov/media/epz/wxcalc/altimeterSetting.pdf):
  `A = (P − 0.3) × (1 + (1013.25^n × 0.0065 / 288) × h / (P − 0.3)^n)^(1/n)`,
  `h` station elevation in m.

Solving the second for the pressure at field elevation and substituting into the
first gives

`PA(ft) = Elevation(ft) + 145366.45 × (1 − (QNH(hPa) / 1013.25)^0.190284)`.

The inversion is exact for that standard-atmosphere definition of the setting.
It assumes QNH is the current altimeter setting for the aerodrome and the entered
elevation is where PA is needed; it does not model non-standard temperature,
observation rounding or position on the aerodrome. It is no aircraft model and
does not make performance tables applicable. Constants are registered in
[data constants](../data_constants/README.md); metres convert through
`FT_TO_M = 0.3048`.

The former linear rule `PA = Elevation + (1013.25 − QNH) × 30` is an
approximation (the model slope at 1013.25 hPa is ≈27.3 ft/hPa). It understates
PA above standard pressure (QNH 1050 hPa: −1102.5 ft versus −988.8 ft), so it is
not used.

## Domain and warnings

| Input | Accepted | Rejected with reason |
| :--- | :--- | :--- |
| QNH | decimal, `hPa`, 850–1100 hPa | empty, nonfinite, other unit, outside range |
| Field elevation | decimal, `ft` or `m`, −1500 to 15000 ft (−457.2 to 4572.0 m) | empty, nonfinite, no unit, outside range |

These are software input bounds for ordinary aerodrome use, not model limits,
chosen so every accepted result lies between about −3800 ft and
+19800 ft. Other pressure units (inHg, mmHg) need a cited conversion and
are not offered. Separately, QNH outside 950–1100 hPa emits warning
`WARN-UI-001` (REQ-UI-008) and does not block.

## Reference cases

Expected values were computed independently with Python `decimal` (40 digits):

| QNH (hPa) | Elevation | PA (ft) |
| :--- | :--- | :--- |
| 1013.25 | 0 ft | 0 |
| 1000 | 0 ft | 363.644579 |
| 950 | 0 ft | 1772.030170 |
| 1050 | 0 ft | −988.828124 |
| 1000 | 457.2 m | 1863.644579 |
| 1030 | −1240 ft | −1694.231377 |

A round trip through the NWS altimeter-setting formula (station pressure and
elevation → QNH → PA) recovers the NWS station PA within 0.001 ft.

## State and invalidation

P2 `modules/performance/composables/pressure-altitude-input.ts` keeps method,
inputs and provenance only in the mounted Performance view and never persists
them. A reload, navigation or "Delete all local data" therefore leaves no derived
PA. The saved [manual runway](manual-runway-entry.md) elevation is copied, with
its original value and unit, only when the pilot presses **Use saved manual
runway elevation**. The copy is labelled with its runway; editing, re-saving or
clearing that runway removes a still-unchanged copy, and a pilot edit makes it
pilot-entered. Any change of method, value, unit or provenance clears displayed
raw distances. The displayed PA is rounded to whole ft; the lookup uses the
unrounded value.
