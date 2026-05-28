# ADR-011: Privacy Posture of the Remote `minSafeVersion` Fetch

<!-- @DES-ARCH-013@ (FROM: @REQ-SYS-006@) -->

- **Status:** Accepted
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
| `Referer` header (same-origin) | Browser default referrer policy | **Yes, by default** | `credentials: 'omit'` does **not** govern `Referer` — referrer policy does. The fetch sets no `referrerPolicy` and the app ships no `<meta name="referrer">`, so under the browser default (`strict-origin-when-cross-origin`) a **same-origin** `GET` sends a `Referer` carrying the document's full URL — including the in-app route, since the router runs in HTML5 history mode. It can be suppressed by any of three levers AeroDash currently declines: a per-request `referrerPolicy: 'no-referrer'` on the fetch, a `<meta name="referrer" content="no-referrer">` in `frontend/index.html`, or a deploy-edge `Referrer-Policy: no-referrer` header (the HTTP-header form is the one that "cannot be set from a `<meta>` tag", per the `index.html` note). The two in-app levers are tracked in #377. Being same-origin, the route is disclosed only to the origin that already served the app. |
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

## Considered Options

- **Option A — Drop the remote fetch (build-time + IndexedDB cache only):**
  zero network activity, perfectly matching the "no transmission" promise. But
  the build-time floor cannot be raised post-release without shipping a new
  bundle, and a kill-switched older bundle resurrected from the Service Worker
  cache would only learn of a newer floor it had previously cached — never one
  published *after* it went offline. This guts the post-release usefulness of
  the REQ-SYS-006 kill switch and weakens the H-019 mitigation.
- **Option B — Keep the fetch, leave it undocumented (status quo at audit
  time):** rejected. The metadata exposure is real and the privacy notice was
  inaccurate; an undocumented network request in an offline-first tool is the
  exact DP-018 finding.
- **Option C — Keep the fetch, minimise it, document it, *and* add a runtime
  opt-out toggle:** a user could disable the version check. Rejected as the
  default posture: REQ-SYS-006 is a **safety control**. A pilot who disables it
  silently re-creates H-019 (running known-unsafe calculation logic) — the
  precise hazard the requirement exists to prevent. Trading a bounded,
  same-origin metadata exposure for the ability to switch off a safety
  kill-switch is the wrong default for a flight-prep tool. (A network-level or
  self-hosting opt-out remains available to the user — see the Decision.)
- **Option D — Keep the fetch, keep it minimal, document the residual exposure,
  provide no in-app opt-out, and correct the privacy notice (chosen).**

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

- The app is no longer "zero network requests" when online; the IP, User-Agent,
  and — unless a `no-referrer` policy is applied (see the exposure table; the
  two in-app levers are tracked in #377) — a same-origin `Referer` (the in-app
  route) of an online cold start are observable by the
  origin server. This is accepted as the minimum metadata intrinsic to any HTTPS
  request and is bounded to the same origin that already served the app.
- Privacy-maximalist users who want *no* outbound request must take an external
  action (stay offline, block the endpoint, or self-host); there is no in-app
  switch, by design.

## Compliance

- **REQ-SYS-006 (Safe Version Verification)** and **H-019 (PWA caching latency
  errors)** are preserved; this ADR is the Design Reference linked from
  REQ-SYS-006.
- **GDPR.** The request transmits no personal data as defined by the app's data
  inventory (no fleet, session, account, or identifier data — see `PRIVACY.md`
  §2). The IP address is processed only transiently at the transport layer to
  serve a request the user initiated by opening the app online, on the
  Art. 6(1)(f) legitimate-interest basis of keeping safety-critical computation
  logic current (H-019); no server-side retention or profiling is performed or
  intended by AeroDash. Where the household-activity exemption (Art. 2(2)(c))
  applies to a private pilot, this processing falls outside GDPR scope, as noted
  in `PRIVACY.md` §3.1.
- **Transparency (GDPR Art. 13/5(1)(a)).** Satisfied by the `PRIVACY.md`
  correction mandated in the Decision — primarily the new **§7 Network
  Activity**, which discloses the request directly, supported by the scoped §1
  overview and the §8 (Third-Party Dependencies) / §9 (Security Measures)
  cross-references.
- Closes data-privacy audit finding **DP-018** (v0.3.0-alpha, 2026-05-08).
