# /milestone.check — Repo gap pre-release audit

- `role`: release-readiness auditor; milestone-vs-repo gap check
- `goal`: target milestone content vs repo state; gaps before release phase
- `repo`: `naturelle137/AeroDash`
- `input`: `<milestone-number-or-version>`
- `input.example`: `/milestone.check 12` | `/milestone.check 0.7.0`
- `input.invalid`: return only `Usage: /milestone.check <target_version>`
- `github.mcp.tools`: `search_issues`, `issue_read`
- `github.mcp.read`:
  - q1 `repo:naturelle137/AeroDash milestone:"<milestone number>"`
  - q2 `repo:naturelle137/AeroDash milestone:"<target_version>"`
  - q3 `repo:naturelle137/AeroDash milestone:"v<target_version>"`
  - q1 hit -> `issue_read` `get`
  - q1 not hit -> continue:
    - q2+q3 empty -> blocked
    - q2+q3 both hit; different sets -> blocked
    - chosen set: exact versioned scope only
    - each hit -> `issue_read` `get`
- `milestone.item.exact`:
  - `Product`: user-visible outcome | requirement definition | docs-visible scope
  - `Engineering`: implementation | enforcement | tooling | validation
  - `Evidence`: code | test | doc | config | workflow | changelog | trace
  - `Status`: `ready` | `partial` | `missing` | `drift` | `blocked`
- `discover.milestone`: title; body; labels; issue type; state
- `discover.milestone.normalize`:
  - dedupe overlap
  - split multi-outcome issue text -> atomic checks
  - map each atomic check -> `Product|Engineering`
  - acceptance signal from explicit issue text only
  - no invented scope
- `discover.repo.order`:
  - `CHANGELOG.md`
  - `package.json`
  - `.release-it.json`
  - `.github/workflows/release.yml`
  - `docs/development/implementation-roadmap.md`
  - `README.md`
  - `ARCHITECTURE.md`
  - `docs/**`
  - `trace/**`
  - `frontend/package.json`
  - `frontend/src/**`
  - `frontend/tests/**`
- `must`:
  - each milestone atomic check -> repo evidence | explicit gap
  - each `Product` check -> runtime | UX | docs-visible evidence
  - each `Engineering` check -> implementation | validation evidence
  - safety-critical scope -> validation evidence; no exception
  - release-path artifacts checked
  - contradictions visible; no silent merge
- `gap.rule`:
  - milestone check complete in repo -> `ready`
  - evidence exists; acceptance incomplete -> `partial`
  - no matching repo evidence -> `missing`
  - repo scope exists; no milestone trace -> `drift`
  - ambiguous scope | missing release artifact | unsafe unvalidated safety scope -> `blocked`
- `release.artifacts.required`:
  - `CHANGELOG.md`: target entry | `Unreleased` source coverage
  - `package.json`: version path coherent with target
  - `.release-it.json`: tag + branch policy coherent with target
  - `.github/workflows/release.yml`: present
- `procedure`:
  - read milestone issue set via GitHub MCP
  - extract atomic checks + expected evidence
  - read repo evidence in order
  - match atomic checks -> repo evidence
  - classify `ready|partial|missing|drift|blocked`
  - elevate release-start blockers

## Output (exactly 4 sections; nothing else)

### 1. Milestone Scope

- `- #<n> | Product|Engineering | <atomic check> | need:<evidence-set> | <status>`

Rules: one bullet per atomic check; grouped by issue; closed issue with `missing|partial|blocked` -> keep visible.

### 2. Repo Gap Matrix

| Issue | Atomic Check | Repo Evidence | Status | Gap |

Rules: `Repo Evidence`: file paths only | `none`; `Gap`: shortest missing proof | missing artifact | drift note; no empty in-scope rows.

### 3. Release Blockers

- `- <class> | <issue/artifact> | <blocked-by>`

Rules: classes only: `implementation` | `validation` | `docs` | `traceability` | `release-config` | `drift`; no blocker -> `- none`; safety-critical `partial|missing|blocked` -> blocker.

### 4. Pre-Release Actions

- `- P<1|2|3> | <short action> | <issue/artifact refs>`

Rules: blocker-removal actions only; smallest closure step first; no explanations.
