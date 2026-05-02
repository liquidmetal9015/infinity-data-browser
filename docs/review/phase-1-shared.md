# Phase 1: Shared Core — Findings

---

## 1.1: shared/game-model.ts (973 LoC)

**Overall Assessment**: Exceptionally well-documented domain model. Every type and constant has JSDoc explaining game semantics. The file acts as a living reference document for the Infinity N4 data format. Few issues, mostly design decisions worth noting.

### Positive Notes
- Comprehensive JSDoc on every type explaining *game semantics*, not just shapes
- Clean section organization with visual separators
- Correct use of `as const` for enum objects
- Precise domain-specific types (e.g., `PeripheralType`, `FireteamType`)
- Explains *why* decisions were made (e.g., peripheral detection heuristics)

### Findings

#### [F-001] Extra literal union types are unused documentation
- **Category**: B1 (YAGNI)
- **Severity**: Minor
- **Effort**: XS
- **Location**: `shared/game-model.ts:143-277`
- **Issue**: Types like `StatModifierExtra`, `DistanceExtra`, `TerrainTypeExtra`, `ImmunityTypeExtra`, `AmmoTypeExtra`, `DeploymentVariantExtra`, and `StatOverrideExtra` are defined as string literal unions but are never referenced in type position anywhere in the codebase. They serve only as documentation. TypeScript types that are never used in type-checking provide no compile-time benefit — they're comments with extra syntax.
- **Suggestion**: Either (a) delete them and keep the documentation as JSDoc comments on the extras system, or (b) use them somewhere (e.g., type the `modifiers: string[]` arrays more precisely as `modifiers: (StatModifierExtra | DistanceExtra | ...)[]`). Option (b) would add real type safety but may be impractical given CB data may introduce new values. Option (a) is simpler — prefer it unless you want compile-time validation of modifier values.

#### [F-002] Index signature weakens FireteamSpec type safety
- **Category**: B1 (YAGNI) / C1 (Type Safety)
- **Severity**: Minor
- **Effort**: XS
- **Location**: `shared/game-model.ts:366`
- **Issue**: `[key: string]: number` on `FireteamSpec` is commented "future-proofing only — no non-standard types found in current data." This defeats type checking — any typo like `spec.CROE` compiles. Since no non-standard types exist, this is speculative generalization.
- **Suggestion**: Remove the index signature. If CB adds new fireteam types in the future, adding them to the interface is a one-line change.

#### [F-003] WeaponDefinition.weaponType union includes `| string`
- **Category**: C1 (Type Safety)
- **Severity**: Minor
- **Effort**: XS
- **Location**: `shared/game-model.ts:885`
- **Issue**: `weaponType: 'WEAPON' | 'CLOSE_COMBAT' | string` — the `| string` makes the union meaningless; any string is valid, so the named literals provide no narrowing benefit. This likely exists because the full set of weapon types wasn't enumerated.
- **Suggestion**: Either enumerate all known values (check the ETL output for distinct weaponType values) and use a strict union, or use just `string` with a comment listing known values. The current form gives false confidence of type safety.

#### [F-004] Numeric fields typed as string in WeaponDefinition
- **Category**: C1 (Type Safety)
- **Severity**: Nitpick
- **Effort**: S (requires ETL and consumer updates)
- **Location**: `shared/game-model.ts:887-889`
- **Issue**: `burst`, `damage`, `saving`, `savingNum` are typed as `string` (or `string | undefined`). Comments indicate `burst` is numeric ("3") or dash, `damage` is numeric or dash, `savingNum` is numeric. Using `string` loses semantic information. However, this mirrors CB's raw data format and the ETL doesn't transform them, so this is a conscious trade-off.
- **Suggestion**: No change recommended unless you want to parse these in the ETL. The dice engine already handles the string→number conversion at point of use. Noting for awareness only.

#### [F-005] Large file could be split by subdomain
- **Category**: A1 (SRP)
- **Severity**: Nitpick
- **Effort**: M
- **Location**: `shared/game-model.ts` (entire file)
- **Issue**: At 973 lines, this is a large file. However, it is 100% type definitions and constants with zero logic. It functions as a reference document. Splitting would increase file count without clear architectural benefit, though it could improve discoverability (e.g., separate `fireteam-types.ts`, `weapon-types.ts`, `unit-types.ts`).
- **Suggestion**: Keep as-is. The single-file format aids discoverability for this type of pure-types reference file. Only split if the file grows significantly beyond 1000 lines.

