# Data-Constants Registry

Source-cited provenance for safety-relevant **hardcoded data constants** whose
silent revision could distort a Go/No-Go advisory — fuel densities and occupant
masses. Closes the PR-014 process gap (v0.3.0-alpha audit): hardcoded fuel
densities and standard occupant masses previously had no source citation,
effective-date tracking, or drift detection, so an upstream standard revision
would be silently ignored (issue #275).

The runtime values live in code (P1 `core/`, P2 `modules/`). This registry does
**not** redefine them — it records, per value, **where it came from** and **when
it must be re-verified**, and a CI gate fails the build if code and registry
diverge or an entry goes stale.

## Files

| File | Role |
| :--- | :--- |
| [`registry.json`](registry.json) | **Single source of truth** (machine-readable). Each constant: value, unit, source, effective date, review-by date, requirement, hazard, code reference. |
| `README.md` (this file) | Human-readable schema, policy, and update procedure. `registry.json` is authoritative on conflict. |

## Registered constants

| ID | Value | Unit | Source (abridged) | Effective | Review by | REQ / H |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| `fuel-density-avgas-mogas` | `0.72` | kg/L | ASTM D910 AvGas 100LL ≈ 0.72 kg/L @ 15 °C | 2026-05-28 | 2028-05-28 | REQ-FE-001 / H-002 |
| `fuel-density-jet-diesel` | `0.84` | kg/L | ASTM D1655 / DEF STAN 91-091 Jet A-1 conservative upper bound | 2026-05-28 | 2028-05-28 | REQ-FE-001 / H-002 |
| `fuel-density-fallback` | `0.84` | kg/L | Conservative fallback = heaviest catalogued density (fail-closed) | 2026-05-28 | 2028-05-28 | REQ-FE-001 / H-002 |
| `occupant-preset-masses-kg` | `[55, 70, 85]` | kg | Representative adult masses for one-tap entry (not regulatory) | 2026-05-28 | 2028-05-28 | REQ-UQ-001 / H-011 |
| `occupant-preset-masses-lb` | `[120, 160, 200]` | lb | Representative adult masses for one-tap entry (not regulatory) | 2026-05-28 | 2028-05-28 | REQ-UQ-001 / H-011 |

> Occupant presets are **convenience shortcuts**, not authoritative masses. The
> pilot always enters the actual or applicable standard mass. EASA standard-mass
> reference for context: AMC1 CAT.POL.MAB.105 / CS-23.

## Entry schema (`registry.json`)

Each object in `constants[]` carries:

- `id` — unique kebab-case key.
- `category` — grouping (`fuel-density`, `occupant-mass`).
- `description` — what the value is and where it is used.
- `value` — the value, mirrored from code (number or array). The gate fails if it drifts from code.
- `unit` — physical unit.
- `source` — non-empty citation (standard, requirement, or documented engineering rationale). An empty/missing source fails the gate (**uncited**).
- `effectiveDate` — ISO `YYYY-MM-DD` the value was last verified against its source.
- `reviewBy` — ISO `YYYY-MM-DD` by which the source must be re-checked. Once in the past the entry is **stale** and the gate fails.
- `requirement` — upstream `REQ-…` id.
- `hazard` — related `H-…` id (when applicable).
- `code.file` / `code.symbol` — where the value is defined in source.

## Staleness policy

Default review cadence is **24 months** (`reviewPolicy.defaultIntervalMonths`).
The gate compares each `reviewBy` against the current date: an entry whose
`reviewBy` has passed fails CI. This is deliberate — a time-based safety prompt
(like a certificate-expiry check) that forces periodic re-verification of every
cited source rather than letting an upstream revision pass silently.

## The CI gate

`frontend/scripts/data-constants/` validates this registry. It runs as a Vitest
spec wired into `pnpm test:unit` (and therefore CI) — **no GitHub Actions
workflow change is required**:

- **Uncited** — an entry with an empty/missing `source` fails.
- **Stale** — an entry whose `reviewBy` is in the past fails.
- **Schema** — missing/ill-formed required fields (`id`, `unit`, dates,
  `requirement`, `code.*`) fail.
- **Drift** — the spec imports the real code constants and asserts each `value`
  matches; a code change without a registry update fails.

Run locally:

```bash
# Citation + staleness + schema (pure-node CLI; non-zero exit on violation)
pnpm --filter frontend check:data-constants

# Full gate incl. code-vs-registry drift (the CI surface)
pnpm test:unit
```

## Updating an entry

1. Re-verify the value against its cited `source`.
2. Update `value` in code **and** `registry.json` together.
3. Bump `effectiveDate` to today and `reviewBy` forward (default +24 months).
4. Run `pnpm --filter frontend check:data-constants` and `pnpm test:unit`.

## Adding a constant

1. Add the runtime value in code with an inline comment referencing
   `docs/data_constants/registry.json#<id>`.
2. Add a `constants[]` entry with every schema field populated.
3. Add a drift assertion in
   `frontend/scripts/data-constants/__tests__/registry-gate.spec.ts`.
4. Run the gate commands above.
