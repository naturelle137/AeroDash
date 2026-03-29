# AeroDash Single Traceability Contract (STC)

> **Authority:** This document is the single authoritative specification for the
> AeroDash traceability system. All Cursor rules, CI validations, and tooling
> configurations MUST derive from and conform to this specification. Any conflict
> between this document and a downstream enforcement artifact is resolved in favor
> of this document.
>
> **Governing ADRs:** [307-DEV](architecture/adr/307-DEV-master-traceability-structure.md),
> [308-DEV](architecture/adr/308-DEV-traceability-engine.md)
>
> **Tool Configuration:** [`.tools/.shtracer.md`](../.tools/.shtracer.md)
>
> **Version:** 2.0
> **Effective Date:** 2026-03-29

---

## 1. Ontology

### 1.1 Node Type Definitions

| Node Type | Prefix | Description | Source Location | Artifact Format |
| :--- | :--- | :--- | :--- | :--- |
| Hazard | `H` | Identified safety hazard from risk analysis | `docs/risk_management/` | Markdown |
| Requirement | `REQ` | Formal software requirement (EARS syntax) | `docs/requirements/` | Markdown |
| User Journey | `UJ` | End-to-end behavioral flow demonstrating requirements | `docs/journeys/` | Markdown |
| Architecture Design | `DES-ARCH` | System architecture, data models, ADRs | `docs/architecture/` | Markdown |
| UX Design | `DES-UX` | User experience flows, component design | `docs/ux/` | Markdown |
| API Design | `DES-API` | API contracts and endpoint specifications | `docs/api/` | Markdown |
| Implementation | `IMP` | Source code implementing a requirement or design | `frontend/src/` | TypeScript |
| Unit Test | `UT` | Isolated verification of atomic implementation logic | `frontend/src/` | TypeScript |
| Integration Test | `IT` | Verification of interaction between internal modules | `frontend/src/`, `frontend/tests/integration/` | TypeScript |
| End-to-End Test | `E2E` | System-level behavioral verification via BDD | `frontend/tests/e2e/` | Gherkin |

### 1.2 Design Subtypes

The `DES` prefix is a composite type discriminated by subtype:

| Subtype | Scope |
| :--- | :--- |
| `DES-ARCH` | System architecture, data models, structural design decisions |
| `DES-UX` | UX flows, component design, interaction patterns |
| `DES-API` | API contracts, endpoint specifications *(reserved — not yet in active use)* |

### 1.3 Module Identifiers

Used as the `{MODULE}` segment in REQ, IMP, UT, and IT tags:

| ID | Domain |
| :--- | :--- |
| `AC` | Aircraft Management |
| `AP` | Airport Database |
| `AD` | Detailed Aircraft Data |
| `FE` | Fuel & Endurance |
| `MB` | Mass & Balance |
| `PF` | Performance |
| `WX` | Weather & Meteorological Data |
| `UI` | User Interface |
| `UQ` | Usability & Quality |
| `SYS` | General System |
| `DOC` | Documentation & Export |
| `SC` | Cloud Sync & Collaboration |

### 1.4 Phase Identifiers

Used as the `{PHASE}` segment in UJ and E2E tags:

| ID | Phase / Domain |
| :--- | :--- |
| `A` | Fleet Management |
| `B` | Flight Preparation |
| `C` | Performance & Safety |
| `D` | System & Usability |
| `E` | Weather & Environment |
| `F` | Fuel & Endurance |
| `G` | Onboarding & Sync |
| `STRESS` | Stress Tests |

### 1.5 Layer Identifiers

Used as the `{LAYER}` segment in IMP, UT, and IT tags:

| ID | Architectural Layer |
| :--- | :--- |
| `CORE` | Core domain logic and math |
| `STORE` | Pinia state management |
| `VIEW` | Vue view components |
| `ROUTE` | Vue Router configuration |
| `PLUGIN` | Vue plugins and adapters |
| `SHARED` | Shared utilities and helpers |

---

## 2. Traceability Graph

### 2.1 Allowed Edges

The traceability graph is a **directed acyclic graph (DAG)**. Edges flow from
upstream (origin/cause) to downstream (derived/verification). The `FROM`
annotation on a downstream artifact points to its upstream parent(s).

