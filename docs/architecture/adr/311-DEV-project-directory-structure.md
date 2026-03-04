# 311-DEV-project-directory-structure: Modular Project Structure with P1 Isolation

- **Status:** Accepted
- **Date:** 2026-03-04

## Context

Following the adoption of Vue 3 ([ADR 002](002-frontend-framework.md)) and the `create-vue` initialization ([ADR 309](309-DEV-frontend-tooling.md)), we needed to formalize the `src/` directory structure for AeroDash.

AeroDash faces a unique structural challenge: it must enforce strict isolation of its **P1 Safety Core** (pure TypeScript math engine for Mass & Balance, Performance, Fuel calculations) from the Vue 3 UI framework, while simultaneously scaling across 8+ functional domain modules (Weather, Aircraft, Sync, Export, etc.) as development progresses through Milestones 2–8.

The [Vue FAQ](https://vue-faq.org/en/development/project-structure.html) recommends the Modular approach for applications of this scale and complexity. We evaluated two primary approaches.

## Considered Options

- **Flat Approach:** All components, stores, views, and services live in top-level folders (`src/components/`, `src/stores/`, `src/views/`, `src/services/`). Simple to set up, minimal overhead.
  - _Pro:_ Low initial complexity. Fast to navigate in early stages.
  - _Con:_ Does not scale. As modules grow, these folders become dumping grounds with 50+ files. No encapsulation — a Weather component sits next to a Mass & Balance component with no logical boundary. P1 isolation is convention-only, not structurally enforced.

- **Modules Approach:** Each functional domain is encapsulated as a self-contained module under `src/modules/`, owning its own components, stores, views, and services. Shared resources live in a separate `src/shared/` app shell. A dedicated `src/core/` folder isolates the P1 Safety Core.
  - _Pro:_ Scalable — each new module follows the same internal template. Domain boundaries are structural, not just naming conventions. P1 isolation is architecturally enforced. Aligns directly with the Vue FAQ recommendation for large applications.
  - _Con:_ Higher initial boilerplate. Requires discipline to maintain per-module structure over time.

## Decision

We have decided to adopt the **Modules Approach** with a dedicated **P1 isolation boundary**.

### Structure

```text
src/
├── core/                    # 🔴 P1 Safety Core — Pure TS. Zero framework deps.
│   ├── math/                #   Interpolation, polygon checks, M&B, FE, performance.
│   ├── units/               #   SI unit normalization (kg, m, L, s).
│   └── validation/          #   Zod schema validation for aircraft data.
│
├── modules/                 # 🟢 Feature Modules — Encapsulated domain logic.
│   ├── mass-balance/        #   components/, composables/, stores/, services/, views/
│   ├── performance/
│   ├── fuel-endurance/
│   ├── weather/
│   ├── aircraft/
│   ├── airport/
│   ├── sync/
│   └── export/
│
├── shared/                  # 🔵 App Shell — Shared across all modules.
│   ├── components/          #   Base UI components (BaseButton, BaseCard, etc.)
│   ├── composables/         #   Shared Vue composition functions
│   ├── layouts/             #   Layout components (DefaultLayout, DarkLayout)
│   └── utils/               #   Non-safety TS helpers (formatting, dates)
│
├── plugins/                 # 🟠 Cross-cutting services (Notification Bus, Connectivity)
├── stores/                  # Global Pinia stores (app-level state)
├── router/                  # Vue Router configuration
└── assets/                  # Static assets (images, fonts, styles)
```

### P1 Isolation Rules

1. **`core/` has ZERO Vue/framework imports.** This is enforceable via ESLint `no-restricted-imports` rules preventing any `vue`, `pinia`, or `vue-router` imports inside `core/`.
2. **Modules call `core/`; `core/` never imports from modules, shared, or plugins.** The dependency is strictly one-directional.
3. **`core/` is 100% unit-testable in isolation** — Vitest with no DOM, no stores, no component mounting.
4. **Data flows one way through the boundary:** Module store action → calls `core/` function → receives deterministic result → emits notification via `plugins/notifications`.

### Folder Semantics

| Folder                  | Purpose                                               |  Framework Deps   | P1 Logic |
| :---------------------- | :---------------------------------------------------- | :---------------: | :------: |
| `core/`                 | Safety-critical math, validation, unit normalization  |      ❌ None      |  ✅ Yes  |
| `modules/<name>/`       | Domain-specific UI, state, services                   |   ✅ Vue, Pinia   |  ❌ No   |
| `shared/`               | Reusable UI components, layouts, non-safety utilities |      ✅ Vue       |  ❌ No   |
| `plugins/`              | Cross-cutting services (notifications, connectivity)  | ✅ Vue (optional) |  ❌ No   |
| `stores/`               | Global application state                              |     ✅ Pinia      |  ❌ No   |
| `utils/` (in `shared/`) | Pure TS helpers not related to safety                 |      ❌ None      |  ❌ No   |

## Consequences

### Positive

- **Structural P1 Isolation:** The safety-critical math core is physically separated from the UI framework, making accidental coupling immediately visible in code review and enforceable via linting.
- **Scalability:** Adding a new domain (e.g., Navigation in a future milestone) is a matter of adding a new module folder following the established template.
- **Testability:** `core/` can be tested with pure unit tests — no Vue Test Utils, no component mounting, no DOM.
- **Developer Clarity:** A contributor immediately knows where to find and where to place code. Weather-related components live in `modules/weather/components/`, not in a flat `src/components/` folder alongside 50 unrelated files.

### Negative

- **Initial Boilerplate:** Each new module requires creating multiple subdirectories (components, stores, views, etc.), even if some start empty.
- **Cross-Module Dependencies:** When modules need to interact (e.g., Weather module providing data to Performance module), the interaction must be routed through shared stores or explicit service interfaces rather than direct imports, adding some indirection.

## Compliance

n/a