---

## 1.2: shared/types.ts (259 LoC)

**Overall Assessment**: This file has accumulated multiple concerns — it's part re-export barrel, part runtime-enriched type definitions, part MCP-specific types, and part search infrastructure. Several naming inconsistencies and structural redundancies with `game-model.ts` indicate organic growth without periodic refactoring.

### Positive Notes
- Clear section separators
- SearchSuggestion and SearchFilter types are well-designed for their use case

### Findings

#### [F-006] Parallel fireteam type hierarchy (DRY violation)
- **Category**: A3 (DRY)
- **Severity**: Major
- **Effort**: M
- **Location**: `shared/types.ts:102-128` vs `shared/game-model.ts:361-417`
- **Issue**: `types.ts` defines `FireteamUnit`, `Fireteam`, `FireteamChart` which are structurally near-identical to `FireteamSlot`, `FireteamComposition`, `FactionFireteamChart` in `game-model.ts`, but with different property names (`slug`→`slug`, `teams`→`compositions`, `spec`→`spec`). Both are used: `game-model.ts` types by the ETL/processed data, `types.ts` types by the frontend/shared modules (9 files import from `types.ts`). This forces mapping between the two at the boundary and means any schema change needs updating in two places.
- **Suggestion**: Consolidate to a single set of fireteam types. Either (a) make frontend consumers use the `game-model.ts` types directly, or (b) delete the `game-model.ts` versions and use the `types.ts` versions in processed data. Likely (a) is better since `game-model.ts` is the canonical reference.

#### [F-007] DatabaseMetadata duplicates game-model types with different shapes
- **Category**: A3 (DRY) / C3 (Naming)
- **Severity**: Major
- **Effort**: M
- **Location**: `shared/types.ts:56-86`
- **Issue**: `DatabaseMetadata` defines inline anonymous types for weapons, skills, etc. that partially mirror `WeaponDefinition`, `SkillDefinition`, `EquipmentDefinition` from `game-model.ts` but with naming inconsistencies:
  - `wiki` vs `wikiUrl` (field name)
  - `equips` vs `equipment` (array name)
  - `med` vs `medium` (distance band name)
  - Missing fields from the full types (e.g., no `ammunition` type reference)
  
  This means there are two representations of the same data with subtly different shapes, requiring mapping logic wherever they interact.
- **Suggestion**: Replace `DatabaseMetadata` inline types with references to `game-model.ts` types (e.g., `weapons: WeaponDefinition[]`). Align naming: if the canonical names in `game-model.ts` are `wikiUrl` and `medium`, use those consistently. This may require updating the ETL output format or the BaseDatabase loading code to match.

#### [F-008] Unit type wraps ProcessedUnit creating parallel hierarchy
- **Category**: A3 (DRY) / B2 (Interface Segregation)
- **Severity**: Major
- **Effort**: L
- **Location**: `shared/types.ts:38-54`
- **Issue**: `Unit` wraps `ProcessedUnit` (in `.raw`) and adds runtime-enriched fields (`allWeaponIds: Set<number>`, `allSkillIds: Set<number>`, `allEquipmentIds: Set<number>`, `allItemsWithMods`). This creates two "unit" concepts throughout the codebase — consumers must always know which they have. The naming is confusing: `Unit` is the enriched form, `ProcessedUnit` is the "raw" form, but `Unit.raw` points to `ProcessedUnit`. `ProcessedUnit` already has `allWeaponIds: number[]` — the enrichment is just Array→Set conversion + adding `allItemsWithMods`.
- **Suggestion**: Consider whether the `Unit` wrapper adds enough value to justify the parallel hierarchy. Options: (a) Merge the Set-based lookups into `ProcessedUnit` (use arrays and do Set conversion at query time — modern engines optimize `.includes()` well for small arrays). (b) Keep the wrapper but rename to `EnrichedUnit` or `IndexedUnit` to clarify the relationship. (c) Move enrichment into the Database class as a query-time concern rather than a type-level concept.