| Edge | Upstream | Downstream | Semantics |
| :--- | :--- | :--- | :--- |
| H → REQ | Hazard | Requirement | Requirement mitigates hazard |
| REQ → UJ | Requirement | User Journey | Journey demonstrates requirement |
| REQ → DES | Requirement | Design | Design implements requirement |
| REQ → IMP | Requirement | Implementation | Code directly implements requirement |
| DES → IMP | Design | Implementation | Code implements design |
| IMP → UT | Implementation | Unit Test | Unit test verifies implementation |
| IMP → IT | Implementation | Integration Test | Integration test verifies implementation |
| UJ → E2E | User Journey | E2E Test | E2E test validates user journey |

An IMP node MAY have edges from both REQ and DES simultaneously.

### 2.2 Forbidden Edges

The following are **strictly forbidden**:

1. **Reverse edges:** No downstream-to-upstream `FROM` links
   (e.g., REQ citing IMP, IMP citing UT).
2. **Cyclic links:** No cycles of any length in the trace graph.
3. **Cross-layer shortcuts:**
   - E2E MUST NOT trace directly to IMP (must go through UJ).
   - UT / IT MUST NOT trace directly to REQ or DES (must go through IMP).
   - DES MUST NOT trace directly to H (must go through REQ).
4. **Cross-type contamination:**
   - UT MUST NOT trace to IT or E2E.
   - IT MUST NOT trace to UT or E2E.

### 2.3 Master Traceability Matrix (MTM) Chains

The full safety chains for a hazard-mitigated feature:

```text
H → REQ → UJ  → E2E          (behavioral verification)
H → REQ → DES → IMP → UT     (structural verification)
H → REQ → IMP → UT            (direct structural verification)
H → REQ → IMP → IT            (interaction verification)
```

---

## 3. Tagging Rules

### 3.1 Tag Format Specifications

All tags use the `@`-delimited format: `@PREFIX-SEGMENTS@`.

| Node Type | Tag Format | Regex | Example |
| :--- | :--- | :--- | :--- |
| H | `@H-{NUMBER}@` | `@H-[0-9]+@` | `@H-006@` |
| REQ | `@REQ-{MODULE}-{NUMBER}@` | `@REQ-[A-Z]+-[0-9]+@` | `@REQ-MB-011@` |
| UJ | `@UJ-{PHASE}-{NUMBER}@` | `@UJ-[A-Z]+-[0-9]+@` | `@UJ-B-005@` |
| DES | `@DES-{SUBTYPE}-{NUMBER}@` | `@DES-[A-Z]+-[0-9]+@` | `@DES-ARCH-002@` |
| IMP | `@IMP-{MODULE}-{LAYER}-{NUMBER}@` | `@IMP-[A-Z]+-[A-Z]+-[0-9]+@` | `@IMP-MB-CORE-001@` |
| UT | `@UT-{MODULE}-{LAYER}-{NUMBER}@` | `@UT-[A-Z]+-[A-Z]+-[0-9]+@` | `@UT-MB-CORE-002@` |
| IT | `@IT-{MODULE}-{LAYER}-{NUMBER}@` | `@IT-[A-Z]+-[A-Z]+-[0-9]+@` | `@IT-MB-CORE-001@` |
| E2E | `@E2E-{PHASE}-{NUMBER}@` | `@E2E-[A-Z]+-[0-9]+@` | `@E2E-B-001@` |

### 3.2 Number Segment

`{NUMBER}` is a zero-padded sequential integer: `001`, `002`, … `999`.
IDs are assigned in ascending order within their namespace and MUST NOT be reused
after deletion.

### 3.3 Trace Annotation Format

Every tag that traces to an upstream parent uses the `FROM` annotation:

```text
@TAG@ (FROM: @UPSTREAM-1@[, @UPSTREAM-2@, ...])
```

Multiple upstream references are comma-separated within a single `FROM` clause.

For technical E2E tests without a UJ trace (§6.2.2), use:

```text
@TAG@ (TECHNICAL)
```

### 3.4 Placement Rules by Artifact Type

