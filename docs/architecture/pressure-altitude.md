# Pressure altitude from QNH and field elevation

Performance lookup needs pressure altitude (PA) in ft. The pilot explicitly
chooses one of two methods; there is no default:

- **Direct**: the PA text is passed unchanged to the raw table lookup.
- **QNH and field elevation**: P1 `core/logic/pressure-altitude.ts` derives PA.

Switching method never overwrites the other method's input. Field elevation is
never treated as PA.

## Model and source

The model inverts the QNH relationship in [ICAO Doc 9837, second edition
2011, amendment 2 (23 June 2017), §9.2.2, printed page 9–2](https://amc.namem.gov.mn/wp-content/uploads/ICAO/31.%209837_cons_en_2017.pdf):

`QNH = 1013.25 × [1 − 0.0065 × (H − Href) / 288.15]^5.25588`

Here `H` is station pressure altitude and `Href` is field elevation, in m.
Solving for `H` and converting metres with `FT_TO_M = 0.3048` gives

`PA_ft = elevation_ft + [288.15 / (0.0065 × 0.3048)] × [1 − (QNH_hPa / 1013.25)^(1 / 5.25588)]`.

This also follows from [WMO-No. 8, seventh edition 2008, Part II §2.9.1,
printed pages II.2–12/13](https://www.weather.gov/media/epz/mesonet/CWOP-WMO8.pdf):
convert QFE to pressure altitude, subtract field elevation and invert the
standard-atmosphere curve to obtain QNH. The additive inverse above is our
mathematical inference from that procedure. These dated technical sources
were checked on 2026-11-17; they are not a claim of current legal authority.

Use the consistent reference temperature 288.15 K, lapse rate 0.0065 K/m,
pressure exponent 5.25588 and standard pressure 1013.25 hPa. At exactly
1013.25 hPa PA equals field elevation. At 1013 hPa PA is 6.828285 ft above it;
1013 and 1013.25 are not interchangeable. No clamping to elevation is applied.

This replaces the former paired [NWS altimeter-setting](https://www.weather.gov/media/epz/wxcalc/altimeterSetting.pdf)
and [pressure-altitude](https://www.weather.gov/media/epz/wxcalc/pressureAltitude.pdf)
station-pressure reduction. Its published 0.3 hPa term was transcribed correctly,
but that reduction was unsuitable for this QNH contract: at 1013.25 hPa and
0 ft it gave −8.188777 ft. An algebraic round trip did not establish applicability.
The replacement uses neither that offset nor its 288 K/0.190284 coefficients.
The linear 30 ft/hPa approximation is also not used.

The model assumes current aerodrome QNH and elevation at the point where PA is
needed. It does not correct non-standard temperature, observation rounding or
position on the aerodrome. It is not an aircraft model and does not make a
performance table applicable. Constants are registered in
[data constants](../data_constants/README.md).

## Domain and warnings

| Input | Accepted | Rejected with reason |
| :--- | :--- | :--- |
| QNH | decimal, `hPa`, 850–1100 hPa | empty, nonfinite, other unit, outside range |
| Field elevation | decimal, `ft` or `m`, −1500 to 15000 ft (−457.2 to 4572.0 m) | empty, nonfinite, no unit, outside range |

These are software input bounds for ordinary aerodrome use, not model limits,
chosen so every accepted result lies between about −3800 ft and
+19782 ft. Other pressure units (inHg, mmHg) need a cited conversion and
are not offered. Separately, QNH outside 950–1100 hPa emits warning
`WARN-UI-001` (REQ-UI-008) and does not block.

## Reference cases

Expected values are independently computed with Python `decimal` at 50-digit
precision, then frozen in P1 tests. The 28 cases combine QNH 850, 950, 1000,
1013, 1013.25, 1050 and 1100 hPa with elevations −1500, 0, 1000 and 15000 ft;
every case is also checked in metres within 0.001 ft. Synthetic software
reference cases establish arithmetic, never operational aircraft validation.

| QNH (hPa) | Elevation (ft) | PA (ft) | Display (ft) |
| :--- | :--- | :--- | :--- |
| 850 | 0 | 4781.166012 | 4782 |
| 950 | 0 | 1772.759455 | 1773 |
| 1000 | 0 | 363.794043 | 364 |
| 1013 | 0 | 6.828285 | 7 |
| 1013.25 | 0 | 0 | 0 |
| 1050 | 0 | −989.234046 | −989 |
| 1100 | −1500 | −3791.057207 | −3791 |

Display rounds toward positive infinity to whole ft, including negative PA;
negative zero is normalized. This is an explicit PA display decision under
REQ-PF-057, not an existing UQ-004 rounding rule. It is conservative with
respect to PA only, not proof that an arbitrary aircraft table is monotonic.
The unrounded PA reaches lookup; table axes and aircraft distances are unchanged.

## State and invalidation

P2 `modules/performance/composables/pressure-altitude-input.ts` keeps method,
inputs and provenance only in the mounted Performance view and never persists
them. A reload, navigation or "Delete all local data" therefore leaves no derived
PA. The saved [manual runway](manual-runway-entry.md) elevation is copied, with
its original value and unit, only when the pilot presses **Use saved manual
runway elevation**. The copy is labelled with its runway; editing, re-saving or
clearing that runway removes a still-unchanged copy, and a pilot edit makes it
pilot-entered. Any change of method, value, unit or provenance clears displayed
raw distances. The displayed PA is rounded toward positive infinity to whole ft; the lookup uses the
unrounded value.
