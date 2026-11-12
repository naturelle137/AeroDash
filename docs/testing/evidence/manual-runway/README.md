# Manual runway entry evidence

Captured on 2026-11-12 from this branch's production preview build (service
worker active) in local Chromium with retries disabled. All runway values are
synthetic arithmetic cases, not aerodrome data, airport validation or a runway
assessment. Units and conversion follow the
[manual runway contract](../../../architecture/manual-runway-entry.md).

## Browser flow

All **63 enabled Chromium scenarios passed**, including 13 manual-runway cases;
`@wip` scenarios remain excluded and are not counted as passed. A temporary local
config used preview port 4493 because 4173 was occupied; committed configuration
is unchanged.

- 1440px and 390px: go offline, enter TORA 2000 ft / LDA 550 m / elevation −12 ft /
  Paved · Wet, save, edit LDA to 1800 ft (summary disappears immediately), save,
  reload offline, confirm retained values and units, pressure altitude stays empty,
  then clear and reload.
- Independent m/ft vectors: 3280 ft → 999.7 m (rounded down), 1000 m, −100 ft →
  −30.5 m; 304.8 m, 1000 ft → 304.8 m, −30.48 m → −100.0 ft.
- Refused saves: missing surface condition, empty/zero/negative/Infinity TORA, NaN
  LDA and missing LDA unit; nothing is stored.
- Damaged JSON and a future record version are visibly ignored and can be cleared.

| Evidence | Desktop | Mobile |
| :--- | :--- | :--- |
| Offline save, edit, reload | [1440px](offline-desktop.png) | [390px](offline-mobile.png) |
| Refused save | [zero TORA](zero-tora-desktop.png) | [missing surface](missing-surface-mobile.png) |
| Storage problem | — | [damaged](damaged-storage-mobile.png), [newer version](newer-storage-mobile.png) |

Reproduce: `pnpm build`, then `CI=1 pnpm --filter frontend exec playwright test
--project=chromium --retries=0 --grep "Offline manual runway"`.