| Artifact Type | Comment Syntax | Placement Rule |
| :--- | :--- | :--- |
| Markdown (H, REQ, UJ, DES) | `<!-- ... -->` | On the line immediately before the `##` or `###` heading |
| TypeScript (IMP) | `// ...` | Immediately before the traced code block (export, function, statement, or branch). May appear at any indentation level. |
| TypeScript (UT, IT) | `// ...` | Immediately before the `it` / `it.each` call or the scenario entry in a data-driven array it traces. One tag per test case, not per `describe`. |
| Gherkin (E2E) | `# ...` | As a `#` comment on the line immediately above the execution tags, before `Scenario` |

### 3.5 Canonical Examples

**Hazard (Markdown):**

```md
<!-- @H-006@ -->
### H-006: Errors by CG shift during flight
```

**Requirement with hazard trace (Markdown):**

```md
<!-- @REQ-MB-011@ (FROM: @H-006@) -->
### REQ-MB-011: CG Migration Detection
```

**User Journey with requirement trace (Markdown):**

```md
<!-- @UJ-B-005@ (FROM: @REQ-MB-002@, @REQ-MB-008@) -->
## UJ-B-005: Textbook Flight Preparation
```

**Design with requirement trace (Markdown):**

```md
<!-- @DES-ARCH-002@ (FROM: @REQ-AD-001@, @REQ-AD-002@) -->
## Aircraft Data Model
```

**Implementation with mixed upstream trace (TypeScript):**

```ts
// @IMP-MB-STORE-005@ (FROM: @REQ-MB-001@, @REQ-MB-002@, @DES-UX-007@, @DES-ARCH-005@)
```

**Unit Test with implementation trace (TypeScript):**

```ts
// @UT-MB-CORE-002@ (FROM: @IMP-MB-CORE-001@, @IMP-MB-CORE-002@)
describe('Verify CG calculation for empty aircraft', () => { ... });
```

**Integration Test with implementation trace (TypeScript):**

```ts
// @IT-MB-CORE-001@ (FROM: @IMP-MB-CORE-012@)
describe('Verify arm interpolation via core', () => { ... });
```

**Business E2E with user journey trace (Gherkin):**

```gherkin
# @E2E-B-001@ (FROM: @UJ-B-005@)
@UJ-B-005 @phase-B @e2e @happy-path @module-mb
Scenario: Pilot completes a clean flight preparation
```

**Technical E2E without user journey (Gherkin):**

```gherkin
# @E2E-D-001@ (TECHNICAL)
@smoke @phase-D @technical-e2e
Scenario: Application boots and renders the dashboard
```

---

## 4. Registry System

### 4.1 Overview

The registry system provides a structured index of all traced artifacts for CI
validation and trace graph generation. Registries are organized by node type
under the `trace/` directory.

### 4.2 Directory Structure

```text
trace/
├── requirements/          # REQ registries, one file per module
├── journeys/              # UJ registries, one file per phase
├── design/                # DES registries, one file per subtype
├── implementation/        # IMP registries, one file per module
├── unit_test/             # UT registries, one file per module
├── integration_test/      # IT registries, one file per module
└── e2e/                   # E2E registries, one file per phase or domain
```

Hazard (H) nodes do not require a separate registry; they are defined inline in
`docs/risk_management/safety_hazards.md`, which serves as the authoritative
hazard log.

### 4.3 Registry Entry Schemas

All registries use indentation-based YAML with the following structure:

```text
{Group Title}
  {ID}
    {field}: {value}
```

#### 4.3.1 Document-Level Registries (REQ, UJ, DES)

Document-level registries serve as indexes of artifacts defined in Markdown
source files. **The Markdown source file remains the source of truth** for
content; the registry provides a machine-readable lookup.

**Requirements** — `trace/requirements/{module}.yaml`:

```yaml
{Group Title}
  {REQ-ID}
    title: {requirement title}
    hazard:
      - {H-ID}
    file: {path to markdown file}
```

**Journeys** — `trace/journeys/{phase}.yaml`:

```yaml
{Group Title}
  {UJ-ID}
    title: {journey title}
    req:
      - {REQ-ID}
    file: {path to markdown file}
```

**Design** — `trace/design/{subtype}.yaml`:

```yaml
{Group Title}
  {DES-ID}
    title: {design title}
    req:
      - {REQ-ID}
    file: {path to markdown file}
```

#### 4.3.2 Code-Level Registries (IMP, UT, IT, E2E)

