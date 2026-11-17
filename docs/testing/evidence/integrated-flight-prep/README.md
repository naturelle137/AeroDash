# Integrated Flight Preparation acceptance

Accepted develop commit: `00566c44568b2884a926984eea90895fa39f90f8`.
Its tree exactly matches reviewed PR569 head `99a196c8c89c41935262149132170cfb4c8aa9fe`.

- [Independent review](https://github.com/naturelle137/AeroDash/pull/569#issuecomment-6943048902): APPROVE, one review, no blockers or correction round.
- [Merged develop CI](https://github.com/naturelle137/AeroDash/actions/runs/44048788674): successful. Pre-merge all six required checks passed in run44046477417; all seven PR commits and the squash commit have valid signatures. Normal protected squash merge, no bypass.
- A fresh build in the terminal's separate HQ-managed worktree passed lint, 2,324 unit, 223 integration, 1,084 P1, typecheck/build, source checks, 97 production BDD and 60 production/offline scenarios.
- Actual Chromium 390/1440 flows include real service-worker installation and network-off cached reload; 320px inline-unit geometry, Fuel-before-Performance DOM/sticky order, live arrival/landing dependency, partial invalid input and recovery, conversions/preferences and native stale guards.
- Homepage Performance icon is visible and aligned; separate desktop/mobile menu entries are absent; keyboard/card access and /performance deep links remain. Button style matches the shared homepage CTA; invalid action is natively disabled and grey without helper text.

## Inspected output

All 13 pages of [critical output](critical-no-backgrounds.pdf), all five [warned-value pages](warned-values.pdf) and all five [corrected offline pages](warned-offline-corrected.pdf) were rendered and visually inspected. Exact warnings remain beside highlighted affected values; critical chart color and crosshatching remain with print backgrounds disabled; long warnings paginate without clipping. Additional desktop chart rendering matches; PDF text matches across390/1440 after excluding generation time. Ten hard-invalid/stale/closed native guard PDFs contain unavailable text and no numeric result tables. Native browser printing is invoked without replacing window.print.

The original offline warned-value test PDF inherited explicit screen media after the preceding loop and included the underlying app. That original artifact was rejected. The corrected offline file here comes from an actual repeat of the same merged app with explicit print media around PDF capture; both viewport cases passed. Production source remained unchanged. Separate test-only maintenance [#570](https://github.com/naturelle137/AeroDash/issues/570), owned by HQ1763, will fix the committed QA fixture. This does not claim a product print defect.

## Boundaries

All data is synthetic software wiring evidence, not operational POH/AFM validation, certification, a physical printer or a real-device claim. Weather and user profiles remain later scope; no user-profile/auth implementation was found, and current unit preferences remain usable. #305/HQ638 remains held.

Separate [#534 coordination](https://github.com/naturelle137/AeroDash/issues/534#issuecomment-6943236300): an actual controlled real-adapter failure keeps result=null, ERROR_CRITICAL, ERR-SYS-001 and export blocked. Its known independent-warning gap remains unchanged in byte-identical store code and belongs to HQ1725/1726; their combined integration acceptance remains required. No #534 fix is claimed here.

## Files and SHA-256

- [home-desktop.png](home-desktop.png): `c570a4387ed2ec30461bebb2e3223896e0b11d168c769e365db2bb12b915ae97`
- [home-mobile.png](home-mobile.png): `92a82f8dad238d7b75415e72bb3b2c4826549928c1e2ef2dbba96a65fa71ddc7`
- [disabled-320.png](disabled-320.png): `0658851f542ec93b3f155615b68292d3a3bbaea9f6dbaa71f8a56c39ec90f33d`
- [enabled-mobile.png](enabled-mobile.png): `d9d700a97edd09b42e4d3b962a095a7266768859d3939cef78ad8248f63f1a86`
- [inline-offline-320.png](inline-offline-320.png): `19b603a7f90f5d393ff0c94c9ac045413cb6ff9b6446dd162220c72b1ab05339`
- [critical-no-backgrounds.pdf](critical-no-backgrounds.pdf): `274e027ba876c37aa0f6a87bed32fc5fa08960f82f727ee7553019fc30a77a85`
- [warned-values.pdf](warned-values.pdf): `d646e38f55c20bb9b09aea3bc658b938191aadc0d43bc82afb65496678285551`
- [warned-offline-corrected.pdf](warned-offline-corrected.pdf): `df9819ebec7f2fffabb35fc6873d098dbba016a56d1eb45559210007ae05d22e`
