# Nullable local owner evidence

Synthetic software checks only; no operational POH/AFM validation.

## Production browser flow

The built PWA registers its service worker online, then reloads from its actual
cache with the browser offline. At 390×1000 and 1440×1000 the test:

1. Creates `D-NULL` through the real six-step wizard and asserts persisted
   `ownerId: null`, schema version 3 and draft status.
2. Imports a synthetic v2 profile with `legacy-owner` (two leading and trailing spaces) and declared
   lb/m/°F/ft performance units; checks the exact owner, raw points and units
   in IndexedDB, then reloads offline and compares the complete stored records.
3. Downloads the actual Privacy backup and checks every complete profile,
   erases only this isolated context's synthetic data, restores the downloaded
   backup through Fleet confirmation, and reloads offline. New profile IDs,
   nullable/legacy owners and all remaining fields are checked.

Screenshots show the real flow; owner values are asserted against storage and
the downloaded JSON, since the UI deliberately has no owner field.

| State | Mobile | Desktop |
| --- | --- | --- |
| Ownerless wizard result | [390](390-offline-ownerless-created.png) | [1440](1440-offline-ownerless-created.png) |
| Legacy profile after reload | [390](390-offline-legacy-reloaded.png) | [1440](1440-offline-legacy-reloaded.png) |
| Restored profiles after reload | [390](390-offline-restored-owners.png) | [1440](1440-offline-restored-owners.png) |

[390 console](390-console.json) and [1440 console](1440-console.json) retain
seven existing preview-server meta-CSP `frame-ancestors` diagnostics each.
The regression rejects every other console error and page exception. Screenshots
were visually inspected at both widths. `SHA256SUMS` covers images and console.
Full traces and actual synthetic backups remain in the author's job evidence.

## Checks

Commands ran from the repository root in `web-dev`, Node 24.18.0 / pnpm 10.32.1.

| Command | Result |
| --- | --- |
| `pnpm install --frozen-lockfile` | Passed |
| `pnpm lint` | Passed |
| `pnpm test:unit` | 2349 passed, 110 files |
| `pnpm test:integration` | 237 passed, 24 files |
| `pnpm build` | Passed, including type check |
| `pnpm --filter frontend test:p1:coverage` | Passed; 99.35% lines, 97.46% branches, 100% functions |
| `pnpm --filter frontend test:mutation --mutate src/core/adapters/aircraft.schema.ts,src/core/logic/profile-migrations.ts --concurrency 4` | Passed; 82.26%, both changed P1 files |
| `CI=1 pnpm test:e2e --project=chromium` | 97 passed; unfinished `@wip` scenarios excluded |
| `pnpm --filter frontend exec playwright test --config playwright.offline.config.ts nullable-owner fleet-restore offline.spec` | 8 passed at 390/1440 |

The owner flow additionally passed with `--reporter=list` and an explicit job
output directory to preserve evidence when the separate E2E runner clears its
shared output. Initial failures were stale v2 test expectations and an incorrect
assumption that export ordering equals IndexedDB key ordering; final assertions
compare every profile independently of order. No runtime safety gate was relaxed.

Unit migration cases explicitly cover v0/v1/v2/v3, omitted/null/string owners,
invalid owner types, unchanged draft/verified state, provenance and raw source
data. Repository integration covers no read writeback, new database null writes,
legacy-index retention and exchange/reload. Future-version/corrupt rejection,
manual preparation, fleet restore/abort and erase remain covered.
