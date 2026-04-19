# Native Support for Battery-Electric Aircraft

Design reference for the powertrain-aware aircraft flow. Covers the wizard, the
fleet editor, and the Mass & Balance view. Companion to
[ADR-009: Powertrain Discriminator](../architecture/adr/009-powertrain-discriminator.md).

---

## 1. The "Shoehorn" Defect

AeroDash's original aircraft schema models mass migration via fuel tanks drained
through a burn sequence. The default load-station editor surfaces a fuel-tank
toggle, a fuel-type selector (MoGas / AvGas / Jet A-1 / …), an unusable-fuel
field, and a burn-sequence editor. The Mass & Balance view renders a
"Fuel & Endurance" card whose endurance row reads energy out of fuel mass.

This shape is correct for the piston / turbine GA majority. It is **wrong** for
battery-electric airframes. A Pipistrel Velis Electro (ICAO `PIVE`) has no
fuel. Its battery pack mass is a fixed contribution to Basic Empty Mass that
does not change in flight. Treating the pack as a "fuel tank with zero burn"
leaves every downstream field staring at nonsense: no fuel type, no density,
no reserve volume, no burn sequence, no CG migration.

> *"Do not try to fit an electric plane in the classical fuel schema. We want
> to show a native support of electric."* — Carsten, issue #225

The UX problem is not "add more fields." It is: **combustion pilots must never
see battery fields, and electric pilots must never see fuel fields.** Mixed UI
invites invalid data, calculation errors, and the pilot deciding we do not
understand their airframe.

---

## 2. Design Principles

1. **One choice, everywhere.** The powertrain is picked once (in the Identity
   step of the wizard) and drives every downstream UI branch. It is never
   inferred at render time from the presence of a battery pack or a fuel tank.
2. **Hide, do not disable.** Fields that do not apply to the current powertrain
   are *absent* from the DOM, not greyed out. Greyed fields still invite
   "why can't I fill this in?" questions.
3. **The catalogue leads, the pilot overrides.** When the pilot picks a known
   electric airframe (Pipistrel Velis Electro today; Bristell Energic,
   eFlyer 2 tomorrow) from the manufacturer / model selector, the powertrain
   flips to `Electric` automatically. The radio group stays interactive so
   one-off or non-catalogued aircraft are still supported.
4. **Combustion is untouched.** The default path for every existing pilot is
   byte-identical to what it was before electric support shipped. No fuel
   control moves, no card is renamed, no extra step is inserted. Legacy
   IndexedDB records rehydrate as `combustion` without a migration pass.
5. **Validation is schema-level.** Cross-field invariants
   (`BATTERY_PACK_REQUIRED_FOR_ELECTRIC`, `BATTERY_PACK_NOT_ALLOWED_FOR_COMBUSTION`,
   `ELECTRIC_AIRCRAFT_HAS_FUEL_TANK`, `RESERVE_EXCEEDS_USABLE_ENERGY`) live in
   the Zod `superRefine`, not in view code. Import/export files with mismatched
   topologies cannot corrupt the fleet.

---

## 3. Flow Map

### 3.1 Aircraft Wizard (`/fleet/new`)

| Step | Combustion | Electric |
| :--- | :--------- | :------- |
| **1 · Identity** | Registration, Manufacturer, Model, ICAO, Reference Datum, **Powertrain = `Combustion`** (default). | Same fields plus **Powertrain = `Electric`** (auto-selected when the model is flagged electric in the catalogue). |
| **2 · Envelope & MTOM** | Category + CG polygon + MTOM / MZFM. Identical for both. | Identical. |
| **3 · Weighing Reports** | BEM, empty CG, weighing date, valid-from. Identical. | Identical. Battery pack mass is included in BEM (it does not migrate in flight). |
| **4 · Load Stations** | Seat / bag rows with arm, limit, unit, default quantity. **Fuel-tank toggle** and **`+ Add Fuel Tank` button** visible. | Seat / bag rows only. Fuel-tank toggle and `+ Add Fuel Tank` button **absent**. Short info note: *"This aircraft is battery-electric — fuel tanks are not applicable. Configure the battery pack in the next step."* |
| **4½ · Battery Pack** | **Step not present.** | Step inserted before Review. Fields: `Usable Energy (kWh)` (required, > 0), `Reserve Floor (kWh)` (required, ≥ 0, < usable energy), `Nominal Voltage (V)` (optional), `Chemistry` (optional free text). Inline error when reserve ≥ usable. |
| **5 · Review & Save** | Lists all entered fields. `Fuel Tanks: N` row visible. | Same review, but `Powertrain: Electric` + `Battery Pack: {usable} kWh (reserve {floor} kWh)` replaces the fuel-tanks row. |

### 3.2 Fleet Editor (`/fleet/:id/edit`)

