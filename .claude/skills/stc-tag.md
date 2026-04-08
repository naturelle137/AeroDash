# Skill: stc-tag

When `/stc-tag` is invoked, execute the following checklist **in order**.
Report findings after each step before proceeding to the next.
Primary source of truth: `docs/stc.md`. Cursor rules are derived summaries only.

---

## Step 1 — Discover changed files

```bash
git diff develop...HEAD --name-only
```

Categorize every changed file:

| Bucket | Pattern | Exclusions |
| :----- | :------ | :--------- |
| **IMP** | `frontend/src/**/*.ts`, `frontend/src/**/*.vue` | `*.spec.ts`, `*.int.spec.ts` |
| **UT** | `frontend/src/**/*.spec.ts` | `*.int.spec.ts` |
| **IT** | `frontend/**/*.int.spec.ts` | — |
| **DES** | `docs/architecture/**/*.md`, `docs/ux/**/*.md`, `docs/api/**/*.md` | `adr/`, `README.md`, `000-template.md` |
| **E2E** | `frontend/tests/e2e/**/*.feature` | — |
| **REQ** | `docs/requirements/**/*.md` | `README.md`, `traceability_matrix.md` |

List every file under its bucket. If a bucket has no files, say "none".

---

## Step 2 — Discover next available IDs

For each relevant prefix namespace, run:

```bash
grep -r "@IMP-PF-" trace/implementation/pf.yaml | grep -oP "@IMP-PF-[A-Z]+-\d+@" | sort | tail -1
# repeat for each module/layer combination present
```

Or read the relevant `trace/` YAML files to find the highest existing number.
The next ID is `max + 1` zero-padded to 3 digits.

**Never reuse a deleted ID.** Check for `deleted: true` entries.

---

## Step 3 — Apply IMP tags (source files)

For every file in the **IMP** bucket:

1. **Tag format:** `// @IMP-{MODULE}-{LAYER}-{NNN}@ (FROM: @REQ-...@[, @DES-...@])`
   - `MODULE` — from `docs/stc.md §1.3`: AC, AP, AD, FE, MB, PF, WX, UI, UQ, SYS, DOC, SC
   - `LAYER` — from `docs/stc.md §1.5`: CORE, STORE, VIEW, ROUTE, PLUGIN, SHARED
   - `NNN` — next available in that module+layer namespace (see Step 2)

2. **Placement:** Immediately before the traced `export`, `function`, `class`, or logical block. One tag per logical exported unit.

3. **Upstream edges (ALLOWED):**
   - `FROM: @REQ-{MODULE}-{NNN}@` — when code directly implements a requirement
   - `FROM: @DES-ARCH-{NNN}@` / `FROM: @DES-UX-{NNN}@` — when code implements a design doc
   - Both simultaneously: `FROM: @REQ-...@, @DES-...@`

4. **FORBIDDEN upstream edges for IMP:**
   - ❌ Never cite `@UT-...@`, `@IT-...@`, `@E2E-...@`, `@UJ-...@`, `@H-...@`
   - ❌ Never cite another `@IMP-...@` as upstream

5. **Verify:** Every IMP tag has ≥ 1 `req` or `des` in its FROM clause (INV-001).

---

## Step 4 — Apply UT tags (unit test files)

For every file in the **UT** bucket:

1. **Tag format:** `// @UT-{MODULE}-{LAYER}-{NNN}@ (FROM: @IMP-...@[, @IMP-...@])`

2. **Placement:** Immediately before **each individual `it()` or `it.each()` call**.
   - ✅ One tag per `it()` — every test case gets its own unique `@UT-...@` ID
   - ❌ Never place at `describe()` level
   - ❌ Never share one ID across multiple `it()` calls

3. **Upstream edges (ALLOWED):**
   - `FROM: @IMP-{MODULE}-{LAYER}-{NNN}@` only
   - Multiple IMP upstreams allowed: `FROM: @IMP-X-001@, @IMP-X-002@`

4. **FORBIDDEN upstream edges for UT:**
   - ❌ Never cite `@REQ-...@`, `@DES-...@`, `@UJ-...@`, `@H-...@`
   - ❌ Never cite `@IT-...@` or `@E2E-...@`

5. **Verify:** Every UT tag has ≥ 1 IMP in its FROM clause (INV-002).

---

## Step 5 — Apply IT tags (integration test files)

For every file in the **IT** bucket (same rules as UT):

1. **Tag format:** `// @IT-{MODULE}-{LAYER}-{NNN}@ (FROM: @IMP-...@[, @IMP-...@])`
2. **Placement:** Immediately before each `it()` or `it.each()` call.
3. **ALLOWED upstream:** `@IMP-...@` only.
4. **FORBIDDEN:** `@REQ-...@`, `@DES-...@`, `@UJ-...@`, `@H-...@`, `@UT-...@`, `@E2E-...@`.

---

## Step 6 — Apply DES tags (architecture/UX/API docs)

For every file in the **DES** bucket:

1. **Tag format:** `<!-- @DES-{SUBTYPE}-{NNN}@ (FROM: @REQ-...@[, @REQ-...@]) -->`
   - SUBTYPE: `ARCH` (architecture/data models), `UX` (UX flows), `API` (API contracts)

