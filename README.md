# AeroDash

## Contents
* [Disclaimer](#️-disclaimer)
* [Project Philosophy](#philosophy)
* [Intended Use & System Limitations](#intendedUse)

## <a name="disclaimer"></a>⚠️ Disclaimer

**NO CERTIFIED AVIATION DEVICE.**

IMPORTANT: AeroDash is an open-source flight preparation tool designed for educational and  informational use only. It is **NOT** a substitute for certified aviation data sources (AIP, AFM/POH, Official Weather Briefings). **USE AT YOUR OWN RISK!** Please read the full [Disclaimer](DISCLAIMER.md).

* **NO WARRANTY:** The software is provided "as is", without warranty of any kind.
* **PILOT RESPONSIBILITY:** The Pilot in Command (PIC) retains sole responsibility for the safe conduct of the flight and the verification of all calculated data against the official Aircraft Flight Manual.
* **DATA VALIDITY:** Calculation results rely entirely on user inputs and the accuracy of the underlying aircraft profiles.

## <a name="philosophy"></a>Project Philosophy

> **"Don't guess. Know. Flight-grade precision for command decisions."**

This guiding principle shapes every architectural decision in AeroDash:

### 🎯 Vision
To eliminate "guesstimation" from General Aviation flight preparation by providing a tool that is as reliable as the aircraft itself.

### 🛡️ Core Values

**1. Pilot Authority**
* The software is an advisor, never the commander.
* We provide **Decision Support**, not Decision Making.
* We warn critical states visually, but we allow manual overrides for abnormal operations.

**2. Conservative Precision**
* We prefer conservative approximations over optimistic exactness. Rounding is always applied to the safe side.
* If the POH says it's tight, we tell you it's tight. We prefer a cancelled flight over a calculated risk.
* Calculations are based on verified physics and accepted aviation standards, not UI convenience.

**3. Traceability**
* Trust is earned through transparency. There is no "hidden magic" – every output in AeroDash is traceable to a specific requirement and a verified data source.
* All hazards arising from the use of AeroDash are understood and mitigated.

## <a name="intendedUse"></a>Intended Use & System Limitations

### 1. What AeroDash IS
AeroDash is a specialized **Flight Preparation and Decision Support Tool** designed for General Aviation pilots operating under **EASA Part-NCO** (Non-Commercial Operations with Other-than-Complex Motor-Powered Aircraft) rules. Its primary purpose is to determine the feasibility of a planned flight regarding Mass & Balance and Takeoff/Landing Performance before the engine is started.

#### Core Capabilities
* **Go/No-Go Decision Support:** Provides mathematical proof that the aircraft is within certified limits for Mass, Center of Gravity (CG), and Performance under expected environmental conditions.
* **Aircraft-Specific Data:** Operates on the exact data of a specific airframe (based on its individual Weighing Report and POH), not generic type data.
* **Hybrid Performance Calculation:** Combines POH table interpolation with standardized safety factors (e.g., FSM 3/75) to provide conservative distance estimates for unpaved or contaminated runways.
* **Simple Endurance Check:** Calculates "Time to Empty" based on user-entered fuel quantities to validate if the endurance exceeds the planned flight time plus reserves.

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
> **"Software calculates, the pilot decides."**

AeroDash processes data based on user inputs. It cannot verify the physical reality (e.g., it cannot know if the fuel tank is actually full). The Pilot in Command (PIC) retains sole responsibility for:
1.  Verifying that the aircraft profile data matches the physical AFM/POH.
2.  Ensuring input values (Weight, Temperature, Wind) reflect reality.
3.  Applying additional safety margins as required by Airmanship.