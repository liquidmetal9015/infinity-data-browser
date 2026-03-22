# AGENTS.md — Agent Context Entrypoint

> **For AI Agents**: This project uses a modular context system. Read ONLY the `.agent/context/` files relevant to your task — do not scan the entire codebase.

## What This Project Is

**Infinity Data Explorer** is a purely client-side React SPA for the Infinity tabletop miniatures game. It provides tools for exploring unit data, building army lists, calculating dice probabilities, comparing factions, and browsing game rules — all running simultaneously in a windowed workspace UI.

There is **no backend API**. All game data is loaded from static JSON files at startup.

## Tech Stack

- **React 19** / TypeScript 5.9 / Vite 7
- **Zustand** (global state with localStorage persistence)
- **Tailwind CSS v4** (utility-first with CSS custom property design tokens)
- **Framer Motion** (animations), **Recharts** / **d3** (charts)
- **dnd-kit** (drag-and-drop in list builder)
- **Headless UI** (accessible dropdown/dialog primitives)
- **Vitest** (unit tests) / **Playwright** (E2E tests)
- **MCP Server** (`mcp-server/`) — Model Context Protocol server exposing game data and list-building tools to AI agents

## Key Commands

| Command | What it does |
|---------|-------------|
| `npm run dev` | Start Vite dev server |
| `npm run build` | Type-check then production build |
| `npm test` | Run Vitest in watch mode |
| `npm test -- --run` | Run Vitest once |
| `npm run test:e2e` | Run Playwright E2E tests |
| `npm run mcp` | Start MCP server (`tsx mcp-server/index.ts`) |
| `npm run lint` | ESLint |

## Context Directory (`.agent/context/`)

Read the file relevant to your task:

- **[architecture.md](.agent/context/architecture.md)** — Workspace engine, window manager, widget registry, layout modes
- **[state-management.md](.agent/context/state-management.md)** — Zustand stores, shared logic module, workspace state
- **[data-layer.md](.agent/context/data-layer.md)** — Static JSON data structure, metadata, modifier system
- **[mcp-server.md](.agent/context/mcp-server.md)** — MCP server tools, resources, and the list-builder API
- **[testing.md](.agent/context/testing.md)** — Vitest unit tests and Playwright E2E tests
- **[styling.md](.agent/context/styling.md)** — Tailwind CSS v4, design tokens, styling conventions

## Workflows (`.agent/workflows/`)

Game-specific recurring tasks:

- **[/analyze-unit](.agent/workflows/analyze-unit.md)** — Analyze a unit's capabilities using MCP tools
- **[/build-list](.agent/workflows/build-list.md)** — Build an army list step-by-step via MCP tools
- **[/verify-rules](.agent/workflows/verify-rules.md)** — Verify game rules against the wiki before answering

## Project Layout

```
├── data/               Static JSON game data (~46 files, ~45MB)
├── shared/             Pure logic shared between web app and MCP server
│   ├── armyCode.ts       Army code encode/decode
│   ├── listLogic.ts      List reducer (add/remove units, fireteams)
│   ├── listTypes.ts      List type definitions
│   ├── dice-engine.ts    F2F probability math
│   ├── classifieds.ts    Classified objectives scoring
│   └── ...               Factions, types, weapon utils
├── mcp-server/         MCP server (game data + list builder tools)
├── src/
│   ├── components/       UI components (workspace, list builder, dice calc, etc.)
│   ├── pages/            Page-level components (one per widget)
│   ├── stores/           Zustand global stores
│   ├── context/          React contexts (workspace, database, modals)
│   ├── hooks/            Custom hooks (useDatabase, useDiceCalculator, etc.)
│   ├── logic/            Re-exports from shared/ for app imports
│   ├── services/         Database singleton (loads/indexes JSON data)
│   ├── types/            TypeScript type definitions
│   └── utils/            Utility functions
├── e2e/                Playwright E2E tests
└── scripts/            Data refresh and build scripts
```

## Workspace Widgets

The app has 9 tool widgets, each a singleton window in the workspace:

| Widget | Key | Description |
|--------|-----|-------------|
| List Builder | `LIST_BUILDER` | Army list construction with fireteams and drag-drop |
| Dice Calculator | `DICE_CALCULATOR` | Face-to-face probability calculator |
| Dice Analytics | `DICE_ANALYTICS` | Statistical charts (currently disabled in launcher) |
| Classifieds | `CLASSIFIEDS` | Classified objectives browser |
| Fireteams | `FIRETEAMS` | Fireteam chart viewer |
| Weapons | `RANGES` | Weapon range band comparison |
| Compare | `COMPARE` | Faction comparison tool |
| Search | `SEARCH` | Unit search and exploration |
| Reference | `REFERENCE` | Game reference / wiki viewer |

## Important Patterns

- **No react-router** — All navigation is handled by the workspace window manager, not URL routing.
- **Singleton windows** — Each widget type can only have one open instance.
- **Shared module** — Pure logic in `shared/` is consumed by both `src/` (web app) and `mcp-server/`. Changes to shared logic affect both.
- **Database singleton** — `src/services/Database.ts` loads all JSON at startup. MCP server has its own `DatabaseAdapter.ts`.
- **Reducer pattern for lists** — List state uses a pure reducer (`shared/listLogic.ts`) wrapped by Zustand in the web app and by the `ListBuilder` class in the MCP server.
