# Privacy & Data Protection

- version: 1.5
- date: 2026-11-17
- status: active

[Deutsch](PRIVACY-DE.md)

---

## 1. Overview

AeroDash is an offline-first, client-side single-page application (SPA) for flight preparation. It runs entirely in the user's browser. **No personal, aircraft, or session data is transmitted to any server, backend, or third-party service.** There is no telemetry, analytics, tracking, advertising, or remote logging. Beyond loading and updating the app itself (same-origin requests for the app shell and the service-worker update lifecycle), the application makes exactly **one** application-level network request — an online safety-version check (`GET /version.json`) described in [§7](#7-network-activity-version-safety-check) — which carries no personal data and exists only as a safety "kill switch" (REQ-SYS-006 / H-019).

## 2. Data Collected

All persisted data is stored **locally on the device, unencrypted**, and is **never transmitted** to any server (there is no backend in this release). Storage locations are listed in §5.

| Data Category              | Source                          | Storage                                                        | Contains PII?                                                                                  |
| -------------------------- | ------------------------------- | -------------------------------------------------------------- | ---------------------------------------------------------------------------------------------- |
| Aircraft profiles (fleet)  | Entered/imported by the pilot   | IndexedDB `aerodash-fleet`                                     | Yes — registration, `ownerId`, weighing reports, `costPerHour` (identify real aircraft/owners) |
| Saved session (M&B inputs) | Entered by the pilot at runtime | localStorage `aerodash:session:payload`                        | No — station weights and interaction flags only                                                |
| Manual runway inputs       | Entered by the pilot at runtime | localStorage `aerodash.performance.manual-runway.v1`           | No — aerodrome/runway identifiers, declared distances, elevation and surface condition         |
| Session-active flag        | Set by the app at startup       | sessionStorage `aerodash.session.active`                       | No — a single `'1'` marker for PWA cold-start detection                                        |
| UI preferences             | Selected by the pilot           | localStorage `aerodash-theme`, `aerodash.preferences.units.v1` | No — theme and display-unit choices                                                            |
| Disclaimer acknowledgement | Confirmed by the pilot          | localStorage `aerodash.disclaimer.ack.v1`                      | No — accepted version/baseline and acceptance timestamp                                        |
| Version-safety cache       | Maintained by the app           | IndexedDB `aerodash-app-version`                               | No — minimum safe version and cache timestamp                                                  |
| Calculation results        | Computed from inputs            | In-memory only (not persisted)                                 | No                                                                                             |

No personal accounts, authentication, or cookies exist. Saved-session and fleet data persist across page reloads as described in §5.

## 3. Data Minimisation (GDPR Art. 5(1)(c))

The application processes only the data required for flight preparation and its local controls:

- Aircraft physical parameters (mass, arm, envelope limits)
- User-entered station weights
- Derived results (CG position, total mass, violations)
- Manual runway inputs, fuel/performance inputs and optional operating-cost data
- Local UI preferences, disclaimer acknowledgement and version-safety state

The local-control storage and its purposes are described in §5; calculation results remain in memory.

### 3.1 Purpose-to-Field Mapping

The aircraft and preparation fields are mapped below to their specific purposes,
lawful bases, and any minimisation controls applied. A field is only persisted
where a concrete purpose requires it; fields that would otherwise leak when a
profile is shared are minimised on export (see the `costPerHour` row).

