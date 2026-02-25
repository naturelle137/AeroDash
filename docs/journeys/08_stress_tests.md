# System Stress Tests (Boundary Conditions)

This document defines the critical User Journeys simulating edge-cases and algorithmic boundary conditions. These scenarios are designed to stress-test the application's core mathematical limits and ensure that safety mechanisms (e.g., UI Warnings, Calculation Blocks) are triggered appropriately.

These scenarios trace directly back to the mitigations defined in `safety_hazards.md`.

---

## Stress Test Journeys

### UJ-STRESS-001: The Sahara Switch (Temperature Boundary)

**Persona:** Pilot
**Context:** A pilot is preparing for departure from Luxor International (HELX) during a severe summer heatwave.
**Goal:** Verify extrapolation boundaries and safety penalties.

* **Journey:**
| Phase | User Action | Thoughts | System Interaction |
| :--- | :--- | :--- | :--- |
| **Heat Envelope** | Inputs 54°C (which is 4°C above the 50°C POH maximum). | "It's scorching today, but we should be within the 10% safety buffer for extrapolation." | Assesses the Performance envelope. Extrapolates distance natively with a mathematically verified +20% safety penalty and UI warning. |
| **Boundary Breach** | The temperature rises. Pilot inputs 57°C. | "Getting even hotter... let's check the numbers again." | System aborts calculation with a clear block warning as it exceeds the 10% permissible extrapolation buffer. |

### UJ-STRESS-002: Burn-out Shift (Aft CG Validation)

**Persona:** Pilot
**Context:** A pilot is flying a heavily loaded aircraft to a destination 3 hours away, with two heavy passengers in the rear seats.
**Goal:** Verify that a safe Takeoff CG does not mask an unsafe Landing CG.

* **Journey:**
| Phase | User Action | Thoughts | System Interaction |
| :--- | :--- | :--- | :--- |
| **Aft Load** | Configures max aft passenger load and minimum fuel for the trip. | "We're packed tight, let's check the balance." | Calculates Takeoff CG (Green). |
| **Fuel Burn Simulation** | Reviews the migration line from Takeoff to Zero Fuel. | "How does the balance shift as we burn this fuel?" | Landing CG shifts behind the aft limit due to fuel burn. |
| **Outcome** | App responds to the shift. | - | System displays a critical warning and visually shows the trend line exiting the safe envelope. |

### UJ-STRESS-003: Altitude Breach (Strict Blocking)

**Persona:** Pilot
**Context:** A pilot attempting a high-altitude mountain lake departure during summer.
**Goal:** Ensure pilots cannot mathematically invent performance data too far off-chart.

* **Journey:**
| Phase | User Action | Thoughts | System Interaction |
| :--- | :--- | :--- | :--- |
| **Breach Input** | Attempts takeoff calculation exactly 11% above POH max altitude table value. | "The charts don't go this high, but maybe the app will guess it." | Refuses to extrapolate. |
| **Outcome** | App prevents operation. | - | System strictly blocks the calculation and renders a red error overlay. |

### UJ-STRESS-004: Penalty Application (Conditional Extrapolation)

**Persona:** Pilot
**Context:** A pilot operating slightly above the maximum tabulated weight for a grass strip.
**Goal:** Verify permitted extrapolations automatically apply the required regulatory safety penalties.

* **Journey:**
| Phase | User Action | Thoughts | System Interaction |
| :--- | :--- | :--- | :--- |
| **Buffer Input** | Attempts calculation exactly 5% above the table max. | "Just a tiny bit over the chart, should be fine with a long runway." | Extrapolates distance natively. |
| **Outcome** | System ensures safety. | - | System applies the required +20% safety penalty to the distance and displays an extrapolation warning UI flag. |

### UJ-STRESS-005: Minimum Distance Rule (Floor Imposition)

**Persona:** Pilot
**Context:** A pilot departing from a frozen runway in deep winter at -30°C.
**Goal:** Verify optimistic data does not result in an unsafely low runway requirement.

* **Journey:**
| Phase | User Action | Thoughts | System Interaction |
| :--- | :--- | :--- | :--- |
| **Ideal Input** | Inputs -30°C density altitude (way below POH minimums). | "The air is super dense, we should lift off instantly." | Extrapolates distance downwards. |
| **Outcome** | System sets a baseline. | - | System floors the calculation at the lowest mapped POH boundary distance and refuses to output a shorter value to maintain baseline safety. |

### UJ-STRESS-006: Crosswind Exceedance (Weather Interaction)

**Persona:** Pilot
**Context:** A pilot preparing for departure during a strong frontal passage with unpredictable gusts.
**Goal:** Ensure METAR wind data acts as an aerodynamic limit check.

* **Journey:**
| Phase | User Action | Thoughts | System Interaction |
| :--- | :--- | :--- | :--- |
| **Wind Input** | Selects runway and app ingests METAR showing a 20kt crosswind for a 15kt demonstrated craft. | "It's gusty, but it's mostly a headwind, right?" | Calculates crosswind vector natively. |
| **Outcome** | Verifies limit alert. | - | A critical No-Go UI alert is triggered for exceeding demonstrated structural limits. |

### UJ-STRESS-007: Mixed Fleet Nightmare (Unit Normalization)

**Persona:** Pilot
**Context:** A European pilot borrowing an American-registered aircraft configured in Imperial units.
**Goal:** Verify flawless unit conversion without internal rounding loss.

* **Journey:**
| Phase | User Action | Thoughts | System Interaction |
| :--- | :--- | :--- | :--- |
| **Imperial Load** | Loads imperial profile (lbs/Gal) into their metric-configured environment. | "I'll enter my baggage in kg and let the app figure it out." | Parses non-SI values. |
| **Outcome** | Verifies stability. | - | System flawlessly converts logic to SI on the backend, calculating M&B correctly without floating point rounding errors surfacing to the pilot. |

### UJ-STRESS-008: The "Make-it-Fit" Override (Regulatory Blocks)

**Persona:** Pilot
**Context:** A pilot trying to fly out of a marginal farm strip and wanting the numbers to look better on paper.
**Goal:** Protect pilots from intentionally minimizing mandatory conservative buffers.

* **Journey:**
| Phase | User Action | Thoughts | System Interaction |
| :--- | :--- | :--- | :--- |
| **Override Attempt** | Sets Take-off Safety Factor to 1.0 (removing EASA 1.25 buffer) to squeeze into a short runway. | "I'll just turn off the safety buffer, I've flown out of here before." | Parses the 1.0 parameter factor. |
| **Outcome** | Warns the pilot. | - | System fires a clear, dismissible warning regarding the violation of standard aviation regulatory practices. |
