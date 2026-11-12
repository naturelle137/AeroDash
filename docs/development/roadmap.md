# AeroDash roadmap

AeroDash’s goal is an understandable, aircraft-specific flight preparation workflow: M&B, performance, endurance and a usable decision summary. [Requirements](../requirements/README.md) retain the full product intent. Milestone numbers describe sequencing, not proof of completion; use [GitHub milestones](https://github.com/naturelle137/AeroDash/milestones?state=all) for active work.

## Available workflows and limits

At the docs-reset baseline `4aaba7e` (2026-11-12), source includes a local fleet wizard/editor, IndexedDB persistence, draft/verified profiles with provenance and expiry, JSON exchange, configurable occupant occupancy, and an integrated M&B view with fuel-burn/envelope calculations. The latest base also repairs mobile wizard step visibility.

Historical integrated [M&B evidence](mb-qa-293.md) and [occupancy evidence](../testing/evidence/optional-occupancy/README.md) use synthetic aircraft. They do not establish aircraft-specific POH validation or a current-head pass. The Performance view now inspects all four raw POH table distances through Fleet import, explicit review and in-envelope lookup. It supplies no default tables, operational factors or runway assessment; a manual runway can be declared and saved offline but is not compared; interpolation, extrapolation and safety-factor core modules remain separate. Missing-distance estimation (#301) is not implemented; its earlier PR was closed unmerged. Weather and endurance cards are also placeholders; airport integration, briefing export and sync remain future scope; requirements for them remain future obligations.

## Next product delivery

Delivered: raw table inspection [#311](https://github.com/naturelle137/AeroDash/issues/311) provides Fleet import/review/verification and in-envelope TOR/TOD/LR/LD lookup; [#492](https://github.com/naturelle137/AeroDash/issues/492) preserves per-axis source units through review, lookup, reload and export. Synthetic browser evidence proves wiring, not aircraft accuracy.

1. Current increment [#302](https://github.com/naturelle137/AeroDash/issues/302): offline manual runway entry in Performance with distinct TORA/LDA, field elevation (explicit m/ft) and required surface condition; edit/save/clear/reload with versioned local recovery and user-entered provenance. It states that no runway assessment is available.
2. Next: #304 QNH-to-pressure-altitude, #305 source-backed correction selection and #300 operational factors, runway margin and alerts. Correction fallbacks never replace missing aircraft distance tables.
3. Add #301 explicitly labelled estimates and #420 extrapolation/acknowledgement, with source review and complete UI tests. The first slice has no silent clamping or implicit acknowledgement.

Every delivery includes relevant core/component tests, a real browser flow with mobile/desktop evidence, local gates, one independent review and green CI. A core-only PR does not complete a pilot workflow. Synthetic fixtures prove software behavior, not aviation accuracy; actual aircraft support requires applicable POH/AFM references and cases. The CEO evaluates usability, not aviation correctness.

## Further capabilities

- **Offline preparation:** usable fuel/endurance planning, landing mass, obstacle constraints and a consolidated Go/No-Go advisory; native electric-aircraft energy/endurance support.
- **Weather and airports:** METAR/TAF, time/location forecasts, source/timestamp display, manual overrides, runway conditions and wind-limit warnings; graceful offline behavior.
- **Briefing pack:** compact PDF/print M&B and performance output with unverified/estimated markers, warnings and acknowledgement gates.
- **Connected pilot:** OIDC authentication, personal/organization workspaces, role-based permissions, sharing and offline-first synchronization. No backend is shipped by the current frontend-only app.
- **Usability:** dark mode, touch-friendly controls, small-screen layouts, contextual help and cross-device offline verification.
- **Release maturity:** reliable integrated workflows, domain-reference validation, security testing and bilingual user help. A release number does not imply certification or approved aviation data.

Trainer/instructor ideas #331–337 remain far-future backlog outside active milestones; the [discovery proposal](../journeys/discovery/230-training-personas.md) is not a delivered training mode. Necessary security/privacy fixes remain owned separately (#377); cosmetic tooling and release research do not displace performance delivery.
