# Briefing action and Performance navigation

Origin: Telegram AeroDash thread 6 message 524; addenda 527/528. Refs #568.
Runtime: `7c2f76bcc1692a056d826dd956f68e6f6d1c438b`. This evidence follow-up
changes no runtime source. Production bundle SHA-256:
`f686bbbfac05893f91c02ca9cb4c7b4e50287431963875699fa0cd1b99176e00`.

## Visible acceptance

| Width | Homepage icon and navigation | Disabled action | Enabled after recovery |
| --- | --- | --- | --- |
| 320px | [Homepage](home-320.png) | [Disabled](disabled-320.png) | Covered at 390px |
| 390px | [Homepage](home-390.png) | [Disabled](disabled-390.png) | [Enabled](enabled-390.png) |
| 1440px | [Homepage](home-1440.png) | [Disabled](disabled-1440.png) | [Enabled](enabled-1440.png) |

The production Playwright `briefing-pack.spec.ts` checks the shared CTA's computed
background, text color, font family/size/weight/line height, border radius, padding,
gap, minimum height and shadow against the actual homepage CTA. Both controls use
one stylesheet for normal, hover, active and keyboard-focus states. Disabled
export is a native grey button, refuses mouse/Enter/Space activation and focus,
and has no associated helper text, description or tooltip. Blank loading disables
it; correction restores it, mouse activation opens the preview, Escape returns
focus, and Enter opens it again. The action remains visible above mobile navigation.

The existing Performance SVG is visible at 28×28px in the same centered 44px
container, color and treatment as M&B. Tests check icon geometry and vertical
alignment, no Performance link in either main navigation, keyboard activation of
the homepage Performance entry, the Flight Preparation CTA and direct
`/performance` loading. Internal Flight Preparation Performance remains available.
Screenshots were visually inspected at all three widths.

## Verification

Commands run in the existing `web-dev` Distrobox:

- `pnpm lint`: passed.
- `pnpm test:unit`: 2,324 passed.
- `pnpm test:integration`: 223 passed.
- `pnpm build`: passed, including strict TypeScript.
- `pnpm --filter frontend test:p1`: 1,084 passed.
- `check:data-constants` and `comment:check`: passed.
- `CI=1 pnpm test:e2e --project=chromium`: 97 passed.
- Full production cached-offline suite: 60 passed at 390/1440px, including 320px checks.

The full suite retains real cached service-worker reloads, current warning-value
associations, valid computed-exceedance export, hard-error refusal, native Print,
Ctrl+P suppression without a valid preview, and same-turn snapshot invalidation.
Raw logs, traces, PDFs and screenshot hashes remain in the implementation job.
These images supersede the action/navigation appearance in the earlier
[CEO524 evidence](../live-warning-pack/README.md).

All aircraft and numeric fixtures are synthetic software tests, not operational
POH/AFM validation. No domain code, calculation policy, #534 warning boundary or
the #305 source hold changed. No physical-printer or real-device claim is made.
Terminal HQ1737 owns the single fresh review, protected integration and actual
merged-app/export acceptance; this evidence establishes branch behavior.
