# AeroDash Contribution Hub — UX & Handoff Design

This document specifies the in-app contribution hub: how a pilot reaches the
intake surface, what they see at each step, what fields they fill in, and
how the app hands the result off to GitHub. The decision for the chosen
handoff style is recorded in [`ADR-013`](../architecture/adr/013-in-app-contribution-intake.md).

See also: [`docs/requirements/system.md`](../requirements/system.md) for
`REQ-SYS-017 / 018 / 019`, and
[`docs/journeys/04_system_usability.md`](../journeys/04_system_usability.md)
for `UJ-D-NNN` journeys covered.

---

## 1. Entry Points

<!-- @DES-UX-013@ (FROM: @REQ-SYS-017@) -->

The contribution hub is reachable from three locations:

| Location | Element | Label | Visibility |
| --- | --- | --- | --- |
| `App.vue` sidebar footer (above the version) | `<RouterLink to="/contribute">` | "Help / contribute" + speech-bubble icon | Always; hidden when sidebar collapsed (icon-only) |
| `HomeView.vue` bottom of page | `<RouterLink to="/contribute">` inside a "Help improve AeroDash" panel | "Open contribution hub →" | Always when route `/` is rendered |
| `PrivacyView.vue` end of page (below the wipe card) | `<RouterLink to="/contribute">` plain link | "Report a problem or suggest an improvement →" | Always when route `/privacy` is rendered |

The hub itself is a single route `/contribute` rendering
`ContributeView.vue`. No deep links are used; the category selection
lives in component state.

---

## 2. Category Intake (Three-Button Entry)

<!-- @DES-UX-014@ (FROM: @REQ-SYS-017@) -->

On first paint the hub shows a heading, one explanatory paragraph, and
three large buttons stacked vertically (mobile) or in a 3-column grid
(≥768 px). The buttons sit above the contribution-promotion section
(§5).

Each button has: icon, label, one-sentence plain-language description,
and an info tooltip (icon `(i)` with `aria-describedby`).

| ID | Label | One-sentence description | Tooltip body |
| --- | --- | --- | --- |
| `defect` | "Report a defect" | "Something doesn't work the way it should." | "Use this when AeroDash shows a wrong number, a button does nothing, the app crashes, or something looks broken. We use these reports to fix problems." |
| `feature` | "Request a feature" | "Suggest something new or an improvement." | "Use this when you have an idea for something AeroDash could do but currently doesn't — a new calculation, a new layout, support for a new aircraft, an extra option." |
| `security` | "Report a security vulnerability" | "You've found a way the app could be abused." | "Use this when you think someone could misuse AeroDash to harm a pilot, steal data, or bypass a safety check. Security reports are handled privately on GitHub — they are not visible in the public issue list." |

Selecting `defect` or `feature` transitions to the guided form (§3 /
§4). Selecting `security` reveals the security card (§5) instead. The
user can step back to the category screen from any sub-screen via a
"Back" button in the top-left of the active panel.

---

## 3. Defect Guided Form

<!-- @DES-UX-015@ (FROM: @REQ-SYS-018@) -->

The form is a single scrollable column with four field groups followed
by the submit row. It maps 1:1 to the existing
[`bug_report.yml`](../../.github/ISSUE_TEMPLATE/bug_report.yml) template;
no field is invented. Fields and the GitHub template ID they target:

| Step | Field | GitHub template ID | Type | Required | Help text shown above the field |
| --- | --- | --- | --- | --- | --- |
| 1 | Title | (URL `title=`) | single-line text | yes | "A short summary — what went wrong, in one line." |
| 2 | Bug Description | `description` | multi-line text (4 rows) | yes | "What happened? Be as detailed as you can." Placeholder: "When calculating x, the moment arm was y." |
| 3 | Steps to Reproduce | `reproduction` | multi-line text (5 rows) | yes | "How can someone else make the same thing happen?" Placeholder mirrors the GitHub template's numbered list. |
| 4 | Severity & safety relevance | `severity` | dropdown | yes | "How badly did this affect you?" Options copied verbatim from the GitHub template. |
| 5 | Safety hazard reference | `hazard_ref` | single-line text | no | "Skip if unsure — leave blank." Hidden behind an "Advanced (optional)" disclosure. |
| 6 | Environment | `environment` | multi-line text (3 rows) | yes | "Browser, OS, device. We auto-fill what we can detect; please add anything missing." Initial value: a string built by `buildEnvironmentLine()` (P3 helper) from `navigator.userAgent` + viewport width × height + `theme`. |

