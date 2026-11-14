# Multi-tank trip arrival CG evidence

Synthetic software fixtures only; no POH/AFM or operational validation.

## Arithmetic and contract

Takeoff is 600 kg / 1160 kg m. Tank A has 20 kg usable at 1 m;
B has 20 kg usable at 3 m. Each retains 10 kg unusable already included in BEM.
At 30 kg trip burn, A first gives 570 kg / 1110 kg m / 1.9473684210526316 m;
B first gives 570 kg / 1090 kg m / 1.912280701754386 m.
Duration mode uses 30 kg/h, 60 minutes trip and 10 minutes reserve (5 kg).
Arrival retains 10 kg usable; the reserve budget margin is separately 5 kg.

Core tests cover both orders at zero, 20 kg transition, 30 kg partial and
40 kg full burn, empty tanks, overdraw, invalid/missing/duplicate orders,
inconsistent mass and numeric overflow. Adapter tests cover shared SI/imperial
conversion, unusable retention, excluded references and unsupported geometry.
See [the existing sequence contract](../../../../ARCHITECTURE.md#trip-arrival-estimate).

## Production browser evidence

The real built PWA was exercised with Chromium at 390 × 1000 and 1440 × 1000.
The full production-offline suite passed 4/4; the final fuel screenshot run passed
2/2. Both planning modes switch between both named sequences without a default.
Changing tank load recomputes CG; changing category clears selection. Cached-offline
reload retains the selected aircraft and loading while clearing method, inputs and
sequence. Explicit re-entry recomputes the expected endpoint. Single-tank behavior,
variable-arm fallback, independent M&B CRITICAL alerts and horizontal overflow are
also checked by the same production test.

The screenshots show browser offline status, arithmetic outputs and retained
M&B CRITICAL status. `controls` shows the unselected sequence; `unselected` shows
valid mass with a visible CG reason; `duration-A/B` and `direct-A/B` show both
orders; `reset-offline` shows recomputation after offline reload and explicit entry.
Each filename begins with viewport width. SHA-256 hashes are in `SHA256SUMS`.

This endpoint does not assess landing suitability or the full burn path/envelope.
Performance source gate #305 and controlled-source hold remain unchanged.
