# AeroDash Architecture — Local Data-Rights (Erasure & Bulk Export)

**Version:** 1.0
**Date:** 2026-05-28
**Status:** Approved
**ADR:** [006-indexeddb-fleet-persistence](adr/006-indexeddb-fleet-persistence.md)

## 1. Scope

Specifies the mechanism of the two pilot-facing data-rights controls: erasure
of all locally held personal data, and bulk export of it.

The privacy-facing data inventory is in [`PRIVACY.md`](../../PRIVACY.md) §2 (Data
Collected) and §5 (Storage & Retention).

## 2. Personal-Data Surface (v0.4.0-alpha)

All persisted data is local to the browser, unencrypted, and not transmitted
(no backend in this release). Three storage facilities are in scope:

| Store | Location | Personal data | Erased | Exported |
| :---- | :------- | :------------ | :----: | :------: |
| IndexedDB `aerodash-fleet` (store `aircraft_profiles`) | Per-origin IndexedDB | `registration`, `ownerId`, weighing reports, `costPerHour` | Yes | Yes |
| `localStorage` `aerodash:session:payload` | Per-origin localStorage | Station weights + aircraft-id reference | Yes | No |
| `localStorage` `aerodash-theme` | Per-origin localStorage | UI preference | Yes | No |
| `sessionStorage` `aerodash.session.active` | Per-origin sessionStorage | PWA cold-start marker | Yes | No |

**Prefix invariant.** Every AeroDash storage key matches
`/^aerodash([-:.]|$)/i`. Erasure sweeps by this prefix; any new key keeps it.

## 3. Erasure Contract

<!-- @DES-ARCH-011@ (FROM: @REQ-SYS-014@) -->

Entry point: `wipeAllLocalData(): Promise<WipeReport>`. Gated in the `/privacy`
view behind the typed phrase `DELETE ALL DATA`.

### 3.1 Steps

1. Count existing records (readable profiles + dropped/corrupt rows).
2. Clear the IndexedDB `aerodash-fleet` object store via `fleetRepository.deleteAll()`.
3. Remove every `aerodash`-prefixed key from `localStorage`.
4. Remove every `aerodash`-prefixed key from `sessionStorage`.

Steps 2–4 are best-effort and run unconditionally; a failure in one store does
not short-circuit the others. Each failure is recorded in `WipeReport.failures`.

### 3.2 Result — `WipeReport`

| Field | Meaning |
| :---- | :------ |
| `profilesDeleted` | Stored records removed (readable + dropped/corrupt rows); `null` when the pre-deletion count could not be read |
| `indexedDbCleared` | `true` once the object store is emptied |
| `localStorageKeysCleared` | Sorted list of removed `localStorage` keys |
| `sessionStorageKeysCleared` | Sorted list of removed `sessionStorage` keys |
| `failures` | `WipeFailure[]`; empty on a complete wipe |
| `complete` | `true` only when every store was cleared with no residual data |
| `clearedAt` | ISO-8601 timestamp of the wipe |

A `WipeFailure` is `{ store: 'indexeddb' \| 'localStorage' \| 'sessionStorage', key, detail }`;
`key` is `null` for a whole-store failure (e.g. a rejected IndexedDB `clear()`).

### 3.3 Failure handling

- The function never throws; `complete` is `false` when `failures` is non-empty.
- Web Storage unavailable (private mode, sandboxed iframe): empty cleared-key
  lists, not recorded as a failure.
- A rejected IndexedDB `clear()`, or a `removeItem` that throws, is recorded as a
  `WipeFailure`; the remaining steps still run.
- When `complete` is `false`, the `/privacy` view shows a CRITICAL notice, not
  the success notice.

## 4. Bulk-Export Contract

<!-- @DES-ARCH-012@ (FROM: @REQ-SYS-015@) -->

Entry points: `exportAllProfiles(): Promise<BulkExportResult>` and
`serializeBulkExport(envelope): string`. `BulkExportResult` is
`{ envelope, omitted }`. The `/privacy` view serialises `envelope` to a `Blob`
download named `aerodash-fleet-<timestamp>.json` and shows the `omitted` count
when non-empty.

### 4.1 Envelope (`exportSchemaVersion: 1`)

| Field | Meaning |
| :---- | :------ |
| `exportSchemaVersion` | Envelope version (`1`); bumped only when the envelope shape changes |
| `exportedAt` | ISO-8601 generation timestamp |
| `profileCount` | Count of included profiles |
| `profiles` | Included aircraft profiles, sorted by `registration` |

- Output is UTF-8, RFC 8259 JSON, two-space-indented.
- The per-profile shape is defined in
  [Aircraft Profile Exchange File Format](aircraft-exchange-file-format.md).
- Records this build cannot rehydrate (future `schemaVersion`, corrupt) are
  omitted from `envelope.profiles` and returned in `BulkExportResult.omitted`;
  the `/privacy` view surfaces that count.

## 5. Interaction

- Both actions are pilot-initiated from the `/privacy` view.
- Erasure enables its button only after the phrase `DELETE ALL DATA` is typed.
- Export and a completed erasure show a status notice; an incomplete erasure
  (`complete: false`) shows a CRITICAL notice; a thrown error shows an alert.
- When the fleet load drops unreadable rows (future `schemaVersion` / corrupt),
  the view shows a standing `role="alert"` warning of the count — independent of
  any export — and repeats it in the wipe confirmation dialog. The count is read
  from `fleetStore.unreadableProfileCount`.

## 6. Future Scope

Extension points as the personal-data surface grows:

- **New local store:** keeps the `aerodash` prefix (§2) so the erasure sweep
  covers it; declares whether the bulk export includes it.
- **User accounts / profiles:** in scope for both controls — erasure deletes
  them, export includes them.
- **Cloud synchronisation:** erasure and export extend to server-side data after
  opt-in/authentication.
