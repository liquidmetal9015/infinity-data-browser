# Remediation Roadmap

All findings from the 6-phase code review, prioritized using:

```
Priority Score = (Severity × 3) + (Blast Radius × 2) − (Effort × 1)
Severity:     Critical=4, Major=3, Minor=2, Nitpick=1
Blast Radius: 1-5 (how many modules affected)
Effort:       XS=1, S=2, M=3, L=4, XL=5
```

---

## Summary Statistics

| Phase | Findings | Critical | Major | Minor | Nitpick |
|-------|----------|----------|-------|-------|---------|
| 1: Shared Core | 35 | 3 | 4 | 20 | 8 |
| 2: Backend | 8 | 0 | 1 | 5 | 2 |
| 3: MCP Server | 13 | 0 | 1 | 10 | 2 |
| 4: Frontend Services & State | 11 | 0 | 0 | 7 | 4 |
| 5: Frontend Components | 7 | 0 | 2 | 5 | 0 |
| 6: Infrastructure | 8 | 0 | 1 | 6 | 1 |
| 7: Test Coverage | — | — | — | — | — |
| **Total** | **82** | **3** | **9** | **53** | **17** |

### Test Coverage Summary (Phase 7)

| Metric | Value |
|--------|-------|
| Test files | 18 |
| Test cases | 163 (all passing) |
| Estimated coverage | 25-30% |
| Modules with 0 tests | 15 significant |
| Regression tests for confirmed bugs | 0 of 4 |
| Tests in CI | No |

---

## P1: Do Now (Score 11+)

These are high-severity issues with easy fixes — maximum impact for minimum effort.

### 1. Fix UnitType magic numbers in unit-roles.ts
- **Findings**: F-027, F-028
- **Score**: Critical(12) + BR(3) − XS(1) = **17**
- **Files**: `shared/unit-roles.ts`
- **Fix**: Import `UnitType` from `game-model.ts`. Replace `=== 7` with `=== UnitType.TAG` (should be 4), `=== 6` with `=== UnitType.REM` (should be 5). Currently TAG and WB classifications are inverted.
- **Risk**: Affects unit classification in MCP tools and any frontend display using `classifyUnit`.

### 2. Fix REMOVE_COMBAT_GROUP mutation bug
- **Findings**: F-012
- **Score**: Critical(12) + BR(2) − XS(1) = **15**
- **Files**: `shared/listLogic.ts`
- **Fix**: In the `REMOVE_COMBAT_GROUP` action, units from the removed group are redistributed to remaining groups via `push()` on shared array references. This mutates the original group's units array. Clone before pushing: `return { ...group, units: [...group.units, ...orphans] }`.

### 3. Fix search_units OR operator logic bug
- **Findings**: F-044
- **Score**: Major(9) + BR(1) − XS(1) = **10** → bumped to P1 as it's an XS fix
- **Files**: `mcp-server/index.ts:155-163`
- **Fix**: The `else` (OR) branch does the same intersection as AND. Change to union the item matches with existing results.

### 4. Fix tags schema default `[""]` → `[]`
- **Findings**: F-036
- **Score**: Major(9) + BR(2) − XS(1) = **12**
- **Files**: `backend-ts/src/db/schema.ts:27`
- **Fix**: Change `.default([""])` to `.default([])`. Check if existing DB rows need a migration to clean up phantom empty strings.

### 5. Fix global CSS specificity overriding Tailwind
- **Findings**: F-089 (root cause of F-069)
- **Score**: Major(9) + BR(5) − M(3) = **14**
- **Files**: `src/index.css`, `tailwind.config.js`
- **Fix**: Audit `index.css` for overly-specific selectors that override utility classes. Options: CSS layers (`@layer`), scoped selectors, or `important: true` in Tailwind config. This is the root cause of the inline style explosion across all pages.

---

## P2: Plan Next (Score 7–10)

Architectural improvements that should be scheduled soon.

### 6. Consolidate parallel type hierarchies (types.ts → game-model.ts)
- **Findings**: F-006, F-007, F-008, XC-007
- **Score**: Major(9) + BR(5) − L(4) = **14** (deprioritized due to effort)
- **Files**: `shared/types.ts`, `shared/game-model.ts`, `shared/BaseDatabase.ts`
- **Action**: Remove `Fireteam`/`FireteamComposition` duplication. Standardize on `game-model.ts` types. Eliminate `as unknown as Fireteam[]` casts. This touches many consumers so plan a focused session.

