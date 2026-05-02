# AGENTS.md — Agent Context Entrypoint

> **For AI Agents**: This project uses a modular context system. Read ONLY the `.agent/context/` files relevant to your task — do not scan the entire codebase.

## What This Project Is

**Infinity Data Explorer** is a React SPA + companion TypeScript backend for the Infinity tabletop miniatures game. The frontend provides tools for exploring unit data, building army lists, calculating dice probabilities, comparing factions, and browsing game rules. The backend persists user-owned army lists and brokers AI agent chat.

### Data flow at a glance

| Concern | Source of truth |
|---|---|
| Game catalog (units, factions, weapons, skills, fireteams, classifieds) | Static JSON in `data/processed/` — fetched by the SPA at boot, read directly from disk by the backend agent's `GameDataLoader` and by the MCP server's `DatabaseAdapter` |
| User data (army lists, ratings, AI usage counters) | PostgreSQL via the `backend-ts/` Hono service, owned by Drizzle |
| List logic (add/remove units, fireteams, scoring, similarity) | Pure functions in `shared/` — consumed identically by the SPA, the backend agent, and the MCP server |

The backend has only three Postgres tables: `users`, `army_lists`, `ai_usage`. There is no catalog data in Postgres.

A `STATIC_MODE` build (set `VITE_DEPLOY_MODE=static`) bypasses the backend entirely and persists lists to `localStorage` — used for GitHub Pages deploys.

## Tech Stack

**Frontend (`src/`)**
- React 19 / TypeScript 5.9 / Vite 7
- Zustand (global state, localStorage persistence) + TanStack Query (server state)
- React Router 7 (routes for `/`, `/lists`, `/search`, `/compare`, `/ranges`, `/reference`)
- Tailwind CSS v4 with CSS custom property design tokens
- Framer Motion, Recharts, d3, dnd-kit, Headless UI
- openapi-fetch — typed API client generated from the backend's OpenAPI spec
- Firebase Auth (Google sign-in)

**Backend (`backend-ts/`)**
- Hono on Node + Drizzle ORM + Postgres
- `@hono/zod-openapi` — routes are Zod-schema-first; OpenAPI spec is exported and consumed by the frontend type generator
- Anthropic + Google AI SDKs for the agent
- Firebase Admin (token verification)

**Shared (`shared/`)** — pure TypeScript logic compiled by both the frontend and backend; no runtime deps.

**MCP Server (`mcp-server/`)** — Model Context Protocol server exposing game data and list-building tools to AI agents. Reads static JSON; does not talk to the backend.

**Tests** — Vitest (frontend + backend) for unit, Playwright for an E2E smoke test (the prior full E2E suite was retired with the May 2026 cleanup; see `e2e/README.md`).

## Key Commands

| Command | What it does |
|---------|-------------|
| `make setup` | Bootstrap: docker postgres + `npm ci` × 2 + drizzle migrate |
| `make dev` | Concurrent Vite frontend + Hono backend on `:8000` with `DEV_AUTH=true` |
| `make migrate` | Run pending Drizzle migrations |
| `make lint` | Lint + typecheck both halves of the stack — authoritative gate |
| `make test` | Vitest suites for frontend and backend |
| `npm run dev` | Frontend only |
| `npm run build` | Production build (`tsc -b && vite build`) |
| `npm run typecheck` | Frontend typecheck (`tsc -b`); already invoked by `make lint` |
| `npm test` | Vitest watch (frontend) |
| `npm run test:e2e` | Playwright smoke test |
| `npm run mcp` | Start MCP server (`tsx mcp-server/index.ts`) |
| `npm run generate:types` | Re-export OpenAPI from backend → regenerate `src/types/schema.d.ts` |

### Verification flow before pushing

1. `make lint` — fast (~5s). Lint + typecheck both halves. **If this passes, `npm run build` will pass.**
2. `make test` — unit suites (~2s).
3. `npm run build` — only when shipping; full production bundle.
4. `npx playwright test` — only if you've changed the SPA shell or added a new spec.

