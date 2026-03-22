# State Management

## Zustand Global Stores

Feature state is managed with **Zustand** stores using `persist` middleware for `localStorage` persistence. Stores exist outside the React tree, avoiding context provider nesting and infinite render loops.

### Stores

| Store | Path | Purpose |
|-------|------|---------|
| `useListStore` | `src/stores/useListStore.ts` | Army list state (units, fireteams, combat groups). Wraps the shared pure reducer. |
| `useDiceCalcStore` | `src/stores/useDiceCalcStore.ts` | Dice calculator inputs, selected profiles/weapons, mode |
| `useGlobalFactionStore` | `src/stores/useGlobalFactionStore.ts` | Currently selected faction ID (shared across tools) |
| `useCompareStore` | `src/stores/useCompareStore.ts` | Factions selected for comparison |
| `useRangesStore` | `src/stores/useRangesStore.ts` | Selected weapons for range graph |
| `useClassifiedsStore` | `src/stores/useClassifiedsStore.ts` | Faction selection for classifieds tool |

### Shared Logic Module (`shared/`)

Pure logic shared between the web app and MCP server lives in `shared/`. Key files:

- **`listLogic.ts`** — Pure reducer for list state (`listReducer` + `initialState`). The web app's `src/logic/ListLogic.ts` re-exports from here.
- **`listTypes.ts`** — Type definitions for list entries, combat groups, fireteam defs.
- **`armyCode.ts`** — Encode/decode army codes (compact binary format for sharing lists).
- **`dice-engine.ts`** — Face-to-face probability math.
- **`classifieds.ts`** — Classified objectives scoring logic.
- **`BaseDatabase.ts`** — Shared database base class.

When modifying shared logic, both the web app and MCP server are affected.

## Workspace State

The workspace window manager uses `useReducer` + React Context (`src/context/WorkspaceContext.tsx`), not Zustand. This manages window positions, sizes, z-index ordering, layout mode, and minimize/maximize state.

## React Contexts

| Context | Path | Purpose |
|---------|------|---------|
| `WorkspaceContext` | `src/context/WorkspaceContext.tsx` | Window management (useReducer) |
| `DatabaseContext` | `src/context/DatabaseContext.tsx` | Provides loaded Database instance |
| `ModalContext` | `src/context/ModalContext.tsx` | Modal dialog management |
| `ContextMenuContext` | `src/context/ContextMenuContext.tsx` | Right-click context menus |
