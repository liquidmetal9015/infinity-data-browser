# Phase 4: Frontend Services & State — Findings

**Overall Assessment**: This layer is remarkably clean and well-organized. The `Database.ts` file, originally estimated at 4013 LoC, turned out to be only 98 LoC (the bulk lives in `BaseDatabase` already reviewed in Phase 1). Services use a clean interface/implementation split with strategy pattern for local vs API backends. Stores are well-granulated, mostly small (~20-50 LoC), and follow consistent Zustand patterns. Hooks compose cleanly on top of stores. Few issues found.

---

## 4.1: src/services/Database.ts (98 LoC)

### Positive Notes
- Clean extension of `BaseDatabase` with browser-specific `fetch()` loading
- `IDatabase` interface enables dependency injection (consumers depend on interface, not implementation)
- Platform-specific loading is minimal — just `fetch` instead of `fs.readFile`
- Backward-compat export (`export const Database = DatabaseImplementation`) is pragmatic

### Findings

#### [F-057] IDatabase interface includes concrete `factionMap` property
- **Category**: B2 (Interface Segregation)
- **Severity**: Minor
- **Effort**: S
- **Location**: `src/services/Database.ts:23-26`
- **Issue**: `IDatabase` mixes abstract methods (`getFactionName`, `getSuggestions`) with concrete public Map properties (`factionMap`, `weaponMap`, `skillMap`, `equipmentMap`). Consumers that only need faction names shouldn't depend on the internal Maps. However, this is pragmatic for the current usage — the Maps are read-only after init and provide efficient lookup.
- **Suggestion**: Low priority. If IDatabase is ever extracted for testing, consider splitting into a lookup interface and a data-access interface.

---

## 4.2: src/services/api.ts (25 LoC) + firebase.ts (47 LoC)

### Positive Notes
- `api.ts` uses `openapi-fetch` with generated types — full type safety at the API boundary
- Auth token injection via middleware is clean and automatic
- `firebase.ts` gracefully handles static-mode by skipping initialization entirely
- Dev auth bypass is simple and clear

### Findings

#### [F-058] Auth header logic duplicated between api.ts and useAIPanelStore.ts
- **Category**: A3 (DRY)
- **Severity**: Minor
- **Effort**: XS
- **Location**: `src/services/api.ts:11-22` and `src/stores/useAIPanelStore.ts:34-44`
- **Issue**: Both files implement the same auth header logic: check `VITE_DEV_AUTH`, else get Firebase token. The AI panel store uses raw `fetch()` instead of the `openapi-fetch` client, so it needs its own header logic. If the auth mechanism changes, both must be updated.
- **Suggestion**: Extract `getAuthHeaders()` into a shared utility (e.g., `src/services/authHeaders.ts`) and import in both places.

---

## 4.3: src/services/listService.ts (231 LoC)

### Positive Notes
- Excellent strategy pattern: `IListService` interface with `localStorageListService` and `apiListService` implementations
- Clean mode switch at the bottom (`STATIC_MODE ? local : api`)
- `forkListLocally` extracted as a reusable pure function
- Boundary cast (`units_json as unknown as ArmyList`) is well-documented with rationale
- API implementation uses generated types from OpenAPI schema

### Findings

#### [F-059] `localStorageListService.createList` does upsert silently
- **Category**: C3 (Readability / Unexpected Behavior)
- **Severity**: Minor
- **Effort**: XS
- **Location**: `src/services/listService.ts:91-101`
- **Issue**: `createList` checks for existing ID and overwrites if found (upsert behavior). This is arguably `updateList` behavior. The caller might not expect `createList` to overwrite existing data. The API implementation (POST /api/lists) creates a new row (no upsert). The two implementations have subtly different semantics for the same interface method.
- **Suggestion**: Add a brief comment explaining the upsert is intentional for localStorage (where ID conflicts from imports are possible). Alternatively, always generate a new ID in create.

---

## 4.4: src/stores/useListStore.ts (163 LoC) + useWorkspaceStore.ts (442 LoC)

### Positive Notes
- **useListStore**: Delegates all logic to the shared `listReducer` — zero domain logic in the store itself. Clean dispatch helper. Persist with partialize (only saves currentList + lastSavedAt).
- **useWorkspaceStore**: Full reducer pattern extracted as pure `workspaceReducer` function — testable independently. Comprehensive window management (cascade, snap, columns, tabs). Manual localStorage persistence with explicit save/load.

### Findings

