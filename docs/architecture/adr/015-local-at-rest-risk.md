# ADR-015: Bounded local at-rest risk acceptance

- **Status:** Technical decision recorded; independent review and merge pending.
- **Date:** 2026-11-17
- **Accountable owner:** CTO (technical residual risk and reopening).

## Decision and boundary

Retain current plaintext browser persistence for local, single-user offline
preparation. Accept the concrete residual risks below within that scope to
preserve offline startup and recoverable JSON exchange without a new lockout,
key authority or migration. No encryption is implemented by this decision.
This is a technical risk acceptance, not legal, compliance, privacy or aviation
safety approval; it makes no claim that risk is low or devices are protected.

The [pre-sync gate](014-pre-sync-privacy-gate.md) remains binding.
[Issue #285](https://github.com/naturelle137/AeroDash/issues/285) remains **OPEN**,
with its DPIA work owned by job1924. This ADR does not supply that acceptance.
[Issue #286](https://github.com/naturelle137/AeroDash/issues/286) has no actual
trust/signer authority; local HMAC cannot establish one against malicious
same-origin code. Nullable `ownerId` and schema v3 remain unchanged; an owner
string is not an authenticated principal. Runtime, export formats and erasure
behavior are unchanged.

## Source-backed scope

Inspected tree: `873809e28f14cbc3da03828138140c721993fd1a` (`develop`),
2026-11-17. Reuse the existing [privacy surface](../../../PRIVACY.md) and
[data-rights contract](../data-rights.md); this is not a new inventory.

- [Fleet repository](../../../frontend/src/modules/aircraft/services/fleet.repository.ts)
  validates profiles and stores objects directly in IndexedDB; [session persistence](../../../frontend/src/stores/session-persistence.store.ts)
  stores JSON in localStorage. Neither path encrypts data or authenticates its author.
- [Profile exchange](../../../frontend/src/modules/aircraft/services/profile.import.ts)
  defaults to stripping costs on single export and resets imported verification
  and status to draft. [Bulk export/erase](../../../frontend/src/modules/aircraft/services/data-rights.service.ts)
  serializes readable full profiles, reports omitted rows, clears fleet and
  namespaced Web Storage and reports observed failures. An unavailable Web
  Storage accessor is treated as empty, not proof that inaccessible data is gone.
- [PWA configuration](../../../frontend/vite.config.ts) precaches app assets and
  legal text, not a fleet backup. [Lifecycle ADR](316-pwa-update-lifecycle.md)
  describes update consent and the offline limit on fresh version checks.
  Cached executable code and persistent user data are distinct boundaries.

## Finite threat model

Assets are identifying profile/passenger/provenance/financial information,
preparation context, usable recovery copies and the integrity of calculation
inputs. The attacker capabilities below are alternatives, not measured incidents.
Browser/device implementations, hosting and actual endpoint protection were not
audited. OS malware with user/browser privileges is outside any assurance this
frontend could provide; its disclosure and alteration consequences remain real.

| Attacker or failure | Current protection and accepted residual risk |
| --- | --- |
| Another web origin | Browser origin isolation limits ordinary cross-origin storage access [S2]. It does not isolate apps by URL path within one origin. |
| Shared unlocked device/browser profile, lost device or copied browser files | No application unlock gate. Profiles, saved context and downloaded JSON can disclose names, weights, registrations, provenance and costs. Device protection is unknown. |
| Same-origin XSS, hostile dependency/update or privileged extension/malware | Code with equivalent app access can read or alter data and capture exports. Validation rejects malformed inputs, not plausible malicious values. Encryption alone would not make running code trustworthy [S1]. |
| Storage edit, deletion or replay of an older valid profile/cache | No authenticated author or trusted monotonic history. Validation/migrations address structure and compatibility, not deliberate tampering or rollback. Cached minimum-version state is not an external freshness authority while offline. |
| Browser eviction, clear-site-data, device loss or failed export | Local preparation and profiles can be lost. Bulk export omits unreadable rows and excludes session state; it is not a complete browser backup. |

## Options and key custody

These are design comparisons, not implemented controls or browser test results.

| Option | Protection and operational tradeoff |
| --- | --- |
| **Current plaintext plus OS/device protection — selected** | No app-layer confidentiality. Offline startup and existing JSON recovery need no key. A locked, encrypted device may protect a lost powered-off device; AeroDash neither enables nor verifies that protection. Unlocked access, exported files and same-origin execution remain exposed. |
| Passphrase-bound encrypted envelope | A separately supplied secret can protect a stolen ciphertext-only copy. A future design would need authenticated encryption, password derivation with salt/work parameters, unique nonces, versioned metadata and explicit unlock/lock rules. Weak passphrases permit offline guessing; active code can capture the passphrase or plaintext. Offline startup must require that secret before restoring protected data. |
| Persisted nonextractable CryptoKey, intended to be device-bound | Can prevent API key export while allowing authorized operations and persistence [S1]. This is not a portable guarantee of hardware binding or encrypted key storage. It permits unattended offline decrypt but also decrypt by hostile same-origin code with access to the key. Losing the browser key can strand the data. |

A raw/exportable key stored beside ciphertext provides no confidentiality against
an attacker who copies both. A nonextractable handle narrows API extraction, not
use by code allowed to decrypt; protection of copied browser storage depends on
the implementation [S1]. A salt, nonce or wrapped data key may sit beside an
envelope only if the unlocking secret is genuinely separate. None creates an
identity/signer authority. An HMAC key available to the same attacker permits
forgery; authenticated encryption also cannot reject an old valid ciphertext
without independently trusted freshness state.

Before adopting either encrypted option, the CTO must settle passphrase change,
key rotation and atomic rewrapping/re-encryption, wrong-secret handling, lock
and multi-tab memory lifetime, browser clearing/eviction and version compatibility.
Forgotten secrets or a lost device key need an explicitly chosen independent
recovery path; no account or escrow exists today. Export must deliberately choose
plaintext disclosure or separately recoverable encryption and verify restore.
Deleting a key is not proven secure erasure of prior copies or memory [S1].

Offline app-shell caching [S3] supplies code, not the passphrase, recovery key or
trusted author. Any future encryption must cover each intended persisted payload
and prevent plaintext copies in caches/logs/exports; a hostile cached app can still
capture later unlock input. This requires a separate bounded implementation and
recovery design, not a crypto wrapper around one store.

## Conditions, recommendations and reopening

Acceptance applies only to current local preparation without accounts, remote
sharing or shared-user authorization. The CTO owns recording changed facts and
reassessing **before** sync, OIDC, network Share-Code or organization/shared-device
deployment; before promising confidentiality or authenticated provenance; or when
real passphrase, protected-export, recovery or managed-device requirements arise.
A reported disclosure/tampering incident, changed data sensitivity/retention,
new persistence/cache boundary or credible origin/device compromise also reopens
this decision. No periodic report or automatic gate release is created.

Operational recommendations are a separate locked OS/browser profile, device
updates and disk encryption, minimum necessary personal fields, deliberate
recipient selection and protected recovery copies. They are **not enforced or
verified** by AeroDash. A shared unlocked session is outside this acceptance's
intended use, not technically prevented.

Current erasure does not remove downloads, recipient/device backups, running-tab
memory, app-version IndexedDB or PWA CacheStorage. Canceling pending session save
in the [privacy view](../../../frontend/src/views/PrivacyView.vue) prevents that
pending timer from rewriting the wiped payload; it is not forensic erasure or a
guarantee against another tab writing. Existing export/erase caveats remain.

## Finite official sources

Accessed **2026-11-17 20:48 UTC**. These pinned publications support API boundaries,
not tested support on AeroDash's browsers or actual device-security guarantees.
The option/lifecycle choices above are engineering inferences for this app.

- **S1:** [W3C Web Cryptography API, Recommendation, 26 January 2017](https://www.w3.org/TR/2017/REC-WebCryptoAPI-20170126/),
  §§5.2, 6.2–6.3, 13–14, 27 (AES-GCM), 32 (PBKDF2). Applies to key custody,
  hostile script, extraction, encryption/derivation primitives and loss/erasure
  limits; it does not guarantee hardware-backed storage or signer identity.
- **S2:** [W3C Web Storage, Second Edition, Recommendation 19 April 2016, superseded 28 January 2021](https://www.w3.org/TR/2021/SPSD-webstorage-20210128/),
  §§4, 6–7. Historical fixed snapshot for origin/storage and local-access limits;
  not a claim to describe every current browser privacy partitioning policy.
- **S3:** [W3C Service Workers, Candidate Recommendation Draft, 6 March 2025](https://www.w3.org/TR/2025/CRD-service-workers-20250306/),
  §§2, 5.2–5.5 and 6. Applies to offline execution, CacheStorage and origin/script
  boundaries; work in progress, not evidence of deployed cache contents.
