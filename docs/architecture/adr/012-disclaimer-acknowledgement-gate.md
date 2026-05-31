# ADR-012: In-App Disclaimer Acknowledgement Gate

- **Status:** Proposed
- **Date:** 2026-05-31

## Context

AeroDash is an advisory, non-certified flight-preparation aid. The liability
boundary — that the tool is advisory only, that its outputs must be verified
against the official POH/AFM, and that the Pilot in Command bears sole
responsibility — was stated only in `DISCLAIMER.md` and the README, both of
which sit outside the runtime path. A pilot could install, open, and operate the
safety-critical functions (Mass & Balance, Performance, Fuel & Endurance)
without ever encountering that statement.

REQ-SYS-016 requires the system to prevent use of the safety-critical functions
until the pilot has acknowledged the disclaimer. This ADR records how that
acknowledgement is obtained and enforced, and why a route-level block keyed to a
disclaimer baseline was chosen over the lighter alternatives.

## Considered Options

- **Option A — Documentation only (status quo):** rely on `DISCLAIMER.md` and
  the README. The pilot may never open either; the liability statement stays out
  of the runtime path. Does not satisfy REQ-SYS-016.
- **Option B — Non-blocking notice (banner/toast on first launch):** a dismissible
  advisory shown over the app. The pilot can ignore it and proceed to the
  safety-critical functions without acknowledging, so it does not *prevent use*.
- **Option C — Blocking modal as a visual overlay only:** a modal covering the UI
  while the destination route still mounts behind it. The route component, its
  stores, and its computation run regardless, and the surface remains reachable
  by typing a route URL (e.g. `/mass-balance`) directly, by deep link, or by
  reload. The block is bypassable.
- **Option D — Route-level block with persisted, baseline-keyed acknowledgement
  (chosen):** the router outlet does not mount the destination route while the
  acknowledgement is outstanding, the surrounding shell is made inert, and the
  one-way modal is the only exit; acceptance is persisted and re-requested only
  when the disclaimer baseline changes.

## Decision

We adopt **Option D**, with the following binding constraints:

1. **Fail-closed default.** The acknowledgement state defaults to blocked and
   flips to allowed only after a matching stored acceptance is read or the pilot
   accepts, so the first-paint window cannot expose the safety-critical surfaces.
2. **Route-level enforcement.** The block is enforced by not mounting the router
   outlet's destination route while the gate is open — not by an overlay that
   route logic runs behind — so direct-URL, deep-link, and reload entry to a
   safety-critical route is covered. The surrounding shell is `inert` /
   `aria-hidden`, and the modal is one-way (no cancel, no `Escape`, no backdrop
   dismiss, focus-trapped).
3. **Baseline-keyed re-prompt.** Acceptance is keyed to the `MAJOR.MINOR`
   disclaimer baseline of the running build. The gate re-appears only when that
   baseline changes; a patch-level change does not re-prompt. A build whose
   version is not valid SemVer has no baseline and is always prompted.
4. **Durable, prefixed persistence.** Acceptance is stored as a versioned
   envelope under an `aerodash`-prefixed `localStorage` key so the existing
   data-rights erasure sweep clears it. Unreadable storage or a failed write
   leaves the gate blocked and surfaces the failure.

## Consequences

### Positive

- The liability boundary is in the runtime path: the safety-critical functions
  cannot be used without acknowledgement, including via direct route URLs.
- Acknowledgement survives reloads and is re-requested when the disclaimer's
  scope changes (baseline bump), without nagging on every patch release.
- Failure modes (no storage, broken build version) resolve toward blocking
  rather than silently allowing use.

### Negative

- A baseline bump re-prompts every pilot once, even when the disclaimer text is
  materially unchanged within that bump.
- The acknowledgement is per-browser-origin local state; clearing site data or
  switching device/browser re-prompts.
- A pilot in a browser without writable `localStorage` is re-prompted on every
  launch.

## Compliance

- **REQ-SYS-016 (Disclaimer Acknowledgement)** — this ADR is the decision record
  for that requirement; the mechanism is specified in
  [Disclaimer Acknowledgement](../disclaimer-acknowledgement.md).
- **Safety.** Not tied to a numbered hazard; the gate reinforces the H-class
  chain by making POH precedence and Pilot-in-Command responsibility a
  precondition for use. No `H-xxx` register entry is added.
- **GDPR.** The acceptance record holds no personal data — a schema version, the
  build version/baseline, and a timestamp — and is never transmitted; it is
  covered by the data-rights erasure control. n/a otherwise.
