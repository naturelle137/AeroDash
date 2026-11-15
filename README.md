# Merged #530 acceptance — HQ 1368, execution 1367

Accepted without runtime exception on 2026-11-15. PR #532 merged as `9e4109e24a58712e23a12366e6d4824c2db945dd`; tree `e48ba39caf5417e2e40b233f84c991d18bd8b7e8` equals sole reviewed head f666852. Sole independent review HQ1315: APPROVE, zero blocking. Existing final-head full gate and CI are retained from HQ1314/1315; no second review or implementation fix round.

## Artifact checks performed personally

`check-artifacts.py` checked exact recorded source tree against Git, six frozen source/config/lock files against merge blobs, all 750 entries of the runner artifact manifest, clean before/after tracked status, byte-identical dist manifests, and SW SHA256 `31501f925f742932ca6b1579f82d6bd8f403b7af2b90be71d649a1a8efea9694` against manifest. Install log confirms frozen lock resolution without updates; build/typecheck and PWA build succeeded. All 24 trace ZIPs passed CRC integrity. Production preview config serves dist (not dev); actual offline log: 24/24 passed, no skips, including lookup-fuel-mb twice.

Read lookup-fuel-mb source and actual successful trace assertions at both widths. q50/u10: 600 kg, CG 2.100 m, moment 1260 kg·m outside both synthetic arm 2.09 m and moment 1250 kg·m envelopes. q30: 580 kg, moment 1170 kg·m, CG displayed 2.017 m, correct normalized arm and moment chart coordinates. q=u: 560 kg /1120 kg·m, CG 2.000 m. Invalid typed q<u blocks with NOT_A_NUMBER (field rejects input below floor); invalid default uses BELOW_UNUSABLE. Uncovered q gives LOOKUP_OUT_OF_RANGE. Summary and CG points vanish, print disables, an already-open print invalidates; correcting to30 restores. Source unit USG/lb·in profile agrees at the normalized moment point. Reset/profile switch and cached reload preserve intended semantics. Print includes [UNVERIFIED], datum/source units/weighing and warning provenance. Nonzero-u trip arrival mass remains available, arrival CG explicitly unsupported. #529 u0 duration/direct and fixed-arm/multiple-tank regression journeys passed at both widths in fuel-endurance/fuel-print.

Trace transient errors in lookup-fuel-mb are ONLY two inner expect.poll attempts at line279 per width waiting for session persistence; parent expectation succeeds. No failed final assertion or library operation in those traces. These are normal polling retries, not the prior Verify race.

Personally viewed q30 arm-chart, q50 moment-critical, below-unusable error and cached-offline print PNGs at both390 and1440. Error is readable, no stale CG marker in blocked desktop view; corrected summary and chart agree. Full-page screenshot captures fixed navigation/header at scroll positions and only the current viewport of a scrollable print dialog; complete print contents are independently covered by trace DOM assertions. No claim of a full print pagination/layout audit.

## Scope and documentation

REQ-MB-031..034 and aircraft_data_model.md correctly describe total-load F(q)-F(u), strict validation, unusable fuel kept in BEM once. CHANGELOG Fixed entry accurately describes #530. Older Added entry incorrectly says nonzero-u trip CG is unsupported "pending #530"; next bounded owner corrects that reference while retaining unsupported status. No full nonlinear flight-path or operational aircraft validation claimed. All inputs are synthetic.

#533 fixed-arm q<u, #534 hidden notices, #535 legacy empty-unit validation, and #536 Verify-navigation race remain separate open follow-ups. Earlier 1346 failure was #536 alone; 1367 passes it at both widths without modification. #530 acceptance requires no exception.

Durable evidence: branch `evidence/job-1368-merged530`, source logs/manifests, six focused trace ZIPs, all focused screenshots, sole review and mechanical check. No build caches included. Acceptance ownership and documentation follow-up are recorded in HQ1368 notes/result.