If `make lint` is green but `npm run build` is red, that's a bug in the configuration — the lint typecheck should match the build typecheck. Fix it rather than tolerate the gap.

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
├── data/               Static JSON game data (~46 files) — catalog source of truth
├── shared/             Pure logic shared between SPA, backend, and MCP server
│   ├── armyCode.ts       Army code encode/decode
│   ├── listLogic.ts      Pure list reducer (add/remove units, fireteams)
│   ├── listTypes.ts      List type + Zod schemas (wire-shared)
│   ├── dice-engine.ts    F2F probability math
│   ├── classifieds.ts    Classified objectives scoring
│   ├── BaseDatabase.ts   Catalog ingestion (subclassed by browser + Node)
│   └── ...               Factions, types, weapon utils
├── backend-ts/         Hono + Drizzle service (user lists + AI agent chat)
│   └── src/
│       ├── routes/       /api/lists, /api/agent, /api/health
│       ├── agent/        Anthropic/Gemini providers + tool executor (reads static JSON)
│       ├── db/           Drizzle schema (users, army_lists, ai_usage)
│       └── auth/         Firebase token verification + dev bypass
├── mcp-server/         MCP server (game data + list builder tools)
├── src/                Vite SPA
│   ├── components/       UI components (workspace, list builder, dice calc, etc.)
│   ├── pages/            Page-level components (one per route or workspace widget)
│   ├── stores/           Zustand global stores
│   ├── contexts/         React contexts (auth, context menu)
│   ├── hooks/            Custom hooks (useDatabase, useDiceCalculator, etc.)
│   ├── services/         API client + Database singleton (loads static JSON)
│   ├── types/            TypeScript type definitions (incl. generated schema.d.ts)
│   └── utils/            Utility functions (export, import, conversions)
├── e2e/                Playwright E2E tests
└── scripts/            Data refresh and processing scripts
```

## Workspace Widgets

The app has 9 tool widgets accessible via the workspace UI on `/`:

| Widget | Key | Description |
|--------|-----|-------------|
| List Builder | `LIST_BUILDER` | Army list construction with fireteams and drag-drop |
| Dice Calculator | `DICE_CALCULATOR` | Face-to-face probability calculator |
| Dice Analytics | `DICE_ANALYTICS` | Statistical charts |
| Classifieds | `CLASSIFIEDS` | Classified objectives browser |
| Fireteams | `FIRETEAMS` | Fireteam chart viewer |
| Weapons | `RANGES` | Weapon range band comparison |
| Compare | `COMPARE` | Faction comparison tool |
| Search | `SEARCH` | Unit search and exploration |
| Reference | `REFERENCE` | Game reference / wiki viewer |

A subset (Search, Compare, Ranges, Reference, MyLists) also have full-page routes registered in `src/App.tsx`.

## Important Patterns

- **Static JSON for catalog, Postgres for user data.** Never write a backend route that returns catalog data; if the agent or MCP server needs it, read from `data/processed/` via the existing loaders.
- **Wire-shared Zod schemas.** `ArmyList` and related types are Zod-defined in `shared/listTypes.ts` and used by both the backend route validators and the frontend client. Don't drop to `as unknown as` casts — fix the schema instead.
- **Reducer-in-Zustand.** `useListStore` delegates every mutation to the pure reducer in `shared/listLogic.ts`. New list mutations should follow this pattern (extend `ListAction`, implement in the reducer, expose a thin Zustand action).
- **Singleton windows.** Each widget type can only have one open instance in the workspace.
- **Shared module is the boundary.** Pure logic in `shared/` is consumed by `src/`, `backend-ts/`, and `mcp-server/`. Changes affect all three.
- **Generate, don't hand-edit, types.** `src/types/schema.d.ts` is produced by `npm run generate:types`. After changing a backend route schema, regenerate.
