# ADR-009: Powertrain Discriminator for Aircraft Profiles

* **Status:** Accepted
* **Date:** 2026-04-19

## Context

AeroDash's original aircraft data model assumes every airframe is powered by a
liquid-fuel engine — mass migrates during flight via "fuel tanks" attached to
load points, and endurance is computed from fuel burn against a "burn
sequence" that drains those tanks. That shape maps cleanly onto piston and
turbine GA, which is the overwhelming majority of the fleet today.

It does not map cleanly onto battery-electric airframes. A Pipistrel Velis
Electro (ICAO `PIVE`) carries no fuel at all — its battery pack is a fixed
contribution to Basic Empty Mass that does not migrate in flight. Attempting
to represent the pack as a "fuel tank" with "zero burn" leaves every
downstream consumer (fuel type checkboxes, burn-sequence editor, density
correction, fuel-mass CG migration) staring at nonsense fields.

Product framing from issue #225 is explicit:

> *"Do not try to fit an electric plane in the classical fuel schema. We want
> to show a native support of electric."* — Carsten

The goal of this ADR is to extend the aircraft data model so that electric
aircraft are represented on their own terms while leaving the combustion
majority untouched.

## Considered Options

* **Option 1 — Single schema, optional battery pack, optional fuel tanks.**
  Add both `fuelTank` (already present) and an optional `batteryPack` field.
  No discriminator. Consumers decide at render time whether a profile is
  electric by inspecting whether a battery pack is present. Rejected because
  it pushes the classification into every consumer and makes the "combustion
  profile with a stray battery pack" state representable.

* **Option 2 — Zod discriminated union.** Split `AircraftProfileSchema` into
  `CombustionAircraftProfileSchema` and `ElectricAircraftProfileSchema`
  sharing a `powertrain` literal discriminator. Type-level guarantees are
  maximal. Rejected because `AircraftProfile` already has 15+ optional sister
  fields (wind limits, surface conditions, performance profiles, checklist
  scaffolds, safety factors…) and duplicating them across two branches
  inflates the surface area dramatically for a change that fundamentally
  only affects two fields.

* **Option 3 — Flat discriminator + `superRefine` cross-field guard
  (chosen).** Add `powertrain: z.enum(['combustion', 'electric']).default('combustion')`
  and `batteryPack: BatteryPackSchema.optional()`. Cross-field consistency
  (battery pack required iff electric, fuel tank forbidden for electric,
  reserve floor strictly below usable energy) is enforced via `superRefine`.
  The rest of the schema is untouched.

## Decision

We take **Option 3**.

The discriminator is `powertrain: 'combustion' | 'electric'`, defaulting to
`'combustion'` on parse. The default matters: every pre-electric
IndexedDB record written by earlier builds of the app is missing the field,
and defaulting on parse means those records rehydrate without any explicit
migration write. The schema version stays at `1`.

Electric profiles carry a single `batteryPack` object:

```ts
type AircraftProfileBatteryPack = {
  usableEnergyKwh: number   // > 0
  reserveFloorKwh: number   // >= 0, < usableEnergyKwh
  nominalVoltage?: number   // optional; future derating lookups
  chemistry?: string        // optional free text, e.g. "LiFePO4"
}
```

A multi-pack topology (redundant strings, hybrid motor-gliders) is deferred.
One pack per airframe at v1.

Cross-field guards live in `AircraftProfileSchema.superRefine()`:

* `BATTERY_PACK_REQUIRED_FOR_ELECTRIC` — electric profile with no pack.
* `BATTERY_PACK_NOT_ALLOWED_FOR_COMBUSTION` — combustion profile with a pack.
* `RESERVE_EXCEEDS_USABLE_ENERGY` — pack where `reserveFloorKwh >= usableEnergyKwh`.
* `ELECTRIC_AIRCRAFT_HAS_FUEL_TANK` — electric profile whose load points
  carry a `fuelTank` extension.

UI consumers branch on `powertrain`:

* **Wizard step 1 (Identity):** new Powertrain radio group. The aircraft
  model catalogue carries an optional `powertrain` hint (e.g. the Velis
  Electro entry sets `powertrain: 'electric'`) and auto-selects the matching
  radio when the pilot picks a known electric airframe. The hint is
  advisory — pilots can override.
* **Wizard step 4 (Load Stations):** hides the "+ Add Fuel Tank" button and
  the "This station is a fuel tank" toggle when `powertrain === 'electric'`.
* **Wizard step 4½ (Battery Pack):** appears only for electric. Hosts the
  usable-energy / reserve-floor / voltage / chemistry form.
* **Mass & Balance view:** the "Fuel & Endurance" card is re-titled to
  "Energy & Endurance" when the active aircraft is electric, and the sticky
  strip chip follows the same rename. The fuel-migration chart never fires
  for electric because the schema guarantees no fuel tanks exist.

The P1 Safety Core exposes the discriminator via `AircraftContext.powertrain`
so Mass & Balance violation vocabulary can branch without consulting the
catalogue or fleet store.

## Consequences

### Positive

* Legacy profiles rehydrate unchanged — no migration pass needed.
* The UI surface stays honest: combustion pilots never see battery fields;
  electric pilots never see fuel fields.
* Cross-field invariants are enforced at the schema layer so import/export
  files with mismatched topologies cannot corrupt the fleet.
* Clean extension point for future non-combustion powertrains (hybrid,
  hydrogen): add a new literal to the enum and a new optional sub-entity,
  fold its cross-field rules into `superRefine`.
* The catalogue's `powertrain` hint gives the pilot a natural on-ramp — pick
  Velis Electro and the wizard flips into electric mode without confusing
  radio gymnastics.

### Negative

* `superRefine` error messages are less structured than a discriminated
  union. Consumers currently pattern-match on the literal message strings
  (`BATTERY_PACK_REQUIRED_FOR_ELECTRIC` etc.), which is a weaker contract
  than a typed union. Acceptable at this scale — the constants are tested
  and referenced in the schema spec.
* Callers that use `AircraftProfile['batteryPack']` without checking
  `powertrain` first see an `optional` type and may defensively handle the
  `undefined` case even for electric profiles, which is impossible in
  practice. Encapsulating the access behind a helper would fix that but
  isn't strictly necessary at v1.
* Adding a third powertrain later (e.g. hybrid) will need its own
  cross-field guard rather than a free branch.

## Compliance

Not a safety-critical calculation change. The discriminator threads
cleanly through the Mass & Balance contract (`AircraftContext.powertrain`)
so P1 code can branch notification vocabulary without importing catalogue
data. All added schema fields have Zod validation; electric profiles
cannot bypass the cross-field guards through the import/export path.
