# picomatch ReDoS (GHSA-fc5q-39xc-vjpf / CVE-2026-112366) — closed disposition

**Status: scanner exceptions removed 2026-11-19, before their 2026-11-24T00:00:00Z
expiry. The underlying library behaviour is NOT repaired.** Issue #581.

## What changed

- The temporary `osv-scanner.toml` ignore is deleted.
- The temporary `scripts/security/pnpm-audit.mjs` wrapper (and its test) is deleted;
  the dependency-audit step is the plain `pnpm audit --audit-level=high|moderate`
  again. Thresholds, `continue-on-error` policy and all other findings are unchanged.
- No ignore, dismissal, threshold change or `continue-on-error` change replaces them.
  Lockfile and application code are unchanged.

## Evidence (checked 2026-11-19)

- GitHub advisory API: `withdrawn_at` 2026-11-18T15:38:56Z; the affected range was
  `<=4.0.7` with no patched version. [OSV record](https://api.osv.dev/v1/vulns/GHSA-fc5q-39xc-vjpf)
  carries the same `withdrawn` timestamp, so OSV-Scanner no longer reports it.
- Plain `pnpm audit --audit-level=high` on the unchanged lockfile (picomatch 2.3.2
  and 4.0.7): "No known vulnerabilities found", exit 0.
- npm `latest` is still `4.0.7`; upstream PR 194 is still open and does not claim a
  complete fix. No patched release exists.
- Independent check of picomatch 4.0.7: `isMatch('a'.repeat(n) + '!', '+(*a)')`
  took 4 ms (n=16), 8 ms (20), 149 ms (24), 16.3 s (28). Matching time still grows
  exponentially, so the withdrawal is an advisory-database decision, not evidence
  of a technical fix.

## Residual risk and reachability

Unchanged from the earlier assessment: picomatch is only a build/test tooling
dependency in practice. Vue Router carries it transitively, but the production
browser bundle contained no matcher modules and no application-controlled glob
pattern path (aircraft JSON, storage, weather/runway input and route parameters
never reach a pattern argument). Malicious PR configuration could still stall Node
tooling; untrusted runs are not declared safe. CI uses `pull_request`, read-only
default permissions and bounded job timeouts.

## Follow-up trigger

Owner: AeroDash CTO with the weekly security rotation. If the advisory is
re-published, scanners will fail again and must be handled as a new finding; no
automatic exception exists. Update both picomatch lines once upstream ships a
complete fix. Reassess if dependencies, browser imports, glob configuration or
trust boundaries change.
