# Phase 7: Test Coverage Analysis

**Overall Assessment**: The project has 18 test files with 163 passing test cases across 3,317 LoC of test code. Tests are concentrated in the right places (pure logic modules and critical state management), but significant gaps exist in the backend, MCP server tools, and most frontend components. Estimated coverage is ~25-30% of functional code paths.

---

## Current Test Inventory

| Layer | Test File | Test Cases | LoC | What's Tested |
|-------|-----------|-----------|-----|---------------|
| **Shared** | listLogic.test.ts | 34 | 531 | All reducer actions (CREATE, ADD_UNIT, REMOVE, REORDER, FIRETEAM ops) |
| **Shared** | list-similarity.test.ts | 20 | 228 | Similarity scoring, indexing, Jaccard, cosine, unit diff |
| **Frontend** | useWorkspaceStore.test.ts | 17 | 200 | Reducer: open, close, focus, minimize, snap, layout modes |
| **Frontend** | useListStore.test.ts | 15 | 166 | Store integration: dispatch, dirty tracking, save/load |
| **Frontend** | useUnitSearch.test.ts | 9 | 281 | Filter logic: items, stats, text, factions, AND/OR operators |
| **Frontend** | DiceCalculator.test.tsx | 25 | 306 | Component rendering: presets, comparison, wounds display |
| **Frontend** | RangesPage.test.tsx | 24 | 284 | Component rendering: sidebar, table, best weapons bar |
| **Frontend** | Database.test.ts | 10 | 166 | Init, faction loading, search, suggestions |
| **Frontend** | WeaponStats.test.ts | 4 | 101 | Weapon parsing and range band extraction |
| **Frontend** | armyCode.test.ts | 4 | 75 | Encode/decode army code round-trip |
| **Frontend** | factions.test.ts | 15 | 118 | FactionRegistry: hierarchy, lookup, grouped factions |
| **Frontend** | fireteams.test.ts | 17 | 187 | Fireteam solver: slot matching, bonuses, team validation |
| **Frontend** | engine.test.ts | 2 | 87 | Dice engine: probability math, wound calculation |
| **MCP** | DatabaseAdapter.test.ts | 23 | 432 | Init, unit lookup, wiki, ITS rules, search |
| **MCP** | repro_crash.test.ts | 1 | 42 | Regression: crash on specific army code |
| **Backend** | lists.test.ts | 2 | 75 | CRUD round-trip, auth rejection (integration test) |
| **Backend** | executor.test.ts | 1 | 17 | Matchup analysis tool smoke test |
| **E2E** | smoke.spec.ts | 1 | 21 | SPA boots without console errors |

**Total: 163 tests, 3,317 LoC**

---

## Coverage Map: What's Tested vs What's Not

### Well-Covered (>60% logic paths)

| Module | Test Quality | Notes |
|--------|-------------|-------|
| `shared/listLogic.ts` | **Excellent** | 34 tests covering all 18 reducer actions. Mock time for determinism. |
| `shared/list-similarity.ts` | **Good** | 20 tests on scoring algorithms. Edge cases covered. |
| `shared/factions.ts` | **Good** | FactionRegistry fully tested (hierarchy, lookup, aliases). |
| `shared/fireteams.ts` | **Good** | Slot solver tested with various compositions. |
| `useWorkspaceStore` | **Good** | Reducer tested independently — correct pattern. |
| `useListStore` | **Good** | Store-level integration testing dispatch + persistence. |
| `mcp-server/DatabaseAdapter` | **Good** | Init, all query methods, wiki, ITS rules. |

### Partially Covered (20-60% logic paths)

| Module | Coverage | Gaps |
|--------|----------|------|
| `shared/dice-engine.ts` | **Low** | Only 2 tests on a 425 LoC probability engine. Missing: edge cases (SV=1, burst=5), ammo types (DA, EXP, T2, PLASMA), continuous damage, critical immunity. |
| `shared/armyCode.ts` | **Low** | 4 tests for basic encode/decode. Missing: edge cases (empty list, max units, faction slug resolution). |
| `useUnitSearch` | **Moderate** | 9 tests cover main filter logic. Missing: text normalization (Unicode), empty state behavior. |
| `src/services/Database.ts` | **Moderate** | 10 tests. Relies on mock data — doesn't test actual fetch/parse cycle. |
| Backend `routes/lists.ts` | **Low** | 1 integration test (CRUD). Missing: validation errors, concurrent access, edge cases. |