The two confirmation checkboxes from the GitHub template ("I have
checked if this issue has already been reported." / "I confirm this is
NOT a security vulnerability report.") are **not** rendered in the app.
The user cannot truthfully attest to a backlog search from the app
itself, and the security-vs-bug split is already handled by the
category screen (§2). Both confirmations remain visible on the GitHub
side after handoff; the user ticks them there.

The submit row contains, left-to-right: "Back" (returns to §2),
"Open GitHub to submit ↗" (primary). The primary button is disabled
when any required field is empty, when the title exceeds 200 chars
(GitHub URL limit guard, see §7), or when `navigator.onLine === false`
(an inline note explains "You need a connection to open GitHub — try
again when online.").

---

## 4. Feature Guided Form

<!-- @DES-UX-016@ (FROM: @REQ-SYS-018@) -->

Same layout pattern as §3. Maps 1:1 to
[`feature_request.yml`](../../.github/ISSUE_TEMPLATE/feature_request.yml):

| Step | Field | GitHub template ID | Type | Required | Help text shown above the field |
| --- | --- | --- | --- | --- | --- |
| 1 | Title | (URL `title=`) | single-line text | yes | "A short summary of the idea, in one line." |
| 2 | Problem statement / use case | `problem` | multi-line text (4 rows) | yes | "What are you trying to do? Try the form: 'As a pilot, I want to … so that …'." |
| 3 | Proposed solution | `solution` | multi-line text (4 rows) | yes | "How could AeroDash help? Describe your ideal version." |
| 4 | Related requirement (advanced) | `req_id` | single-line text | no | "Skip if unsure. Format: REQ-SYS-XXX." Hidden behind "Advanced (optional)" disclosure. |
| 5 | Potential safety impact | `safety_impact` | multi-line text (3 rows) | no | "Could this feature affect a Go/No-Go decision? Skip if you don't know." |
| 6 | Definition of Done / checklist | `dod` | multi-line text (4 rows) | yes | "What would need to be done for this to be 'finished'? A short checklist is fine." Pre-fills with `"- [ ] "` so the user only types. |

Confirmation checkboxes are again not rendered in the app for the same
reason as §3.

---

## 5. Security Advisory Card

<!-- @DES-UX-017@ (FROM: @REQ-SYS-019@) -->

Selecting `security` (§2) reveals a single card with no form fields. The
card contains:

1. A short paragraph: "Security reports are private. They go to a
   form on GitHub that only the maintainers can read — they are not
   visible in the public issue list."
2. A one-line bullet list of what *not* to put in a public bug report:
   "Don't post exploit details in a normal bug report; use this path
   instead."
3. A primary button "Open the private security form on GitHub ↗" with
   `rel="noopener noreferrer"` and `target="_blank"`, opening
   `https://github.com/naturelle137/AeroDash/security/advisories/new`.
4. A "Back" button returning to §2.

There is no in-app field collection — see ADR-013 for the rationale. The
button is enabled regardless of connectivity (the new tab will fail to
load offline, but blocking would hide the link entirely from a pilot
who needs the URL for later).

---

## 6. Contribution Promotion Section

<!-- @DES-UX-018@ (FROM: @REQ-SYS-017@) -->

Below the category buttons (§2), permanently visible, sits a
non-modal panel titled "How else can you help?" containing:

- A one-paragraph statement: "AeroDash is built in the open. Contribution
  isn't only writing code — telling us what didn't work, suggesting what
  could work better, improving the wording in the manual, or sharing a
  real-world flight-prep edge case all directly improve the next
  version."
- A 4-row bullet list: "Report a defect you noticed", "Suggest a
  feature", "Improve the documentation", "Share a real-world edge
  case in a discussion".
- A row of two link-style buttons: "Browse open issues ↗"
  (`https://github.com/naturelle137/AeroDash/issues`) and "Open the
  GitHub repository ↗"
  (`https://github.com/naturelle137/AeroDash`). Both open in a new tab
  with `rel="noopener noreferrer"`.

The panel uses the standard `.card` surface (matches
`PrivacyView.vue`), not a coloured callout — it is informational, not
an alert.

---

## 7. P1 URL Builder — Public Contract

<!-- @DES-ARCH-018@ (FROM: @REQ-SYS-018@) -->

The mapping from in-app form state to a prefilled GitHub URL lives in a
single pure-TypeScript module:

```text
frontend/src/core/logic/github-issue-url.ts
```

It exports two named functions:

```ts
buildBugReportUrl(input: BugReportInput): string
buildFeatureRequestUrl(input: FeatureRequestInput): string
```

Both:

- Always target `https://github.com/naturelle137/AeroDash/issues/new`.
- Always include `template=bug_report.yml` or `template=feature_request.yml`
  in the query string (this is how GitHub selects the form schema).
- Pass the form title via `title=` (URL-encoded). All other fields are
  prefilled using GitHub's structured-form syntax: one query parameter
  per field, keyed by the **exact `id` of the matching GitHub template
  field** (`description`, `reproduction`, `severity`, `hazard_ref`,
  `environment` for bugs; `problem`, `solution`, `req_id`,
  `safety_impact`, `dod` for features). For the `severity` dropdown the
  value is the **exact option label** from
  [`bug_report.yml`](../../.github/ISSUE_TEMPLATE/bug_report.yml) (e.g.
  `"Major: Core functionality impaired, no workaround"`), URL-encoded.
- Empty optional fields are omitted from the query string entirely (no
  empty `&foo=` segments).
- Compute the final URL length up-front. If `length > 7500` (GitHub's
  practical limit; documented in the source file), the builder trims
  the longest text field by removing characters from the tail and
  replacing them with a literal trailing marker
  `… (truncated)`. If after trimming all text fields the URL still
  exceeds 7500 chars, the builder falls back to title-only (only
  `title=` + `template=`, all other fields dropped). Both fallback
  paths are independently unit-testable.

`BugReportInput` and `FeatureRequestInput` are exported types whose
property names match the GitHub field IDs in §3 and §4 (`description`,
`reproduction`, `severity`, `hazard_ref`, `environment` for bugs;
`problem`, `solution`, `req_id`, `safety_impact`, `dod` for features),
plus `title: string`. Optional fields are typed `string | undefined`;
required fields are typed `string` and must be non-empty (the builder
throws `Error("github-issue-url: required field …")` if a required
field is empty, since the form layer already gates on this and reaching
the builder with an empty required field is a bug).

The builder is P1: it imports only from other `src/core/` modules and
the standard library. It does not import `vue`, `pinia`, or anything
under `src/modules/ src/shared/ src/stores/`.

---

## 8. State, Accessibility, and Layout Behaviour

<!-- @DES-UX-019@ (FROM: @REQ-SYS-017@) -->

- The `/contribute` view uses the standard
  [Interaction State Taxonomy](design_system.md#2-interaction-state-taxonomy)
  states `INITIAL` (no category chosen) and `UNCONFIGURED` (required
  fields not yet filled). It never enters `VERIFIED_SAFE`,
  `WARNING`, or `ERROR_CRITICAL` — no safety math runs here.
- The category buttons (§2) have `role="button"`, a 44 × 44 px
  minimum touch target, and visible focus ring per
  [`design_system.md §3`](design_system.md#3-accessibility-a11y-standards).
- Tooltips use `aria-describedby` pointing at a visually-hidden
  `<span>` containing the full tooltip body, so screen readers
  receive the long explanation even though only the `(i)` icon is
  rendered.
- Each form field has an associated `<label>`, an inline `aria-describedby`
  to its help text, and `aria-required="true"` when required.
- The "Open GitHub to submit ↗" primary button announces its target
  via the trailing `↗` glyph and an `aria-label` suffix "(opens
  github.com in a new tab)".
- Layout follows
  [`design_system.md §1.2`](design_system.md#12-layout-responsiveness):
  single column ≤ 768 px, 3-column grid for §2 buttons ≥ 768 px, the
  guided forms remain single column at all widths to preserve linear
  reading order.
- The view fits inside the standard `App.vue` shell — no full-screen
  takeover, no modal backdrop.

---

## 9. Out of Scope

<!-- @DES-UX-020@ (FROM: @REQ-SYS-017@) -->

- Offline drafting and persistence of contribution drafts (no IndexedDB
  store, no Pinia persistence). A draft is component-local state only
  and is discarded on navigation away from `/contribute`.
- Free-text redaction (no P1 redactor). The user reviews and edits the
  prefilled content on the GitHub side before submission.
- New issue templates. Both `bug_report.yml` and `feature_request.yml`
  remain unchanged; no `incident_report.yml` or any fourth template is
  introduced.
- In-app authentication, token storage, or background issue submission.
  The flow is "prefill and confirm on GitHub" for bug / feature, and
  "link-only" for security — see [`ADR-013`](../architecture/adr/013-in-app-contribution-intake.md).
- Live status of submitted issues. The app does not poll GitHub for
  responses; the pilot tracks responses in GitHub itself or via the
  notification settings on their GitHub account.
