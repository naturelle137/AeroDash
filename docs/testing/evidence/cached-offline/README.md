# Cached offline preparation evidence

Synthetic browser wiring evidence for #283; no POH/AFM accuracy or operational validation.
Captured with Chromium against the built production app on 2026-11-13.

## Checks

- `pnpm lint`: passed.
- `pnpm test:unit`: 1,872 passed, including connectivity event/listener lifecycle tests.
- `pnpm test:integration`: 111 passed, including offline minimum-safe-version enforcement.
- `pnpm build`: passed; Workbox generated a 37-entry production precache.
- `pnpm test:offline`: production build and both viewport journeys passed.
- Final production offline run: both passed, with explicit `Response.fromServiceWorker()` assertions for disconnected reload and Fleet/M&B navigations.
- Full production Chromium BDD suite: 97 passed, `@wip` excluded. The default port 4173 was occupied; an equivalent temporary config used an isolated preview on 4287. No other suite settings changed.

The offline suite runs at 390 × 1000 and 1440 × 1000. It accepts the actual disclaimer,
imports the fictional profile, explicitly verifies it with a synthetic revision,
saves a manual runway with explicit units, waits for service-worker control and
checks cached document/scripts. It then disconnects Chromium and reloads Performance.
The saved runway and aircraft survive; in-envelope raw lookup gives the synthetic
220/320/420/520 m vector; edits clear prior output and saved-runway status.
Disconnected Fleet and M&B navigations are served by the worker; an 85 kg pilot
input survives reload and produces 585 kg total mass. Clearing it removes the
within-limits verdict. Unsupported correction sources apply no corrections.
Reconnection restores the browser status without reloading.

CI runs the same dedicated suite and uploads `offline-workflow-evidence` containing
HTML report, screenshots and traces. Browser storage retention, actual network
reachability, source freshness and physical cockpit usability are not established.
Weather, airport queries and cloud sync remain unavailable.

## Screenshots

| Flow | 390 px | 1440 px |
| --- | --- | --- |
| Offline persisted Fleet | [Mobile](offline-fleet-390.png) | [Desktop](offline-fleet-1440.png) |
| Offline restored M&B | [Mobile](offline-mass-balance-390.png) | [Desktop](offline-mass-balance-1440.png) |
| Offline raw distances | [Mobile](offline-raw-distances-390.png) | [Desktop](offline-raw-distances-1440.png) |
| Offline saved runway | [Mobile](offline-saved-runway-390.png) | [Desktop](offline-saved-runway-1440.png) |

[Connectivity explanation at 390 px](connectivity-details-390.png).
