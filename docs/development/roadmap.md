# AeroDash roadmap

AeroDash’s goal is an understandable, aircraft-specific flight preparation workflow: M&B, performance, endurance and a usable decision summary. [Requirements](../requirements/README.md) retain the full product intent. Milestone numbers describe sequencing, not proof of completion; use [GitHub milestones](https://github.com/naturelle137/AeroDash/milestones?state=all) for active work.

## Available workflows and limits

At the docs-reset baseline `4aaba7e` (2026-11-12), source includes a local fleet wizard/editor, IndexedDB persistence, draft/verified profiles with provenance and expiry, JSON exchange, configurable occupant occupancy, and an integrated M&B view with fuel-burn/envelope calculations. The latest base also repairs mobile wizard step visibility.

Historical integrated [M&B evidence](mb-qa-293.md) and [occupancy evidence](../testing/evidence/optional-occupancy/README.md) use synthetic aircraft. They do not establish aircraft-specific POH validation or a current-head pass. Performance UI is still a placeholder even though interpolation, extrapolation and safety-factor core modules exist. Weather and endurance cards are also placeholders; airport integration, briefing export and sync remain future scope; requirements for them remain future obligations.

## Next product delivery

Complete the performance preparation workflow: valid aircraft tables and environmental/runway inputs, visible missing-data/limit failures, extrapolation acknowledgement, corrected distances and runway margins. Demonstrate an integrated browser journey with independently checked synthetic vectors; operational profile acceptance requires actual source-backed POH/AFM data.

## Further capabilities

- **Offline preparation:** usable fuel/endurance planning, landing mass, obstacle constraints and a consolidated Go/No-Go advisory; native electric-aircraft energy/endurance support.
- **Weather and airports:** METAR/TAF, time/location forecasts, source/timestamp display, manual overrides, runway conditions and wind-limit warnings; graceful offline behavior.
- **Briefing pack:** compact PDF/print M&B and performance output with unverified/estimated markers, warnings and acknowledgement gates.
- **Connected pilot:** OIDC authentication, personal/organization workspaces, role-based permissions, sharing and offline-first synchronization. No backend is shipped by the current frontend-only app.
- **Usability:** dark mode, touch-friendly controls, small-screen layouts, contextual help and cross-device offline verification.
- **Release maturity:** reliable integrated workflows, domain-reference validation, security testing and bilingual user help. A release number does not imply certification or approved aviation data.

Flight-training personas remain a [discovery proposal](../journeys/discovery/230-training-personas.md), not a delivered training mode.
