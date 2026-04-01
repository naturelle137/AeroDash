# Version Requirements and Journeys Summary

## v0.2.0

### Requirements

- `REQ-AD-001`: Base aircraft attributes; schema defined for walking skeleton; **status: Implemented**
- `REQ-AD-002`: Load points; **status: Implemented**
- `REQ-AD-003`: Fuel tanks and burn sequences; `H-003` mitigation; **status: Implemented**
- `REQ-AD-004`: BEM, empty CG, weighing date; predefined aircraft data
- `REQ-AD-005`: Flight envelope polygon; **status: Implemented**
- `REQ-AD-011`: Certification categories with distinct MTOM/envelope; **status: Implemented**
- `REQ-AD-012`: Fixed arm or variable loading stations; **status: Implemented**
- `REQ-AD-014`: Store POH values in original units; `H-001` mitigation
- `REQ-FE-001`: Fuel mass from type-specific density; `H-002` mitigation
- `REQ-FE-004`: Burn sequences per tank; `H-006` mitigation; **status: Implemented**
- `REQ-MB-001`: Update MTOM/stations/envelope on category change; `H-005` mitigation; **status: Implemented**
- `REQ-MB-002`: Recalculate mass/CG on any load change; **status: Implemented**
- `REQ-MB-003`: Chart updates synchronized with input; **status: Implemented**
- `REQ-MB-004`: CG out of envelope -> `CRIT-MB-001`; `H-006` mitigation; **status: Implemented**
- `REQ-MB-005`: Over MTOM -> `CRIT-MB-002`; **status: Implemented**
- `REQ-MB-006`: Geometric coordinates for envelope and load points; **status: Implemented**
- `REQ-MB-007`: Point-in-polygon for sloped/complex envelopes; **status: Implemented**
- `REQ-MB-008`: TO/LDG CG plus burn waypoints / burn-down polygon; `H-006` mitigation; **status: Implemented**
- `REQ-MB-009`: MZFM validation -> `CRIT-MB-004`; **status: Implemented**
- `REQ-MB-010`: Output CG envelope polygon definition for chart rendering
- `REQ-MB-011`: CG migration exceeds envelope -> `CRIT-MB-003`; `H-006` mitigation; **status: Implemented**
- `REQ-MB-012`: Fixed or variable moment per station; **status: Implemented**
- `REQ-SYS-003`: Normalize to SI internally; `H-001`, `H-002` mitigation
- `REQ-SYS-004`: Supported units list (`kg`, `lbs`, `L`, `Gal`, etc.)
- `REQ-SYS-007`: Centralized notification service; **status: Implemented**
- `REQ-SYS-008`: Uniform notification model (severity, actions); **status: Implemented**
- `REQ-SYS-011`: Zod validation before core logic; **status: Implemented**
- `REQ-SYS-012`: Validation failure `ERROR` (`ERR-SYS-001`); **status: Implemented**
- `REQ-UI-008`: Out-of-range inputs -> `WARN-UI-001`
- `REQ-UI-009`: Recalculate on certification category change; `H-005` mitigation
- `REQ-UI-010`: CG migration trend line or burn polygon display; `H-006` mitigation
- `REQ-UI-018`: Severity-based notification UI rendering
- `REQ-UI-019`: CG polygon + mass points + burn polygon overlay; `H-006` mitigation
- `REQ-UQ-003`: Decimal precision by unit type
- `REQ-UQ-004`: Conservative rounding for safety values
- `REQ-UQ-005`: Show active unit next to every numeric value; `H-001` mitigation

### Journeys

- `UJ-A-003`: Category-driven MTOM/envelope/station update
- `UJ-B-001`: CG migration with aft load; burn-down trend
- `UJ-B-003`: MTOM and MZFM limit detection
- `UJ-B-004`: Standard vs. alternative burn-order polygon display

## v0.3.0

### Requirements