| Field                               | Storage                                              | Purpose                                                                                                                                                                                          | Lawful basis                                                                                                                            | Minimisation control                                                                                                                                                            |
| ----------------------------------- | ---------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | --------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `id` (profile UUID)                 | IndexedDB `aerodash-fleet`                           | Stable per-profile key for fleet CRUD, active-aircraft selection, and collision-free import.                                                                                                     | Art. 6(1)(b) — necessary to deliver the fleet feature the user requested.                                                               | Random UUID v4; not derived from PII; regenerated on import.                                                                                                                    |
| `registration`                      | IndexedDB `aerodash-fleet`                           | Identifies the aircraft to the pilot and checks registration uniqueness across the local fleet (REQ-AC-003). PII-adjacent — a tail mark can identify a real aircraft and, indirectly, its owner. | See [§3.2 Lawful basis for `registration`](#32-lawful-basis-for-registration).                                                          | Entered by the pilot for their own aircraft; never transmitted; erasable via fleet delete / browser storage clear.                                                              |
| `ownerId`                           | IndexedDB `aerodash-fleet`                           | No active ownership purpose before sync; new local profiles default to null. Existing supplied strings remain for backward-compatible local import/export.                                       | No owner identifier is required for current local registration checks. Future identity processing remains subject to the pre-sync gate. | Nullable, never generated for new local profiles; retained legacy strings are not authenticated subjects or authorization claims. No account system or automatic transmission.  |
| `weighingReports`                   | IndexedDB `aerodash-fleet`                           | Basic empty mass / empty CG / weighing dates — the legal weight basis for all Mass & Balance computation (REQ-AD-004, REQ-AD-013).                                                               | Art. 6(1)(b) — core safety-computation input.                                                                                           | Only the fields needed for M&B math are stored; no inspector or facility identity is collected.                                                                                 |
| `costPerHour`, `fuelCostIncluded`   | IndexedDB `aerodash-fleet`                           | Optional operating-cost tracking for flight-cost estimation (REQ-AD-006). Not used in any safety computation.                                                                                    | Art. 6(1)(a) — voluntary, optional convenience data the pilot chooses to enter.                                                         | **Optional** at the schema layer; **excluded from the default profile export** so cost data is not disclosed when a profile is shared (REQ-AD-023; closes audit DP-008/DP-009). |
| Saved session payload               | localStorage `aerodash:session:payload`              | Restores the in-progress M&B session (active aircraft id, certification category, per-station weights) across a page refresh (REQ-SYS-013).                                                      | Art. 6(1)(b) — necessary to preserve unsaved work in an offline tool.                                                                   | No personal data beyond the aircraft-id reference; overwritten on change; cleared on aircraft switch; removed if it fails validation.                                           |
| Manual runway inputs                | localStorage `aerodash.performance.manual-runway.v1` | Restores the pilot's declared runway values on this device.                                                                                                                                      | Art. 6(1)(b) — necessary to preserve entered preparation data offline.                                                                  | No personal data; overwritten on save; removed by Clear or local data deletion; ignored if invalid.                                                                             |
| Session-active flag                 | sessionStorage `aerodash.session.active`             | Single `'1'` marker to detect PWA cold starts vs in-session updates.                                                                                                                             | Art. 6(1)(f) — legitimate interest in correct cold-start behaviour.                                                                     | Contains no personal data; cleared automatically when the last tab closes.                                                                                                      |
| Other aircraft technical parameters | IndexedDB `aerodash-fleet`                           | Load points, envelope, certification categories, performance/wind/surface data — the technical inputs to M&B and performance math.                                                               | Art. 6(1)(b) — core computation inputs.                                                                                                 | Non-personal technical data about the airframe, not the pilot.                                                                                                                  |

> **GDPR applicability note.** AeroDash is an offline, single-user, on-device
> tool with no accounts and no transmission. For a private pilot processing
> their own aircraft data, the **household-activity exemption (Art. 2(2)(c))**
> may place this processing outside the GDPR's material scope entirely. The
> lawful bases above are documented for transparency and to apply by analogy
> where a user operates in a non-private (e.g. commercial club) context.

### 3.2 Lawful basis for `registration`

The aircraft `registration` (tail mark, e.g. `D-EBPN`) is the one persisted
field that is meaningfully **PII-adjacent**: a registration can be cross-referenced
to a public aircraft register to identify a specific airframe and, indirectly,
its keeper. AeroDash processes it on the following basis:

- **Primary basis — Art. 6(1)(b) (performance of the requested service):** the
  pilot enters the registration of their _own_ aircraft so the app can identify
  the profile, label results, and check registration uniqueness across the local fleet
  (REQ-AC-003). The mark is intrinsic to the Mass & Balance task the user asked
  the tool to perform.
- **Supporting basis — Art. 6(1)(f) (legitimate interest):** distinguishing
  aircraft by their real registration is the least surprising, lowest-friction
  way for a pilot to recognise their own profiles; no less-identifying
  alternative would serve that purpose.
- **Scope & safeguards:** the registration is stored **locally and unencrypted**
  on the user's own device and is **never transmitted** (there is no backend in
  this release). It is retained in profile exports because it is intrinsic to a
  usable aircraft profile, but it carries no additional contact or identity data,
  and it is **erasable** at any time by deleting the profile or clearing site
  storage (§5–§6). Where the household-activity exemption (Art. 2(2)(c)) applies,
  the registration falls outside GDPR's scope.

## 4. Purpose Limitation (GDPR Art. 5(1)(b))

Data processed by AeroDash is used for flight preparation (M&B, fuel/endurance and performance), optional flight-cost estimation, and the local UI and safety controls described in §5. Data is not repurposed, shared, or aggregated.

## 5. Storage & Retention Policy (GDPR Art. 5(1)(e))

### Current State

