# AeroDash Architecture Overview

## Motivation and Core Constraints

AeroDash is a safety-critical flight preparation advisory tool for General Aviation pilots. The architecture is driven by the following constraints:

- **Offline-First Applicability**: Must function globally on remote airfields devoid of cellular connectivity.
- **Computational Safety**: Mathematical operations must be traceable, deterministically testable, and robust against misinterpretation.
- **Platform Agnosticism**: General Aviation cockpits are BYOD (Bring Your Own Device). It must work performantly on old iPads, Android devices, and modern Desktop browsers.
- **Data Portability**: Aircraft definitions must be strictly versioned, exportable (JSON), and cleanly separable from the core calculation logic over long lifecycles.

## High-Level Architecture

AeroDash is an **Offline-first Progressive Web Application (PWA)** built on Vue 3.

The architecture emphasizes strict decoupling of the safety-critical computational mathematical core (P1 logic) from the Reactive UI layers.

### Data Flow & Component Interaction

```mermaid
flowchart TD
    %% UI Layer
    subgraph UI ["Vue 3 UI Layer"]
        Views["Views (Pages)"]
        Comps["Shared Components"]
    end

    %% State Management
    subgraph State ["State Management"]
        Pinia["Pinia Stores<br/>(Active Aircraft, Active FP)"]
    end

    %% Core Module
    subgraph Core ["Safety Core (P1)"]
        Math["Math Engine<br/>(M&B, Performance)"]
        Unit["Unit Normalization<br/>(SI conversion)"]
        Val["Schema Validation (Zod)"]
    end

    %% Persistence Layer
    subgraph Persistence ["Data Persistence"]
        IDB[("Local DB (IndexedDB)")]
        Cloud[("Cloud Backend<br/>(Sync Engine M6)")]
    end

    %% Communication
    Bus(("Notification Bus<br/>(INFO, WARN, CRIT)"))

    %% Relationships
    UI -->|Reads/Updates| State
    State -->|Triggers calculations| Core
    Core -->|Returns deterministic results| State

    Core -.->|Fires Mathematical Limit Alerts| Bus
    Persistence -.->|Fires Network Failure Alerts| Bus
    Bus -.->|Subscribes to rendering| UI

    State <-->|Loads/Saves| IDB
    IDB <-->|"Bidirectional Sync<br>(Org precedence)"| Cloud

    %% Styling Definitions
    classDef uiLayer fill:#e0f2fe,stroke:#0284c7,stroke-width:2px,color:#0f172a;
    classDef stateLayer fill:#dcfce7,stroke:#16a34a,stroke-width:2px,color:#0f172a;
    classDef coreLayer fill:#ffe4e6,stroke:#e11d48,stroke-width:2px,color:#0f172a;
    classDef persistenceLayer fill:#fef08a,stroke:#ca8a04,stroke-width:2px,color:#0f172a;
    classDef busLayer fill:#ffedd5,stroke:#ea580c,stroke-width:2px,color:#0f172a;

    %% Apply Styles
    class Views,Comps uiLayer;
    class Pinia stateLayer;
    class Math,Unit,Val coreLayer;
    class IDB,Cloud persistenceLayer;
    class Bus busLayer;
```

### System Context & Component Architecture

The following diagram illustrates the structural boundaries between the local AeroDash client and the remote cloud infrastructure. It highlights the modular layer design within both environments and their interaction via the REST API.

```mermaid
flowchart TB
    %% Frontend Subgraph
    subgraph Frontend ["Frontend (AeroDash PWA)"]
        direction TB
        UI["UI Layer<br>(Vue Components / Views)"]
        State["State Module<br>(Pinia Stores)"]
        Core["Safety Core<br>(Pure TS / Math / Zod)"]
        Sync["Services Layer<br>(API Client / Sync)"]
        LocalDB[("Local Data<br>(IndexedDB)")]

        UI --- State
        State --- Core
        State --- LocalDB
        LocalDB --- Sync
    end

    %% Network / API
    Sync <-->|"REST API<br>JWT Auth"| API

    %% Backend Subgraph
    subgraph Backend ["Backend (AeroDash Cloud)"]
        direction TB
        API["API Layer<br>(Gateway / OIDC Auth)"]
        BLL["Service Layer<br>(Business Logic / Sync Resolution)"]
        DB[("Data Layer<br>(PostgreSQL / Blob Storage)")]

        API --- BLL
        BLL --- DB
    end

    %% Styling
    classDef frontend fill:#e0f2fe,stroke:#0284c7,stroke-width:2px,color:#0f172a;
    classDef backend fill:#dcfce7,stroke:#16a34a,stroke-width:2px,color:#0f172a;
    classDef storage fill:#fef08a,stroke:#ca8a04,stroke-width:2px,color:#0f172a;

    class Frontend frontend;
    class Backend backend;
    class LocalDB,DB storage;
```

## Architectural Layers

- **Safety Core (`core/`)**: Framework-agnostic, pure TypeScript implementation handling all calculations, physical unit normalization (kg, m, L, s), and structural Zod schema validation.
- **State & State-Management (`stores/`)**: Leverages `Pinia` (Type-safe Vue state) to maintain the ephemeral state of the active Flight Plan and the selected Aircraft Profile.
- **Data Persistence (`services/`)**: Local browser storage (`IndexedDB`) is the primary source of truth. Synchronizes bidirectionally with an OIDC-authenticated cloud backend.
- **Communication & Notification Bus**: Decoupled rules engine. Generates explicitly structured notifications (INFO, WARNING, CRITICAL) when mathematical limits are approached or API requests drop.
- **UI & Presentation (`views/`, `components/`)**: Built with Vue 3 SFCs (no JSX). `vite-plugin-pwa` registers Service Workers caching the App Shell and computation logic for true 0-byte initial rural visits.

## Directory Structure Matrix

```text
aerodash/
├── src/
│   ├── core/         # Pure TS (P1 Logic): Math engine, validators, unit normalization.
│   ├── stores/       # Pinia State Management: Ephemeral UI state (Active Aircraft/Flight).
│   ├── components/   # Vue 3 SFCs: Reusable, reactive UI elements (No business logic).
│   ├── views/        # Vue 3 Router Views: High-level page compositions.
│   └── services/     # API/Integrations: IndexedDB wrapper, Cloud Sync, Notification Bus.
└── tests/
    ├── unit/         # Vitest: Deterministic testing covering the `core/` math & boundaries.
    └── e2e/          # Playwright: End-to-end verification of Critical User Journeys.
```

## Technology Stack Summary

- **Frontend Framework**: Vue 3 (Composition API, No JSX) + Strict TypeScript
- **Tooling**: Vite, vue-tsc, Pinia, Vue Router
- **Formatting/Quality**: ESLint, Oxlint, Prettier
- **Testing**: Vitest (Unit/Logic/Core), Playwright (E2E/UI Flows)
- **Traceability/Safety**: `shtracer` (Requirements-to-Code mapping)

## Detailed Architecture

The detailed architecture (Design Details, Data Models, Schemas, etc.) and architecture decisions ADR are documented in the [docs/architecture](docs/architecture) folder.