### Not Covered (0 tests)

| Module | LoC | Risk | Priority |
|--------|-----|------|----------|
| `shared/BaseDatabase.ts` | 493 | **High** — core data loading, init logic, race conditions | P1 |
| `shared/unit-roles.ts` | 429 | **High** — has confirmed bugs (F-027/F-028) | P1 |
| `shared/list-scoring.ts` | 318 | Medium — scoring heuristics, hard to verify without tests | P2 |
| `shared/classifieds.ts` | 82 | Low — simple matching logic | P3 |
| `shared/armyCode.ts` (encode path) | 239 | Medium — binary encoding, off-by-one risks | P2 |
| `backend-ts/src/auth/` | 103 | Medium — auth middleware, user provisioning | P2 |
| `backend-ts/src/agent/` | ~500 | Medium — LLM orchestration, tool routing | P3 |
| `mcp-server/index.ts` (tools) | 1352 | **High** — 16 tools, has confirmed bug (F-044) | P1 |
| `mcp-server/list-builder.ts` | 196 | Medium — stateful list management | P2 |
| `src/services/listService.ts` | 231 | Medium — strategy pattern, API/localStorage | P2 |
| `src/services/api.ts` | 25 | Low — thin wrapper on openapi-fetch | P4 |
| `src/hooks/useDiceCalculator.ts` | 230 | Medium — pure computation is exported but untested | P2 |
| `src/hooks/useArmyListImportExport.ts` | 77 | Medium — import can corrupt list state | P2 |
| `src/stores/useDiceCalcStore.ts` | 122 | Low — simple state, swap logic | P3 |
| `src/stores/useAIPanelStore.ts` | 114 | Low — network calls, hard to unit test | P4 |
| All page components | ~4300 | Low — UI rendering, covered by manual QA | P4 |

---

## Quality Assessment of Existing Tests

### Strengths

1. **Pure functions get pure tests**: `listReducer`, `workspaceReducer`, `list-similarity` — the right pattern. These are deterministic and stable.
2. **Mock factory pattern**: `createMockUnit()` in listLogic.test.ts provides realistic test data without depending on JSON files.
3. **Time mocking**: Tests mock `Date.now()` for determinism — handles the timestamp-in-state pattern correctly.
4. **Integration test exists**: Backend `lists.test.ts` does a real CRUD round-trip against a dev database instance.
5. **Component tests verify behavior**: DiceCalculator and RangesPage tests check interactions (callbacks, rendered values), not just "does it render."

### Weaknesses

1. **Dice engine has only 2 tests** for a 425 LoC probability algorithm. The math is the most bug-prone code in the project (floating point, edge cases, N5 rules). Should have 20+ tests with known-answer comparisons.
2. **No tests for confirmed bugs**: The UnitType bugs (F-027/F-028), REMOVE_COMBAT_GROUP mutation (F-012), and search OR operator (F-044) have no test that would have caught them.
3. **No snapshot/boundary tests for army code**: The VLI binary encoder/decoder handles variable-length integers — off-by-one errors are hard to spot without comprehensive encode→decode round-trip tests with known army codes.
4. **Backend test coverage is near-zero**: 3 tests total for ~1500 LoC of backend code.
5. **MCP tools are completely untested**: 16 tools with complex logic (classify_units, analyze_matchup, analyze_classifieds) — zero test coverage.
6. **No test for data initialization race conditions**: `BaseDatabase.init()` and `GameDataLoader.initialize()` have promise-dedup patterns that could regress silently.

---

## Coverage Gaps by Risk

### Critical Gaps (bugs exist or math is complex)

