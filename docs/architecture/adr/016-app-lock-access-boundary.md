# ADR-016: App lock access and recovery boundary

- **Status:** Accepted (implementation of the optional app lock in issue #289).
- **Relates to:** [ADR-015](015-local-at-rest-risk.md), which keeps data in plaintext.

## Decision

Offer an optional passcode gate that hides the AeroDash UI. It is an access
control against casual use of a shared unlocked browser, **not** encryption and
**not** tamper protection. Stored profiles, session data and exports stay
readable plaintext; ADR-015 residual risks are unchanged. A UI that implied
more would be false assurance, so every lock surface says it does not encrypt.

## Design

- Passcode (6–64 characters) is verified with PBKDF2-SHA256 (310,000
  iterations, random 16-byte salt) from Web Crypto. Salt, iteration count and
  hash are stored in `localStorage` key `aerodash.applock.v1`; the passcode is
  never stored. Anyone who copies browser storage can guess the passcode
  offline, and can simply read the data. Without Web Crypto the lock cannot be
  enabled.
- Unlocked state exists only in the memory of a tab. A new tab or reload is
  locked; nothing persists "unlocked", so no unlock token can be stolen from
  storage.
- Startup is offline-capable: the verifier is local and needs no network. The
  app is locked until the record has been read. The version-block screen
  pre-empts the lock, as it does the disclaimer.
- No attempt throttling or lockout: a counter in the same storage could be
  reset by the same attacker, so it would promise more than it delivers.

## Multi-tab

`BroadcastChannel` `aerodash-applock` carries two messages. `lock` (from
"Lock now"/"Lock AeroDash") locks every open tab. `config` (lock enabled,
removed or erased) makes tabs re-read the record: a removed lock opens them, a
lock enabled elsewhere does not interrupt a tab being used, and an unreadable
record locks. Browsers without `BroadcastChannel` keep per-tab state until
reload. Messages carry no secrets and are not authenticated; same-origin code
can send them.

## Export and key loss

- Fleet export and restore, Privacy actions and calculations require an
  unlocked tab. Export before enabling the lock if a copy may be needed.
- A forgotten passcode cannot be recovered: no account, escrow, recovery code
  or backup exists, and none is added. The only in-app remedy is
  Delete-All-Data from the lock screen (typed confirmation), which removes the
  verifier and every profile. Downloaded backups are unaffected and can be
  restored afterwards as drafts.
- An unreadable lock record keeps the app locked and offers the same erasure.
  If erasure is incomplete the verifier may remain and the app stays locked;
  the lock screen reports this and suggests clearing site data in the browser.
- Unreadable `localStorage` means nothing can be persisted or protected; the
  lock then fails open and does not show a lock.
- Deleting data through browser tools or "Clear site data" also removes the
  lock; it is not a security boundary.

## Not decided here

Encryption of stored data, signed or tamper-evident storage, WebAuthn, idle
auto-lock and remote privacy preferences. Preferences need a real sync or
analytics consumer and the open #285 processing prerequisites; no opt-in store
is added.
