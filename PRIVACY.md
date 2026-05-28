# Privacy & Data Protection

- version: 1.3
- date: 2026-05-28
- status: active

---

## 1. Overview

AeroDash is an offline-first, client-side single-page application (SPA) for flight preparation. It runs entirely in the user's browser. **No data is transmitted to any server, backend, or third-party service.** There is no telemetry, analytics, tracking, or remote logging.

## 2. Data Collected

All persisted data is stored **locally on the device, unencrypted**, and is **never transmitted** to any server (there is no backend in this release). Storage locations are listed in §5.

| Data Category              | Source                          | Storage                                  | Contains PII?                                                                                  |
| -------------------------- | ------------------------------- | ---------------------------------------- | ---------------------------------------------------------------------------------------------- |
| Aircraft profiles (fleet)  | Entered/imported by the pilot   | IndexedDB `aerodash-fleet`               | Yes — registration, `ownerId`, weighing reports, `costPerHour` (identify real aircraft/owners) |
| Saved session (M&B inputs) | Entered by the pilot at runtime | localStorage `aerodash:session:payload`  | No — station weights and interaction flags only                                                |
| Session-active flag        | Set by the app at startup       | sessionStorage `aerodash.session.active` | No — a single `'1'` marker for PWA cold-start detection                                        |
| Calculation results        | Computed from inputs            | In-memory only (not persisted)           | No                                                                                             |

No personal accounts, authentication, or cookies exist. Saved-session and fleet data persist across page reloads as described in §5.

## 3. Data Minimisation (GDPR Art. 5(1)(c))

The application processes only the minimum data required for Mass & Balance calculation:

- Aircraft physical parameters (mass, arm, envelope limits)
- User-entered station weights
- Derived results (CG position, total mass, violations)

No data beyond what is necessary for the M&B computation is collected or processed.

## 4. Purpose Limitation (GDPR Art. 5(1)(b))

All data processed by AeroDash is used solely for the purpose of computing Mass & Balance results. Data is not repurposed, shared, or aggregated.

## 5. Storage & Retention Policy (GDPR Art. 5(1)(e))

### Current State (v0.4.0-alpha)

This release **does** persist data on the device. All storage is **local to the browser, unencrypted, and never transmitted** — there is no backend, sync, or remote logging in this release. Three storage facilities are used:

1. **IndexedDB — database `aerodash-fleet`** (object store `aircraft_profiles`).
   Holds the pilot's saved aircraft fleet. Each profile may contain PII or
   PII-adjacent data: the aircraft `registration` mark, an `ownerId`, one or more
   weighing reports (basic empty mass, empty CG, weighing dates), and an optional
   `costPerHour`, alongside the technical M&B/performance parameters. Persists
   until the pilot deletes the profile, runs the in-app *Delete All Data* action,
   or clears browser storage.
2. **localStorage — keys prefixed with `aerodash`.**
   - `aerodash:session:payload` — auto-saved Mass & Balance session (active
     aircraft id, active certification category, per-station weights with
     interaction flags). No personal data beyond the aircraft id reference.
     Overwritten on change, cleared on aircraft switch, and removed if it
     fails validation.
   - `aerodash-theme` — pilot's light/dark UI preference. Not personal data.
   - The *Delete All Data* action removes every `aerodash`-prefixed key
     irrespective of suffix, so future keys cannot silently survive a wipe.
3. **sessionStorage — key `aerodash.session.active`.**
   A single `'1'` marker used only to detect PWA cold starts versus in-session
   updates. Contains no personal data and is cleared automatically when the last
   tab for the origin is closed, and is also cleared by the in-app *Delete All
   Data* action.

**User control today:** AeroDash ships a dedicated **Privacy view** at
`/privacy` exposing two GDPR-aligned actions:

1. **Bulk JSON Export (Art. 15 / Art. 20).** Downloads every *readable*
   aircraft profile as a single schema-versioned JSON file
   (`aerodash-fleet-<timestamp>.json`). If any stored profile cannot be read
   by the running build (e.g. it was written by a newer app version after a
   PWA cache rollback), it is excluded from the file **and the export view
   warns you how many profiles were left out**, so the copy is never silently
   incomplete — update AeroDash to recover those profiles before deleting.
