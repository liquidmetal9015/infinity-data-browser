# Phase 3: MCP Server — Findings

**Overall Assessment**: The MCP server is functional and well-featured (16 tools, 4 resources). The file size estimate from the plan was stale — `index.ts` is 1352 LoC, not 49KB. The main concerns are structural: all tool handlers inline in one file, repeated boilerplate patterns, dead code, and a logic bug in the search operator. `DatabaseAdapter` is a clean extension of `BaseDatabase`. Supporting files are well-factored.

---

## 3.1: mcp-server/index.ts (1352 LoC)

### Positive Notes
- 16 tools covering search, analysis, list building, rules lookup, and dice calculation
- Good tool descriptions optimized for LLM comprehension
- Zod schemas provide clear input validation
- Error handling is present in all tools (try/catch or conditional checks)
- `main()` initializes DB before connecting transport — correct startup sequence

### Findings

#### [F-044] `search_units` OR operator branch is identical to AND — logic bug
- **Category**: C1 (Correctness)
- **Severity**: Major
- **Effort**: XS
- **Location**: `mcp-server/index.ts:155-163`
- **Issue**: Both the `and` and `or` branches for item filters do exactly the same thing:
  ```typescript
  if (operator === 'and') {
      const matchIds = new Set(itemMatches.map(u => u.id));
      results = results.filter(u => matchIds.has(u.id));
  } else {
      const matchIds = new Set(itemMatches.map(u => u.id));
      results = results.filter(u => matchIds.has(u.id));
  }
  ```
  The `or` case should union the item matches with existing results, not intersect them.
- **Suggestion**: 
  ```typescript
  if (operator === 'or') {
      const matchIds = new Set(itemMatches.map(u => u.id));
      const existingIds = new Set(results.map(u => u.id));
      results = db.units.filter(u => existingIds.has(u.id) || matchIds.has(u.id));
  }
  ```

#### [F-045] Repeated `if (!db.metadata) await db.init()` guard in every tool
- **Category**: A3 (DRY)
- **Severity**: Minor
- **Effort**: S
- **Location**: Lines 30, 46, 135, 269, 329, 367, 419, 453, 606, 627, 665, 884, 1021, 1161, 1254
- **Issue**: This guard appears in 15+ tool handlers despite `main()` already calling `await db.init()` before `server.connect()`. The guard is redundant for normal operation but serves as a safety net for resources (which can be accessed before tools). The repetition adds noise.
- **Suggestion**: For tools, this is genuinely unnecessary since `main()` guarantees init before server accepts connections. For resources, a middleware/wrapper pattern would be cleaner:
  ```typescript
  function ensureInit<T>(fn: (...args: any[]) => Promise<T>) {
      return async (...args: any[]) => { if (!db.metadata) await db.init(); return fn(...args); };
  }
  ```
  Low priority since it's a cosmetic issue.

#### [F-046] Repeated dynamic imports instead of top-level imports
- **Category**: C2 (Performance) / A3 (DRY)
- **Severity**: Minor
- **Effort**: XS
- **Location**: Lines 627-631, 667-670, 708-709, 846, 919-920, 964, 1087, 1163-1164
- **Issue**: `await import('../shared/armyCode.js')` and `await import('./list-utils.js')` are dynamically imported inside tool handlers rather than at the top of the file. Comment at line 629 says "avoid initialization issues" but this concern doesn't apply — the modules don't have side effects that require DB to be ready. `fs/promises` and `path` are also dynamically imported in resources (lines 48-49, 92-93) despite being available as Node built-ins.
- **Suggestion**: Move to static imports at the top of the file. Dynamic import is only justified for code-splitting in bundled environments (not applicable to a Node MCP server).

#### [F-047] Metadata map building duplicated across tools
- **Category**: A3 (DRY)
- **Severity**: Minor
- **Effort**: S
- **Location**: Lines 690-701 (analyze_classifieds), 888-911 (classify_units), 1055-1059 (analyze_matchup)
- **Issue**: Three tools independently build `skillsMap`, `weaponsMap`, `equipsMap` from `db.metadata`. This is ~15 lines duplicated each time. If the metadata shape changes, all three must be updated.
- **Suggestion**: Add a helper method to `DatabaseAdapter` (or a local utility) that returns pre-built Maps:
  ```typescript
  function getMetadataMaps() {
      const skills = new Map(db.metadata!.skills.map(s => [s.id, s.name]));
      // ...
      return { skills, weapons, equips };
  }
  ```

