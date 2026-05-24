# Privacy & Data Protection

- version: 1.1
- date: 2026-05-24
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

### Current State (v0.3.0-alpha)

This release **does** persist data on the device. All storage is **local to the browser, unencrypted, and never transmitted** — there is no backend, sync, or remote logging in this release. Three storage facilities are used:

1. **IndexedDB — database `aerodash-fleet`** (object store `aircraft_profiles`).
   Holds the pilot's saved aircraft fleet. Each profile may contain PII or
   PII-adjacent data: the aircraft `registration` mark, an `ownerId`, one or more
   weighing reports (basic empty mass, empty CG, weighing dates), and an optional
   `costPerHour`, alongside the technical M&B/performance parameters. Persists
   until the pilot deletes the profile or clears browser storage.
2. **localStorage — key `aerodash:session:payload`.**
   Holds the auto-saved current session so entered data survives a page refresh:
   the active aircraft id, the active certification category, and per-station
   weights with interaction flags. No personal data beyond the aircraft id
   reference. Overwritten on change, cleared on aircraft switch, and removed if it
   fails validation.
3. **sessionStorage — key `aerodash.session.active`.**
   A single `'1'` marker used only to detect PWA cold starts versus in-session
   updates. Contains no personal data and is cleared automatically when the last
   tab for the origin is closed.

**User control today:** There is **no in-app "Delete All Data" control in this
release.** A pilot can remove all stored data by clearing the site's browser
storage (browser settings → site data / "Clear site data" for the AeroDash
origin), which deletes the `aerodash-fleet` database and both storage keys.
Individual aircraft profiles can be deleted from within the fleet view.

**Residual exposure:** Because storage is unencrypted and local, anyone with
access to the device's browser profile can read the saved fleet (including
registration marks and owner identifiers). This is acceptable for an offline,
single-user, on-device tool but is documented here for transparency.

### Future Releases (planned — NOT shipped in v0.3.0-alpha)

The following controls are **planned and not yet implemented**:

1. **Retention period:** User-entered M&B/weighing reports will be retained for a maximum of **12 months** from creation, unless the user deletes them earlier.
2. **Auto-purge:** On application startup, any records older than the retention period will be automatically deleted.
3. **User-initiated deletion:** An in-app "Delete All Data" function will be provided, clearing all IndexedDB stores and storage keys in a single action (until then, use browser storage settings as described above).
4. **No server sync without consent:** If cloud synchronisation is added (Milestone #7), data will only leave the device after explicit user opt-in and authentication.

## 6. Data Subject Rights (GDPR Arts. 15–20)

### Current State (v0.3.0-alpha)

Personal data is now stored locally on the device (see §5), but it is never
transmitted and no accounts exist. The data subject is the device's sole user,
who has full physical control over the data:

- **Right of access (Art. 15):** All stored data is on the user's own device; aircraft profiles are viewable in the fleet view.
- **Right to rectification (Art. 16):** Aircraft profiles can be edited in the app.
- **Right to erasure (Art. 17):** Individual profiles can be deleted in the fleet view; **all** stored data can be erased via browser storage settings (no in-app "Delete All Data" control ships in this release).
- **Right to data portability (Art. 20):** A standard JSON import/export format is **planned, not yet shipped** — see "Future Releases" below.

### Future Releases

The following mechanisms are **planned and not yet implemented**:

- **Right of access (Art. 15):** Export all stored data in machine-readable format (JSON).
- **Right to erasure (Art. 17):** An in-app "Delete All Data" action to clear all stores at once.
- **Right to data portability (Art. 20):** Export/import data in a standard, interoperable format.

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
