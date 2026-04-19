# ADR-316: PWA Update Lifecycle — Cold-Start Silent Update Exception

* **Status:** Accepted
* **Date:** 2026-04-19

## Context

`registerType: 'prompt'` (vite-plugin-pwa) was chosen to satisfy REQ-SYS-005:
pilots must explicitly consent before a Service Worker update is applied, so
that in-flight M&B / Performance calculations are never silently invalidated
(H-019). This works correctly for the in-session case.

However, the "Reload to update" banner also fires on cold starts — a fresh
browser tab opened with connectivity after a new build has been deployed. On a
cold start there is no active session, no in-flight calculation, and therefore
no H-019 exposure. Requiring the pilot to acknowledge a banner here adds
unnecessary friction without safety benefit (pilot complaint, issue #TBD).

## Decision

Introduce a **session classifier** using `sessionStorage`:

* Key: `aerodash.session.active` (value `'1'`).
* At bootstrap (`main.ts`), before `registerSW` is called:
  1. Read `wasActiveSession = sessionStorage.getItem(key) === '1'`.
  2. Immediately write `sessionStorage.setItem(key, '1')`.
* `sessionStorage` is scoped to the browser tab and cleared when the last tab
  for the origin closes — this is the precise definition of a cold start.

When `onNeedRefresh` fires, branch on `wasActiveSession`:

* **`false` (cold start):** call `pwaStore.applyColdStartUpdate()` — SW update
  applied silently. H-019 is **not triggered** (no session state to protect).
* **`true` (in-session):** call `pwaStore.onNeedsRefresh()` — banner shown,
  explicit consent required. H-019 mitigation remains in force.

### Cold-Start Silent Update Exception — Definition

> A **cold start** is any navigation where `sessionStorage['aerodash.session.active']`
> was absent at the time `captureAndMarkSession()` ran during bootstrap.

Fail-safe: if `sessionStorage` throws (Safari private mode, sandboxed iframe),
`captureAndMarkSession()` returns `true`, routing to the banner path and
preserving the H-019 mitigation.

## Consequences

### Positive

* Cold-start users always receive the latest build automatically; no
  spurious banner on fresh-tab opens with connectivity.
* H-019 / REQ-SYS-005 mitigation is fully preserved for the in-session case.
* The classifier is pure, synchronous, and trivially unit-testable
  (`captureAndMarkSession`, `createUpdateHandler` in `main.ts`).

### Negative

* If a pilot opens a new tab from an existing tab (e.g. Cmd+click) the
  `sessionStorage` key is **not** inherited — the new tab is treated as a cold
  start. This is correct behaviour: the new tab has no in-flight calculation.

## Compliance

REQ-SYS-005 (explicit consent for SW updates during active sessions) and H-019
(no silent logic swap during computation) are satisfied. The cold-start path is
explicitly excluded from the H-019 hazard because no calculation state exists
to be invalidated.
