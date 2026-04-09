# AeroDash — Operational Assumptions

## Device Capabilities

- Browser: Chrome 90+, Edge 90+, Firefox 90+, Safari 15+ with Service Worker support
- Storage: IndexedDB available (required for fleet persistence); localStorage available (required for session restore)
- Minimum free storage: 50 MB for offline app shell and fleet data
- PWA install: supported on Chrome/Edge; standalone mode recommended for preflight use

## User Competence Boundaries

AeroDash assumes the user:

- Is a licensed pilot, student pilot, or authorized ground instructor
- Understands Mass & Balance concepts (MTOM, CG, datum, arm, moment)
- Can interpret CG envelope charts and performance tables
- Will verify all AeroDash calculations against the aircraft's official POH/AFM
- Will NOT use AeroDash as the sole authority for any flight decision

## Catalogue Data Scope

- Aircraft profile data is entered by the user or imported from user-supplied exchange files
- No external aviation database is consulted by this version of AeroDash
- The user is solely responsible for the accuracy of all entered aircraft data
- Aircraft profiles marked **Draft** have not been user-verified and display a WARNING when selected for computation
- Regulatory catalogue data (ICAO type designators, manufacturer names) in the app is provided for convenience only and may not be exhaustive

## Disclaimer

AeroDash is a planning aid only. All computations must be verified against official aircraft documentation before flight. The pilot-in-command remains solely responsible for all flight planning decisions.