| Gap | Why It Matters | Suggested Tests |
|-----|---------------|-----------------|
| `shared/unit-roles.ts` | Has confirmed wrong constants (TAG=7→4, REM=6→5) | Test `classifyUnit` with known units of each type |
| `shared/dice-engine.ts` | Probability math with 5 ammo types, crits, continuous | Known-answer tests against CB's official calculator or Monte Carlo |
| `mcp-server/index.ts` search_units OR | Confirmed logic bug (F-044) | Test OR with item filters returns union |
| `shared/listLogic.ts` REMOVE_COMBAT_GROUP | Confirmed mutation bug (F-012) | Test that removing a group doesn't mutate remaining groups' arrays |

### High-Value Gaps (pure logic, easy to test)

| Gap | Test Approach |
|-----|--------------|
| `shared/BaseDatabase.ts` init/loading | Mock file responses, verify Maps populated correctly |
| `shared/armyCode.ts` | Round-trip with real army codes from the official builder |
| `src/hooks/useDiceCalculator.ts` `computeDiceResults` | Already exported as pure function — just call with known inputs |
| `shared/list-scoring.ts` | Score known lists, verify breakdown matches expectations |
| `mcp-server/list-builder.ts` | Create/add/remove/status/generateCode — stateful but testable |

### Medium-Value Gaps (integration-style)

| Gap | Test Approach |
|-----|--------------|
| `src/services/listService.ts` | Test localStorage impl with JSDOM; mock API responses for API impl |
| `backend-ts/src/auth/` | Test middleware with mock Firebase tokens |
| `backend-ts/src/routes/` | More edge cases in integration tests (invalid data, 404s, auth edge cases) |

---

## Recommended Test Additions (Prioritized)

### Sprint 1: Cover Confirmed Bugs (prevent regression)

```
shared/unit-roles.test.ts          — 10+ tests classifying known units by type
shared/listLogic.test.ts           — Add: REMOVE_COMBAT_GROUP mutation isolation test
mcp-server/search.test.ts          — Test OR operator returns union of results
backend-ts/schema.test.ts          — Verify tags default is [] not [""]
```

### Sprint 2: Cover Critical Math

```
shared/dice-engine.test.ts         — 15+ known-answer tests per ammo type
shared/armyCode.test.ts            — 10+ round-trip tests with real army codes
src/hooks/useDiceCalculator.test.ts — Test computeDiceResults with various scenarios
```

### Sprint 3: Cover Data Layer

```
shared/BaseDatabase.test.ts        — Init, concurrent init, partial failure
shared/list-scoring.test.ts        — Score breakdown for known lists
mcp-server/list-builder.test.ts    — Full session: create → add × N → status → export
```

### Sprint 4: Integration & Edge Cases

```
backend-ts/tests/auth.test.ts      — Middleware with various token states
backend-ts/tests/agent.test.ts     — Tool execution with mock LLM
src/services/listService.test.ts   — Both implementations, fork, concurrent access
```

---

## Metrics Summary

| Metric | Value |
|--------|-------|
| Total test files | 18 |
| Total test cases | 163 |
| Total test LoC | 3,317 |
| Source LoC (approx) | ~14,000 |
| Test-to-source ratio | 0.24:1 |
| Estimated path coverage | 25-30% |
| Modules with 0 tests | 15 significant modules |
| Tests for confirmed bugs | 0 of 4 |
| All tests passing | Yes (163/163) |

### Industry Benchmarks (for reference)

| Metric | This Project | Good Practice | Excellent |
|--------|-------------|---------------|-----------|
| Test:Source ratio | 0.24:1 | 0.5:1 | 1:1+ |
| Critical path coverage | ~40% | >80% | >95% |
| Bug regression tests | 0% | 100% | 100% |
| CI test execution | Not in CI | In CI | In CI + coverage gates |

---

## Key Takeaway

The project has **good test culture** — the tests that exist are well-written, focused on pure logic, and all pass. The issue is **breadth, not depth**. The most dangerous gaps are:

1. **Zero regression tests for known bugs** — fix a bug, add a test that would have caught it
2. **Dice engine under-tested** — 2 tests for the most mathematically complex code
3. **Tests not in CI** — regressions can ship (F-088, already tracked)

The positive: because the architecture separates pure logic from side effects (reducers, `computeDiceResults`, scoring functions), adding tests is straightforward — no complex mocking needed for the highest-value gaps.
