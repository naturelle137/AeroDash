# 310-DEV-vue-vite-plugins: Vue/Vite Plugin Selection

- **Status:** Accepted
- **Date:** 2026-03-04

## Context

Following the frontend framework decision ([ADR 002](002-frontend-framework.md)) and the project initialization ([ADR 309](309-DEV-frontend-tooling.md)), we need to select additional Vue/Vite plugins beyond the `create-vue` baseline. These plugins extend the application's capabilities in areas not covered by the default scaffolding: offline PWA support, interactive charting for CG envelopes, and developer ergonomics.

Each plugin must be evaluated against the project's core constraints: minimal bundle impact on old cockpit tablets, strict TypeScript compatibility, and long-term ecosystem stability.

## Considered Options

### 1. PWA & Offline Support

AeroDash must function on remote airfields with no connectivity (REQ-SYS-001). This requires Service Worker registration, App Shell precaching, and offline asset management.

- **`vite-plugin-pwa` (Vite PWA):** The established Vite-native PWA plugin. Wraps Google's Workbox under the hood but provides a zero-config Vite integration. Handles manifest generation, Service Worker registration, and precache strategies.
- _Alternative 1:_ **Raw Workbox:** Direct use of the Workbox library for fine-grained caching strategies. Offers maximum control but requires significantly more manual configuration and maintenance.
- _Alternative 2:_ **Custom Service Worker:** Hand-written Service Worker without any library. Maximum flexibility but very high development and maintenance cost with no precaching abstractions.

### 2. Charting (CG Envelope Visualization)

AeroDash requires interactive, real-time CG envelope charts with polygon rendering, trend lines, and point overlays (REQ-UI-010, REQ-UI-019).

- **`vue-chartjs` (Chart.js wrapper):** Mature Vue 3 wrapper around Chart.js. Supports scatter plots, polygons via custom datasets, and real-time updates. Lightweight runtime (~60KB gzipped for Chart.js core). Well-documented, large community.
- _Alternative 1:_ **`vue-echarts` (Apache ECharts):** Feature-rich charting suite with built-in polygon/area support and excellent interactivity. Heavier bundle (~200KB gzipped full, ~100KB with tree-shaking). More powerful out-of-the-box for complex visualizations but overkill for the focused chart types AeroDash needs.
- _Alternative 2:_ **D3.js (direct):** The most powerful and flexible visualization library. Offers pixel-perfect control over SVG rendering. However, it has no Vue integration layer, requiring significant boilerplate for reactivity, and its learning curve is steep for a solo developer.

### 3. PWA Asset Generation

PWA manifests require multiple icon sizes and splash screens across platforms.

- **`@vite-pwa/assets-generator`:** Companion tool for `vite-plugin-pwa` that auto-generates all required icon sizes and manifest entries from a single source image.
- _Alternative 1:_ **`pwa-asset-generator`:** Standalone CLI tool by Apple that generates splash screens and icons. Platform-focused, works outside the Vite pipeline.
- _Alternative 2:_ **Manual generation:** Using image editors or scripts to manually create each icon size. Time-consuming and error-prone for a solo developer.

## Decision

We have decided to adopt the following three plugins:

1. **`vite-plugin-pwa`** for PWA & Offline Support. This plugin is the de facto standard for Vite-based PWAs and provides the most efficient path to satisfying our offline-first requirement. It integrates natively with the Vite build pipeline, automatically generates the Web App Manifest, and manages Service Worker lifecycle (install, activate, update) with sensible defaults. Workbox precaching strategies ensure the App Shell and `core/` computation logic are cached for true zero-connectivity operation. Raw Workbox was rejected because it requires manual Service Worker scripting without the Vite integration, adding significant maintenance burden for a solo developer. A custom Service Worker was rejected for the same reason at an even higher cost.

2. **`vue-chartjs`** (Chart.js wrapper) for CG Envelope Visualization. Chart.js provides the best balance of bundle size (~60KB gzipped), feature coverage, and ecosystem maturity for our specific chart types (scatter plots with polygon overlays, trend lines, real-time point updates). The `vue-chartjs` wrapper provides idiomatic Vue 3 Composition API bindings, making reactive chart updates straightforward. Apache ECharts was rejected due to its significantly larger bundle size, which conflicts with our constraint of performant operation on older cockpit tablets. D3.js was rejected because it lacks Vue integration and demands extensive custom code for reactive chart updates, which is impractical for a solo developer when a proven wrapper exists.

3. **`@vite-pwa/assets-generator`** for PWA Asset Generation. As a companion to `vite-plugin-pwa`, it provides seamless icon and splash screen generation from a single source image, directly outputting the formats and sizes required by the manifest. This eliminates a manual, error-prone step from the build process. The standalone `pwa-asset-generator` was rejected because it operates outside the Vite pipeline, creating an additional manual step. Manual generation was rejected as it is unsustainable for cross-platform icon requirements.

## Consequences

### Positive

- **Offline-First Guarantee:** `vite-plugin-pwa` provides robust, battle-tested Service Worker management, ensuring the application works reliably on remote airfields without connectivity.
- **Lightweight Charting:** Chart.js keeps the production bundle small enough for older cockpit tablets while providing all required chart types (scatter, polygon, trend line) for M&B envelope visualization.
- **Automated Asset Pipeline:** `@vite-pwa/assets-generator` removes a manual step from the build process, ensuring consistent, correctly-sized icons across all target platforms.
- **Ecosystem Alignment:** All three plugins are widely adopted in the Vue/Vite ecosystem, ensuring long-term support, community resources, and compatibility with future Vite versions.

### Negative

- **Chart.js Customization Ceiling:** While Chart.js handles our current requirements well, highly custom rendering (e.g., non-standard polygon annotations) may require Chart.js plugins or custom controller extensions. If future charting needs exceed Chart.js capabilities, migration to a lower-level library (D3.js) could be costly.
- **Workbox Abstraction:** `vite-plugin-pwa` abstracts Workbox configuration, which simplifies initial setup but may limit fine-grained control over caching strategies if advanced scenarios arise (e.g., selective runtime caching of API responses).

## Compliance

n/a
