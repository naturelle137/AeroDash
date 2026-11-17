# Temporary picomatch ReDoS disposition

## Decision proposed for CTO acceptance

This is a real, unpatched vulnerability, not a false positive or a repair.
The root `osv-scanner.toml` proposes ignoring only GHSA-fc5q-39xc-vjpf
(alias CVE-2026-112366) until **2026-11-24 00:00:00 UTC**. Prepared on
2026-11-17; HQ1866/project CTO owns acceptance after one fresh security review,
protected integration and actual develop CI. This document does not grant acceptance.
The weekly security rotation shares follow-up ownership. Issue #581 stays open.

Remove the entry at the first supported patched release or complete upstream fix,
or at expiry, whichever comes first. Check the advisory and npm release, update
both resolved lines where supported, rerun the scanner and functional gates,
and remove this exception. If no complete repair exists at expiry, the scan must
fail again; do not silently extend it. Reassess earlier if dependencies, browser
imports, glob configuration or untrusted-input boundaries change.

## Primary evidence, checked 2026-11-17

- [GitHub advisory](https://github.com/advisories/GHSA-fc5q-39xc-vjpf), updated
  15:56:44Z: high, CVSS v3 7.5, affected `<=4.0.7`, no first patched version.
  Single-branch repeated extglobs such as `+(*a)` can cause exponential backtracking.
- [Official npm registry](https://registry.npmjs.org/picomatch/latest): latest
  `4.0.7`. No supported complete dependency repair was available at inspection.
- [Upstream PR 194](https://github.com/micromatch/picomatch/pull/194) remains open;
  its stated scope excludes the general single-branch case and says `+(*a)` remains
  exponential. It is not a complete patch. No parser patch or invented release is used.
- [OSV 2.7.1 configuration documentation](https://github.com/google/osv-scanner/blob/v2.7.1/docs/configuration.md)
  specifies `osv-scanner.toml` beside the scanned lockfile and ID-based ignores
  including aliases. [Pinned implementation](https://github.com/google/osv-scanner/blob/v2.7.1/internal/config/config.go)
  supports `ignoreUntil` as a deprecated fallback for `effectiveUntil`; it compares
  the timestamp with the current time and stops ignoring at expiry. The explicit
  UTC `ignoreUntil` here follows the requested pinned-version contract.

## Resolved graph and actual reachability

The unchanged lockfile resolves picomatch **2.3.2** and **4.0.7**. Representative
paths from `pnpm -r why picomatch --json`:

| Version | Resolved consumers |
| --- | --- |
| 2.3.2 | markdownlint-cli2 0.24.1 → micromatch 4.0.8; globby/fast-glob → micromatch; @vue/eslint-config-typescript → fast-glob; vite-plugin-pwa 1.3.0 → workbox-build 7.4.0 → Rollup Babel/replace plugins → @rollup/pluginutils 3.1.0 |
| 4.0.7 | Vite 8.3.8; Vitest 4.1.12; vue-tsc 3.3.14 → @vue/language-core; npm-run-all2; release-it → tinyglobby; Workbox Rollup plugins → @rollup/pluginutils 5.5.1; Vue Router 5.5.0 and its unplugin/tinyglobby dependencies |

Package placement alone cannot establish non-exposure: `pnpm -r list --prod
--depth Infinity --json` includes 4.0.7 via **Vue Router 5.5.0**, a production
dependency. Its package exports separate the browser router (`dist/vue-router.js`)
from `vue-router/vite` and `vue-router/unplugin`. AeroDash imports the former in
`frontend/src/router/index.ts` and declares routes statically; it does not enable
the router unplugin. Its router runtime uses its own path parser, not picomatch.

Source inspection of `frontend/src` and `frontend/scripts` found no picomatch,
micromatch, tinyglobby or dynamic `import.meta.glob` use. Imported aircraft JSON,
local storage, runway/weather input and URL route parameters therefore have no
identified application path to a picomatch pattern argument. This conclusion is
limited to the inspected imports and build, not a guarantee about future changes.

A production Vite build with an observation-only `generateBundle` plugin recorded
12 JS chunks and 254 module entries: no picomatch, micromatch, tinyglobby or router
unplugin modules. It did record the three browser router modules. The normal
production build, generated service worker and Workbox runtime were separately
inspected; a text search alone is not the basis of the reachability conclusion.
Node dependencies remain installed on build machines; they are not shipped by
copying `node_modules` into this static PWA.

## Tooling callsites and trust boundary

Installed-source inspection distinguishes patterns from candidate filenames:

- `micromatch/index.js` passes its `patterns[i]` argument to picomatch;
  `markdownlint-cli2.mjs` supplies CLI/config globs to micromatch and filenames as
  candidates. The repository script uses `**/*.md`; nested lint configs can alter
  options. Filenames alone are not the vulnerable pattern argument.
- `@rollup/pluginutils/dist/es/index.js` compiles configured include/exclude
  patterns in `createFilter`; source module IDs are candidates. Workbox's
  `get-file-manifest-entries.js` consumes configured `globPatterns`/`globIgnores`.
  AeroDash's `frontend/vite.config.ts` sets fixed asset globs plus legal filenames.
- `tinyglobby/dist/index.mjs` compiles processed match/ignore arrays with picomatch.
  Vite, Vitest and Vue language tooling consume repository configuration/CLI
  patterns, including fixed test/include/exclude globs in `vitest.config*.ts`
  and `tsconfig*.json`. `npm-run-all2/lib/match-tasks.js` matches script selectors.

An untrusted PR can change these patterns, add tool configuration or execute code
in the existing install/build/test steps. It can therefore cause Node event-loop
DoS, wasted runner time or stalled developer commands. This proposal accepts that
**residual tooling availability risk**, including untrusted-PR runs; it does not
claim such runs are safe. Review configuration/dependency changes before running
locally, keep the dev server local, and cancel stalled CI. Existing CI uses
`pull_request` (not `pull_request_target`), read-only default contents permission
and bounded ordinary build/test job timeouts. Those limits reduce impact, not
vulnerability. Release tooling and installed developer servers remain exposed
if someone supplies malicious patterns; no public build/glob service is provided
by this PWA. Compromised dependencies or arbitrary contributor code are outside
the no-application-pattern-path conclusion.

## Reproduction and acceptance evidence

HQ job 1893 retains source snapshots, resolved graph, installed callsites,
production module inventory, artifact hashes, command receipts and scanner JSON.
The lockfile SHA-256 is
`80cb30c175cfdd94edee67a1b83669b620c38e6d7a043546ce5fba3f9bf01e65`.
The official Linux amd64 OSV-Scanner 2.7.1 binary SHA-256 matches release metadata:
`fb7dab19a8bd9bbe5c3189f09d4b7ee1820c9553a23bac202648a56efd2f6ee8`.

Run from the repository root with that binary:

```sh
osv-scanner scan source --lockfile=pnpm-lock.yaml --format=json --output=scan.json
```

The baseline without configuration reports precisely the two affected package
versions (exit 1). The configured scan reports no active findings (exit 0).
The normal JSON omits ignored findings, including with `--all-vulns`. An expired-copy scan
restored both findings (exit 1). A separate temporary lodash 4.17.20 fixture
still reported four unrelated advisories (exit 1); that fixture never enters the
product lockfile.
Scanner execution errors are not evidence of either a clean scan or a vulnerability.
No malicious ReDoS execution is necessary for this disposition.

The security workflow and its existing PR warn-only / push-and-schedule hard-fail
policy remain unchanged. A green PR alone does not establish actual develop
acceptance. The parent owns the sole fresh review and subsequent CI decision;
no alert is dismissed and no issue is closed by this proposal.

## Newly propagated pnpm detection (2026-11-17)

HQ1866 accepted the OSV tooling-risk decision at 2026-11-17T17:03:21.257060Z
(`var/jobs/1866/security-risk-acceptance.json`), following review HQ1895 with no
fix round. That delivered decision and its OSV configuration remain unchanged.
PR #583 run 44144122587/job 134254475312 then failed pnpm audit on the same
GHSA-fc5q-39xc-vjpf / CVE-2026-112366: two high root paths through lint-staged
and markdownlint-cli2/micromatch. OSV ignores do not configure pnpm.

A fresh check of the [official registry](https://registry.npmjs.org/picomatch/latest)
and [GitHub advisory API](https://api.github.com/advisories/GHSA-fc5q-39xc-vjpf)
still returned latest 4.0.7, affected `<=4.0.7`, and no first patched version
(advisory updated 2026-11-17T15:56:44Z). No supported complete fix was available.
This is the same accepted Node tooling availability risk, with no new risk
class, vulnerability repair or expiry extension.

The dependency-audit Run step invokes `scripts/security/pnpm-audit.mjs`.
Before **2026-11-24T00:00:00Z** it audits a byte-identical lockfile in a
temporary directory whose package manifest sets only
`pnpm.auditConfig.ignoreCves: [CVE-2026-112366]`. The directory is removed
afterwards, including on failure. At that instant and afterwards it runs the
normal audit in the repository without an ignore. The clock comes from the process, with no CLI or
environment expiry override. The [pnpm 10 audit documentation](https://pnpm.io/10.x/cli/audit)
documents CVE ignores; the project uses pnpm 10.32.1. Actual CLI/source inspection
showed that `audit --ignore` persists a package.json ignore and returns success
before checking remaining findings. It is therefore unsuitable here. The temporary
manifest uses pnpm's documented `auditConfig.ignoreCves` filtering instead.
PR/push high and scheduled moderate thresholds remain unchanged. Exit statuses,
registry failures, spawn failures and signals remain failures. No global ignore,
ignore-unfixable or ignore-registry-errors setting is added. The lockfile,
browser application and OSV TOML remain byte identical.

CI runs `node --test scripts/security/pnpm-audit.test.mjs` before the wrapper.
Injected-clock tests cover one millisecond before, exactly at and after expiry;
fake audit processes cover unrelated high/critical findings, scheduled moderate,
clean post-expiry scans and process/network failure statuses. Spawn errors,
signals and invalid clocks also fail closed. Tests check lockfile identity,
project-file preservation and cleanup after errors; no ReDoS payload is executed.

Remove this wrapper exception as soon as a supported complete fix covers both
resolved picomatch lines, or at the existing expiry, whichever comes first.
HQ1866/AeroDash CTO and the weekly security rotation retain removal ownership.
HQ1892 owns this new mechanism's sole fresh review, at most one named fix round,
protected integration and actual develop CI. That review does not reopen the
accepted OSV risk decision. Issue #581 remains open.
