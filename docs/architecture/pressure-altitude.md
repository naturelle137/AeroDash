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
  `PA = 145366.45 × (1 − (P / 1013.25)^n)` ft, `P` station pressure in hPa (mb).
- [Altimeter setting](https://www.weather.gov/media/epz/wxcalc/altimeterSetting.pdf):
  `A = (P − 0.3) × (1 + (1013.25^n × 0.0065 / 288) × h / (P − 0.3)^n)^(1/n)`,
  `h` station elevation in m.

Both sheets use the same station pressure `P`. Taking the pilot-entered QNH as
the setting `A` and solving the second equation for `P` gives

`P = (QNH^n − 1013.25^n × 0.0065 / 288 × h)^(1/n) + 0.3`

which the first equation turns into PA. The 0.3 hPa term is kept exactly as
published; AeroDash attaches no further meaning to it. This inversion is
algebraically exact: a station pressure taken through the altimeter-setting
sheet and back is recovered, and the result equals that pressure's NWS
pressure altitude (see reference cases).

Consequence: with QNH 1013.25 hPa at 0 ft the result is −8.19 ft, not 0 ft.
Compared with the simpler idealized relation `Elevation + 145366.45 × (1 −
(QNH / 1013.25)^n)`, which ignores the 0.3 hPa term, the result is between
7.3 ft and 15.3 ft lower across the whole input domain (−7.34 ft at
1100 hPa/−1500 ft, −15.26 ft at 850 hPa/15000 ft; Python `decimal` grid in
5 hPa × 250 ft steps). The idealized relation is not used because it does not
follow from the cited sheets.

The model assumes QNH is the current altimeter setting for the aerodrome and
the entered elevation is where PA is needed; it does not model non-standard
temperature, observation rounding or position on the aerodrome. It is no
aircraft model and does not make performance tables applicable. Constants are
registered in [data constants](../data_constants/README.md); metres convert
through `FT_TO_M = 0.3048`.

The former linear rule `PA = Elevation + (1013.25 − QNH) × 30` is an
approximation (the model slope near 1013.25 hPa is ≈27.3 ft/hPa). It understates
PA above standard pressure (QNH 1050 hPa at 0 ft: −1102.5 ft versus
−996.8 ft), so it is not used.

## Domain and warnings

| Input | Accepted | Rejected with reason |
| :--- | :--- | :--- |
| QNH | decimal, `hPa`, 850–1100 hPa | empty, nonfinite, other unit, outside range |
| Field elevation | decimal, `ft` or `m`, −1500 to 15000 ft (−457.2 to 4572.0 m) | empty, nonfinite, no unit, outside range |

These are software input bounds for ordinary aerodrome use, not model limits,
chosen so every accepted result lies between about −3800 ft and
+19770 ft. Other pressure units (inHg, mmHg) need a cited conversion and
are not offered. Separately, QNH outside 950–1100 hPa emits warning
`WARN-UI-001` (REQ-UI-008) and does not block.

## Reference cases

Expected values were computed independently with Python `decimal` (40 digits),
not with the module under test:

| QNH (hPa) | Elevation | PA (ft) |
| :--- | :--- | :--- |
| 1013.25 | 0 ft | −8.188777 |
| 1000 | 0 ft | 355.368070 |
| 950 | 0 ft | 1763.402729 |
| 1050 | 0 ft | −996.784081 |
| 1000 | 457.2 m | 1854.993736 |
| 1013.25 | 1000 ft | 991.567192 |
| 1030 | −1240 ft | −1702.026273 |

Same-station-pressure round trips (station pressure and elevation → NWS
altimeter setting → derived station pressure and PA) recover `P` and its NWS PA
to better than 10⁻⁶ ft, including at negative elevation:

| Station P (hPa) | Elevation (ft) | Setting A (hPa) | NWS PA of P (ft) |
| :--- | :--- | :--- | :--- |
| 950.3 | 1800 | 1014.274988094126 | 1763.402729357421 |
| 1000 | 0 | 999.7 | 363.644578556939 |
| 980 | 4500 | 1151.105203218686 | 920.001823507912 |
| 1030 | −1240 | 984.506223674033 | −454.231376885259 |
| 1050 | −1500 | 994.377629805917 | −988.828124275084 |

The first row is the review PA-01 case; the idealized relation gives
1772.030103 ft there.

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