#### [F-009] Inconsistent casing for item type discriminants
- **Category**: C3 (Readability)
- **Severity**: Minor
- **Effort**: S
- **Location**: `shared/types.ts:11` vs `shared/types.ts:35`
- **Issue**: `Item.type` uses uppercase (`'WEAPON' | 'SKILL' | 'EQUIPMENT'`) while `ItemWithModifier.type` uses lowercase (`'skill' | 'equipment' | 'weapon'`). Same conceptual domain, inconsistent conventions. Any code comparing between these must lowercase/uppercase convert.
- **Suggestion**: Pick one convention (lowercase is more idiomatic in TypeScript union types) and use it consistently.

#### [F-010] MCP-specific types in shared package
- **Category**: B2 (Interface Segregation)
- **Severity**: Minor
- **Effort**: S
- **Location**: `shared/types.ts:176-221` (HydratedUnit, HydratedList, HydratedGroup)
- **Issue**: Comment says "MCP-specific but shared for type compatibility." Frontend imports from `shared/types.ts` but never uses these Hydrated* types. They increase the surface area of the shared package without benefit to all consumers.
- **Suggestion**: Move to `mcp-server/types.ts` and import the base types they need from shared. If the backend also needs them, consider a `shared/mcp-types.ts` barrel that's only imported by MCP/backend.

---

## 1.3: shared/listTypes.ts (127 LoC) + shared/listLogic.ts (418 LoC)

**Overall Assessment**: `listLogic.ts` is well-structured — a clean reducer pattern with immutable updates and a useful `withGroup` helper. `listTypes.ts` is clean and minimal. One significant design concern (full unit data in list entries) and one correctness bug (mutation in REMOVE_COMBAT_GROUP).

### Positive Notes
- Pure reducer pattern — testable, no side effects (except one console.warn)
- `withGroup` helper reduces boilerplate elegantly
- Peripheral auto-attachment logic in ADD_UNIT is thorough and well-commented
- REMOVE_UNIT correctly cascades to peripheral children
- MOVE_UNIT_TO_GROUP correctly moves peripherals with their parent
- Good guard clauses (null checks, bounds checks)

### Findings

#### [F-011] ListUnit stores full Unit reference — serialization bloat
- **Category**: A2 (Separation of Concerns) / C2 (Performance)
- **Severity**: Critical
- **Effort**: L
- **Location**: `shared/listTypes.ts:12` — `unit: Unit`
- **Issue**: Each `ListUnit` in an army list holds a reference to the full `Unit` object, which includes the entire `ProcessedUnit` (all profileGroups, all loadouts, all weapons/skills/equipment, pre-computed aggregates). When the list is serialized to localStorage (via Zustand persist) or sent to the backend (as `units_json` JSONB), **all game catalog data for every unit in the list is duplicated**. A 10-unit list could easily be 500KB+ of redundant data. This also means stored lists become stale when game data updates — the embedded unit data won't reflect ETL changes.
- **Suggestion**: Store only references in `ListUnit` (unit ID/slug + faction ID), not the full object. Hydrate unit data at load time from the Database singleton. This is a significant refactor affecting serialization, deserialization, and any code that accesses `listUnit.unit.raw.*` — but it eliminates data duplication, reduces localStorage/network payload by 10-50x, and ensures lists always reference current game data.

#### [F-012] REMOVE_COMBAT_GROUP mutates shared references (bug)
- **Category**: C1 (Correctness)
- **Severity**: Major
- **Effort**: XS
- **Location**: `shared/listLogic.ts:229-232`
- **Issue**: 
  ```ts
  const newGroups = state.currentList.groups.filter((_, i) => i !== action.groupIndex);
  newGroups.forEach((g, i) => { g.name = `Combat Group ${i + 1}`; });
  ```
  `filter()` creates a new array but does NOT clone the objects inside it. The `forEach` then mutates `g.name` on the *original* `CombatGroup` objects that are still referenced by the previous state. This violates immutability — any component holding a reference to the old state will see its group names change unexpectedly. In practice this may not cause visible bugs because React re-renders from new state, but it breaks the contract that previous state objects are never mutated (important for undo/redo, time-travel debugging, strict-mode double-renders, etc.).
