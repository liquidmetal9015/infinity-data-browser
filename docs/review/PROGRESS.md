# Code Review Progress

## Status Legend
- `TODO` — Not yet reviewed
- `IN PROGRESS` — Currently under review
- `DONE` — Review complete

## Phase 1: Shared Core

| Unit | Module | Status | Findings | Critical | Major | Minor | Nitpick |
|------|--------|--------|----------|----------|-------|-------|---------|
| 1.1 | shared/game-model.ts | DONE | 5 | 0 | 0 | 3 | 2 |
| 1.2 | shared/types.ts | DONE | 5 | 0 | 3 | 2 | 0 |
| 1.3 | shared/listTypes.ts + listLogic.ts | DONE | 6 | 1 | 1 | 2 | 2 |
| 1.4 | shared/BaseDatabase.ts | DONE | 6 | 0 | 1 | 4 | 1 |
| 1.5 | shared/dice-engine.ts | DONE | 4 | 0 | 0 | 3 | 1 |
| 1.6 | shared/factions.ts + fireteams.ts + unit-roles.ts | DONE | 5 | 2 | 0 | 2 | 1 |
| 1.7 | shared/armyCode.ts + list-similarity.ts + list-scoring.ts + classifieds.ts | DONE | 4 | 0 | 0 | 2 | 2 |

## Phase 2: Backend

| Unit | Module | Status | Findings | Critical | Major | Minor | Nitpick |
|------|--------|--------|----------|----------|-------|-------|---------|
| 2.1 | backend-ts/src/db/schema.ts + config.ts | DONE | 2 | 0 | 1 | 0 | 1 |
| 2.2 | backend-ts/src/auth/ | DONE | 1 | 0 | 0 | 1 | 0 |
| 2.3 | backend-ts/src/routes/lists.ts | DONE | 1 | 0 | 0 | 1 | 0 |
| 2.4 | backend-ts/src/agent/ | DONE | 3 | 0 | 0 | 2 | 1 |
| 2.5 | backend-ts/src/app.ts + index.ts | DONE | 1 | 0 | 0 | 1 | 0 |

## Phase 3: MCP Server

| Unit | Module | Status | Findings | Critical | Major | Minor | Nitpick |
|------|--------|--------|----------|----------|-------|-------|---------|
| 3.1 | mcp-server/index.ts | DONE | 7 | 0 | 1 | 5 | 1 |
| 3.2 | mcp-server/DatabaseAdapter.ts + list-builder.ts + list-utils.ts | DONE | 6 | 0 | 0 | 5 | 1 |

## Phase 4: Frontend Services & State

| Unit | Module | Status | Findings | Critical | Major | Minor | Nitpick |
|------|--------|--------|----------|----------|-------|-------|---------|
| 4.1 | src/services/Database.ts | DONE | 1 | 0 | 0 | 1 | 0 |
| 4.2 | src/services/api.ts + firebase.ts | DONE | 1 | 0 | 0 | 1 | 0 |
| 4.3 | src/services/listService.ts | DONE | 1 | 0 | 0 | 1 | 0 |
| 4.4 | src/stores/useListStore.ts + useWorkspaceStore.ts | DONE | 2 | 0 | 0 | 1 | 1 |
| 4.5 | src/stores/ (remaining) | DONE | 2 | 0 | 0 | 1 | 1 |
| 4.6 | src/hooks/ | DONE | 2 | 0 | 0 | 1 | 1 |
| 4.7 | src/utils/ | DONE | 2 | 0 | 0 | 1 | 1 |

## Phase 5: Frontend Components & Pages

| Unit | Module | Status | Findings | Critical | Major | Minor | Nitpick |
|------|--------|--------|----------|----------|-------|-------|---------|
| 5.1 | src/pages/MyLists.tsx | DONE | 3 | 0 | 2 | 1 | 0 |
| 5.2 | src/components/Panels/ArmyListPanel.tsx | DONE | 2 | 0 | 0 | 2 | 0 |
| 5.3 | ListsComparePage + ListsOverviewPage | DONE | 0 | 0 | 0 | 0 | 0 |
| 5.4 | UnitRosterPanel + UnitDetailPanel | DONE | 1 | 0 | 0 | 1 | 0 |
| 5.5 | src/components/ListBuilder/ | DONE | 0 | 0 | 0 | 0 | 0 |
| 5.6 | DiceCalculator/ + DiceAnalytics/ | DONE | 0 | 0 | 0 | 0 | 0 |
| 5.7 | src/components/Workspace/ | DONE | 1 | 0 | 0 | 1 | 0 |
| 5.8 | src/components/shared/ + AIPanel/ | DONE | 0 | 0 | 0 | 0 | 0 |
| 5.9 | Remaining pages | DONE | 0 | 0 | 0 | 0 | 0 |
| 5.10 | NavBar + misc components | DONE | 0 | 0 | 0 | 0 | 0 |

## Phase 6: Infrastructure & Cross-Cutting

| Unit | Module | Status | Findings | Critical | Major | Minor | Nitpick |
|------|--------|--------|----------|----------|-------|-------|---------|
| 6.1 | Dockerfile + docker-compose.yml | DONE | 1 | 0 | 0 | 1 | 0 |
| 6.2 | terraform/ | DONE | 2 | 0 | 0 | 1 | 1 |
| 6.3 | Build config (vite, eslint, tsconfig, tailwind) | DONE | 1 | 0 | 0 | 1 | 0 |
| 6.4 | scripts/process-data.ts | DONE | 0 | 0 | 0 | 0 | 0 |
| 6.5 | .github/workflows/ | DONE | 2 | 0 | 0 | 2 | 0 |
| 6.6 | Styling architecture | DONE | 2 | 0 | 1 | 1 | 0 |
