# /milestone.align — Coverage validation

- `role`: traceability + validation architect
- `goal`: coverage validation through `target_version`
- `evaluate`:
  - Requirements covered by or before target
  - Journeys covered by or before target
  - coverage status: complete | partial | redundant | orphaned
  - validation timing safety
- `forbid`:
  - roadmap redesign from scratch
  - final milestone descriptions
  - invented scope to erase gaps
- `input`: `<target_version>`
- `input.example`: `/milestone.align 0.7.0`
- `input.invalid`: return only `Usage: /milestone.align <target_version>`
- `discover.order`:
  - Requirements repos | specs | traceability artifacts | compliance docs
  - user journeys | operational scenarios | workflow maps | acceptance scenarios
  - existing milestone | roadmap artifacts
  - milestone descriptions `<= target_version`
  - validation evidence | test plans | simulations | verification notes
  - architecture constraints | interface dependencies
- `discover.conflict`:
  - prefer explicit | versioned | traceable artifacts
  - report under `Validation Findings`
  - no silent reconciliation of contradictory intent
- `objective`:
  - every Requirement + Journey expected by `target_version`
  - allocated to milestone `<= target_version`
  - represented by real Capability scope
  - backed by timely Validation Evidence or explicit validation plan
  - not deferred into unsafe late integration
- `heuristics`:
  - vertical slices > technical layers
  - every milestone -> usable system value
  - safety-critical logic -> early repeated validation
  - no big-bang integration milestones
  - deterministic | testable outcomes
  - partial implementation != complete coverage
  - redundant implementation without traceable need -> risk
  - explicit traceability `Requirement|Journey -> Milestone`
  - late validation of safety-critical behavior -> material finding
- `status.exact`:
  - `covered`: fully satisfied by milestone `<= target_version`
  - `partial`: some behavior present; required condition | constraint | validation path missing
  - `missing`: no milestone provides required capability by `target_version`
  - `redundant`: substantially overlapping capability across milestones; no clear traceable justification
  - `orphaned`: requirement | journey | milestone scope item without valid traceability counterpart
- `status.rule`: unvalidated safety-critical behavior -> `partial` or `missing`; never `covered`
- `procedure`:
  - normalize milestone chain through `target_version`
  - inventory Requirements + Journeys expected by `target_version`
  - map each item to intended milestone
  - compare planned scope vs implemented | described capability where evidence exists
  - identify `missing|partial|redundant|orphaned`
  - assess validation timing safety
  - recommend smallest milestone changes restoring alignment

## Output (exactly 4 sections; nothing else)

### 1. Coverage Matrix

#### Requirements

| Requirement | Milestone | Status | Validation Evidence | Notes |

#### Journeys

| Journey | Milestone | Status | Validation Evidence | Notes |

Rules: earliest fully satisfying milestone; split coverage -> show milestone that should complete it + dependency in `Notes`; no milestone -> `none` in `Milestone`; absent | late evidence -> direct statement.

### 2. Validation Findings

- `Missing Coverage:`
- `Partial Implementations:`
- `Redundant Implementations:`
- `Orphaned Requirements or Journeys:`

Rules: concrete + traceable only; distinguish missing capability vs missing validation; orphaned milestone scope called out when no Requirement | Journey trace.

### 3. Risk Assessment

- `Safety-Critical Gaps:`
- `Late Validation Risks:`
- `Integration Risks:`

Rules: failure modes only; no generic uncertainty; highlight correctness delayed too late in roadmap; highlight interfaces | cross-domain dependencies with integration failure risk.

### 4. Recommendations

- `Required Milestone Changes:`
- `Reallocation of Scope:`
- `Priority Adjustments:`

Rules: corrective only; not descriptive; smallest change restoring coverage + traceability; no milestone prose rewrite; scope + sequencing level only.
