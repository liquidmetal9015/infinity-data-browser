# Phase 5: Frontend Components & Pages — Findings

**Overall Assessment**: Components are feature-rich and functional. The dominant pattern issue is excessive inline styles (~74 `style={{...}}` blocks in MyLists alone vs 4 `className` usages) — this creates maintenance burden and prevents responsive design. State management in large page components (MyLists: 12+ useState hooks) could benefit from extraction into custom hooks. However, the core architecture is sound: stores provide state, hooks derive data, components render. DnD integration is well-structured. Chart/visualization pages use shared analysis modules correctly.

---

## 5.1: src/pages/MyLists.tsx (1179 LoC)

### Positive Notes
- Comprehensive list management: rename, tag, rate, fork, export, compare, bulk delete
- Excellent TanStack Query usage: optimistic rating update with rollback, lazy content fetching
- Content-based filtering (find lists by weapon/skill inside them) is sophisticated
- Proper loading/empty/error states

### Findings

#### [F-068] 12+ useState hooks in a single component — state explosion
- **Category**: A1 (Single Responsibility)
- **Severity**: Major
- **Effort**: M
- **Location**: `src/pages/MyLists.tsx:38-73`
- **Issue**: The component manages: UI mode (showNewModal, showImportModal), loading indicators (loadingId, openingInArmyId, isExporting), inline editing (renamingId, renameValue, editingTagsId, tagInput, editingDescId, descValue), expansion (expandedIds), filtering/sorting (sortKey, filterSuperFaction, filterTag, minRating), selection (selectedIds), content filtering (contentFilters, unitNameQuery), and menu state (openKebabId). This violates SRP — the component is simultaneously a page layout, list manager, filter controller, export handler, and inline editor.
- **Suggestion**: Extract into focused hooks:
  - `useListFiltering(lists)` → sortKey, filters, displayedLists
  - `useInlineEditing(listService)` → rename, tags, description mutations + local state
  - `useListSelection()` → selectedIds, toggle, clear
  - `useListExport(db)` → export handlers + isExporting state

