# AeroDash Architecture — Local Data-Rights (Erasure & Bulk Export)

<!-- @DES-ARCH-011@ (FROM: @REQ-SYS-014@, @REQ-SYS-015@) -->

**Version:** 1.0
**Date:** 2026-05-28
**Status:** Approved
**ADR:** [006-indexeddb-fleet-persistence](adr/006-indexeddb-fleet-persistence.md)

## 1. Overview

This document is the design-level contract for the pilot-facing data-rights
controls required by [`REQ-SYS-014`](../requirements/system.md) (erasure of all
personal data) and [`REQ-SYS-015`](../requirements/system.md) (export of all
personal data). Those requirements are deliberately **solution-free** — they
state the obligation (erase / export *all* personal data the application holds)
without naming any storage mechanism or file format. This document records the
mechanism: which stores exist today, exactly what each control touches, and how
both controls must extend as the personal-data surface grows.

It does **not** restate the privacy-facing data inventory; that lives in
[`PRIVACY.md`](../../PRIVACY.md) §2 (Data Collected) and §5 (Storage &
Retention). This document references that inventory and focuses on the
engineering contract — algorithm, ordering, result shape, failure semantics,
and extension points.

Implementation lives in `frontend/src/modules/aircraft/services/data-rights.service.ts`
(`IMP-SYS-STORE-013`), the repository-wide clear in
`frontend/src/modules/aircraft/services/fleet.repository.ts` (`IMP-AC-STORE-009`),
and the `/privacy` view `frontend/src/views/PrivacyView.vue` (`IMP-UI-VIEW-002`).

## 2. Current-State Personal-Data Surface (v0.4.0-alpha)

All persisted data is local to the browser, unencrypted, and never transmitted
(no backend in this release). Three storage facilities are in scope; the
canonical inventory is [`PRIVACY.md`](../../PRIVACY.md) §5. Summarised for this
contract:

| Store | Location | Holds personal data? | In scope for erasure | In scope for export |
| :---- | :------- | :------------------- | :------------------: | :-----------------: |
| IndexedDB database `aerodash-fleet` (object store `aircraft_profiles`) | Per-origin IndexedDB | Yes — `registration`, `ownerId`, weighing reports, `costPerHour` | Yes | Yes |
| `localStorage` key `aerodash:session:payload` | Per-origin localStorage | No — station weights + an aircraft-id reference | Yes | No (derived session state, not a personal record) |
| `localStorage` key `aerodash-theme` | Per-origin localStorage | No — UI preference | Yes | No |
| `sessionStorage` key `aerodash.session.active` | Per-origin sessionStorage | No — PWA cold-start marker | Yes | No |

**Prefix invariant.** Every AeroDash storage key is prefixed `aerodash`
(matching `/^aerodash([-:.]|$)/i`). Erasure sweeps by this prefix rather than an
enumerated key list, so a future component that adds a new `aerodash`-prefixed
key cannot silently survive a wipe. Any new key **must** keep the prefix.

## 3. Erasure Contract (REQ-SYS-014)

Entry point: `wipeAllLocalData(): Promise<WipeReport>`. Pilot-initiated and
gated behind a typed-confirmation phrase (`DELETE ALL DATA`) in the `/privacy`
view.

### 3.1 Steps

1. Count existing records — readable profiles **plus** dropped/corrupt rows, so
   the result can report "deleted N profiles" without understating what was
   erased (`clear()` removes the whole store, not just the readable subset).
2. Clear the IndexedDB `aerodash-fleet` object store via
   `fleetRepository.deleteAll()`.
3. Remove every `aerodash`-prefixed key from `localStorage`.
4. Remove every `aerodash`-prefixed key from `sessionStorage`.

Steps 2–4 are **best-effort and run unconditionally** — a failure in one store
never short-circuits the others, because erasing as much as possible is the
right outcome for an erasure request. Each failure is recorded in
`WipeReport.failures`.

### 3.2 Result — `WipeReport`

| Field | Meaning |
| :---- | :------ |
| `profilesDeleted` | Count of stored records removed (readable profiles + dropped/corrupt rows) |
| `indexedDbCleared` | `true` once the object store is emptied |
| `localStorageKeysCleared` | Sorted list of removed `localStorage` keys |
| `sessionStorageKeysCleared` | Sorted list of removed `sessionStorage` keys |
| `failures` | `WipeFailure[]` — storage locations that could not be cleared; empty on a complete wipe |
| `complete` | `true` only when every store was cleared with no residual data |
| `clearedAt` | ISO-8601 timestamp of the wipe |