This release **does** persist data on the device. All storage is **local to the browser, unencrypted, and never transmitted** — there is no backend, sync, or remote logging in this release. Three storage facilities are used:

1. **IndexedDB — database `aerodash-fleet`** (object store `aircraft_profiles`).
   Holds the pilot's saved aircraft fleet. Each profile may contain PII or
   PII-adjacent data: the aircraft `registration` mark, an `ownerId`, one or more
   weighing reports (basic empty mass, empty CG, weighing dates), and an optional
   `costPerHour`, alongside the technical M&B/performance parameters. Persists
   until the pilot deletes the profile, runs the in-app _Delete All Data_ action,
   or clears browser storage.
2. **localStorage — keys prefixed with `aerodash`.**
   - `aerodash:session:payload` — auto-saved Mass & Balance session (active
     aircraft id, active certification category, per-station weights with
     interaction flags). No personal data beyond the aircraft id reference.
     Overwritten on change, cleared on aircraft switch, and removed if it
     fails validation.
   - `aerodash.performance.manual-runway.v1` — saved manual runway inputs.
   - `aerodash-theme` — pilot's light/dark UI preference. Not personal data.
   - `aerodash.preferences.units.v1` — display-unit choices; numeric QNH and pressure-altitude inputs are not stored here.
   - `aerodash.disclaimer.ack.v1` — accepted app version, disclaimer baseline and acceptance timestamp; used to decide whether acknowledgement is required again.
   - The _Delete All Data_ action targets keys equal to `aerodash` or beginning
     with `aerodash-`, `aerodash:` or `aerodash.` (case-insensitive), not unrelated
     prefixes such as `aerodashboard`. The same rule applies to sessionStorage.
3. **sessionStorage — key `aerodash.session.active`.**
   A single `'1'` marker used only to detect PWA cold starts versus in-session
   updates. Contains no personal data and is cleared automatically when the last
   tab for the origin is closed, and is also cleared by the in-app _Delete All
   Data_ action.

The version-safety cache also uses **IndexedDB `aerodash-app-version`**, object
store `version_policy`, record `minSafeVersion`. It stores the minimum safe
version and `fetchedAt` timestamp for offline enforcement. The in-app
_Delete All Data_ action does not clear this separate database; browser site-data
clearing can remove it. The service worker also caches app assets for offline use;
these caches are not fleet/session data and are not cleared by that action.

**User control today:** AeroDash ships a dedicated **Privacy view** at
`/privacy` exposing two GDPR-aligned actions:

1. **Bulk JSON Export (Art. 15 / Art. 20).** Downloads every _readable_
   aircraft profile as a single schema-versioned JSON file
   (`aerodash-fleet-<timestamp>.json`). If any stored profile cannot be read
   by the running build (e.g. it was written by a newer app version after a
   PWA cache rollback), it is excluded from the file **and the export view
   warns you how many profiles were left out**, so the copy is never silently
   incomplete — update AeroDash to recover those profiles before deleting.
2. **Delete All Data (Art. 17).** After explicit confirmation (typed
   confirmation phrase), clears the entire `aerodash-fleet` IndexedDB store
   plus the namespaced localStorage and sessionStorage keys defined above. The
   action is best-effort across all three stores — a failure in one never
   stops the others, so as much data as possible is removed. Reported deletion
   failures produce a critical notice rather than a completion notice; retry,
   then use the browser's "Clear site data" for the AeroDash origin if it still
   fails. A missing or inaccessible localStorage/sessionStorage backend is
   skipped without a reported failure, so a completion notice does not prove
   that inaccessible storage was inspected or cleared.

**On retention (Art. 5(1)(e)):** AeroDash does not auto-expire stored data.
A retention period bounds how long personal data is kept relative to the
purpose it was collected for — it is _not_ a function of how old an
aircraft's weighing report is (a basic empty mass can remain valid and in
active use for years). With no inactivity signal recorded today, automatic
age-based deletion would risk destroying data the pilot still relies on, so
retention is exercised by the pilot through the per-profile delete and the
_Delete All Data_ control above rather than by a time-based purge.

Individual aircraft profiles can still be deleted from within the fleet
view. A pilot can also remove all stored data outside the app by clearing
the site's browser storage (browser settings → site data / "Clear site
data" for the AeroDash origin).

**Residual exposure:** Because storage is unencrypted and local, anyone with
access to the device's browser profile can read the saved fleet (including
registration marks and owner identifiers) **until** the pilot exercises the
_Delete All Data_ control above. This is acceptable for an offline,
single-user, on-device tool but is documented here for transparency.

### Future Releases

The following controls remain **planned but not yet implemented**:

