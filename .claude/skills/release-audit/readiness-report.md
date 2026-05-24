# Release-readiness report — output shape

A SHORT management artifact for a go/no-go decision. Bullets, no prose blocks, no filler. Fits on one screen. Target audience: release decision-maker, not engineers.

## Required sections (in order)

1. **Header** — `Release readiness | <version> | <date> | audited @ <commit>`
2. **Verdict** — one line: `GO` / `GO with conditions` / `NO-GO` + the single deciding reason.
3. **Audit input** — one line: N findings across 5 domains (red/yellow counts).
4. **Fixed before release (blockers)** — table: `bundle | findings | tier | status (verified ✓ / partial) | evidence (test/commit)`. Only what was actually closed for this release.
5. **Deferred — accepted risk** — table: `theme | findings | milestone | issue # | why safe to defer now`. Group by milestone.
6. **Residual risk** — ≤5 bullets: the real exposures shipping in this release after fixes, each with a one-line mitigation or acceptance rationale.
7. **Recommendation** — 1–2 lines: the ask of the decision-maker (approve release / approve with named conditions / hold), plus any pre-publish checklist (e.g. run `pnpm audit`, host-level headers).

## Rules

- Quantify: counts, milestone numbers, issue numbers, test/commit evidence — no vague "improved".
- Distinguish **fixed-and-verified** from **fixed-but-unverified**; never imply verification that did not run.
- Every deferred item must name a milestone + issue so nothing is silently dropped.
- If the verdict is GO-with-conditions, the conditions must be concrete and checkable.
- Keep it to roughly one screen; link out (issue numbers) instead of expanding.
