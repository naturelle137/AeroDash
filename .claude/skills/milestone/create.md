# /milestone.create — GitHub-ready milestone description

- `role`: milestone author; safety-critical roadmap
- `goal`: GitHub-ready milestone description; roadmap intent only
- `forbid`:
  - invent strategy
  - redesign sequencing
  - full validation audit
  - unbacked scope
- `input`: `<version>`
- `input.example`: `/milestone.create 0.7.0`
- `input.invalid`: return only `Usage: /milestone.create <version>`
- `discover.order`:
  - existing milestone roadmap | planning artifacts
  - existing milestone descriptions for `version`
  - coverage mappings from Requirements + Journeys
  - alignment findings + risk notes for `version`
  - architecture constraints + validation expectations for `version`
- `discover.blocked`: missing enough intent -> return only `Blocked: milestone intent for <version> is not sufficiently defined. Run /milestone.plan first or provide roadmap input.`
- `conflict.plan-vs-align`:
  - preserve planned intent
  - apply corrective clarifications only
  - no roadmap replanning
- `must`:
  - match roadmap intent for `version`
  - measurable | testable wording
  - reflect allocated Requirements + Journeys
  - explicit validation expectations
  - GitHub-paste-ready
- `heuristics`:
  - vertical slices > technical layers
  - usable system value required
  - safety-critical logic -> early explicit validation
  - no big-bang integration phrasing
  - deterministic | testable outcomes
  - docs + validation + runtime behavior aligned to real scope
  - out-of-scope excludes adjacent blur
- `rules`:
  - use provided version exactly
  - reuse roadmap name + focus when present
  - if name|focus absent -> derive from Purpose + Key Capabilities; no scope change
  - no new capabilities
  - every deliverable | exit criterion -> observable | testable | reviewable
  - operational wording
  - audience: engineers | validators | product owners

## Output (filled template below; no extra sections)

### Title

`<version> - <name> (<focus>)`

### Objective

`2-4` sentences; usable value | safety-critical behavior/workflow advanced | roadmap significance.

### Scope

#### Functional Scope

- `<capability or user-visible/system-visible outcome>`
- `<capability or user-visible/system-visible outcome>`
- `<capability or user-visible/system-visible outcome>`

#### Architecture Constraints

- `<architecture constraint | interface boundary | data integrity rule | safety constraint>`
- `<architecture constraint | interface boundary | data integrity rule | safety constraint>`

#### Engineering / Tooling

- `<tooling | observability | traceability | automation | enablement item>`
- `<tooling | observability | traceability | automation | enablement item>`

### Deliverables & Exit Criteria

#### Documentation

- `<required document | traceability update | design artifact>`
- `<required document | traceability update | design artifact>`

#### Testing & Validation

- `<test | simulation | verification | review outcome>`
- `<test | simulation | verification | review outcome>`
- `<test | simulation | verification | review outcome>`

#### Runtime Behavior

- `<observable runtime property | protection | deterministic behavior | failure response>`
- `<observable runtime property | protection | deterministic behavior | failure response>`

### Out of Scope

- `<adjacent excluded item>`
- `<adjacent excluded item>`
- `<adjacent excluded item>`

### Success Signal

> blockquote; one sentence; clearest real-world completion signal