#### [F-060] useWorkspaceStore uses manual persistence instead of Zustand's `persist` middleware
- **Category**: A3 (Inconsistency)
- **Severity**: Nitpick
- **Effort**: M
- **Location**: `src/stores/useWorkspaceStore.ts:345-441`
- **Issue**: All other persisted stores use Zustand's `persist` middleware. `useWorkspaceStore` implements its own `saveToStorage`/`loadFromStorage` + `.subscribe()`. This works identically but is a pattern inconsistency. The manual approach does give more control over serialization shape.
- **Suggestion**: Not worth changing — the manual approach handles the complex state shape more explicitly. Just noting the inconsistency.

#### [F-061] `clearData.ts` STORE_KEYS list is incomplete
- **Category**: C1 (Correctness)
- **Severity**: Minor
- **Effort**: XS
- **Location**: `src/utils/clearData.ts:4-11`
- **Issue**: `STORE_KEYS` lists 6 keys but the app uses more: `infinity-app-mode`, `infinity-global-faction`, `infinity-workspace-state` (workspace store), `infinity-list-library` (localStorage list service). Since `clearAllPersistedState()` calls `localStorage.clear()` anyway, the `STORE_KEYS` array is only used by `getPersistedDataSummary()` — which will undercount storage usage.
- **Suggestion**: Either keep the list comprehensive (for the summary function) or remove it entirely since `clear()` handles the nuclear option.

---

## 4.5: Remaining Stores (8 stores)

### Positive Notes
- **useDiceCalcStore**: Clean persist with `partialize` (excludes ephemeral selections). Swap function is nice UX.
- **useAIPanelStore**: Good error handling (429 rate limit, network errors). Rolls back optimistic message on failure.
- **useListBuilderUIStore**: Ephemeral UI state (no persist needed). Clean selection management.
- **useCompareStore, useClassifiedsStore, useRangesStore**: Tiny, focused, single-purpose. Each persists only what's needed.
- **useAppModeStore**: Remembers last path per mode — thoughtful UX detail.
- **useContextMenuStore**: Zero persistence, pure UI state. Appropriate.
- **useDatabaseStore**: Thin wrapper connecting singleton to React lifecycle.
- **useGlobalFactionStore**: Single persisted value. Maximally simple.

### Findings

#### [F-062] useDiceCalcStore `updateActive`/`updateReactive` uses `string` key + `unknown` value
- **Category**: C1 (Type Safety)
- **Severity**: Minor
- **Effort**: S
- **Location**: `src/stores/useDiceCalcStore.ts:40-41`
- **Issue**: `updateActive(field: string, val: unknown)` — callers can pass any string for `field` and any value. No type checking that `field` is a valid key of `DiceCalcParams` or that `val` matches the expected type. This is a convenient API but loses type safety at the call site.
- **Suggestion**: Use a typed setter pattern:
  ```typescript
  updateActive: <K extends keyof DiceCalcParams>(field: K, val: DiceCalcParams[K]) => void;
  ```

#### [F-063] useAIPanelStore duplicates BASE_URL derivation from api.ts
- **Category**: A3 (DRY)
- **Severity**: Nitpick
- **Effort**: XS
- **Location**: `src/stores/useAIPanelStore.ts:31-32` (identical to `src/services/api.ts:5-6`)
- **Issue**: `const BASE_URL = import.meta.env.VITE_API_URL || (typeof window !== 'undefined' ? window.location.origin : 'http://localhost')` — duplicated verbatim.
- **Suggestion**: Extract to a shared constant in the services layer.

---

## 4.6: src/hooks/ (10 hooks)

### Positive Notes
- **useUnitSearch**: Comprehensive filtering logic (items, stats, text query, faction). Correct handling of AND/OR operators across mixed filter types. Unicode normalization for text search.
- **useDiceCalculator**: Dual-signature pattern (self-contained or external state) is clever and well-documented. Pure `computeDiceResults` exported for non-React usage.
- **useFactionsComparison**: Efficient set-based Venn diagram computation. Clean grouping of shared units.
- **useClassifiedMatches**: Correctly cross-references all profile×option combinations.
- **useBestWeapons**: Simple derived computation, correctly memoized.
- **useFactionMapping**: Shared logic between multiple pages — good extraction.
- **useDatabase**: One-liner convenience hook. Perfect.

### Findings