Code-level registries are manually maintained and serve as the authoritative
record of trace relationships for code artifacts.

**Implementation** — `trace/implementation/{module}.yaml`:

```yaml
{Group Title}
  {IMP-ID}
    title: {implementation title}
    req:
      - {REQ-ID}
    des:
      - {DES-ID}
    files:
      - {file path}
```

An IMP entry MUST have at least one `req` or `des` upstream reference.

**Unit Test** — `trace/unit_test/{module}.yaml`:

```yaml
{Group Title}
  {UT-ID}
    title: {test suite title}
    impl:
      - {IMP-ID}
    files:
      - {file path}
```

**Integration Test** — `trace/integration_test/{module}.yaml`:

```yaml
{Group Title}
  {IT-ID}
    title: {test suite title}
    impl:
      - {IMP-ID}
    files:
      - {file path}
```

**E2E Test** — `trace/e2e/{phase-or-domain}.yaml`:

```yaml
{Group Title}
  {E2E-ID}
    title: {scenario title}
    files:
      - {file path}
```

E2E upstream trace (UJ) is recorded in the `.feature` file itself (§3.4), not
duplicated in the registry.

### 4.4 Registry Maintenance Rules

1. **Creation:** When a new traced artifact is created, its registry entry MUST
   be added in the same commit.
2. **Deletion:** When an artifact is removed, its registry entry MUST be marked
   `deleted` or `obsolete` — never physically removed. This preserves audit
   history.
3. **ID reuse:** Deleted or obsoleted IDs MUST NOT be reused.
4. **File organization:** YAML files are named by module (REQ, IMP, UT, IT),
   phase (UJ, E2E), or subtype (DES).
5. **Ranges:** Bulk deletions may use range notation:
   `{ID-START} - {ID-END}` followed by `deleted`.

---

## 5. Lifecycle Rules

### 5.1 Requirement Evolution

| Action | Rules |
| :--- | :--- |
| **Creation** | New REQ receives the next sequential ID in its module. Status: `Draft`. |
| **Modification** | Requirement text may be updated. Status transitions: `Draft` → `Review` → `Approved` → `Implemented`. |
| **Deprecation** | Set status to `Deprecated`. All downstream `FROM` traces must be updated or removed. The REQ entry is never deleted from the file. |
| **Consolidation** | When merging REQ-A into REQ-B: (1) Update all downstream `FROM` tags referencing REQ-A to reference REQ-B. (2) Verify the hazard chain is preserved — REQ-B must still trace to all hazards REQ-A traced to. (3) Mark REQ-A as `Deprecated` with a note referencing REQ-B. |

### 5.2 Deletion and Consolidation Rules

1. **No physical deletion:** Traced artifacts are never physically deleted from
   source files or registries. They are marked `Deprecated`, `obsolete`, or
   `deleted`.
2. **Cascade obligation:** Deprecating or consolidating an upstream artifact
   triggers a mandatory review of all downstream artifacts that reference it.
3. **Registry annotation:** In YAML registries, deleted/obsolete entries replace
   the entry body with the keyword `deleted` or `obsolete`.

### 5.3 Hazard Propagation Rules

1. **Coverage obligation:** Every hazard (H-xxx) MUST be mitigated by at least
   one requirement (REQ-xxx).
2. **Indirect verification:** Every hazard MUST be indirectly verifiable through
   the MTM chain: `H → REQ → UJ → E2E` for behavioral paths, or
   `H → REQ → IMP → UT` for structural paths.
3. **New hazard impact:** When a new hazard is identified, at least one
   mitigating REQ must be created or linked, and the downstream chain
   (DES/IMP/UJ/Test) must be planned.
4. **Severity escalation:** A severity upgrade (e.g., S3 → S1) triggers
   mandatory review of all mitigating REQs and their verification coverage.

### 5.4 Verification Guarantees

| Guarantee | Rule |
| :--- | :--- |
| **P1 REQ coverage** | All P1 requirements with user-observable behavior MUST be tagged in ≥1 UJ |
| **Hazard indirect coverage** | Every H-xxx MUST have ≥1 mitigating REQ tagged in a UJ |
| **Algorithm exception** | Internal algorithm REQs (not user-observable) MAY be unit-test-only |
| **UQ exception** | Cross-cutting quality attributes (UQ-001–004) use QA test suites, not individual UJs |

