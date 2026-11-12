# ADR-011: Privacy Posture of the Remote `minSafeVersion` Fetch

- **Status:** Proposed
- **Date:** 2026-05-28

## Context

REQ-SYS-006 (Safe Version Verification) mitigates H-019 — operating with
outdated or erroneous calculation logic because of PWA caching latency — by
acting as a remote "kill switch": when the application initialises **online**
it verifies the running build against a minimum-safe-version floor and blocks
execution if the build is below it.

The build-time constant `__MIN_SAFE_VERSION__` is baked into each released
bundle and cannot be raised without a re-deploy. To make the kill switch
usable for a safety-critical defect discovered *after* release, issue #271
added a best-effort online refresh: `app-version.remote.ts` issues
`GET /version.json` on every online check, and the store enforces
`max(buildTimeConstant, cachedValue, remoteValue)` (`app-version.store.ts`).

The v0.3.0-alpha data-privacy release audit (2026-05-08) raised **DP-018**:
for an *offline-first* PWA whose users reasonably expect zero network activity,
issuing even a first-party HTTP request is an **unanticipated** behaviour that
exposes request metadata — at minimum the client **IP address** and
**User-Agent** — to whatever server hosts `/version.json`. This ADR records the
privacy implications of that fetch (the data exposed, when it fires, and the
opt-out posture) and the decision on how to make the behaviour honest, so the
exposure is a documented, bounded architectural choice rather than an
accidental side effect.

This decision interacts with `PRIVACY.md`, whose §1 previously asserted a
blanket "**No data is transmitted to any server**". That statement is true of
all *stored* personal data (the fleet, the saved session) but is contradicted
by the existence of the `/version.json` request itself, which must therefore be
disclosed.

### Data actually exposed by the fetch

The request is a bare `GET` with no application payload. What a server can
nonetheless observe is the unavoidable metadata of any HTTPS request:

| Datum | Source | Exposed? | Notes |
| :---- | :----- | :------- | :---- |
| Client IP address | IP/TLS layer | **Yes** | Inherent to any TCP/TLS connection; cannot be suppressed client-side. Coarse-grained location / ISP inference only. |
| `User-Agent` header | Browser default | **Yes** | Browser/engine/OS family. Not set by AeroDash; the browser attaches it. |
| TLS fingerprint, request timing & frequency | Transport / scheduling | **Yes** | Reveals *that* and *roughly when* the app was opened online (cold start / reconnect). |
| `Referer` header | Per-request referrer policy | **No** | The fetch sets `referrerPolicy: 'no-referrer'`, suppressing the header independently of deploy-edge configuration. `credentials: 'omit'` does not govern `Referer`. |
| Cookies, credentials, `Authorization` | Browser / app | **No** | `credentials: 'omit'` sends no cookies/credentials; no `Authorization` header is set. |
| Request body | App | **No** | The request carries no body. |
| Custom / identifying headers | App | **No** | AeroDash adds none. No device id, install id, or query parameter is appended. |
| Aircraft / fleet / session data | App | **No** | No persisted or in-memory personal data is part of the request. |

The endpoint is **same-origin** (`/version.json` is shipped in the PWA
`public/` directory and served by the same origin that already delivered the
application bundle and every other asset). This is enforced at runtime, not by
convention alone: for the **shipped artifact**, the default endpoint is the
same-origin relative path and the `<meta>` Content-Security-Policy `connect-src
'self'` (`frontend/index.html`) blocks any cross-origin `connect-src`, so the
fetch cannot reach a third-party origin. (Both the endpoint default and the
`<meta>` CSP are overridable by a self-hosting operator, but the build ships
closed.) For a self-hosted or single-origin deployment, the fetch therefore
discloses metadata only to a server the user is *already* in contact with merely
by loading the app — it introduces no **new** party and no **third-party**
processor.

### When the fetch fires

- On mount, via `App.vue` → `checkMinSafeVersion()`.
- On the browser `online` event, via `attachConnectivityRefresh()`.
- **Gated on `navigator.onLine === true`** — it never fires while offline,
  which is the dominant cockpit/remote-airfield case.
- **Suppressed in the fail-closed state** — when a structurally-broken build
  raises the ephemeral `FAIL_CLOSED_MIN_SAFE_VERSION` sentinel, the refresh is
  skipped entirely (`app-version.store.ts`). This only makes the fetch rarer; no
  privacy claim depends on it.
- Serialised by a single-flight latch, so a reconnect racing a cold start
  issues at most one in-flight request.

It is **best-effort**: every failure mode (network down, non-2xx, oversized
body, parse failure, timeout) returns `null` and the prior enforced floor is
kept. A flaky or hostile endpoint can never *unblock* a kill-switched build.

## Decision

We adopt **Option D**. The remote `minSafeVersion` fetch is retained because it
is integral to the REQ-SYS-006 / H-019 safety mitigation, subject to the
following constraints, which the current implementation already satisfies and
which this ADR makes binding:

1. **Minimal request.** The fetch stays a credential-less (`credentials:
   'omit'`), body-less `GET` to a **same-origin** endpoint, with **no**
   AeroDash-set identifying headers, query parameters, cache-busting tokens, or
   device/install identifiers. Any future change that adds an identifier, a
   third-party origin, or a request body **requires a new ADR**.
2. **Online-only, best-effort.** The fetch fires only when `navigator.onLine`
   is true and never blocks or fails the app on error. Offline operation — the
   dominant use case — produces no network activity at all.
3. **No in-app opt-out.** Because disabling the check would re-introduce H-019,
   there is intentionally no toggle to suppress it. Users who require zero
   outbound requests retain two avenues that do **not** disable the safety
   control: operate the app offline (no fetch is issued), or block the request
   at the network layer / self-host the origin so the metadata never leaves
   their own infrastructure.
4. **Honest disclosure.** `PRIVACY.md` must accurately describe this single
   first-party request — what metadata it exposes, when it fires, why it
   exists, and that there is no in-app opt-out. The blanket "no data is
   transmitted" claim is corrected to scope it to *stored personal data* (which
   genuinely never leaves the device) and to disclose the version-safety
   request explicitly. This ADR is recorded in the same change as that
   correction.
5. **Maintenance guardrail.** The "exactly one application-level request" claim
   in `PRIVACY.md` §1/§7 is only true for the current module set. Any **new**
   outbound network request introduced by a future module (e.g. `weather`,
   `sync`) **must**, in the same change, update `PRIVACY.md` §7 and re-verify the
   §1 request count — so the notice cannot silently regress to the DP-018 state
   this ADR fixes.

## Consequences

### Positive

- The REQ-SYS-006 kill switch remains usable for post-release safety defects;
  the H-019 mitigation is preserved in full.
- The privacy exposure is now a **documented, bounded** architectural decision:
  same-origin only, no cookies, no body, no identifiers, online-only.
- `PRIVACY.md` becomes truthful, closing DP-018: users are told about the one
  request the app makes and how to avoid it without disabling a safety control.
- A guardrail is established — adding any identifier, third-party origin, or
  payload to the request now requires a fresh ADR.

### Negative

- The app makes a network request when online; IP address, User-Agent and
  request timing remain observable by the origin server. The request suppresses
  `Referer` with its per-request `no-referrer` policy.
- Privacy-maximalist users who want *no* outbound request must take an external
  action (stay offline, block the endpoint, or self-host); there is no in-app
  switch, by design.