A `WipeFailure` records `{ store: 'indexeddb' \| 'localStorage' \| 'sessionStorage', key, detail }`;
`key` is `null` for a whole-store failure (e.g. a rejected IndexedDB `clear()`).

### 3.3 Failure semantics

- The function **never throws** — it captures each store's failure and returns
  a report. `complete` is `false` whenever `failures` is non-empty.
- **Web Storage unavailable** (private mode, sandboxed iframe): the affected
  step contributes empty cleared-key lists and is **not** a failure — there is
  nothing to erase.
- **IndexedDB `clear()` rejects**, or a per-key `removeItem` throws: recorded as
  a `WipeFailure`; the remaining steps still run.
- **UI obligation:** when `complete` is `false`, the `/privacy` view must show a
  CRITICAL notice, never the success notice. A partial wipe reported as success
  is disallowed by `REQ-SYS-014`'s unwanted-behaviour clause.

## 4. Bulk-Export Contract (REQ-SYS-015)

Entry points: `exportAllProfiles(): Promise<BulkExportResult>` and
`serializeBulkExport(envelope): string`. `BulkExportResult` is
`{ envelope, omitted }` — the serialisable envelope plus the records that could
not be included. The `/privacy` view serialises `envelope` to a `Blob` download
named `aerodash-fleet-<timestamp>.json`, and warns the pilot when `omitted` is
non-empty.

### 4.1 Envelope schema (`exportSchemaVersion: 1`)

| Field | Meaning |
| :---- | :------ |
| `exportSchemaVersion` | Envelope version (`1`). Bumped only when the **envelope** shape changes |
| `exportedAt` | ISO-8601 generation timestamp |
| `profileCount` | Convenience count for importers to verify completeness |
| `profiles` | Every rehydratable aircraft profile, verbatim, sorted by `registration` |

- The **profile** shape is versioned independently via `AircraftProfile.schemaVersion`
  and specified in [Aircraft Profile Exchange File Format](aircraft-exchange-file-format.md)
  (`DES-ARCH-010`); the bulk envelope is a sorted array of that shape plus the
  metadata header above.
- Profiles the current build cannot rehydrate (future `schemaVersion`, corrupt)
  cannot be serialised into the typed envelope, so they are **omitted** from
  `envelope.profiles` and their diagnostics are returned in
  `BulkExportResult.omitted`. The view must surface that count — silently
  dropping them would understate the data held, and a follow-up Delete-All-Data
  wipe (`store.clear()`) would then destroy those same rows. `REQ-SYS-015`
  requires a *complete* copy.
- Output is UTF-8, RFC 8259 JSON, two-space-indented for human readability.

### 4.2 Format rationale

JSON is an implementation choice satisfying the requirement's "structured,
commonly-used, machine-readable" obligation; it round-trips, is diff-friendly
when sorted, and a pilot can open it in any text editor. The requirement does
not mandate JSON — a future format change would not change `REQ-SYS-015`.

## 5. Interaction / UX Notes

- Both destructive paths use confirm-then-act. Erasure additionally requires the
  typed phrase `DELETE ALL DATA` before the destructive button enables.
- Each action surfaces a status notice (success) or an alert (`role="alert"`) on
  failure; there is no Go/No-Go advisory in this flow.
- The `/privacy` route is reachable from the desktop sidebar. (Mobile bottom-nav
  exposure is tracked separately and is not part of this contract.)

## 6. Future Scope

The requirements are storage-agnostic; this section is where the mechanism is
extended as new personal-data classes/stores appear. Each addition **must**
update this document and re-verify `REQ-SYS-014` / `REQ-SYS-015`.

- **User accounts / profiles.** If user-identifying account data is introduced,
  it becomes personal data in scope for both controls: erasure must delete it
  and export must include it.
- **Cloud synchronisation** (planned; see [`PRIVACY.md`](../../PRIVACY.md) §5
  "Future Releases"). Once data can leave the device after opt-in/authentication,
  erasure (`REQ-SYS-014`) must extend to server-side copies and export
  (`REQ-SYS-015`) must include them — local-only erasure/export would no longer
  satisfy the requirements.
- **New local stores.** Any new persisted key must keep the `aerodash` prefix
  (§2 invariant) so the erasure sweep covers it, and must declare whether it is a
  personal record that the bulk export should include.

## 7. Traceability

| Artifact | ID |
| :------- | :- |
| This design | `DES-ARCH-011` (FROM `REQ-SYS-014`, `REQ-SYS-015`) |
| Service implementation | `IMP-SYS-STORE-013` |
| Repository-wide clear | `IMP-AC-STORE-009` |
| Privacy view | `IMP-UI-VIEW-002` |
| Per-profile exchange format | `DES-ARCH-010` |