- **Suggestion**: Replace with:
  ```ts
  const newGroups = state.currentList.groups
      .filter((_, i) => i !== action.groupIndex)
      .map((g, i) => ({ ...g, name: `Combat Group ${i + 1}` }));
  ```

#### [F-013] console.warn side effect in pure reducer
- **Category**: A2 (Separation of Concerns)
- **Severity**: Minor
- **Effort**: XS
- **Location**: `shared/listLogic.ts:102`
- **Issue**: `console.warn('Could not find option for unit', ...)` is a side effect inside what should be a pure function. While logging doesn't affect state correctness, it violates the purity contract of a reducer pattern. In tests or server-side (MCP) contexts, this produces unexpected console output.
- **Suggestion**: Remove the console.warn. The reducer already returns unchanged state on failure, which is the correct "no-op" behavior. If debugging is needed, the caller can detect unchanged state.

#### [F-014] Inline import type in action definition
- **Category**: C3 (Readability)
- **Severity**: Nitpick
- **Effort**: XS
- **Location**: `shared/listLogic.ts:31`
- **Issue**: `Partial<import('./listTypes.js').FireteamDef>` uses an inline dynamic import type instead of a top-level import. `FireteamDef` is defined in `./listTypes.js` which is already imported on line 6 (`import type { ArmyList, CombatGroup, ListUnit } from './listTypes.js'`) — `FireteamDef` was simply omitted from that import.
- **Suggestion**: Add `FireteamDef` to the existing import on line 6.

#### [F-015] MOVE_FIRETEAM action is overly complex
- **Category**: C3 (Readability)
- **Severity**: Minor
- **Effort**: S
- **Location**: `shared/listLogic.ts:304-351`
- **Issue**: At 47 lines, this is the densest action in the reducer. It handles extracting a fireteam definition, its member units, removing from source group, and inserting into target group — all in one block with interleaved mutation of `newGroups`. The same-group edge case (line 331) adds conditional logic that's easy to misread.
- **Suggestion**: Extract helpers: `extractFireteamFromGroup(group, fireteamId) → { ftDef, ftUnits, remainingGroup }` and `insertFireteamIntoGroup(group, ftDef, ftUnits, atIndex) → group`. This makes the action body a clear two-step: extract from source, insert into target.

#### [F-016] calculateListPoints/calculateListSWC — defensive Number() wrapping
- **Category**: C1 (Type Safety)
- **Severity**: Nitpick
- **Effort**: XS
- **Location**: `shared/listTypes.ts:97,104`
- **Issue**: `Number(unit.points || 0)` and `Number(unit.swc || 0)` — `ListUnit.points` is already typed as `number` and `ListUnit.swc` is already typed as `number`. The `Number()` wrapping and `|| 0` fallback suggest distrust of the type system. If these values could be undefined or strings, the types are wrong; if the types are correct, this defensive coding is noise.
- **Suggestion**: Use `unit.points` and `unit.swc` directly, or fix the types if they can actually be undefined/NaN.

---

---

## 1.4: shared/BaseDatabase.ts (493 LoC)

**Overall Assessment**: Good abstract class pattern providing platform-agnostic data loading and querying. However, it exposes too much mutable state publicly, contains a type escape hatch related to the parallel type hierarchies, and silently swallows errors.

### Positive Notes
- Clean Template Method pattern (abstract `loadMetadataFiles`/`loadFactionData`, shared `init`/`ingestUnits`)
- Lazy caching of search suggestions
- Deduplication by ISC handles shared mercenary units correctly
- Slug-based lookup with fallback normalization

### Findings

#### [F-017] Public mutable state — no encapsulation
- **Category**: B2 (Interface Segregation) / C4 (Testability)
- **Severity**: Major
- **Effort**: M
- **Location**: `shared/BaseDatabase.ts:31-68`
- **Issue**: 15+ public properties (`units`, `metadata`, `factionMap`, `weaponMap`, `skillMap`, `equipmentMap`, `weaponDetailsMap`, `weaponWikiMap`, `skillWikiMap`, `equipmentWikiMap`, `fireteamData`, `factionRegistry`) are directly mutable by any consumer. External code can accidentally corrupt the database state. This also makes the class hard to refactor — every consumer touches internals directly.
- **Suggestion**: Make properties private/protected with public getter methods (read-only access). At minimum, expose only `readonly` typed accessors.