- `REQ-AC-001`: CRUD aircraft profiles; local persistence
- `REQ-AC-002`: ICAO registration validation
- `REQ-AC-003`: Duplicate registration warning
- `REQ-AC-004`: Import from exchange files
- `REQ-AC-005`: Draft/Verified status; `H-011` mitigation
- `REQ-AC-006`: Passenger profiles with standard weights
- `REQ-AD-006`: Cost per hour; `P3`; non-safety; stored with profile data
- `REQ-AD-007`: Reference datum description; fleet management detail
- `REQ-AD-010`: Checklists per aircraft; `P3`; data model scaffolded
- `REQ-AD-013`: Weighing "Valid From" for version immutability
- `REQ-SYS-001`: Fully offline; local profiles and logic; PWA
- `REQ-SYS-002`: Portable storage format; IndexedDB schema
- `REQ-SYS-005`: Update-available `INFO-SYS-001`, no silent update; `H-019` mitigation
- `REQ-SYS-006`: Verify against remote minimum safe version; `H-019` mitigation
- `REQ-UI-001`: Model dropdown filtered by manufacturer
- `REQ-UI-002`: Manual model entry when manufacturer = `"Other"`
- `REQ-UI-003`: Auto-fill ICAO type from model selection
- `REQ-UI-004`: Lookup manufacturer/model from ICAO type designator
- `REQ-UI-006`: Passenger profiles in load input fields
- `REQ-UI-013`: SemVer + date in About section; `H-019` mitigation

### Journeys

- `UJ-A-001`: Fleet CRUD, draft/verified, envelope/moment setup
- `UJ-A-002`: Unit switching across Imperial/Metric profiles
- `UJ-F-002`: Partial `v0.2.0` (density math); full requires fleet switching between aircraft

## v0.4.0

### Requirements

- `REQ-AD-008`: Performance profiles for TO/LDG phases
- `REQ-AD-009`: Up to 1000 performance data points per profile
- `REQ-AD-015`: Surface condition correction factors
- `REQ-AD-016`: POH operational safety factors
- `REQ-AD-017`: Wind limits (Demonstrated vs. Limit); `H-014` partial mitigation; data model enables manual wind-limit checking
- `REQ-AP-003`: Manual entry mode when ICAO not found; performance manual context
- `REQ-AP-004`: Mandatory surface condition when runway selected; `H-009` partial
- `REQ-AP-006`: Editable overrides for airport/runway parameters
- `REQ-PF-001`: Four performance variables: `TOR`, `TOD`, `LR`, `LD`
- `REQ-PF-002`: Bilinear interpolation (mass, PA, temp); `H-004` mitigation
- `REQ-PF-003`: Hierarchical fallback: POH table -> `FSM 3/75`
- `REQ-PF-004`: Friction/slope on ground roll only; DA/wind on full distance
- `REQ-PF-005`: Estimate missing ground/50ft via `CAA SSL 07` ratio
- `REQ-PF-006`: Operational required distance with OSF presets
- `REQ-PF-007`: Safety margin absolute and percentage display
- `REQ-PF-010`: Extrapolation cap `10%` + `20%` penalty; `H-007`, `H-012` mitigation
- `REQ-PF-011`: Floor benefits at best-case POH (minimum distance rule); `H-013` mitigation
- `REQ-PF-012`: Pilot acknowledgment for extrapolated data; `H-012` mitigation
- `REQ-PF-013`: Pressure altitude formula
- `REQ-PF-015`: Runway insufficient -> `CRIT-PF-002`; `H-008` mitigation
- `REQ-PF-016`: Low OSF -> `WARN-PF-002`; `H-008`, `H-016` mitigation
- `REQ-PF-017`: Mark estimated values (`CAA SSL 07`) in UI
- `REQ-UI-017`: Export with low OSF -> `CRIT-UI-002`; `H-016` mitigation

### Journeys

- `UJ-C-001`: Extrapolation cap/penalty and acknowledgment
- `UJ-C-003`: `CAA SSL 07` estimation with visual flagging
- `UJ-E-003`: Cold extrapolation; floor at best-case POH; acknowledgment

## v0.5.0

### Requirements

- `REQ-FE-002`: Endurance from usable fuel and flow rate; `H-010` mitigation
- `REQ-FE-003`: Warn if mission exceeds endurance (`WARN-FE-001`)
- `REQ-FE-005`: Planned time/trip fuel for landing mass calculation
- `REQ-PF-008`: Custom obstacle constraints (distance, height)
- `REQ-PF-009`: Unverified obstacle warning `WARN-PF-001`; `H-017` mitigation

### Journeys

- `UJ-C-002`: Partial `v0.4.0` (manual runway); full requires obstacle constraints (`PF-008`/`009` in `v0.5.0`)
- `UJ-F-001`: Endurance vs. planned time; fuel warning

## v0.6.0

### Requirements

