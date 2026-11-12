# ADR-004: Modern Navigation Shell and Dashboard Home

- **Status:** Accepted
- **Date:** 2026-04-08

## Context

AeroDash launched with a single route (`/mass-balance`) that loaded directly into the
Mass & Balance view. There was no home page, no persistent navigation chrome, and no
visual structure to communicate that additional modules (Performance, Weather, Fuel &
Endurance, Airport Database, Fleet Management) would follow.

This created several problems:

- Pilots arriving at the app had no orientation — the M&B form appeared immediately
  with no context or entry point.
- With only one visible destination, the routing layer had no room to grow without a
  disruptive structural change.
- The app felt like a single-purpose form tool rather than an integrated flight
  preparation suite.
- There was no persistent chrome to surface cross-cutting controls (theme toggle) or
  the AeroDash brand identity.

The design system already defined `--nav-sidebar-width`, `--nav-header-height`, and
related dimension tokens (`REQ-UI-011`), anticipating a navigation shell. These tokens
were unused at the point this ADR was written.

## Decision

We adopt **Option C**.

`App.vue` is redesigned as a CSS Grid app shell with:

- A fixed 56 px header (`--nav-header-height`) carrying the `AppLogo` component,
  a collapse toggle for the sidebar, and the theme toggle.
- A 220 px left sidebar (`--nav-sidebar-width`) that collapses to 64 px
  (`--nav-sidebar-collapsed`) on user request or auto-collapses on narrow desktops
  (768–1023 px). Nav items: Home, Flight Prep, Fleet, Weather, Fuel, Airport DB.
  Coming-soon items are rendered as non-interactive `<span>` elements with
  `aria-disabled="true"`.
- A 56 px bottom tab bar (`--nav-bottom-height`) on mobile (`< 768 px`) showing
  the four primary destinations, replacing the hidden sidebar.
- A new `HomeView.vue` at route `/` presenting a greeting, a primary CTA to Flight
  Preparation, an active-modules grid, and a coming-soon modules grid.

A new `AppLogo.vue` shared component provides the AeroDash "A" letterform SVG mark
and wordmark, accepting `iconOnly` and `size` props so it adapts between the expanded
and collapsed sidebar states.

The router is extended with the `/` → `HomeView` route alongside the existing
`/mass-balance` route. Both are tagged `IMP-UI-ROUTE-001`.

References: `REQ-UI-011`, `REQ-SYS-001`.

## Consequences

### Positive

- **Orientation:** Pilots see the full module suite on first load, giving immediate
  context for the app's scope and roadmap.
- **Extensibility:** Adding a new module requires only: (1) adding a route, (2)
  changing the `soon` flag on the corresponding nav item. No structural change to the
  shell.
- **Consistent chrome:** The theme toggle, logo, and advisory footer are available on
  every page without duplication per view.
- **Mobile-first parity:** The bottom tab bar gives mobile users the same primary
  destinations as the desktop sidebar without requiring a hamburger menu interaction.
- **Token utilisation:** Navigation dimension tokens previously defined but unused in
  `theme.css` are now wired to real layout constraints, validating the token design.

### Negative

- **Always-present chrome reduces content area:** The 220 px sidebar reduces the
  available width for content on desktop. The collapsible design mitigates this for
  content-heavy views.
- **Sidebar collapse state is local (not persisted):** The collapse preference resets
  on page reload. A future enhancement could persist the preference to `localStorage`.
- **Coming-soon items add visual noise:** Disabled nav items and home-page cards may
  feel like unfinished UI. The muted styling (`opacity: 0.5`, dashed borders) is
  intended to signal "in development" rather than "broken", but this requires user
  familiarity.
