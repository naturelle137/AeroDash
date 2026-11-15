# Sole independent review PR #532 (HQ 1315, fresh subagent session a3d582a9)
Head f666852f31b9d394f3a5a9e7f173bafe59f7dbeb, base d27325a. Verdict APPROVE, 0 blocking.
- Math recomputed: lookup mass q-u, moment F(q)-F(u); base 560/1120, knots (0,0),(10,10),(30,60),(50,150), u10: q50 600/1260, q30 580/1170, q10 560/1120 (spec fuel-lookup-total-moment.spec.ts:186-195 exact). Fixed arm 600/1160 unchanged; multi-fixed waypoints subtract same usableMoment; #529 u0 1270/1225/1180/1155/1120 unchanged; nonzero-u arrival CG blocked, mass retained.
- Order: finite/u>=0 -> q<u BELOW_UNUSABLE -> strict geometry -> coverage u,q -> bounds. q=u zero after validation. Adapter refine + core throw. arm+lookup NOT_ALLOWED.
- Store raw precheck before SI normalisation -> ERR-SYS-001, lastResult=null. All consumers (chart, summary, print, fuel) read store.lastResult only -> no stale values.
Non-blocking: (1) raw error early return hides other notices; (2) adapter INVALID_INPUT->NOT_A_NUMBER unreachable; (3) fixed-arm q<u coerced 0 (pre-existing); (4) lookup tanks w/ empty unit now block (intended); (5) geometry validation in two places.
Merged 9e4109e (squash, --match-head-commit), tree e48ba39 == f666852 tree, GitHub verified.
