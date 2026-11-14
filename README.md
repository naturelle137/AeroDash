# AeroDash

[![de](https://img.shields.io/badge/lang-de-green.svg)](README-DE.md)

## Contents

* [Disclaimer](#disclaimer)
* [Project Philosophy](#philosophy)
* [Intended Use & System Limitations](#intendedUse)
* [License](#license)
* [Operational Assumptions](ASSUMPTIONS.md)

<a name="disclaimer"></a>

## ⚠️ Disclaimer

**NO CERTIFIED AVIATION DEVICE.**

IMPORTANT: AeroDash is an open-source flight preparation tool designed for educational and  informational use only. It is **NOT** a substitute for certified aviation data sources (AIP, AFM/POH, Official Weather Briefings). **USE AT YOUR OWN RISK!** Please read the full [Disclaimer](DISCLAIMER.md).

* **NO WARRANTY:** The software is provided "as is", without warranty of any kind.
* **PILOT RESPONSIBILITY:** The Pilot in Command (PIC) retains sole responsibility for the safe conduct of the flight and the verification of all calculated data against the official Aircraft Flight Manual.
* **DATA VALIDITY:** Calculation results rely entirely on user inputs and the accuracy of the underlying aircraft profiles.

<a name="philosophy"></a>

## Project Philosophy

> **"Don't guess. Know. Flight-grade precision for command decisions."**

This guiding principle shapes every architectural decision in AeroDash:

### 🎯 Vision

To eliminate "guesstimation" from General Aviation flight preparation by providing a tool that is as reliable as the aircraft itself.

### 🛡️ Core Values

#### Pilot Authority

* The software is an advisor, never the commander.
* We provide **Decision Support**, not Decision Making.
* We warn critical states visually, but we allow manual overrides for abnormal operations.

#### Conservative Precision

* We prefer conservative approximations over optimistic exactness. Rounding is always applied to the safe side.
* If the POH says it's tight, we tell you it's tight. We prefer a cancelled flight over a calculated risk.
* Calculations are based on verified physics and accepted aviation standards, not UI convenience.

#### Evidence

* Calculations need explicit inputs, limits and independently checked reference cases.
* Synthetic tests check software behavior; aircraft-specific data still requires verification against the actual POH/AFM and weighing report.

<a name="intendedUse"></a>

## Intended Use & System Limitations

### 1. What AeroDash IS

AeroDash is a specialized **Flight Preparation and Decision Support Tool** designed for General Aviation pilots operating under **EASA Part-NCO** (Non-Commercial Operations with Other-than-Complex Motor-Powered Aircraft) rules. Its primary purpose is to determine the feasibility of a planned flight regarding Mass & Balance and Takeoff/Landing Performance before the engine is started.

#### Core Capabilities

* **Go/No-Go Decision Support:** Aims to compare calculated mass, CG and performance against entered aircraft limits; see the current delivery limits below.
* **Aircraft-Specific Data:** Operates on the exact data of a specific airframe (based on its individual Weighing Report and POH), not generic type data.
* **Performance goal:** Combine aircraft POH interpolation with applicable documented correction factors; the Performance view currently inspects four uncorrected POH distances within complete tables’ bounds.
* **Fuel & Endurance:** Flight Preparation uses available tank loads minus unusable fuel with explicit duration/consumption/reserve inputs or direct Trip Fuel in kg. It shows estimated arrival mass and, for exactly one category-available fixed-arm tank without a lookup table, estimated arrival CG in metres. Unsupported CG has a visible reason while valid mass remains available. Duration mode also shows endurance, required fuel and shortages; reserve remains aboard. Neither mode assesses landing suitability or the full burn path/envelope. Inputs clear on aircraft/method changes, leaving the view or reloading. Multi-tank/variable-arm trip CG, tank scheduling and electric endurance remain future work.

#### Target Operational Context

* **Aircraft:** Single Engine Piston (SEP) aircraft (e.g., Diamond DA40, Tecnam P2008, Klemm KL 107).
* **Flight Rules:** VFR (Visual Flight Rules) and private IFR operations.
* **User:** Recreational pilots and flight clubs.

### 2. What AeroDash is NOT

AeroDash explicitly disclaims functionality outside the scope of pre-flight performance calculation. It is **not** a certified Electronic Flight Bag (EFB) for navigation or primary flight guidance.

#### Functional Exclusions

* **No In-Flight Navigation:** The system does not provide moving maps, airspace warnings, or real-time traffic information.
* **No Route Planning:** It does not calculate headings, ground speeds, or wind correction angles for navigation legs. Trip fuel must be calculated externally; AeroDash only checks if the tank capacity covers the requirement.
* **No Briefing Service:** It does not replace the mandatory Pre-Flight Briefing. It does not provide NOTAMs, GAFOR, or Synoptic Weather Charts.

#### Operational Exclusions

* **No Commercial or Complex Operations:** Not intended for Commercial Air Transport (CAT), Non-Commercial Complex (NCC) operations, or High Performance Aircraft (HPA). These operations require specific certified performance tools and adhere to stricter performance classes.
* **No Multi-Engine Support:** The current physics engine does not account for asymmetric thrust scenarios or balanced field length calculations required for MEP/SET/JET operations.

### Limited In-Flight Use (Contingency Only)

While designed for pre-flight use, the system *may* be used in-flight solely for **contingency planning** (e.g., calculating Landing Distances for an unplanned diversion). However, the pilot must prioritize flying the aircraft (`Aviate`) over operating the software.

### 3. Pilot in Command Authority
>
> **"Software calculates, the pilot decides."**

AeroDash processes data based on user inputs. It cannot verify the physical reality (e.g., it cannot know if the fuel tank is actually full). The Pilot in Command (PIC) retains sole responsibility for:

1. Verifying that the aircraft profile data matches the physical AFM/POH.
2. Ensuring input values (Weight, Temperature, Wind) reflect reality.
3. Applying additional safety margins as required by Airmanship.

<a name="license"></a>

## License

AeroDash uses **dual licensing**:

* **Source code** (for example the `frontend/` application, scripts, and configuration used to build and run the software) is licensed under the **[European Union Public Licence (EUPL) v. 1.2](LICENSE)**.
* **Documentation** (Markdown under `docs/` and Markdown at the repository root such as this README, requirements, journeys, and guides) is licensed under **[Creative Commons Attribution-ShareAlike 4.0 International](LICENSE-DOCUMENTATION)** (CC BY-SA 4.0).

## 🚀 Roadmap

See the full development roadmap here:
👉 [docs/development/roadmap.md](docs/development/roadmap.md)

## Current delivery limits

The current frontend provides local aircraft management, M&B preparation and raw POH table inspection. Import your own sourced tables in Fleet, review original and normalized points (source units: kg/lb, ft/m, °C/°F, m/ft), explicitly verify the Draft, then select the snapshot in Performance and enter kg/ft/°C. Invalid or out-of-envelope lookups are blocked. Performance also saves a user-entered runway (TORA/LDA, field elevation, surface condition, explicit m/ft) offline; it is not airport-validated and not yet compared. No default performance tables, operational factors or runway assessment are supplied. Weather and electric endurance remain placeholders; cloud, airport integration and briefing export are future capabilities. See the [roadmap](docs/development/roadmap.md). Requirements describe the intended product, not a list of certified or fully shipped features.

## Development and documentation

Use Node >=22.12 and Corepack/pnpm. Run `pnpm install --frozen-lockfile`, then `pnpm dev` (port 5173). Validate with `pnpm lint && pnpm test:unit`; use `pnpm test:e2e --project=chromium` for browser checks.

Start with [AGENTS.md](AGENTS.md), [Contributing](CONTRIBUTING.md), [Architecture](ARCHITECTURE.md), [Requirements](docs/requirements/README.md), [Testing](docs/testing/TESTING.md) and [user flows](docs/journeys/README.md). Developer docs and requirements are English; this README has a maintained [German version](README-DE.md).