1. **No server sync without consent:** If cloud synchronisation is added
   (Milestone #7), data will only leave the device after explicit user opt-in
   and authentication.

## 6. Data Subject Rights (GDPR Arts. 15–20)

### Current State

Personal data is stored locally on the device (see §5), but it is never
transmitted and no accounts exist. The data subject is the device's sole user,
who has full physical control over the data:

- **Right of access (Art. 15):** All stored data is on the user's own device.
  Aircraft profiles are viewable in the fleet view, and the Privacy view's
  _Bulk JSON Export_ (`/privacy`) produces a machine-readable dump of the
  full fleet.
- **Right to rectification (Art. 16):** Aircraft profiles can be edited in
  the app (Fleet → edit; the Draft/Verified FSM tracks who introduced each
  revision).
- **Right to erasure (Art. 17):** Individual profiles can be deleted in the
  fleet view. The Privacy view's _Delete All Data_ action erases the entire
  fleet plus the namespaced localStorage/sessionStorage keys described in §5
  in a single confirmed operation, subject to the limitations stated there.
- **Right to data portability (Art. 20):** The single-profile import/export
  flow on each Fleet card continues to handle one profile at a time. The
  Privacy view's _Bulk JSON Export_ produces an envelope of every profile in
  one schema-versioned file, suitable for archival or migration to another
  device.

- **Bulk JSON Import (Art. 20).** The Fleet view can restore a bulk export
  through file selection, preview and explicit confirmation. It adds fresh,
  unverified drafts without overwriting existing aircraft; registration conflicts
  block the restore. Single-profile import remains available.

### Future Releases

The following remains **planned but not yet implemented**:

- Cloud-sync onboarding (Milestone #7). Local bulk backup restoration is already
  available and does not require cloud synchronisation.

## 7. Network Activity (Version-Safety Check)

AeroDash is offline-first and issues **no** network requests while offline.
When the application starts — or regains connectivity — **while online**, it
makes exactly **one** application-level request beyond loading and updating the
app itself: an HTTP `GET` for `/version.json` served from the **same origin** as
the app. This is the _minimum safe version_
check that satisfies REQ-SYS-006 and mitigates hazard H-019: it lets a
safety-critical defect discovered after release block an unsafe build (a remote
"kill switch"). The full privacy analysis is recorded in
[ADR-011](docs/architecture/adr/011-min-safe-version-fetch-privacy.md).

- **What the request sends:** nothing AeroDash adds. It carries no cookies or
  credentials (`credentials: 'omit'`), no request body, no AeroDash-set
  headers, no query string, and no device, install, or user identifier. No
  aircraft, fleet, or session data is included.
- **What is nonetheless observable:** as with any HTTPS request, the server can
  see your **IP address**, the browser's default **User-Agent**, and the timing of the request
  (roughly, when you opened the app online). For a self-hosted or single-origin
  deployment this is the same origin that already served you the app, so the
  check introduces no third party. The request uses `referrerPolicy: 'no-referrer'`
  to suppress the **`Referer`** header.
- **When it fires:** only when the device reports it is online — on app start
  and on reconnect. It is best-effort; any failure is ignored and the app keeps
  the last known safe-version floor.
- **Opt-out:** because this check is a _safety control_, there is intentionally
  no in-app switch to disable it — turning it off would let a known-unsafe build
  keep running (hazard H-019). If you need zero outbound requests you can
  operate the app fully offline (no request is made), block the endpoint at the
  network layer, or self-host the origin so the metadata never leaves your own
  infrastructure.

## 8. Third-Party Dependencies

- No third-party analytics, advertising, or tracking libraries are included.
- Beyond loading and updating the app itself, the only network request the app
  makes is the first-party, same-origin version-safety check described in §7; no
  third-party service is contacted.
- Runtime dependencies are limited to Vue.js, Pinia, Vue Router, Zod, and `uuid`.
- Dependency security is monitored via Dependabot and `pnpm audit` in CI.

## 9. Security Measures

- Offline-first architecture minimises network-based attack surface; the sole
  outbound request (§7) is a same-origin, credential-less `GET` that never
  reads more than a small bounded response body.
- An optional app lock (Privacy page) hides the app behind a passcode checked
  locally with a salted PBKDF2 verifier. It does not encrypt stored data or
  exports, and a forgotten passcode can only be cleared by deleting all local
  data (see ADR-016).
- Input validation via Zod schemas at the adapter boundary.
- No credentials, tokens, or secrets are stored in the application.
- CI pipeline enforces frozen lockfiles and dependency auditing.

## 10. Contact

For privacy-related questions, open an issue in the project repository with the label `privacy`.
