# Feature Design: Mass & Balance

This document specifies the UX flow and Vue component architecture for the Mass & Balance module (`core/math`). It inherits the global standards defined in [`design_system.md`](design_system.md).

## 1. Feature Goals

- **User Intent:** To quickly input payload and fuel data and receive immediate, mathematically sound safety feedback for the Take-off, flight migration, and Landing phases in order to make a confident Go/No-Go decision.
- **Business Goal:** To provide a frictionless, mathematically robust safety-critical core feature that sets AeroDash apart from basic calculators by visualizing complex fuel burn-down behaviors and structural boundaries (MZFM).

---

## 2. User Flow

The Mass & Balance (M&B) user flow relies on synchronous data reactions. The goal is to provide immediate feedback to the pilot while remaining effortless to operate in flight.

### Step 1: Context & Configuration (The Foundation)

- **Action:** User selects Manufacturer and Model (with ICAO autofill) from DB. Select Certification Category.
- **Trigger:** `@change` event on the dropdown/selection component.
- **Reaction (Async):** System dispatches a Pinia action to fetch the aircraft profile geometry from IndexedDB (`LOADING` state).
- **Reaction (Sync/Explicit Action):** On profile load success, explicitly dispatch `resetPayloadState()` to dynamically adjust structural limits (MTOM, MZFM) and bounding polygons (`REQ-MB-001`) before enabling the `UNVERIFIED` state.

### Step 2: Payload Entry (The Iterative Loop)

- **Action:** Input payload weights via touch-friendly steppers/numpad. User can select "Passenger Profiles" to auto-fill.
- **Trigger:** `@input` (for typings) and `@click` (for steppers/profiles) on the `<MassStationInput>`.
- **Debounce Rule:** Explicitly **no debounce** allowed for steppers or profile clicks to satisfy `REQ-UI-009` and prevent visual lag. Fast manual keyboard entry may be debounced slightly (`200ms`) purely to prevent thrashing, but the final calculation must strictly appear real-time.
- **Reaction (Sync/Computed):** Total Mass, ZFM, and CG are derived dynamically using Vue `computed()` properties bound to the raw station state array (`REQ-MB-002`). The underlying `vue-chartjs` re-renders synchronously on the same reactive tick. _Note: The chart instance MUST be configured with `animation: false` or `updateMode: 'none'` to prevent visual rendering lag during rapid stepper clicking (`REQ-MB-003`)._

### Step 3: Fuel & Sequences (The Migration Check)

- **Action:** Input fuel volumes into the tank stations.
- **Trigger:** Identical to Payload Entry (`@input`/`@click`).
- **Reaction (Sync/Computed):** System calculates Take-Off Mass (TOM) and Landing Mass (LM) using pure mathematical helper functions. A `computed()` property derives the trend pathway points and passes them as a prop to the child chart, instantly drawing the line or shaded polygon (`REQ-MB-008`, `UJ-B-004`).

### Step 4: Verification & Export (The Safety Gate)

- **Action:** Review safety notifications. Trigger PDF Export.
- **Trigger:** `@click` on the Export button.
- **Reaction (Synchronous Gate):** A pre-export intercept checks the `UNVERIFIED` state derived from the dataset. If true, a blocking Vue modal is layered (`z-index`) forcing user confirmation (`REQ-UI-015`). If clean, proceeding to export Generation (`Async`).

### Step 5: Error Recovery (The Escape Hatch)

- **Action:** User becomes stuck configuring an overloaded aircraft and wants to start over, or a math exception occurs.
- **Reaction:** User taps "Clear Payload" in the `ResultSummary.vue` card.
- **Recovery:** Pinia store immediately flushes all station weights to `0`, resetting the state machine to `UNVERIFIED` (clean start). If a hard math crash occurred, the module unmounts, flushes, and remounts via the global Error Boundary.

---

## 3. Component Breakdown (Vue Architecture)

The UI sits firmly disconnected from the `core/math` processing logic. Its only duty is to capture payload integers, pass them to the calculations, and blindly render the resulting Notification Schema structures.

### 3.1 Container (Smart Component)

- **`MassBalanceView.vue`**: The orchestrator. Fetches the aircraft profile, binds to the central Pinia store, listens to Math Core notifications, and manages the overarching layout state.

### 3.2 Presentational (Dumb Components)

- **`InputGroupCard.vue`**: Renders a clustered group of stations (e.g., "Front Seats", "Fuel Tanks").
- **`MassStationInput.vue`**: The atomic input field with touch-steppers, static unit labels, and warning border logic. Emits raw data upwards.
- **`CGEnvelopeChart.vue`**: Wraps `vue-chartjs`. Strictly receives a props array of polygon bounds and active CG points/trend lines to render. It performs no boundary validation.
- **`ResultSummary.vue`**: A sticky/fixed card summarizing TOM, ZFM, and the final Go/No-Go state based solely on provided Notification Severity inputs.

---

## 4. Specific UI State Implementations

### Visual Feedback (The Chart)

As defined by `REQ-UI-019`, the chart is the core visual feedback mechanism.

- **Background:** The valid Envelope defined as a shaded polygon.
- **Migration Path:** The path between TOM and LM is rendered as an arrowed trend line. For multi-sequence tanks, it renders a shaded boundary area.
- **Violation:** If the Point-in-Polygon check fails in the math core layer, it emits a `CRIT-MB-001` struct. The UI catches this, checks the `CRITICAL` severity, and transitions the violating chart points to **Red and changes their shape** (e.g., from a circle to a heavy `X` or triangle). The bounding path or polygon exceeding limits transitions to **Red with a highly visible crosshatched pattern-fill**.

### Architectural Boundaries

As governed by Issues #96, #97, and #98, the UI layer does not "know" why a polygon boundary was failed. It simply captures data and displays the resulting structural Notification flag.
