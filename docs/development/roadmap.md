# AeroDash roadmap

AeroDash’s goal is an understandable, aircraft-specific flight preparation workflow: M&B, performance, endurance and a usable decision summary. [Requirements](../requirements/README.md) retain the full product intent. Milestone numbers describe sequencing, not proof of completion; use [GitHub milestones](https://github.com/naturelle137/AeroDash/milestones?state=all) for active work.

## Available workflows and limits

At the docs-reset baseline `4aaba7e` (2026-11-12), source includes a local fleet wizard/editor, IndexedDB persistence, draft/verified profiles with provenance and expiry, JSON exchange, configurable occupant occupancy, and an integrated M&B view with fuel-burn/envelope calculations. The latest base also repairs mobile wizard step visibility.

Historical integrated [M&B evidence](mb-qa-293.md) and [occupancy evidence](../testing/evidence/optional-occupancy/README.md) use synthetic aircraft; they do not establish aircraft-specific POH validation or a current-head pass. Fleet imports and reviews four raw POH distance tables with explicit source units. Flight Preparation uses the current valid M&B takeoff mass for takeoff and current valid trip-arrival mass for landing; an unavailable arrival blocks landing independently and never substitutes the all-usable-fuel-burned endpoint. Below a table's minimum mass, a positive mass is capped at the minimum only when every mass row is nondecreasing and pressure altitude and temperature are in range. Upper mass and lower/upper pressure-altitude and temperature excursions remain blocked. This cap does not establish aircraft applicability outside the manual range. See [Performance evidence](../testing/evidence/flight-prep-performance/README.md) and the [contract](../architecture/performance-flight-prep.md).

Combustion fuel/endurance planning uses available M&B tank loads and either explicit manual consumption and trip/reserve minutes or direct trip fuel, with shortage arithmetic and estimated trip-arrival mass. Arrival CG supports fixed-arm tanks with one tank or an explicitly selected complete named multi-tank sequence, and exactly one lookup tank; lookup contributions use total-load moment differences with strict table validation (#530). inputs are session-only. Electric energy/endurance and Weather remain placeholders.

Flight Preparation assembles the complete current native-browser briefing pack: loading and chart, current fuel/arrival, manual runway and per-phase Performance or their unavailable reasons, with warnings and profile markers. Changed inputs invalidate the preview. A client-side PDF download of the same current snapshot is available next to print, with the same invalidation and unverified-data acknowledgement gate and an offline path (covered by `briefing-pdf.int.spec.ts`; no physical-device evidence). [Browser evidence](../testing/evidence/briefing-pack/README.md) covers native print and browser-rendered PDFs. The integrated software acceptance used synthetic fixtures, not operational validation or physical-device proof.

Persisted historical lookup-fuel profiles with an explicit blank unit can be opened and corrected in the Fleet editor; M&B remains blocked until a supported unit is chosen. The evidence covers persisted profiles, not exchange import behavior. [Recovery evidence](../testing/evidence/legacy-fuel-unit/README.md) covers the bounded path; #535 is delivered through PRs #563 and #564: the named M&B notice points to Load Stations → Unit and approved source data, and the persisted Fleet/editor correction, save/reload and recalculation flow passes at 390/1440 px online and cached offline. These synthetic checks establish software behavior, not aircraft operational validity or physical-device evidence. #534 is partial: the required-occupant zero-mass warning is retained alongside invalid raw fuel, while the broader issue remains open.

Fleet also restores the existing Privacy bulk JSON backup offline through a registration/count preview and explicit confirmation. All profiles become fresh unverified drafts in one conflict-safe transaction; single-profile exchange remains available. Data-rights work #289 remains partial: an optional local app lock (access gate, not encryption) exists; privacy preferences await #285.

Browser connectivity is visible throughout Fleet and preparation; it does not verify Internet access, cache readiness or source freshness. After a successful online load and caching, the production app can reopen persisted Fleet and manual runway data offline for local M&B and raw table inspection (#283). Weather, airport queries and sync remain future scope.

## Next product delivery

Delivered: raw table inspection [#311](https://github.com/naturelle137/AeroDash/issues/311) provides Fleet import/review/verification and in-envelope TOR/TOD/LR/LD lookup; [#492](https://github.com/naturelle137/AeroDash/issues/492) preserves per-axis source units through review, lookup, reload and export. Synthetic browser evidence proves wiring, not aircraft accuracy.

1. Manual runway entry in Performance provides TORA/LDA, optional TODA, field elevation and explicit surface with offline edit/save/clear/reload and user-entered provenance. Supported source corrections feed runway comparisons; unsupported conditions and sources remain unavailable.
2. #304 direct or QNH/elevation pressure altitude is delivered. Source-limited corrections, safety factors, runway margins and alerts are available for supported aircraft and conditions; the original manual and actual runway sources remain authoritative.
3. #301 missing-distance estimation is available with visible estimated provenance. #420 remains open for unsupported extrapolation and acknowledgement paths; no actual-device evidence establishes its outstanding device scope. Synthetic browser tests do not substitute for device testing.

Every delivery includes relevant core/component tests, a real browser flow with mobile/desktop evidence, local gates, one independent review and green CI. A core-only PR does not complete a pilot workflow. Synthetic fixtures prove software behavior, not aviation accuracy; actual aircraft support requires applicable POH/AFM references and cases. The CEO evaluates usability, not aviation correctness.

Issue #284 remains **OPEN on source hold**: this [source-contract disposition](../regulatory/airac-airport-data-contract.md)
corrects the acceptance boundary; it does not deliver automatic airport freshness.
HQ terminal owner 1892 owns review/integration and reassessment when a complete
named authorised source/consumer contract is actually accepted, including coverage,
licence/interface, version/publication/effect/expiry and NOTAM limitations.
There is no timer-based restart or calendar-only completion.

## Further capabilities

- **Offline preparation:** remaining variable-arm trip-specific CG (multiple lookup tanks) and full-flight fuel-burn path assessment, obstacle constraints and a consolidated Go/No-Go advisory; native electric-aircraft energy/endurance support.
- **Weather and airports:** later move temperature, wind and QNH inputs into Weather before Performance. METAR/TAF, time/location forecasts, source/timestamp display, manual overrides, runway conditions and wind-limit warnings; graceful offline behavior.
- **Decision summary:** Flight Preparation shows current takeoff/zero-fuel mass differences to entered MTOM/MZFM as an arithmetic comparison (#521), with neutral within-limit styling and a raw exact-limit cross-check (#527); it adds no margin threshold, payload advice or suitability verdict, and #110 remains open.
- **User profiles:** when user profiles become available, move Performance unit preferences into them; retain current preferences until then. Aircraft profiles do not provide user accounts.
- **Briefing pack:** the complete current assembly is available through native browser print and a client-side PDF download, including current Performance and its unavailable states, unverified markers, warnings and disclaimers. The all-usable-fuel-burned endpoint is not trip arrival or a suitability verdict. Broader source coverage and #420 remain future work.
- **Connected pilot:** OIDC authentication, personal/organization workspaces, role-based permissions, sharing and offline-first synchronization. No backend is shipped by the current frontend-only app.
- **Usability:** dark mode, touch-friendly controls, small-screen layouts, contextual help and cross-device offline verification.
- **Release maturity:** reliable integrated workflows, domain-reference validation, security testing and bilingual user help. A release number does not imply certification or approved aviation data.

Trainer/instructor ideas #331–337 remain far-future backlog outside active milestones; the [discovery proposal](../journeys/discovery/230-training-personas.md) is not a delivered training mode. Cosmetic tooling and release research do not displace performance delivery.