#### [F-018] Type escape hatch: `as unknown as Fireteam[]`
- **Category**: C1 (Type Safety)
- **Severity**: Minor
- **Effort**: XS (fix by resolving F-006)
- **Location**: `shared/BaseDatabase.ts:111`
- **Issue**: `data.faction.fireteams.compositions as unknown as Fireteam[]` is a double cast that bypasses type checking. It's required because `FireteamComposition` (game-model.ts) and `Fireteam` (types.ts) are parallel types with different property names. This is a symptom of F-006.
- **Suggestion**: Resolving F-006 (consolidating fireteam types) eliminates this cast naturally.

#### [F-019] Silent error swallowing on faction loading
- **Category**: B4 (Error Handling)
- **Severity**: Minor
- **Effort**: XS
- **Location**: `shared/BaseDatabase.ts:118`
- **Issue**: `catch {}` swallows faction loading errors completely — no log, no count, no diagnostic. If a faction file is corrupted or missing, the app silently skips it. Users would see missing factions with no explanation.
- **Suggestion**: At minimum, log the failed slug: `catch (e) { console.warn(\`Failed to load faction ${faction.slug}\`, e); return null; }`. Or collect errors in a `loadErrors` array for diagnostic display.

#### [F-020] buildDatabaseMetadata is a symptom of F-007
- **Category**: A3 (DRY)
- **Severity**: Minor
- **Effort**: XS (removed by fixing F-007)
- **Location**: `shared/BaseDatabase.ts:142-172`
- **Issue**: This entire method exists only to map between `ProcessedMetadataFile` → `DatabaseMetadata`, converting property names (`wikiUrl`→`wiki`, `equipment`→`equips`). If the types were unified (F-007), this method would be a simple assignment.
- **Suggestion**: Fix F-007 first; this method becomes trivial or disappears.

#### [F-021] Deprecated `getExtraName` method
- **Category**: B1 (YAGNI)
- **Severity**: Nitpick
- **Effort**: XS
- **Location**: `shared/BaseDatabase.ts:471-473`
- **Issue**: Deprecated method that always returns `undefined`. Dead code.
- **Suggestion**: Delete it. If anything still calls it, the TypeScript compiler will flag the removal.

#### [F-022] searchWithModifiers silently ignores stat filters
- **Category**: B4 (Error Handling) / C3 (Readability)
- **Severity**: Minor
- **Effort**: XS
- **Location**: `shared/BaseDatabase.ts:310`
- **Issue**: `if (filter.type === 'stat') return true` — stat-type filters pass through as "always matches." The method accepts `SearchFilter[]` which includes stat filters, but can't process them. This is confusing for callers who might expect stat filtering to work.
- **Suggestion**: Either handle stat filters properly here, or change the method signature to accept only item filters (`Exclude<SearchFilter, { type: 'stat' }>`). Or add a doc comment explaining that stat filtering is handled separately.

---

## 1.5: shared/dice-engine.ts (425 LoC)

**Overall Assessment**: Solid mathematical implementation of F2F probability calculations. Clean and correct algorithms. Main issues are readability (magic numbers, large parameter lists) and a minor performance concern (JSON.stringify as Map keys).

### Positive Notes
- Correct probability math (CDF-based max distribution, binomial expansion)
- Handles edge cases (burst=0, saves≤0, continuous damage iteration cap)
- Clean convolution helper for combining distributions
- High-level API (`calculateF2F`) wraps low-level math cleanly

### Findings

#### [F-023] Magic numbers throughout
- **Category**: C3 (Readability)
- **Severity**: Minor
- **Effort**: S
- **Location**: `shared/dice-engine.ts:35,48,55,98,313`
- **Issue**: `200` (critical sentinel value), `0.05` (probability per d20 face), `20` (faces on d20), `1e-9` (probability epsilon), `10` (max continuous damage iterations) are unexplained magic numbers scattered throughout the code.
- **Suggestion**: Define named constants at the top:
  ```ts
  const D20_FACES = 20;
  const PROB_PER_FACE = 1 / D20_FACES;
  const CRIT_VALUE = 200;
  const PROB_EPSILON = 1e-9;
  const MAX_CONT_ITERATIONS = 10;
  ```

