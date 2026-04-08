# AeroDash Navigation Architecture

This document describes the navigation shell introduced in the UI redesign
(`@IMP-UI-SHARED-002@`, `@IMP-UI-ROUTE-001@`), covering desktop sidebar behaviour,
mobile bottom tab bar, nav item states, and route structure.

See also: [`design_system.md §6`](design_system.md) for token values and
[`ADR-004`](../architecture/adr/004-ui-redesign-navigation.md) for the decision record.

---

## 1. Overview

AeroDash uses a **persistent app shell** that wraps every route via `App.vue`. The
shell provides:

- A **fixed top header** (56 px) that is always visible regardless of scroll position.
- A **left sidebar** on desktop that lists all nav items with icons and labels.
- A **bottom tab bar** on mobile that shows the four primary destinations.

Navigation state (which route is active) is derived from Vue Router's `useRoute()`
composable — no additional Pinia store is needed.

---

## 2. Desktop Sidebar

### 2.1 Layout

The sidebar occupies the left column of a CSS Grid app shell:

```css
.app-shell {
  display: grid;
  grid-template-areas:
    "header header"
    "sidebar main";
  grid-template-columns: var(--nav-sidebar-width) 1fr;
  grid-template-rows: var(--nav-header-height) 1fr;
}
```

It is `position: sticky`, pinned `top: var(--nav-header-height)`, and scrolls
independently from the main content area.

### 2.2 Expanded State (≥ 1024 px)

- Width: `--nav-sidebar-width` = 220 px.
- Each nav item shows: icon (20 × 20 px) + label text + optional "Soon" badge.
- The sidebar footer displays a one-line advisory reminder.

### 2.3 Collapsed State

The user collapses the sidebar by clicking the hamburger button in the header.
Collapse is stored in a local `ref<boolean>` (`sidebarCollapsed`) on `App.vue`.

When collapsed:

- Grid column shrinks to `--nav-sidebar-collapsed` = 64 px.
- Labels, "Soon" badges, and the sidebar footer text are hidden via `display: none`.
- The logo in the header switches to icon-only mode.
- Nav items remain tabbable and show a `title` tooltip on hover.

### 2.4 Narrow Desktop Auto-Collapse (768–1023 px)

At this breakpoint the sidebar auto-collapses to icon-only (64 px) regardless of the
toggle state. No label text is shown. This prevents layout overflow on smaller laptops
and tablets in landscape orientation.

---

## 3. Mobile Bottom Tab Bar

On viewports narrower than 768 px:

- The sidebar is hidden (`display: none`).
- The hamburger collapse button is hidden.
- A **fixed bottom tab bar** appears (`position: fixed; bottom: 0; height: 56px`).
- Main content receives `padding-bottom: var(--nav-bottom-height)` so content is never
  obscured by the bar.

### 3.1 Items

The bottom bar shows the first four nav items: **Home**, **Flight Prep**, **Fleet**,
**Weather**.

Each tab displays:

- Icon (22 × 22 px, centred).
- Label in uppercase micro-text (`0.625rem`, `letter-spacing: 0.03em`).

### 3.2 Touch Targets

All bottom tab links meet the 44 × 44 px minimum touch target requirement
(`REQ-UQ-001`) — the `<a>` or `<span>` element stretches to fill the full tab cell
height via `height: 100%`.

---

## 4. Nav Item States

| State | Element type | Visual treatment | Accessibility |
| --- | --- | --- | --- |
| **Default** | `<RouterLink>` | `--color-nav-text`, no background | — |
| **Hover** | `<RouterLink>` | `--color-surface-hover` background, `--color-text-primary` | — |
| **Active** | `<RouterLink>` | `--color-nav-active-bg` + `--color-nav-active-text`, `font-weight: 600`, dark-mode glow | `aria-current="page"` |
| **Soon / disabled** | `<span>` | `opacity: 0.5` (sidebar) / `0.4` (bottom tab) | `aria-disabled="true"`, `title="… — Coming soon"` |

Active route detection uses a helper function `isActive(item)`:

- For the home route (`/`), exact match only (`route.path === '/'`).
- For all other routes, prefix match (`route.path.startsWith(item.path)`).

---

## 5. Nav Items Reference

| ID | Label | Path | Status |
| --- | --- | --- | --- |
| `home` | Home | `/` | Active |
| `flight-prep` | Flight Prep | `/mass-balance` | Active |
| `fleet` | Fleet | `/fleet` | Coming soon |
| `weather` | Weather | `/weather` | Coming soon |
| `fuel` | Fuel | `/fuel` | Coming soon |
| `airport` | Airport DB | `/airport` | Coming soon |

---

## 6. Route Structure

Defined in `frontend/src/router/index.ts` — tagged `@IMP-UI-ROUTE-001@`.

| Route | Name | Component | Notes |
| --- | --- | --- | --- |
| `/` | `home` | `HomeView.vue` | Lazy-loaded |
| `/mass-balance` | `mass-balance` | `MassBalanceView.vue` | Eager-loaded |

All future module routes follow the pattern `/module-id` matching the nav item paths
above. When a module ships, its route is added here and the `soon` flag removed from
the corresponding nav item in `App.vue`.

---

## 7. Header

The top header (`role="banner"`, `z-index: 200`) contains:

- **Left:** Hamburger collapse button (desktop only) + `AppLogo` link to `/`.
- **Right:** Theme toggle button (sun / moon icon).

The header background (`--color-nav-bg`) matches the sidebar to form a unified shell
surface. A 1 px bottom border (`--color-divider`) and `--shadow-xs` separate it from
the main content area.

---

## 8. Accessibility Notes

- The sidebar `<nav>` carries `aria-label="Main navigation"` and `id="app-sidebar"`.
- The hamburger button references `aria-controls="app-sidebar"` and reflects state
  with `aria-expanded`.
- The mobile bottom nav carries `aria-label="Main navigation (mobile)"` as a distinct
  landmark to avoid duplicate landmark names causing screen reader confusion.
- Soon/disabled items are rendered as `<span>` (not `<a>`) to prevent keyboard focus
  on non-functional links. They carry `aria-disabled="true"` for completeness.
- Theme toggle button carries a dynamic `aria-label` ("Switch to light mode" /
  "Switch to dark mode") that updates reactively.