---

## 6. Invariants

The following constraints MUST hold at all times. CI validation MUST reject any
commit that violates these invariants.

### 6.1 Orphan Prevention

| ID | Rule |
| :--- | :--- |
| **INV-001** | No orphan IMP: Every IMP MUST trace to at least one REQ or DES. |
| **INV-002** | No orphan UT: Every UT MUST trace to at least one IMP. |
| **INV-003** | No orphan IT: Every IT MUST trace to at least one IMP. |
| **INV-004** | No orphan business E2E: Every business E2E MUST trace to at least one UJ. |
| **INV-005** | No unverified IMP: Every IMP that realizes a non-deprecated REQ MUST have at least one downstream verification artifact (UT, IT, or E2E via UJ). |
| **INV-006** | No UJ without REQ: Every UJ MUST trace to at least one REQ. |

### 6.2 E2E Classification Rules

E2E tests are classified into two categories with distinct invariants:

#### 6.2.1 Business E2E

- MUST trace to at least one UJ via `FROM: @UJ-xxx@`.
- MUST follow the full MTM chain: `H → REQ → UJ → E2E`.
- MUST include the UJ as an execution tag (e.g., `@UJ-B-005`).
- MUST be tagged with `@e2e`.

#### 6.2.2 Technical E2E (Smoke / System)

- MAY trace to H or REQ, or be standalone.
- MUST NOT require UJ trace.
- MUST be explicitly marked with `@smoke` or `@technical-e2e`.
- Trace comment uses: `# @E2E-xxx@ (TECHNICAL)`.
- MUST NOT be used for business validation.

### 6.3 Uniqueness Constraints

| ID | Rule |
| :--- | :--- |
| **INV-007** | No cross-layer duplicate IDs: A numeric+segment combination MUST be globally unique within its prefix namespace (e.g., only one `IMP-MB-CORE-001` may exist). |
| **INV-008** | Single-source definition: Each tag MUST be defined (declared) in exactly one source file. Multiple `FROM` citations from other files are permitted. |

### 6.4 Trace Integrity

| ID | Rule |
| :--- | :--- |
| **INV-009** | No dangling references: Every ID cited in a `FROM` clause MUST exist as a defined tag in the system. |
| **INV-010** | No circular dependencies: The trace graph MUST be acyclic. |
| **INV-011** | Edge type conformance: `FROM` references MUST only cross allowed edge types defined in §2.1. |

---

## 7. Tooling Integration

### 7.1 shtracer Engine Configuration

The `shtracer` engine (ADR 308-DEV) uses this specification to configure its
scanning rules. The machine-readable tool configuration is maintained in
[`.tools/.shtracer.md`](../.tools/.shtracer.md). All paths below are relative
to the repository root.

#### Hazard

- **PATH:** `docs/risk_management/`
- **EXTENSION FILTER:** `*.md`
- **TAG FORMAT:** `@H-[0-9]+@`
- **TAG LINE FORMAT:** `<!--.*-->`

#### Requirement

- **PATH:** `docs/requirements/`
- **EXTENSION FILTER:** `*.md`
- **IGNORE FILTER:** `README.md|traceability_matrix.md`
- **TAG FORMAT:** `@REQ-[A-Z]+-[0-9]+@`
- **TAG LINE FORMAT:** `<!--.*-->`

#### User Journey

- **PATH:** `docs/journeys/`
- **EXTENSION FILTER:** `*.md`
- **IGNORE FILTER:** `README.md`
- **TAG FORMAT:** `@UJ-[A-Z]+-[0-9]+@`
- **TAG LINE FORMAT:** `<!--.*-->`

#### Design

- **PATH:** `docs/architecture/`, `docs/ux/`, `docs/api/`
- **EXTENSION FILTER:** `*.md`
- **IGNORE FILTER:** `000-template.md|README.md`
- **TAG FORMAT:** `@DES-[A-Z]+-[0-9]+@`
- **TAG LINE FORMAT:** `<!--.*-->`

#### Implementation

- **PATH:** `frontend/src/`
- **EXTENSION FILTER:** `*.ts`
- **IGNORE FILTER:** `*.spec.ts|*.int.spec.ts`
- **TAG FORMAT:** `@IMP-[A-Z]+-[A-Z]+-[0-9]+@`
- **TAG LINE FORMAT:** `//.*`

