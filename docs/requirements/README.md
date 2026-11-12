# Product requirements

These files describe intended AeroDash behavior, including features not yet integrated. See the [roadmap](../development/roadmap.md) for the distinction between available workflows, core-only work and future scope. A requirement is not implementation or certification evidence.

## Format

Use a stable heading `### REQ-XX-NNN: Short title` followed by one independently testable obligation in plain English. Preserve existing headings so ordinary links keep working. On a split, the primary obligation keeps the original ID; allocate unused numbers above the existing module maximum for the others. Retired IDs remain reserved.

Use EARS (Easy Approach to Requirements Syntax):

- Always: `The system shall <observable response>.`
- Event: `When <event>, the system shall <response>.`
- State: `While <state>, the system shall <response>.`
- Unwanted condition: `If <condition>, then the system shall <response>.`

Give numeric limits, units and boundary conditions when they determine acceptance. A structured record may list its fields as one data contract; independently failing actions or outputs need separate requirements. Put algorithms, storage choices and interpretation context in [architecture](../architecture/), not rationale paragraphs or tag attributes. Ordinary links to relevant contracts are sufficient; no matrix, registry or tagging tool is required.

Authoring and PR review use the same concise [requirements review command](../../.claude/commands/requirements.md): compare original intent, flag design leakage and scope narrowing, then split independently testable responses. JSON/PDF exchange requirements specify observable interoperability, not internal storage.

## Modules

| Prefix | File |
| :--- | :--- |
| AC | [Aircraft management](aircraft_management.md) |
| AD | [Aircraft data](detailed_aircraft_data.md) |
| AP | [Airports](airport_database.md) |
| DOC | [Briefing export](documentation_export.md) |
| FE | [Fuel and endurance](fuel_endurance.md) |
| MB | [Mass and balance](mass_balance.md) |
| PF | [Performance](performance.md) |
| SC | [Sync and collaboration](cloud_sync_collaboration.md) |
| SYS | [System](system.md) |
| UI | [Interface](user_interface.md) |
| UQ | [Usability and quality](usability_quality.md) |
| WX | [Weather](weather_meterological_data.md) |

Source limitations and interpretation: [ASSUMPTIONS.md](../../ASSUMPTIONS.md), [calculation contracts](../architecture/performance-bilinear-interpolation-contract.md), [occupancy](../architecture/optional-occupancy.md), [data rights](../architecture/data-rights.md). Reference tests must distinguish synthetic numerical checks from aircraft-specific POH/AFM validation.
