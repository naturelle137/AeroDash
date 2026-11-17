# pnpm audit enforcement

The dependency-audit CI job runs
`node .github/scripts/dependency-audit.mjs high` (weekly schedule: `moderate`).
It invokes the pinned pnpm audit with JSON output, retains the full scanner report
and fails on scanner execution, parsing, report consistency or blocking findings.
Behavior tests run in the same job before the live scan:
`node --test .github/scripts/dependency-audit.test.mjs`.

The existing [picomatch disposition](picomatch-redos-disposition.md) also applies
to this audit path. Only GHSA-fc5q-39xc-vjpf for picomatch 2.3.2/4.0.7 at high
severity with no supported patch is excepted, strictly before
2026-11-24T00:00:00Z. The vulnerability remains unpatched; unrelated findings
retain the existing severity thresholds. Changed versions, severity or a reported
patch require reassessment. Expiry restores failure without a policy extension.

HQ1866/project CTO and the weekly security rotation retain removal ownership.
Remove the pnpm exception alongside the OSV entry on supported complete upstream
repair or expiry, whichever comes first, and rerun both scanners and functional
checks. The original disposition and OSV configuration remain unchanged; this
adds enforcement for the separate pnpm path and does not grant new risk acceptance.