#### Unit Test

- **PATH:** `frontend/src/`
- **EXTENSION FILTER:** `*.spec.ts`
- **IGNORE FILTER:** `*.int.spec.ts`
- **TAG FORMAT:** `@UT-[A-Z]+-[A-Z]+-[0-9]+@`
- **TAG LINE FORMAT:** `//.*`

#### Integration Test

- **PATH:** `frontend/src/`, `frontend/tests/integration/`
- **EXTENSION FILTER:** `*.int.spec.ts`
- **TAG FORMAT:** `@IT-[A-Z]+-[A-Z]+-[0-9]+@`
- **TAG LINE FORMAT:** `//.*`

#### E2E Test

- **PATH:** `frontend/tests/e2e/`
- **EXTENSION FILTER:** `*.feature`
- **TAG FORMAT:** `@E2E-[A-Z]+-[0-9]+@`
- **TAG LINE FORMAT:** `#.*`

### 7.2 Trace Annotation Parsing

The engine parses upstream references using these patterns:

- **FROM annotation:** `\(FROM:\s*(@[A-Z0-9-]+@(?:,\s*@[A-Z0-9-]+@)*)\)`
- **TECHNICAL annotation:** `\(TECHNICAL\)`

### 7.3 CI Validation Pipeline

The CI pipeline MUST execute the following validations in order:

1. **Tag Scan:** Parse all source files for tags matching the regex patterns in
   §7.1.
2. **Registry Cross-Check:** Verify every tag found in source files has a
   corresponding registry entry, and every registry entry references an existing
   source file.
3. **Graph Construction:** Build the directed trace graph from all `FROM`
   annotations.
4. **Invariant Check:** Validate all invariants (§6) against the constructed
   graph.
5. **Orphan Report:** Report any nodes violating orphan prevention rules
   (INV-001 through INV-006).
6. **Coverage Report:** Generate coverage metrics:
   - Percentage of H nodes with ≥1 mitigating REQ.
   - Percentage of P1 REQs with ≥1 UJ.
   - Percentage of IMP nodes with ≥1 downstream UT or IT.

### 7.4 Enforcement Hooks

| Hook | Trigger | Action |
| :--- | :--- | :--- |
| **Pre-commit** | `git commit` | Validate tag format in staged files |
| **Pre-push** | `git push` | Full invariant check on changed files |
| **CI Gate** | Pull Request | Complete trace graph validation + coverage report |
| **Release Gate** | Merge to `main` | Full MTM coverage verification against all invariants |

---

## Appendix A: Non-Enforceable Rules

The following aspects of this specification are documentation-only and cannot be
automatically enforced by CI tooling. They require human review.

| Rule | Reason |
| :--- | :--- |
| Requirement EARS syntax quality | Requires judgment of requirement clarity |
| Journey design principles (realistic aircraft, extend vs. create) | Architectural judgment |
| Hazard severity classification accuracy | Requires domain expert assessment |
| P1 / P2 / P3 priority assignment correctness | Requires safety analysis |
| Design document completeness and correctness | Requires human review |
| Semantic correctness of `FROM` references (right upstream, not just valid format) | Requires domain understanding |

---

## Appendix B: Test Methodology Constraints

The following test methodology rules are referenced by the agent enforcement
layer (Cursor rules) and derive from the project's
[Testing Guidelines](testing/TESTING.md). They are included here to
maintain the STC as the single canonical source for all agent-enforceable rules.

### B.1 Unit Test Isolation

Unit tests (UT) MUST execute in absolute isolation:

- No network calls.
- No disk I/O or local storage access.
- No browser APIs.
- No real Pinia store instances (must be mocked).

Each `describe` block SHOULD verify one logical unit of one or more IMP
artifacts.

### B.2 Integration Test Interaction Scope

Integration tests (IT) MUST verify the interaction (handshake) between two or
more internal modules. External network calls MUST be mocked (e.g., via MSW or
fixture intercepts).

### B.3 E2E Step Definition Constraint

E2E trace tags (`@E2E-xxx@`, `FROM` annotations) MUST be placed exclusively in
`.feature` files. Step definition files (`*.ts`) MUST NOT contain trace tags.