#### [F-024] JSON.stringify as Map key — fragile and slow
- **Category**: C2 (Performance) / C1 (Type Safety)
- **Severity**: Minor
- **Effort**: S
- **Location**: `shared/dice-engine.ts:136,154,159,215,384`
- **Issue**: `solveF2F` uses `JSON.stringify(outcome)` as Map keys, then `JSON.parse(key)` to read them back. This is called per-outcome in the probability calculation (potentially hundreds of iterations). JSON serialization is slow relative to string concatenation, and key format depends on property insertion order (non-deterministic in edge cases pre-ES2015, though V8 is consistent).
- **Suggestion**: Use a structured string key: `\`${aSuccess}:${aCrit}:${bSuccess}:${bCrit}\`` — deterministic, faster to create, faster to parse.

#### [F-025] calculateExpectedWounds has 12 positional parameters
- **Category**: C3 (Readability)
- **Severity**: Minor
- **Effort**: S
- **Location**: `shared/dice-engine.ts:188-201`
- **Issue**: 12 parameters with 6 optional trailing booleans/numbers. Easy to misorder or confuse `aArm` with `bArm`, `aCont` with `bCont`. The function is called from `calculateF2F` (internal) and potentially from tests.
- **Suggestion**: Use a parameter object: `calculateExpectedWounds(f2fDist, { active: {...}, reactive: {...} })`. The high-level API (`calculateF2F`) already uses `CombatantInput` objects — reuse that pattern at this layer too.

#### [F-026] "N5" vs "N4" rules comment inconsistency
- **Category**: C3 (Readability)
- **Severity**: Nitpick
- **Effort**: XS
- **Location**: `shared/dice-engine.ts:1-2`
- **Issue**: Header says "N5 Rules: Probability of Survival" but `game-model.ts` header says "N4 edition." If the game data is N4, the dice engine comment is misleading (or the game has since moved to N5 and game-model.ts is out of date).
- **Suggestion**: Align to the correct edition across all files.

---

## 1.6: shared/factions.ts (233 LoC) + shared/fireteams.ts (315 LoC) + shared/unit-roles.ts (429 LoC)

**Overall Assessment**: `factions.ts` is clean and well-structured. `fireteams.ts` has a solid backtracking solver. `unit-roles.ts` has **actual bugs** due to using magic numbers instead of the `UnitType` constants defined in game-model.ts.

### Positive Notes (factions.ts)
- FactionRegistry cleanly handles the complex parent/sectorial/vanilla relationships
- SHORT_NAME_OVERRIDES is pragmatic for a finite known set
- Good edge case handling (NA2, phantom parents, reinforcement ID patterns)

### Positive Notes (fireteams.ts)
- Backtracking solver (`assignMembersToSlots`) is correct and efficient for small N
- Slug-based matching preferred over name matching where available
- Fireteam level calculation follows official rules

### Findings

#### [F-027] BUG: scoreHeavy uses wrong UnitType IDs for TAG
- **Category**: C1 (Correctness)
- **Severity**: Critical
- **Effort**: XS
- **Location**: `shared/unit-roles.ts:317`
- **Issue**: `profile.unitType === 7` with comment "TAG" is **wrong**. Per `game-model.ts`, `UnitType.TAG = 4` and `UnitType.WB = 7` (Warband). This means:
  - TAGs (the heaviest units in the game, e.g., Maruts, Szalamandras) get **zero** heavy score from their unit type
  - Warbands (light impetuous troops like Yuan Yuan, Antipodes) incorrectly get **+40 heavy score**
  
  This inverts the role classification for two entire troop classes.
- **Suggestion**: `profile.unitType === 4` (TAG). Import `UnitType` from game-model.ts and use `UnitType.TAG`.