- `REQ-AP-001`: Full airport data object with metadata and runway fields
- `REQ-AP-002`: Auto-populate from external DB by ICAO
- `REQ-AP-005`: External airport data marked Unverified; `H-015` mitigation
- `REQ-SYS-009`: Connectivity state `Online/Offline`
- `REQ-SYS-010`: Gate online-only features when offline
- `REQ-UI-005`: Five recent airports; `P3`; needs airport data model
- `REQ-UI-014`: Toggle Unverified -> Verified per field; meaningfully used with external data
- `REQ-UI-016`: `"Mark all as Verified"` batch action in dialog
- `REQ-UI-020`: Connectivity indicator in header/status bar
- `REQ-WX-001`: Fetch `METAR`/`TAF` by ICAO
- `REQ-WX-002`: Time-specific forecast for departure/arrival
- `REQ-WX-003`: Auto-populate temperature/wind from `METAR` when no forecast
- `REQ-WX-004`: Liquid precipitation -> default surface = Wet; `H-009` mitigation
- `REQ-WX-005`: Heavy/prolonged precipitation -> default Soft Ground on grass; `H-009` mitigation
- `REQ-WX-006`: Manual override of inferred surface condition
- `REQ-WX-007`: Calculate wind components relative to runway heading
- `REQ-WX-008`: Weather metadata (source, fetch timestamp)
- `REQ-WX-009`: Wind limit exceedance -> `WARN` or `CRIT` per `AD-017` classification; `H-014` full mitigation

### Journeys

- `UJ-E-001`: `METAR`-driven surface inference; pilot override
- `UJ-E-002`: Wind component calculation; limit exceedance detection
- `UJ-E-004`: Requires automated weather data + `AD-017` wind limit classification
- `UJ-G-003`: Partial `v0.3.0` (PWA offline); full requires graceful degradation from online features

## v0.7.0

### Requirements

- `REQ-DOC-001`: PDF/print `"Digital Briefing Pack"`
- `REQ-DOC-002`: `[UNVERIFIED]` on unverified params in export; `H-015` mitigation
- `REQ-DOC-003`: Disclaimer if unverified data present; `H-015` mitigation
- `REQ-DOC-004`: Disclaimer if low safety margin; `H-016` mitigation
- `REQ-DOC-005`: Render `WARNING`/`CRITICAL` notifications in export; status: Draft — approval needed before `v0.7.0`
- `REQ-UI-015`: Export with unverified data -> `CRIT-UI-001`; `H-015` mitigation; depends on export mechanism

### Journeys

- `UJ-B-002`: Partial `v0.4.0` (performance + OSF warnings); full requires PDF export and disclaimer rendering (`REQ-DOC-005` in `v0.7.0`)
- `UJ-B-005`: Partial `v0.6.0` (weather + airport); full requires PDF export (`v0.7.0`)
- `UJ-D-002`: Partial `v0.6.0` (toggle per-field, batch verify); full requires export gating (`REQ-UI-015` in `v0.7.0`)

## v0.8.0

### Requirements

- `REQ-AD-018`: Share-code field on aircraft; `P3`
- `REQ-AD-019`: Owner identifier; linked to auth workspace model
- `REQ-SC-001`: `OIDC` authentication
- `REQ-SC-002`: Cloud sync; organization data wins on conflict
- `REQ-SC-003`: Personal vs. organization workspaces
- `REQ-SC-004`: Organization roles (`Admin`, `Fleet Admin`, `Member`)
- `REQ-SC-005`: Share-code generation
- `REQ-SC-006`: Import by share-code to personal workspace
- `REQ-SC-007`: JSON export
- `REQ-SC-008`: JSON import with schema validation

### Journeys

- `UJ-G-001`: `OIDC` auth + org sync + RBAC
- `UJ-G-002`: Share-code generation and import

## v0.9.0

### Requirements

- `REQ-UI-011`: Dark mode toggle; `H-018` mitigation; `P3`
- `REQ-UI-012`: Contextual tooltips for inputs and results
- `REQ-UQ-001`: Touch-friendly controls (`44px` targets)
- `REQ-UQ-002`: Responsive layout >= `320px` viewport width

### Journeys

- `UJ-D-001`: Partial across `v0.3.0` (offline), `v0.4.0` (PA calc), `v0.7.0` (PDF/unverified); dark mode gate is `v0.9.0`
