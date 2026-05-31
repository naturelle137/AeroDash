# AeroDash Architecture — Disclaimer Acknowledgement

**Version:** 1.0
**Date:** 2026-05-31
**Status:** Approved
**ADR:** [012-disclaimer-acknowledgement-gate](adr/012-disclaimer-acknowledgement-gate.md)

## 1. Scope

Specifies the mechanism by which AeroDash obtains the pilot's acknowledgement of
the disclaimer and blocks the safety-critical functions until that
acknowledgement is given (REQ-SYS-016).

The disclaimer wording's source of record is
[`DISCLAIMER.md`](../../DISCLAIMER.md).

## 2. Acknowledgement Trigger & Frequency

<!-- @DES-ARCH-014@ (FROM: @REQ-SYS-016@) -->

- The acknowledgement state is resolved once per app load, on mount, before the
  safety-critical surfaces render.
- Acceptance is keyed to a *disclaimer baseline*: the `MAJOR.MINOR` of the
  running build's SemVer (e.g. `0.4` for `0.4.0-alpha`).
- The gate is presented when no stored acceptance exists for the current
  baseline:
  - first launch, where no record is stored; and
  - the first load after the baseline changes, where a record is stored but its
    baseline differs from the running build's.
- A build sharing the stored record's `MAJOR.MINOR` (a patch-level change) does
  not re-present the gate.
- A build whose version is not parseable as SemVer resolves to no valid baseline
  and the gate is presented on every load.

## 3. Blocking Enforcement

<!-- @DES-ARCH-015@ (FROM: @REQ-SYS-016@) -->

- The acknowledgement state defaults to *gate open* (blocked) and flips to
  *closed* only after a stored record matching the current baseline is read, or
  after the pilot accepts. The first-paint window is therefore blocked.
- The router outlet (`<RouterView>`) is mounted behind a condition that is false
  while the gate is open. A safety-critical route reached by typing its URL
  directly (e.g. `/mass-balance`), by deep link, or by reload does not
  instantiate its route component while the gate is open, so that component's
  setup, stores, and computation do not run.
- The application shell surrounding the outlet is marked `inert` and
  `aria-hidden` while the gate is open, so background focus, pointer events, and
  assistive-technology navigation cannot reach the header, sidebar, or
  navigation links.
- The acknowledgement modal is rendered via a body-level `Teleport` outside the
  inert shell. It is one-way: it carries no cancel control, does not respond to
  `Escape`, and is not dismissed by a backdrop interaction. Keyboard focus is
  trapped on the single accept control, with a global capture-phase listener
  that re-traps focus if focus ever leaves the dialog subtree.
- The sole transition out of the blocked state is the pilot activating the
  accept control.

## 4. Consent Content

<!-- @DES-ARCH-016@ (FROM: @REQ-SYS-016@) -->

The acknowledgement presents, and the pilot confirms by accepting:

- AeroDash is not a certified aviation device and is used at the pilot's own
  risk.
- AeroDash is advisory only and is not certified by EASA, FAA, or any aviation
  authority.
- Every calculation (Mass & Balance, Performance, Fuel & Endurance) is to be
  verified against the official POH/AFM for the specific airframe before each
  flight.
- The official handbook takes precedence wherever it and AeroDash disagree.
- AeroDash does not replace the mandatory flight briefing (METAR / TAF / NOTAM).
- Aircraft profiles, environmental models, and algorithms may contain errors or
  be out of date.
- The pilot confirms being the Pilot in Command and accepting these
  responsibilities.

Links to the full [`DISCLAIMER.md`](../../DISCLAIMER.md) and the licence are
presented alongside the acknowledgement.

## 5. Acceptance Persistence

<!-- @DES-ARCH-017@ (FROM: @REQ-SYS-016@) -->

- Acceptance is stored under the `localStorage` key
  `aerodash.disclaimer.ack.v1`.
- The stored record is a versioned envelope (`schemaVersion: 1`) carrying the
  accepted baseline, the full accepted version string, and an acceptance
  timestamp.
- On load the record is read and structurally validated; an absent, non-JSON, or
  structurally-invalid record is treated as no acceptance and the gate is
  presented.
- When storage is unreachable on read, or the acceptance write fails, the state
  stays *gate open* (blocked) and the failure is surfaced to the pilot.
- A stored record whose baseline differs from the running build's is retained but
  does not close the gate.

## 6. Storage Key & Erasure

The `aerodash.disclaimer.ack.v1` key carries the `aerodash` prefix matched by the
data-rights erasure sweep (see [Local Data-Rights](data-rights.md) §2), so
clearing all local data removes the acceptance and the gate is presented on the
next load.