#### [F-069] 74 inline `style={{}}` blocks vs 4 className usages
- **Category**: C3 (Readability) / R1 (React Patterns)
- **Severity**: Major
- **Effort**: L
- **Location**: `src/pages/MyLists.tsx` (entire JSX section, lines 329-1161)
- **Issue**: Nearly all styling is inline objects. This creates:
  - Poor readability (style objects interleaved with logic)
  - No hover/focus/active states (inline can't express pseudo-classes)
  - No responsive design (no media queries)
  - No reuse (same padding/border/color repeated many times)
  - Bundle size (each render recreates style objects unless memoized)
  The project uses Tailwind and CSS Modules elsewhere — this file uses neither.
- **Suggestion**: Migrate to CSS Modules (consistent with ListBuilder, Workspace patterns) or Tailwind utility classes. Start with the most repeated patterns (the action buttons all share `actionBtnSm` style at line 1163 — a good candidate for a CSS class).

#### [F-070] `handleDeleteSelected` bypasses mutation pattern
- **Category**: R3 (TanStack Query Patterns)
- **Severity**: Minor
- **Effort**: XS
- **Location**: `src/pages/MyLists.tsx:286-292`
- **Issue**: Bulk delete calls `listService.deleteList(id)` directly with `Promise.all` instead of using the existing `deleteMutation`. This means no loading state tracked during bulk deletes, no error handling displayed to the user, and inconsistency with single-item delete (which uses mutation).
- **Suggestion**: Either loop through `deleteMutation.mutateAsync` or create a separate `bulkDeleteMutation`.

---

## 5.2: src/components/Panels/ArmyListPanel.tsx (790 LoC)

### Positive Notes
- Auto-save with 3.5s debounce — excellent UX pattern
- Complex dnd-kit integration for unit reordering and cross-group moves
- Fireteam validation computed on hover — responsive feedback
- Uses CSS Modules (consistent with Workspace patterns)

### Findings

#### [F-071] Auto-save effect has eslint-disable for exhaustive-deps
- **Category**: R1 (React Patterns)
- **Severity**: Minor
- **Effort**: S
- **Location**: `src/components/Panels/ArmyListPanel.tsx:121-131`
- **Issue**: `// eslint-disable-next-line react-hooks/exhaustive-deps` suppresses the warning. The deps are `[currentList?.updatedAt, isDirty, user, saveListMutation.isPending]` — deliberately omitting `saveListMutation.mutate`. The `mutate` function reference changes on each render (TanStack Query v5), so including it would trigger infinite re-renders of the timeout.
- **Suggestion**: Use `useRef` to hold the latest mutate function:
  ```typescript
  const saveFnRef = useRef(saveListMutation.mutate);
  saveFnRef.current = saveListMutation.mutate;
  // Then in effect: saveFnRef.current()
  ```
  This eliminates the eslint-disable while maintaining correct behavior.

#### [F-072] ArmyListPanel directly uses `api` client for save instead of `listService`
- **Category**: A4 (Dependency Direction)
- **Severity**: Minor
- **Effort**: S
- **Location**: `src/components/Panels/ArmyListPanel.tsx:29, 86-117`
- **Issue**: The save mutation calls `api.PUT` and `api.POST` directly rather than using `listService.updateList`/`listService.createList`. This bypasses the service abstraction — the component has a hard dependency on the API layer. In static mode (`STATIC_MODE`), this code would fail because it only handles the API path.
- **Suggestion**: Delegate to `listService.createList` and `listService.updateList` (which already handle both modes). The auto-save logic could be extracted to a `useAutoSave(currentList, isDirty)` hook that internally uses `listService`.

---

## 5.3: ListsComparePage (627 LoC) + ListsOverviewPage (536 LoC)

### Positive Notes
- Excellent use of shared analysis modules (`list-similarity`, `list-scoring`)
- Recharts integration is clean (RadarChart, BarChart, ResponsiveContainer)
- Auto-detects same-faction vs cross-faction mode with user override
- Color scheme is consistent with brand

### Findings

#### [F-073] No findings for these files
- These pages are well-structured data visualization components. They consume shared analysis functions correctly, handle loading states, and display results with appropriate chart types. No issues identified.

---

## 5.4: UnitRosterPanel (384 LoC) + UnitDetailPanel (385 LoC)

### Positive Notes
- UnitRosterPanel: grouped by unit classification, filterable, adds units to list with click
- UnitDetailPanel: comprehensive profile display with all stats, weapons, skills

### Findings

#### [F-074] `matchesStat` duplicates `checkProfileStat` from useUnitSearch
- **Category**: A3 (DRY)
- **Severity**: Minor
- **Effort**: XS
- **Location**: `src/components/Panels/UnitRosterPanel.tsx:16-46` vs `src/hooks/useUnitSearch.ts:9-56`
- **Issue**: Both implement the same stat comparison logic (switch on stat name, switch on operator). The UnitRosterPanel version handles MOV slightly differently (`Math.max` vs sum) but the core pattern is identical.
- **Suggestion**: Extract to shared utility (e.g., `shared/statFilters.ts`) with a configurable MOV interpretation.

---

## 5.5: src/components/ListBuilder/ (~800 LoC across 6 files)

### Positive Notes
- Clean component decomposition: SortableFireteamContainer, DraggableUnitRow, DragOverlayUnit, NewListModal, FireteamGroupView
- dnd-kit integration is well-encapsulated in leaf components
- Uses CSS Modules consistently

### Findings

#### [F-075] No significant findings
- The ListBuilder components are small (50-250 LoC each), focused, and well-composed. The drag-and-drop architecture is cleanly separated between container management (ArmyListPanel) and item rendering (DraggableUnitRow).

---

## 5.6: DiceCalculator/ (~600 LoC across 8 files) + DiceAnalytics

### Positive Notes
- Well-decomposed: CompactNumber, AmmoSelector, WoundsBar, WoundsTable, WeaponSelector, CalculatorUnitSelector, ComparisonSummary — each is 38-107 LoC
- Store integration is clean (useDiceCalcStore)
- Analytics page delegates to `utils/dice-analytics.ts` for data generation

### Findings

#### [F-076] No significant findings
- Clean component composition. Each sub-component is focused and small. The computation is properly lifted to the `useDiceCalculator` hook and `computeDiceResults` pure function.

---

## 5.7: src/components/Workspace/ (~700 LoC across 4 files)

### Positive Notes
- WindowFrame handles resize, drag, minimize, maximize — full window management
- WorkspaceView supports columns, multi-window, and tabbed modes
- DragDivider for column resizing uses pointer events correctly
- Mobile support with swipe gestures
- `widgetRegistry` provides clean widget→component mapping

### Findings

#### [F-077] `useIsMobile` hook is duplicated in WorkspaceView.tsx and NavBar.tsx
- **Category**: A3 (DRY)
- **Severity**: Minor
- **Effort**: XS
- **Location**: `src/components/Workspace/WorkspaceView.tsx:12-22` and `src/components/NavBar.tsx:19-29`
- **Issue**: Identical implementation in two files — same useState, same resize listener, same 768px breakpoint.
- **Suggestion**: Extract to `src/hooks/useIsMobile.ts` and import in both places.

---

## 5.8: src/components/shared/ + AIPanel/ (~800 LoC)

### Positive Notes
- UnifiedSearchBar (336 LoC): comprehensive autocomplete with category-based suggestions
- ExpandableUnitCard (320 LoC): rich unit display with collapsible details
- WeaponTooltip (186 LoC): contextual weapon stat display
- ArmyLogo (51 LoC): safe image loading with fallback
- AIPanel (128 LoC) + ChatInput (46 LoC): simple chat interface

### Findings

#### [F-078] No significant findings
- Shared components are appropriately sized and focused. The UnifiedSearchBar is the largest (336 LoC) but manages complex autocomplete state — reasonable for the feature scope.

---

## 5.9: Remaining Pages (Search, Ranges, Compare, Reference, Classifieds, Fireteams)

### Positive Notes
- All between 83-316 LoC — appropriately scoped
- SearchPage uses `useUnitSearch` hook (keeps component lean)
- RangesPage uses `useBestWeapons` for derived data
- ComparePage uses `useFactionsComparison` for Venn logic

### Findings

#### [F-079] No significant findings
- These pages are smaller and well-structured. They follow the pattern of delegating logic to hooks/stores and focusing on presentation.

---

## 5.10: NavBar + misc (316 LoC)

### Positive Notes
- Mode switching (builder/explorer) with path memory — good UX
- Responsive: different layouts for mobile vs desktop
- Widget launcher integrated into nav

### Findings

#### [F-080] `useIsMobile` duplication (covered by F-077)
- Same issue as F-077 — already tracked.

---

## Phase 5 Summary

| Unit | Findings | Critical | Major | Minor | Nitpick |
|------|----------|----------|-------|-------|---------|
| 5.1 MyLists.tsx | 3 | 0 | 2 | 1 | 0 |
| 5.2 ArmyListPanel.tsx | 2 | 0 | 0 | 2 | 0 |
| 5.3 ListsComparePage + Overview | 0 | 0 | 0 | 0 | 0 |
| 5.4 UnitRosterPanel + Detail | 1 | 0 | 0 | 1 | 0 |
| 5.5 ListBuilder/ | 0 | 0 | 0 | 0 | 0 |
| 5.6 DiceCalculator/ + Analytics | 0 | 0 | 0 | 0 | 0 |
| 5.7 Workspace/ | 1 | 0 | 0 | 1 | 0 |
| 5.8 shared/ + AIPanel/ | 0 | 0 | 0 | 0 | 0 |
| 5.9 Remaining pages | 0 | 0 | 0 | 0 | 0 |
| 5.10 NavBar + misc | 0 | 0 | 0 | 0 | 0 |
| **Total** | **7** | **0** | **2** | **5** | **0** |

### Key Observations
- **MyLists.tsx is the only component with Major issues** — inline styles and state explosion. The rest of the frontend is clean.
- Component decomposition is generally excellent — most components are 50-300 LoC
- CSS Modules are used consistently in ListBuilder and Workspace but not in pages
- DnD integration (dnd-kit) is well-architected with clean separation of concerns
- Chart/visualization pages correctly leverage shared analysis modules
- The `useIsMobile` duplication is trivial but illustrative — utility hooks should be centralized