#### [F-028] BUG: scoreHackTarget uses wrong UnitType IDs
- **Category**: C1 (Correctness)
- **Severity**: Critical
- **Effort**: XS
- **Location**: `shared/unit-roles.ts:370-381`
- **Issue**: 
  - Line 370: `profile.unitType === 3` (HI) — **correct**
  - Line 374: `profile.unitType === 6` with comment "REM" — **wrong**. `UnitType.REM = 5`, `UnitType.SK = 6` (Skirmisher). Skirmishers are being classified as hackable REMs.
  - Line 378: `profile.unitType === 7` with comment "TAG" — **wrong**. Same bug as F-027. Warbands are being classified as hackable TAGs.
  
  Impact: REMs are NOT classified as hack targets (missing a whole troop class). TAGs are NOT classified as hack targets. Meanwhile, Skirmishers and Warbands are incorrectly flagged as hackable.
- **Suggestion**: Use the correct constants:
  ```ts
  import { UnitType } from './game-model.js';
  // ...
  if (profile.unitType === UnitType.HI) { ... }
  if (profile.unitType === UnitType.REM) { ... }  // 5
  if (profile.unitType === UnitType.TAG) { ... }  // 4
  ```

#### [F-029] unit-roles.ts uses fragile name-based string matching
- **Category**: C1 (Type Safety)
- **Severity**: Minor
- **Effort**: M
- **Location**: `shared/unit-roles.ts:36-59`
- **Issue**: Skill/weapon detection uses `skill.includes(specialist)` — loose substring matching on display names. The processed data has stable numeric IDs for every skill and weapon. Name-based matching is fragile: "Forward Observer" contains "forward" (could false-match future skills), "Paramedic" contains "medic", etc. If CB renames a skill, this breaks silently.
- **Suggestion**: Match by skill ID (e.g., `HACKER_SKILL_ID = 1000` from game-model.ts) rather than name substrings. Define `SPECIALIST_SKILL_IDS`, `CAMO_SKILL_IDS`, etc.

#### [F-030] Unused parameter `_unit` in analyzeUnitForTeam
- **Category**: C3 (Readability) / B1 (YAGNI)
- **Severity**: Nitpick
- **Effort**: XS
- **Location**: `shared/fireteams.ts:279`
- **Issue**: `_unit: Unit | undefined` is accepted but never used (prefixed with underscore). Adds noise to the call site.
- **Suggestion**: Remove it from the signature. If callers pass it, they'll get a compile error telling them it's no longer needed.

#### [F-031] fireteams.ts bidirectional substring matching is overly loose
- **Category**: C1 (Type Safety)
- **Severity**: Minor
- **Effort**: S
- **Location**: `shared/fireteams.ts:63,76,82,290`
- **Issue**: `t.includes(rt) || rt.includes(t)` matches bidirectionally. If a unit's tag is "moderator" and a slot's tag is "moderator", great. But if a tag is "od" (hypothetical), it would match anything containing "od". In practice, game-specific names are distinct enough that this likely doesn't cause false positives, but it's a fragile pattern that could break with future data.
- **Suggestion**: Use exact slug matching as the primary matcher (already available and used where possible, line 72). Fall back to `===` equality on normalized names rather than substring containment.

---

## 1.7: shared/armyCode.ts (239 LoC) + list-similarity.ts (479 LoC) + list-scoring.ts (318 LoC) + classifieds.ts (82 LoC)

**Overall Assessment**: Well-structured feature modules. `armyCode.ts` is clean and focused. `list-similarity.ts` is sophisticated and mathematically sound. `list-scoring.ts` has some simplifications that may affect accuracy. `classifieds.ts` is minimal and correct.

### Positive Notes
- `armyCode.ts`: Clean VLI encoding, well-documented binary format, good encode/decode symmetry
- `list-similarity.ts`: Multi-axis similarity with proper cosine/Jaccard, good weight presets for same-faction vs cross-faction
- `list-scoring.ts`: Comprehensive 6-dimension scoring
- `classifieds.ts`: Simple, focused, single responsibility

### Findings

