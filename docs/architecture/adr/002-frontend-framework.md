# 002-frontend-framework: Architecting the UI layer with Vue 3

* **Status:** Accepted
* **Date:** 2026-03-02

## Context

AeroDash is a safety-critical aviation tool designed to compute Mass & Balance (M&B) and Takeoff/Landing performance. It must function reliably on potentially low-end computing devices (e.g., older iPads or Android tablets) operated in remote environments (like grass airfields) with "Edge" or no cellular connectivity.

Furthermore, AeroDash is being engineered by a solo developer, meaning that developer efficiency and the availability of a stable, deeply integrated ecosystem are paramount. We needed to select a frontend framework that safely cleanly decouples the pure-TypeScript "Safety Core" from the UI, minimizes initial load sizes for poor connections, prevents battery-draining CPU usage during complex visual UI updates (like dragging interactive M&B envelope charts), and offers long-term stability without requiring a massive architectural overhead.

We evaluated the top frameworks based on six primary criteria:

1. **Bundle Size & Initial Load**: Bandwidth requirements on bad connections.
2. **Runtime Performance & Memory**: CPU/RAM impact during continuous UI updates.
3. **TypeScript Integration**: Ability to seamlessly decouple pure-TS core logic.
4. **Ecosystem & Tooling**: Availability of mature PWA and Charting libraries.
5. **Longevity & Stability**: Long-term maintainability without breaking changes.
6. **Solo-Dev Suitability**: Efficiency and learning curve.

## Considered Options

* **React**: The market leader with the largest ecosystem (excellent charting and PWA support). However, its aggressive Virtual DOM re-rendering poses a high risk of stuttering and battery drain on old tablets if optimization hooks (`useMemo`, `useCallback`) are not perfectly managed by the solo developer. Its fragmented "bring your own architecture" nature also introduces unnecessary complexity.
* **Angular**: Highly structured enterprise framework with an "out-of-the-box" approach, including first-party PWA support. However, its massive bundle overhead is overkill for an offline PWA tool. The extreme learning curve (RxJS) makes it highly inefficient for a solo developer focused on aviation math.
* **Svelte (v5) / SolidJS**: True performance kings utilizing compilation instead of a Virtual DOM, yielding minimal bundle sizes. However, their ecosystems are significantly smaller, meaning complex features like interactive charting wrappers would likely require time-consuming custom development from scratch.
* **Flutter**: Excellent for consistent cross-platform native rendering, but entirely unsuitable for the Web/PWA requirement due to massive initial load payloads (>2MB Canvas engine). Moving to Dart would also sacrifice the rich TypeScript math/testing ecosystem needed for the Safety Core.
* **Vue 3 (Composition API)**: The "golden middle." It combines the granular reactivity of Svelte/Solid with an ecosystem rivalry React. Features like `vite-plugin-pwa`, `Pinia`, and mature `Chart.js` wrappers provide a highly stable, solo-developer-friendly foundation while generating small, performant bundles that can run smoothly on older devices.

## Decision

We have decided to use **Vue 3 with the Composition API** and strict **TypeScript** as the frontend framework for AeroDash.

This decision was made because Vue 3 represents the ideal sweet spot for our constraints. It is lightweight and fast enough for older cockpit tablets while avoiding the re-rendering traps inherent to React. The Composition API enforces a clean architectural separation between our safety-critical math Core (which can remain pure TypeScript) and the reactive UI layer. Finally, its massive, mature ecosystem (Pinia, Vite PWA, ChartJS) acts as a force multiplier, allowing a solo developer to focus on aviation logic rather than reinventing UI infrastructure.

## Consequences

By adopting Vue 3, we accept the following consequences:

### Positive

* **Developer Velocity**: The minimal learning curve and robust ecosystem (Vite, Pinia) will save weeks of setup and boilerplate development.
* **Architecture Integrity**: The Composition API (`setup`) cleanly maps to our requirement of isolating the P1 math core from the UI layer.
* **Performance Control**: Vue's reactivity system natively prevents unnecessary re-rendering, protecting the battery life of older devices during continuous chart updates.

### Negative

* **Runtime Footprint**: Compared to Svelte or SolidJS, Vue does ship a framework runtime to the browser, resulting in a marginally larger initial load and memory footprint.
* **Template Typing**: While `<script setup lang="ts">` is excellent, TypeScript validation within the HTML template is sometimes not as foolproof as React's deeply integrated JSX/TSX.

## Compliance

n/a