2. **Delete All Data (Art. 17).** After explicit confirmation (typed
   confirmation phrase), clears the entire `aerodash-fleet` IndexedDB store
   plus every `aerodash`-prefixed localStorage and sessionStorage key. The
   action is best-effort across all three stores — a failure in one never
   stops the others, so as much data as possible is removed. If **any** part
   cannot be deleted, the app reports the failure as a critical notice and
   does **not** indicate the erasure as complete; retry, then use the
   browser's "Clear site data" for the AeroDash origin if it still fails.

**On retention (Art. 5(1)(e)):** AeroDash does not auto-expire stored data.
A retention period bounds how long personal data is kept relative to the
purpose it was collected for — it is *not* a function of how old an
aircraft's weighing report is (a basic empty mass can remain valid and in
active use for years). With no inactivity signal recorded today, automatic
age-based deletion would risk destroying data the pilot still relies on, so
retention is exercised by the pilot through the per-profile delete and the
*Delete All Data* control above rather than by a time-based purge.

Individual aircraft profiles can still be deleted from within the fleet
view. A pilot can also remove all stored data outside the app by clearing
the site's browser storage (browser settings → site data / "Clear site
data" for the AeroDash origin).

**Residual exposure:** Because storage is unencrypted and local, anyone with
access to the device's browser profile can read the saved fleet (including
registration marks and owner identifiers) **until** the pilot exercises the
*Delete All Data* control above. This is acceptable for an offline,
single-user, on-device tool but is documented here for transparency.

### Future Releases

The following controls remain **planned but not yet implemented**:

1. **No server sync without consent:** If cloud synchronisation is added
   (Milestone #7), data will only leave the device after explicit user opt-in
   and authentication.

## 6. Data Subject Rights (GDPR Arts. 15–20)

### Current State (v0.4.0-alpha)

Personal data is stored locally on the device (see §5), but it is never
transmitted and no accounts exist. The data subject is the device's sole user,
who has full physical control over the data:

- **Right of access (Art. 15):** All stored data is on the user's own device.
  Aircraft profiles are viewable in the fleet view, and the Privacy view's
  *Bulk JSON Export* (`/privacy`) produces a machine-readable dump of the
  full fleet.
- **Right to rectification (Art. 16):** Aircraft profiles can be edited in
  the app (Fleet → edit; the Draft/Verified FSM tracks who introduced each
  revision).
- **Right to erasure (Art. 17):** Individual profiles can be deleted in the
  fleet view. The Privacy view's *Delete All Data* action erases the entire
  fleet plus every `aerodash`-prefixed storage key in a single confirmed
  operation.
- **Right to data portability (Art. 20):** The single-profile import/export
  flow on each Fleet card continues to handle one profile at a time. The
  Privacy view's *Bulk JSON Export* produces an envelope of every profile in
  one schema-versioned file, suitable for archival or migration to another
  device.

### Future Releases

The following mechanism remains **planned but not yet implemented**:

- **Bulk JSON Import (Art. 20).** The bulk export envelope round-trips, but
  the corresponding "import this whole file" UI is not yet wired (one-at-a-time
  import works today via the existing Fleet import card). Tracked alongside
  Milestone #7 cloud-sync onboarding.

## 7. Third-Party Dependencies

- No third-party analytics, advertising, or tracking libraries are included.
- Runtime dependencies are limited to Vue.js, Pinia, Vue Router, and Zod.
- Dependency security is monitored via Dependabot and `pnpm audit` in CI.

## 8. Security Measures

- Offline-first architecture eliminates network-based attack vectors.
- Input validation via Zod schemas at the adapter boundary.
- No credentials, tokens, or secrets are stored in the application.
- CI pipeline enforces frozen lockfiles and dependency auditing.

## 9. Contact

For privacy-related questions, open an issue in the project repository with the label `privacy`.