#### [F-032] list-scoring.ts ignores actual order types (simplification)
- **Category**: C3 (Readability) / Correctness
- **Severity**: Minor
- **Effort**: S
- **Location**: `shared/list-scoring.ts:115-117`
- **Issue**: `regularOrders = listUnits.length` and `irregularOrders = 0` — every unit is assumed to generate exactly 1 regular order. The data model (`Loadout.orders: OrderEntry[]`) contains full order information (type, count, inPool) but it's completely ignored. This makes the "order economy" dimension inaccurate: irregular units (which DON'T contribute to the shared pool) are counted as regular, and multi-order units are undercounted.
- **Suggestion**: Use actual order data: iterate `option.orders` and sum by type. This is available on every `Loadout` object.

#### [F-033] list-scoring.ts totalBurst is a crude heuristic
- **Category**: C3 (Readability)
- **Severity**: Nitpick
- **Effort**: M
- **Location**: `shared/list-scoring.ts:132`
- **Issue**: `totalBurst += hasHeavyWeapon > 20 ? 4 : 3` — assigns burst=4 if "heavy score >20", else burst=3. Actual weapon burst data is available in metadata. This rough approximation reduces the scoring accuracy.
- **Suggestion**: If metadata is available (via a parameter or a lazy lookup), use actual burst values from the best weapon on each unit.

#### [F-034] resolveListUnits depends on ListUnit.unit reference (design coupling)
- **Category**: A4 (Dependency Direction)
- **Severity**: Minor
- **Effort**: M (contingent on F-011)
- **Location**: `shared/list-similarity.ts:30`, `shared/list-scoring.ts:101`
- **Issue**: These modules access `lu.unit` to get the full Unit object for analysis. If F-011 is implemented (removing full unit data from ListUnit), these functions will need a database/registry parameter to hydrate units by ID. This is important context for planning F-011's remediation scope.
- **Suggestion**: When implementing F-011, add a `unitResolver: (id: number) => Unit | undefined` parameter to these functions, or pass the database instance.

#### [F-035] Unused `_pointsLimit` parameter in scoreList
- **Category**: C3 (Readability)
- **Severity**: Nitpick
- **Effort**: XS
- **Location**: `shared/list-scoring.ts:99`
- **Issue**: `_pointsLimit: number = 300` is accepted but never used (underscore prefix). It's passed from `compareLists` but has no effect on scoring.
- **Suggestion**: Either use it (e.g., for scoring efficiency relative to budget — `orderEfficiency` already uses `totalPoints` but not `pointsLimit`) or remove it.

---

## Phase 1 Summary

| Unit | Findings | Critical | Major | Minor | Nitpick |
|------|----------|----------|-------|-------|---------|
| 1.1 game-model.ts | 5 | 0 | 0 | 3 | 2 |
| 1.2 types.ts | 5 | 0 | 3 | 2 | 0 |
| 1.3 listTypes.ts + listLogic.ts | 6 | 1 | 1 | 2 | 2 |
| 1.4 BaseDatabase.ts | 6 | 0 | 1 | 4 | 1 |
| 1.5 dice-engine.ts | 4 | 0 | 0 | 3 | 1 |
| 1.6 factions.ts + fireteams.ts + unit-roles.ts | 5 | 2 | 0 | 2 | 1 |
| 1.7 armyCode.ts + list-similarity.ts + list-scoring.ts + classifieds.ts | 4 | 0 | 0 | 2 | 2 |
| **Total** | **35** | **3** | **5** | **18** | **9** |

### Critical Findings
1. **F-011**: ListUnit stores full Unit reference — serialization bloat (L effort)
2. **F-027**: scoreHeavy uses wrong UnitType ID (WB=7 instead of TAG=4) — actual bug (XS effort)
3. **F-028**: scoreHackTarget uses wrong UnitType IDs (SK=6 instead of REM=5, WB=7 instead of TAG=4) — actual bug (XS effort)

### Key Themes
1. **Parallel type hierarchies** (F-006, F-007, F-008, F-018, F-020): Multiple representations of the same domain concepts with inconsistent naming — biggest structural debt in the shared layer
2. **Serialization design** (F-011, F-034): Storing full game data inside list entries causes bloat and creates coupling
3. **Magic numbers over constants** (F-023, F-027, F-028, F-029): The UnitType bugs are a direct consequence of not using the constants defined in game-model.ts
4. **Encapsulation gaps** (F-017): BaseDatabase exposes internals publicly
5. **Error handling inconsistency** (F-019, F-022): Silent failures and ignored filter types
