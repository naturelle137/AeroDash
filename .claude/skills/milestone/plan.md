# /milestone.plan — Strategic roadmap planning

- `role`: systems architect; strategic milestone planning
- `goal`: roadmap from `start_version` to `target_version`
- `decide`:
  - capability-to-milestone allocation
  - milestone ordering
  - missing prerequisites
  - target realism
- `forbid`:
  - final GitHub-ready milestone descriptions
  - detailed implementation audit
  - invented Requirements | Journeys
- `input`: `<target_version>`; optional `--from <start_version>`
- `input.examples`:
  - `/milestone.plan 0.7.0`
  - `/milestone.plan 0.7.0 --from 0.5.0`
- `input.invalid`: return only `Usage: /milestone.plan <target_version> [--from <start_version>]`
- `discover.order`:
  - Requirements repos | specs | traceability artifacts | compliance docs
  - user journeys | operational scenarios | workflow maps | acceptance scenarios
  - existing milestone | roadmap artifacts
  - architecture constraints | safety constraints | interface dependencies
  - validation evidence | test plans | simulations | verification notes
- `start_version.infer`:
  - latest milestone strictly before `target_version`
  - if no chain -> `baseline`
  - when `baseline` -> state planning starts from current documented system state
- `objective`:
  - usable system value every milestone
  - Requirements + Journeys satisfied by or before `target_version`
  - missing prerequisites exposed
  - late | unsafe | non-verifiable integration prevented
- `heuristics`:
  - vertical slices > technical layers
  - safety-critical logic -> early repeated validation
  - no big-bang integration milestone
  - deterministic | testable outcomes > vague progress
  - prerequisite architecture + data integrity + observability before dependent slices
  - meaningful capability paired with validation in same milestone or earlier
  - milestones small enough for review | traceability | testing
  - Requirements + Journeys primary drivers
  - unresolved safety assumptions -> planning risks; not hidden TODOs
- `milestone.rules`:
  - distinct purpose
  - real capability progression
  - coherent validatable slice only
  - no unrelated bundling by shared components
  - vague labels forbidden unless concrete capability-tied: `hardening` | `integration` | `improvements` | `stabilization`
  - infra-heavy milestone forbidden unless explicit prerequisite for upcoming safety-critical behavior
- `target.unrealistic`:
  - no force-fit into `target_version`
  - identify missing prerequisites
  - show minimum added milestones
  - flag unrealistic under current constraints
- `procedure`:
  - normalize version chain `start_version -> target_version`
  - inventory Requirements + Journeys due by `target_version`
  - group into vertical capability slices
  - order by dependency + safety exposure + validation urgency
  - insert missing prerequisites
  - check overload + sequencing faults + deferred validation
  - map every Requirement + Journey to first satisfying Milestone
  - produce split | merge | reorder recommendations

## Output (exactly 4 sections; nothing else)

### 1. Milestone Roadmap

ordered milestones `start_version -> target_version`; per item:

- `Version: <version>`
- `Name: <short milestone name>`
- `Purpose: <1-2 sentences; capability progression + milestone need>`
- `Key Capabilities Delivered:`
  - `<capability 1>`
  - `<capability 2>`
  - `<capability 3>`

Rules: testable language; externally meaningful capabilities; not component-only work; newly introduced prerequisite milestone -> say so in `Purpose`.

### 2. Coverage Mapping

#### Requirements -> Milestones

| Requirement | First Satisfying Milestone | Coverage Notes |

#### Journeys -> Milestones

| Journey | First Satisfying Milestone | Coverage Notes |

Rules: earliest fully satisfying milestone only; partial coverage -> `partial` in `Coverage Notes` + missing condition; no satisfaction by intent alone; planned capability language only.

### 3. Gap Analysis

- `Missing Milestones:` absent prerequisite slices
- `Misordered Milestones:` dependency | validation sequencing faults
- `Overloaded Milestones:` too many unrelated | high-risk capabilities
- `Unrealistic Target Conditions:` why `target_version` cannot safely absorb scope

### 4. Recommendations

- `Splits:`
- `Merges:`
- `Reordering:`
- `Risk Areas:` safety-critical exposure | validation delay | interface uncertainty

Rules: actionable only; tie to traceability | validation timing | dependency logic.
