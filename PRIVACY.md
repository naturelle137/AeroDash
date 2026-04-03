# Privacy & Data Protection

- version: 1.0
- date: 2026-04-02
- status: active

---

## 1. Overview

AeroDash is an offline-first, client-side single-page application (SPA) for flight preparation. It runs entirely in the user's browser. **No data is transmitted to any server, backend, or third-party service.** There is no telemetry, analytics, tracking, or remote logging.

## 2. Data Collected

| Data Category                 | Source                          | Storage                               | Contains PII?                                                           |
| ----------------------------- | ------------------------------- | ------------------------------------- | ----------------------------------------------------------------------- |
| Aircraft profiles (catalogue) | Hardcoded in source code        | In-memory only (no persistence)       | Registration marks are PII-adjacent (can identify real aircraft/owners) |
| Station weights / M&B inputs  | Entered by the pilot at runtime | In-memory only (lost on page refresh) | No                                                                      |
| Calculation results           | Computed from inputs            | In-memory only                        | No                                                                      |

No personal accounts, authentication, cookies, or session data exist.

## 3. Data Minimisation (GDPR Art. 5(1)(c))

The application processes only the minimum data required for Mass & Balance calculation:

- Aircraft physical parameters (mass, arm, envelope limits)
- User-entered station weights
- Derived results (CG position, total mass, violations)

No data beyond what is necessary for the M&B computation is collected or processed.

## 4. Purpose Limitation (GDPR Art. 5(1)(b))

All data processed by AeroDash is used solely for the purpose of computing Mass & Balance results. Data is not repurposed, shared, or aggregated.

## 5. Storage & Retention Policy (GDPR Art. 5(1)(e))

### Current State (v0.2.0-alpha)

- **No persistent storage.** All data is held in-memory (Vue reactive state) and discarded on page unload or refresh.
- No IndexedDB, localStorage, or cookies are used in the current release.

### Future Releases (IndexedDB / Offline Persistence)

When persistent storage is introduced:

1. **Retention period:** User-entered M&B reports will be retained for a maximum of **12 months** from creation, unless the user deletes them earlier.
2. **Auto-purge:** On application startup, any records older than the retention period will be automatically deleted.
3. **User-initiated deletion:** A "Delete All Data" function will be provided, clearing all IndexedDB stores in a single action.
4. **No server sync without consent:** If cloud synchronisation is added (Milestone #7), data will only leave the device after explicit user opt-in and authentication.

## 6. Data Subject Rights (GDPR Arts. 15–20)

### Current State

Since no personal data is stored or transmitted, data subject rights (access, rectification, erasure, portability) are satisfied by default — there is nothing to access, correct, or delete.

### Future Releases

When user accounts and persistent storage are introduced, the following mechanisms will be implemented prior to launch:

- **Right of access (Art. 15):** Export all stored data in machine-readable format (JSON).
- **Right to rectification (Art. 16):** Edit any stored aircraft profile or M&B record.
- **Right to erasure (Art. 17):** Delete individual records or all data.
- **Right to data portability (Art. 20):** Export data in a standard, interoperable format.

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