#### [F-048] `compare_lists` ignores existing shared scoring/similarity modules
- **Category**: B1 (YAGNI / Under-use)
- **Severity**: Minor
- **Effort**: M
- **Location**: `mcp-server/index.ts:1150-1236`
- **Issue**: The `compare_lists` tool reimplements basic list metrics inline (counting points, models, specialists) rather than using `shared/list-scoring.ts` or `shared/list-similarity.ts` which were built specifically for this purpose. The shared modules offer much richer analysis (Jaccard similarity, cosine comparison, role-based scoring).
- **Suggestion**: Import and delegate to the shared modules for richer comparison output. The inline implementation is a shallow version of what already exists.

#### [F-049] Tool comment numbering is inconsistent/colliding
- **Category**: C3 (Readability)
- **Severity**: Nitpick
- **Effort**: XS
- **Location**: Throughout file — "12. Calculate Face-to-Face" (line 819) and "12. Create List" (line 1244)
- **Issue**: Sequential comment numbers collide. Tools 12-16 appear twice. This is just comment drift as tools were added.
- **Suggestion**: Remove or renumber. Or better: group tools by category with section headers rather than sequential numbers.

#### [F-050] `analyze_matchup` hardcodes reactive burst=1 and ignores ammo types
- **Category**: C1 (Correctness)
- **Severity**: Minor
- **Effort**: M
- **Location**: `mcp-server/index.ts:1089-1110`
- **Issue**: The matchup always assigns `burst: 1` to the reactive player and `ammo: 'NORMAL'` for both. This ignores:
  - Weapons with special ammo (AP, DA, EXP) which dramatically change outcomes
  - Units with reactive burst bonuses (Full Auto, Neurocinetics)
  - The actual burst value of the attacker's weapon
  Also, `_aOption` and `_dOption` (lines 1044-1045) are assigned but unused.
- **Suggestion**: Parse the weapon's burst from metadata. Apply ammo type from weapon data. Accept a parameter for reactive burst override. Remove unused variables.

---

## 3.2: mcp-server/DatabaseAdapter.ts (258 LoC) + list-builder.ts (196 LoC) + list-utils.ts (165 LoC)

### Positive Notes
- `DatabaseAdapter` cleanly extends `BaseDatabase` with Node.js filesystem implementations
- Wiki and ITS rules are MCP-specific concerns properly isolated here
- `ListBuilder` is appropriately simple for stateful MCP sessions
- `hydrateUnit` is exported and reused by both `list-utils.ts` and `index.ts`
- `list-utils.ts` handles missing/unknown units gracefully with fallback objects

### Findings

#### [F-051] `list-utils.ts` resolve functions use linear search instead of Map lookup
- **Category**: C2 (Performance)
- **Severity**: Minor
- **Effort**: S
- **Location**: `mcp-server/list-utils.ts:94-128`
- **Issue**: `resolveSkill`, `resolveEquipment`, and `resolveWeapon` all call `db.metadata?.skills.find(m => m.id === s.id)` — a linear O(n) search per item. For a unit with 10 skills/weapons and metadata arrays with 100+ entries, this is repeated for every unit in a list (potentially 15+ units × 10+ items = 150+ linear scans).
- **Suggestion**: Build ID→item Maps once (either lazily on first call or during init) and use Map.get() for O(1) lookup. Could be added to `DatabaseAdapter` as cached Maps.

#### [F-052] `skill-summaries.ts` contains dead code (`loadSkillSummariesFromWiki`, `extractEffectsFromWiki`)
- **Category**: B1 (YAGNI)
- **Severity**: Minor
- **Effort**: XS
- **Location**: `mcp-server/skill-summaries.ts:134-197`
- **Issue**: `loadSkillSummariesFromWiki()` and `extractEffectsFromWiki()` are never called from anywhere in the codebase. The `skillSummariesCache` variable is never populated. Only `getSkillSummary()` (which uses the hardcoded `BUILT_IN_SUMMARIES`) and `enrichSkillsWithSummaries()` are actually used.
- **Suggestion**: Remove dead functions or wire them into initialization if wiki-based summaries are intended.