#### [F-064] useUnitSearch stat checking duplicates MCP server logic
- **Category**: A3 (DRY)
- **Severity**: Nitpick
- **Effort**: M
- **Location**: `src/hooks/useUnitSearch.ts:9-56` vs `mcp-server/index.ts:166-200`
- **Issue**: The stat comparison switch statement (`CC`, `BS`, `PH`, etc.) is implemented identically in both the frontend hook and the MCP server's `search_units` tool. Both have the same switch/case structure with identical operators.
- **Suggestion**: Extract to shared as a `checkProfileStat(profile, stat, operator, value)` function. Low priority since both are stable and small.

#### [F-065] useDiceCalculator has conditional hook violation risk
- **Category**: R1 (React Patterns)
- **Severity**: Minor
- **Effort**: S
- **Location**: `src/hooks/useDiceCalculator.ts:195-229`
- **Issue**: The hook calls `useState` unconditionally (correct) but returns early at line 215 in "external mode", meaning the internal useState values are allocated but unused when external params are provided. This isn't a hooks-rule violation (hooks are still called unconditionally), but it's wasteful — React allocates state slots that are never read.
- **Suggestion**: Consider splitting into two hooks: `useStandaloneDiceCalculator()` and `computeDiceResults()` (already exported). The overloaded signature adds complexity for marginal ergonomic benefit.

---

## 4.7: src/utils/ (14 files)

### Positive Notes
- **dice-calculator/engine.ts**: Pure re-export barrel from shared. Clean.
- **listExport.ts**: Comprehensive markdown export with tables. Well-formatted.
- **listImport.ts**: Clean import with proper unit resolution. `parseArmyCodes` handles multi-format input.
- **orderUtils.ts**: Domain mapping extracted cleanly. Correct default-to-regular behavior.
- **clearData.ts**: Nuclear clear option that handles localStorage + sessionStorage + IndexedDB.
- **classifications.ts**: Good reference map for unit type IDs with correct VH=8 (not TURRET).
- **assets.ts**: Safe URL mapping for faction/unit logos.
- **conversions.ts**: Single-purpose format function. Minimal.
- **armyCode.ts**: Browser-specific clipboard utility with graceful fallback.

### Findings

#### [F-066] `classifications.ts` uses `VH` (Vehicle?) label for unitType 8
- **Category**: C3 (Naming)
- **Severity**: Nitpick
- **Effort**: XS
- **Location**: `src/utils/classifications.ts:5`
- **Issue**: `shared/game-model.ts` defines unitType 8 as `TURRET`, but `classifications.ts` labels it as `VH` (Vehicle/Heavy?). This might be correct for display purposes (game terminology) vs code terminology, but the mismatch could confuse developers.
- **Suggestion**: Add a comment noting the game terminology vs code constant mismatch.

#### [F-067] `listExport.ts` accesses `lu.unit.raw.profileGroups` (full Unit reference in ListUnit)
- **Category**: C1 (Design Debt)
- **Severity**: Minor (tracked as part of F-011)
- **Effort**: L (blocked by F-011)
- **Location**: `src/utils/listExport.ts:56-57`
- **Issue**: This confirms the serialization concern from F-011 — export code traverses `lu.unit.raw.profileGroups` to find option names. This only works because `ListUnit` stores the full `Unit` object. If F-011 is fixed (ListUnit stores only IDs), this code would need to accept a database reference for resolution.
- **Suggestion**: No immediate action. This is a downstream consequence of F-011 — track together.

---

## Phase 4 Summary

| Unit | Findings | Critical | Major | Minor | Nitpick |
|------|----------|----------|-------|-------|---------|
| 4.1 Database.ts | 1 | 0 | 0 | 1 | 0 |
| 4.2 api.ts + firebase.ts | 1 | 0 | 0 | 1 | 0 |
| 4.3 listService.ts | 1 | 0 | 0 | 1 | 0 |
| 4.4 useListStore + useWorkspaceStore | 2 | 0 | 0 | 1 | 1 |
| 4.5 Remaining stores | 2 | 0 | 0 | 1 | 1 |
| 4.6 Hooks | 2 | 0 | 0 | 1 | 1 |
| 4.7 Utils | 2 | 0 | 0 | 1 | 1 |
| **Total** | **11** | **0** | **0** | **7** | **4** |

### Key Observations
- **No Critical or Major findings** — this layer is exceptionally well-structured
- The strategy pattern in `listService.ts` (local vs API) is a standout design choice
- Store granularity is appropriate — each store has a single, clear purpose
- Zustand usage is correct throughout (no anti-patterns like subscribing inside render)
- The `listReducer` delegation pattern (store → shared pure function) is excellent for testability
- Minor DRY violations (auth headers, BASE_URL, stat checking) are the primary theme
- The `workspaceReducer` being pure and exported separately is best-practice Zustand