2. **Placement:** On the line immediately before the `##` or `###` heading that the design section begins with.
   - A blank line between the tag and the heading is acceptable: `<!-- tag -->\n\n## Heading`

3. **ALLOWED upstream:** `@REQ-{MODULE}-{NNN}@` only.
4. **FORBIDDEN:** `@H-...@`, `@IMP-...@`, `@UT-...@`, `@DES-...@` (no cross-DES traces).

5. **Verify:** Check that the cited REQs actually exist in `docs/requirements/`.

---

## Step 7 — Apply E2E tags (feature files)

For every file in the **E2E** bucket:

**Business scenario** (traces to a user journey):

```gherkin
# @E2E-{PHASE}-{NNN}@ (FROM: @UJ-{PHASE}-{NNN}@)
@UJ-B-005 @phase-B @e2e
Scenario: ...
```

**Technical scenario** (no user journey):

```gherkin
# @E2E-{PHASE}-{NNN}@ (TECHNICAL)
@phase-D @smoke @technical-e2e
Scenario: ...
```

- Tags go in `.feature` files **only** — never in `.ts` step definitions.
- Place the `# @E2E-...@` comment immediately above the Gherkin execution tags, before `Scenario:`.
- FORBIDDEN upstream: `@IMP-...@`, `@UT-...@`, `@REQ-...@`, `@DES-...@`.

---

## Step 8 — Update registry YAML files

For every new tag created, add an entry to the appropriate registry in the **same commit**.

### IMP registry — `trace/implementation/{module-lowercase}.yaml`

```yaml
Performance Core
  IMP-PF-CORE-001
    title: Bilinear interpolation for POH performance tables
    req:
      - REQ-PF-002
    des:
      - DES-ARCH-006
    files:
      - frontend/src/core/logic/performance.bilinear-interpolation.ts
```

### UT registry — `trace/unit_test/{module-lowercase}.yaml`

```yaml
Performance Core Unit Tests
  UT-PF-CORE-001
    title: VEC-TOR-001 exact grid point 850 kg 0 ft TOR
    impl:
      - IMP-PF-CORE-001
    files:
      - frontend/src/core/logic/performance.bilinear-interpolation.spec.ts
```

### DES registry — `trace/design/{subtype-lowercase}.yaml`

```yaml
Architecture Design Documents
  DES-ARCH-006
    title: Performance Bilinear Interpolation Contract
    req:
      - REQ-PF-002
    file: docs/architecture/performance-bilinear-interpolation-contract.md
```

### REQ registry — `trace/requirements/{module-lowercase}.yaml`

```yaml
General System Requirements
  REQ-SYS-013
    title: Session payload persistence across page reloads
    hazard: []
    file: docs/requirements/system.md
```

**Registry rules:**

- Add entry in the same commit as the tagged artifact.
- When deleting an artifact, mark `deleted: true` — never remove the entry.
- Every `file`/`files` path must exist on disk.
- IMP entry must have ≥ 1 `req` or `des` upstream reference.

---

## Step 9 — Self-check invariants

Run through each invariant from `docs/stc.md §5`:

| INV | Check |
| :-- | :---- |
| INV-001 | Every IMP tag has ≥ 1 `req` or `des` in FROM |
| INV-002 | Every UT tag has ≥ 1 IMP in FROM |
| INV-003 | Every IT tag has ≥ 1 IMP in FROM |
| INV-004 | Every business E2E has ≥ 1 UJ in FROM |
| INV-007 | No duplicate IDs within same prefix namespace |
| INV-009 | Every FROM target actually exists |
| INV-010 | No cycles in the trace DAG |
| INV-011 | Only allowed edge types used |

Quick check for duplicate IDs:

```bash
grep -r "@IMP-PF-CORE-" trace/implementation/pf.yaml | grep -oP "@IMP-PF-CORE-\d+@" | sort | uniq -d
```

Quick check for forbidden UT→REQ edges:

```bash
grep -n "FROM:.*@REQ-" frontend/src/**/*.spec.ts
```

---

## Step 10 — Commit message guidance

Use conventional commits format. Reference issue and REQ IDs:

```text
chore(repo): fix STC trace tags and registries for {module} (refs #{issue})

- Add @DES-ARCH-006@ tag to performance contract doc
- Add per-test @UT-PF-CORE-001..040@ tags (IMP-only upstream)
- Fix @IMP-SYS-CORE-009@ ID conflict (was 005, already registered to units.ts)
- Create trace/design/arch.yaml, trace/implementation/pf.yaml, trace/unit_test/pf.yaml
- Add REQ-SYS-013 to docs/requirements/system.md
```

---

## Quick Reference: Allowed Edges

```text
H → REQ → UJ  → E2E
H → REQ → DES → IMP → UT
H → REQ       → IMP → IT
```

| Tag | FROM must cite | FROM must NOT cite |
| :-- | :------------- | :----------------- |
| REQ | H (optional) | IMP, UT, IT, E2E, DES |
| DES | REQ | H, IMP, UT, IT, E2E |
| IMP | REQ and/or DES | H, UJ, UT, IT, E2E, other IMP |
| UT | IMP only | REQ, DES, H, UJ, IT, E2E |
| IT | IMP only | REQ, DES, H, UJ, UT, E2E |
| E2E (business) | UJ | REQ, DES, IMP, UT, IT, H |
| E2E (technical) | none (TECHNICAL) | anything |