### 7. Reduce ListUnit serialization bloat
- **Findings**: F-011
- **Score**: Critical(12) + BR(4) − L(4) = **16** (deprioritized due to blast radius)
- **Files**: `shared/listTypes.ts`, `src/stores/useListStore.ts`, `src/services/listService.ts`, `src/utils/listExport.ts`
- **Action**: Store only IDs in `ListUnit` instead of the full `Unit` object. Resolve units from the database at render time. This is a large refactor affecting serialization (localStorage, API) and all code that accesses `lu.unit.*`.

### 8. Extract MyLists.tsx state into hooks
- **Findings**: F-068
- **Score**: Major(9) + BR(1) − M(3) = **7**
- **Files**: `src/pages/MyLists.tsx`
- **Action**: Extract `useListFiltering`, `useInlineEditing`, `useListSelection` hooks. Reduces the 12+ useState declarations to 3-4 hook calls.

### 9. Migrate MyLists.tsx from inline styles to CSS Modules
- **Findings**: F-069
- **Score**: Major(9) + BR(1) − L(4) = **6** → bumped to P2 as prerequisite is P1 item 5
- **Files**: `src/pages/MyLists.tsx`
- **Action**: After fixing the index.css specificity issue (P1 #5), convert inline styles to CSS Module classes. The 74 style blocks can likely collapse to ~15-20 CSS classes.

### 10. Add tests to CI pipeline
- **Findings**: F-088
- **Score**: Minor(6) + BR(5) − S(2) = **12** → P2 due to safety impact
- **Files**: `.github/workflows/production.yml`, `.github/workflows/pages.yml`
- **Action**: Add `npm test -- --run` step after lint. Prevents regressions from shipping.

### 11. Encapsulate public mutable state (BaseDatabase + DatabaseAdapter)
- **Findings**: F-017, F-055, XC-009
- **Score**: Minor(6) + BR(4) − M(3) = **9**
- **Files**: `shared/BaseDatabase.ts`, `mcp-server/DatabaseAdapter.ts`
- **Action**: Make all Map/array properties `private` with `public get` accessors. After init, state should be read-only from consumers' perspective.

---

## P3: Batch Later (Score 4–6)

Good improvements to batch in a tech-debt sprint.

### 12. Extract auth header helper (DRY)
- **Findings**: F-058, F-063
- **Files**: `src/services/api.ts`, `src/stores/useAIPanelStore.ts`
- **Action**: Extract `getAuthHeaders()` and `BASE_URL` to shared utility.

### 13. Extract `useIsMobile` hook
- **Findings**: F-077
- **Files**: `src/components/Workspace/WorkspaceView.tsx`, `src/components/NavBar.tsx`
- **Action**: Move to `src/hooks/useIsMobile.ts`.

### 14. Extract stat comparison to shared utility
- **Findings**: F-064, F-074
- **Files**: `src/hooks/useUnitSearch.ts`, `src/components/Panels/UnitRosterPanel.tsx`, `mcp-server/index.ts`
- **Action**: Create `shared/statFilters.ts` with `checkProfileStat()`.

### 15. Fix ArmyListPanel service abstraction bypass
- **Findings**: F-072
- **Files**: `src/components/Panels/ArmyListPanel.tsx`
- **Action**: Use `listService` instead of raw `api` client for save operations.

### 16. Remove dead code in skill-summaries.ts
- **Findings**: F-052
- **Files**: `mcp-server/skill-summaries.ts`
- **Action**: Remove `loadSkillSummariesFromWiki`, `extractEffectsFromWiki`, `skillSummariesCache`.

### 17. Fix skill summary matching order
- **Findings**: F-053
- **Files**: `mcp-server/skill-summaries.ts`
- **Action**: Prioritize exact matches before substring matches in `getSkillSummary()`.

### 18. Remove legacy `cyber` theme from Tailwind config
- **Findings**: F-085
- **Files**: `tailwind.config.js`
- **Action**: Check if any component uses `cyber-*` classes. If not, remove.

### 19. Extract metadata Maps helper (MCP DRY)
- **Findings**: F-047
- **Files**: `mcp-server/index.ts`
- **Action**: Create `getMetadataMaps()` helper, use in `classify_units`, `analyze_classifieds`, `analyze_matchup`.

### 20. Convert MCP dynamic imports to static
- **Findings**: F-046
- **Files**: `mcp-server/index.ts`
- **Action**: Move `armyCode.js`, `list-utils.js`, `dice-engine.js` to top-level imports.

### 21. Add `.dockerignore`
- **Findings**: F-081
- **Files**: `.dockerignore` (new file)
- **Action**: Create file excluding `node_modules`, `.git`, `data/`, `ai-tmp/`, `coverage/`.

### 22. Use typed setter for DiceCalcStore
- **Findings**: F-062
- **Files**: `src/stores/useDiceCalcStore.ts`
- **Action**: Change `updateActive(field: string, val: unknown)` to generic typed setter.

### 23. Update clearData.ts STORE_KEYS
- **Findings**: F-061
- **Files**: `src/utils/clearData.ts`
- **Action**: Add missing keys or remove list since `clear()` already handles all.

---

## P4: Backlog (Score 1–3)

Nice-to-have, no urgency. Address opportunistically.

| # | Finding | Action |
|---|---------|--------|
| 24 | F-037 | Remove asyncpg URL replacement in config.ts (verify not needed) |
| 25 | F-049 | Renumber tool comments in index.ts |
| 26 | F-054 | Remove or refactor `run_analysis.ts` |
| 27 | F-056 | Remove unused `_profileId` param in ListBuilder |
| 28 | F-060 | (No action) Document why workspace uses manual persistence |
| 29 | F-066 | Add comment about VH vs TURRET naming |
| 30 | F-083 | Change Terraform DATABASE_URL to standard `postgresql://` |
| 31 | F-087 | Consider removing Python lint step (or add comment) |

---

## Cross-Cutting Patterns for Long-Term Attention

These emerged across multiple phases and represent structural debt:

| XC | Pattern | Status |
|----|---------|--------|
| XC-001 | Error Handling Consistency | Tracked — no single fix; address per-module |
| XC-002 | Singleton Pattern Usage | Acceptable per proposed standard |
| XC-003 | Data Initialization Patterns | BaseDatabase `initPromise` is the standard |
| XC-004 | ID Type Consistency | Numeric backend ↔ string frontend — document as intentional |
| XC-005 | Import Path Conventions | Stabilized: shared uses `.js`, frontend uses `@shared/` |
| XC-007 | Parallel Type Hierarchies | Covered by P2 #6 |
| XC-008 | Type Escape Hatches | Covered by P2 #6 (eliminating casts) |
| XC-009 | Public Mutable State | Covered by P2 #11 |

---

## Recommended Execution Order

**Sprint 1 (Quick Wins + Regression Tests)**: P1 items 1-4 (fix real bugs) + write regression tests for each fix
- Fix UnitType magic numbers → add `unit-roles.test.ts` (10+ tests)
- Fix REMOVE_COMBAT_GROUP mutation → add isolation test in `listLogic.test.ts`
- Fix search_units OR logic → add `mcp-server/search.test.ts`
- Fix tags schema default → add `schema.test.ts`

**Sprint 2 (Styling Foundation)**: P1 #5 + P2 #9 (fix CSS specificity, then migrate styles)

**Sprint 3 (Critical Test Gaps)**: Dice engine + army code coverage
- Expand `dice-engine.test.ts` to 15+ known-answer tests per ammo type
- Expand `armyCode.test.ts` with 10+ round-trip tests using real army codes
- Add `useDiceCalculator.test.ts` for `computeDiceResults`

**Sprint 4 (Architecture)**: P2 #6 + #7 (type consolidation + ListUnit refactor)

**Sprint 5 (CI + Data Layer Tests)**: P2 #10 + data layer coverage
- Add `npm test -- --run` to CI workflows
- Add `BaseDatabase.test.ts` (init, concurrent init, partial failure)
- Add `list-scoring.test.ts` (score breakdown for known lists)
- Add `mcp-server/list-builder.test.ts` (full session workflow)

**Sprint 6 (DRY cleanup)**: P3 items 12-23 (batch small fixes)

---

*Review completed 2026-05-02. 82 findings across 6 phases + test coverage analysis. 163 tests passing, ~25-30% estimated coverage.*