#### [F-053] `getSkillSummary` matching can return wrong summary due to `includes`
- **Category**: C1 (Correctness)
- **Severity**: Minor
- **Effort**: XS
- **Location**: `mcp-server/skill-summaries.ts:100-112`
- **Issue**: The matching logic uses `normalizedName.toLowerCase().includes(key.toLowerCase())`, meaning a lookup for "TO Camouflage" will match "Camouflage" (which appears earlier in object iteration). A lookup for "Multispectral Visor L2" would also match "Multispectral Visor L1" if L1 appears first.
- **Suggestion**: Prioritize exact matches before substring matches:
  ```typescript
  // First pass: exact match
  const exact = BUILT_IN_SUMMARIES[normalizedName] || 
      Object.entries(BUILT_IN_SUMMARIES).find(([k]) => k.toLowerCase() === normalizedName.toLowerCase());
  if (exact) return typeof exact === 'string' ? exact : exact[1];
  // Then substring match (longest key first)
  ```

#### [F-054] `run_analysis.ts` duplicates tool logic from index.ts
- **Category**: A3 (DRY)
- **Severity**: Nitpick
- **Effort**: S
- **Location**: `mcp-server/run_analysis.ts` (entire file, 173 LoC)
- **Issue**: This script reimplements scoring and classifieds analysis that already exists in the `classify_units` and `analyze_classifieds` tools. It appears to be a dev/debug script that has drifted from the main tool implementations.
- **Suggestion**: Either remove (if no longer needed) or refactor to call shared functions that both the tools and this script can use.

#### [F-055] `DatabaseAdapter` continues public mutable state pattern (XC-009)
- **Category**: A3 (Design)
- **Severity**: Minor
- **Effort**: S
- **Location**: `mcp-server/DatabaseAdapter.ts:18-21`
- **Issue**: `wikiPages: Map<string, WikiPage>`, `wikiLoaded: boolean`, and `itsRules: ITSRules | null` are all public and mutable. Any consumer can modify wiki state after initialization.
- **Suggestion**: Make these private with public getters. Consistent with proposed standard in XC-009.

#### [F-056] `ListBuilder` unused `_profileId` parameter
- **Category**: B1 (YAGNI)
- **Severity**: Nitpick
- **Effort**: XS
- **Location**: `mcp-server/list-builder.ts:62`
- **Issue**: `addUnit(unitSlug, groupNumber, optionId?, _profileId?)` — the `_profileId` parameter is accepted but never used. It's in the public API (exposed as a tool parameter in index.ts line 1272).
- **Suggestion**: Remove or implement. If profile selection is planned, add a TODO.

---

## Supporting Files Assessment

### types.ts + utils.ts (Re-export barrels)
- **Assessment**: Clean re-export files. `types.ts` re-exports shared types, `utils.ts` re-exports shared functions. These provide a stable import boundary for the MCP server.
- **Minor concern**: Dual re-export of the same items (e.g., `getFireteamBonuses` re-exported in both `types.ts` and `utils.ts` from the same source). Not harmful but could be consolidated.

---

## Phase 3 Summary

| Unit | Findings | Critical | Major | Minor | Nitpick |
|------|----------|----------|-------|-------|---------|
| 3.1 index.ts | 7 | 0 | 1 | 5 | 1 |
| 3.2 DatabaseAdapter + list-builder + list-utils | 6 | 0 | 0 | 5 | 1 |
| **Total** | **13** | **0** | **1** | **10** | **2** |

### Key Observations
- Only 1 Major finding: the OR operator logic bug (F-044) which is an XS fix
- Primary structural concern is code duplication (metadata map building, dynamic imports, run_analysis.ts)
- The file is well-organized for its size — the concern from the plan about a "49KB god-file" doesn't apply (likely stale measurement)
- Dead code in `skill-summaries.ts` should be cleaned up
- Cross-cutting: continues XC-009 (public mutable state) and adds a new DRY concern (metadata Maps should be centralized)