Mirrors the wizard's section-by-section layout. The powertrain radio is in the
Identity accordion section. Switching powertrain on an existing profile is
allowed in Draft state only; on save, the cross-field guards run and reject
mismatched topologies (fuel tank present for electric, battery pack present for
combustion).

### 3.3 Mass & Balance View

| Element | Combustion | Electric |
| :------ | :--------- | :------- |
| Page subtitle | `… · Fuel` | `… · Energy` |
| "Fuel & Endurance" card title | unchanged | renamed to `Energy & Endurance` |
| Fuel-mass CG migration chart | rendered | not rendered (the schema guarantees no fuel tanks exist, so the migration series is empty by construction) |

The fuel-type selector, fuel-density density correction, and burn-sequence
picker do not appear for electric aircraft because they have no load points
flagged as fuel tanks.

---

## 4. Catalogue Hint

The aircraft model catalogue (`aircraft-model-catalogue.json`) gains an
optional `powertrain` hint per row. Legacy combustion rows omit the hint (which
maps to the wizard's combustion default). The Pipistrel Velis Electro row ships
with `"powertrain": "electric"`.

```json
{
  "id": "pipistrel-velis-electro",
  "manufacturer": "Pipistrel",
  "model": "Velis Electro",
  "icaoTypeDesignator": "PIVE",
  "powertrain": "electric"
}
```

When the pilot picks `Pipistrel` → `Velis Electro`, the Identity section reads
the hint via `getPowertrainHintFor(manufacturer, model)` and patches the
powertrain in the wizard form. The pilot can still switch back to combustion
if they need to force a non-catalogued variant — the hint is advisory, not
binding. When the pilot picks `Other`, no hint fires and the wizard's current
powertrain selection is preserved.

---

## 5. Error & Validation Copy

Errors surface as inline field-level messages. The copy below is the target —
implementation currently uses the Zod `superRefine` message constants, which
the view maps to these strings.

| Guard | Inline message |
| :---- | :------------- |
| `BATTERY_PACK_REQUIRED_FOR_ELECTRIC` | "Battery pack is required for an electric aircraft." |
| `BATTERY_PACK_NOT_ALLOWED_FOR_COMBUSTION` | "Combustion aircraft cannot carry a battery pack. Remove the pack or switch powertrain to Electric." |
| `RESERVE_EXCEEDS_USABLE_ENERGY` | "Reserve floor must be below usable energy." |
| `ELECTRIC_AIRCRAFT_HAS_FUEL_TANK` | "Electric aircraft cannot carry fuel tanks. Remove the fuel tank or switch powertrain to Combustion." |

---

## 6. Out of Scope at v1

- **Multi-pack topologies** (redundant strings, motor-glider hybrids). A single
  pack per airframe at v1.
- **State-of-charge (SoC) modelling in flight** and in-flight energy endurance
  calculation. The Battery Pack nameplate + reserve floor are stored; endurance
  math on top of them is tracked separately (future FE work).
- **Hybrid powertrain** (electric + combustion on the same airframe). Would
  require a new enum value and a new cross-field guard — deliberately kept
  out of v1 so the two-option choice stays simple for pilots.
- **Battery-health derating** (cycle count, SoH, temperature correction). The
  optional `nominalVoltage` and `chemistry` fields are the on-ramp, but no
  math reads them yet.

---

## 7. Traceability

| Requirement | What it guarantees |
| :---------- | :----------------- |
| [REQ-AD-020](../requirements/detailed_aircraft_data.md#REQ-AD-020) | Powertrain discriminator on every profile, with combustion default for legacy records. |
| [REQ-AD-021](../requirements/detailed_aircraft_data.md#REQ-AD-021) | Battery pack record (usable / reserve / voltage / chemistry) while electric. |
| [REQ-AD-022](../requirements/detailed_aircraft_data.md#REQ-AD-022) | Schema-level rejection of mixed topologies (fuel tank on electric, battery pack on combustion). |
| [REQ-UI-021](../requirements/user_interface.md#REQ-UI-021) | Powertrain selector in the wizard, catalogue-hint pre-selection with override. |
| [REQ-UI-022](../requirements/user_interface.md#REQ-UI-022) | Gated editor sections: fuel UI hidden for electric, battery UI hidden for combustion. |
| [REQ-FE-006](../requirements/fuel_endurance.md#REQ-FE-006) | Energy & Endurance card title + suppression of fuel-tank rows in M&B for electric. |
| [UJ-A-004](../journeys/01_fleet_management.md#UJ-A-004) | Adding a Pipistrel Velis Electro end-to-end journey. |
| [ADR-009](../architecture/adr/009-powertrain-discriminator.md) | Why discriminator + `superRefine` over a discriminated union. |
