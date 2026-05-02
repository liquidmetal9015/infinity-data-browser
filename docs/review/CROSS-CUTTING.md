# Cross-Cutting Concerns

Issues that span multiple modules are tracked here. Each concern is populated as it's discovered during phase reviews.

---

## XC-001: Error Handling Consistency
- **Type**: Inconsistency
- **Affected Modules**: shared/BaseDatabase.ts, backend-ts/agent/gameData/loader.ts
- **Examples**:
  - `BaseDatabase.init()` line 118: `catch {}` swallows faction loading errors silently
  - `GameDataLoader.readJson()`: swallows non-ENOENT errors with only a warning
  - `app.ts` line 49: fire-and-forget initialization with no error handler
- **Proposed Standard**: All async initialization should surface errors to a diagnostics mechanism. Use structured logging with severity. Never `catch {}` without at minimum a console.warn indicating what failed and why.

## XC-002: Singleton Pattern Usage
- **Type**: Anti-pattern risk
- **Affected Modules**: backend-ts/agent/gameData/loader.ts, src/services/Database.ts (pending Phase 4)
- **Examples**:
  - `GameDataLoader.getInstance()` — static singleton with mutable state
  - Frontend `DatabaseImplementation.getInstance()` (to be reviewed)
- **Proposed Standard**: Singletons are acceptable for stateless-after-init services like data loaders. BUT: all mutable properties should be private/readonly after initialization. Consider dependency injection for testability.

## XC-003: Data Initialization Patterns
- **Type**: Inconsistency
- **Affected Modules**: shared/BaseDatabase.ts, backend-ts/agent/gameData/loader.ts
- **Examples**:
  - `BaseDatabase.init()` — idempotency guard (`if (this.metadata) return`)
  - `GameDataLoader.initialize()` — promise dedup (`if (this.initPromise) return`)
  - Both use `Promise.all` for parallel file loading, both deduplicate by ISC
- **Proposed Standard**: The `initPromise` pattern (GameDataLoader) is more robust than the boolean guard (BaseDatabase) because it handles concurrent callers correctly. Standardize on promise-dedup.

## XC-004: ID Type Consistency
- **Type**: Inconsistency
- **Affected Modules**: TBD (need Phase 4 for frontend perspective)
- **Examples**: Backend army_lists.id is `serial` (number), frontend ListUnit.id is `string` (generated via `generateId()`). Backend user.id is `varchar` (Firebase UID). ArmyList.serverId is `number | undefined`.
- **Proposed Standard**: TBD after Phase 4 review.

## XC-005: Import Path Conventions
- **Type**: Inconsistency
- **Affected Modules**: shared/ (mixed `.js` extensions in imports)
- **Examples**:
  - `shared/listLogic.ts`: imports from `'./types.js'` (with extension)
  - `shared/unit-roles.ts`: imports from `'./types'` (without extension)
  - Backend uses `@shared/game-model` (path alias, no extension)
- **Proposed Standard**: Use consistent import extensions within each project. TypeScript ESM requires `.js` extensions in some configs. Standardize: shared uses `.js`, backend uses `@shared/` alias.

## XC-006: State Derivation Location
- **Type**: Missing pattern
- **Affected Modules**: TBD (need Phase 4)
- **Examples**: TBD
- **Proposed Standard**: TBD

## XC-007: Parallel Type Hierarchies (Fireteam / Unit / Metadata)
- **Type**: Anti-pattern (DRY violation)
- **Affected Modules**: shared/game-model.ts, shared/types.ts, shared/BaseDatabase.ts, backend-ts/agent/gameData/loader.ts
- **Examples**:
  - `FireteamComposition` (game-model.ts) vs `Fireteam` (types.ts) — same data, different names
  - `WeaponDefinition` (game-model.ts) vs `DatabaseMetadata.weapons` (types.ts) — same data, different field names (`wikiUrl` vs `wiki`, `medium` vs `med`)
  - `ProcessedUnit` (game-model.ts) vs `Unit` (types.ts) — wrapper with Array→Set enrichment
  - Causes: `as unknown as Fireteam[]` casts in BaseDatabase.ts:111 and loader.ts:92
- **Proposed Standard**: Consolidate to game-model.ts as the canonical source. Remove parallel types from types.ts. Any runtime enrichment (Array→Set) should be a database/query concern, not a type-level parallel hierarchy.

## XC-008: Type Escape Hatches
- **Type**: Anti-pattern
- **Affected Modules**: shared/BaseDatabase.ts, backend-ts/agent/gameData/loader.ts
- **Examples**:
  - `as unknown as Fireteam[]` — double cast bypassing type safety (appears twice)
  - `as Record<string, unknown>` — lists route (acceptable for opaque JSONB)
- **Proposed Standard**: Zero `as unknown as X` casts. If types don't align, fix the types. Single-level `as X` casts are acceptable only at system boundaries (e.g., JSONB ↔ typed object) with documented contracts.

## XC-009: Public Mutable State on Data Classes
- **Type**: Anti-pattern
- **Affected Modules**: shared/BaseDatabase.ts, backend-ts/agent/gameData/loader.ts
- **Examples**:
  - BaseDatabase: 15+ public Maps/arrays directly writable by any consumer
  - GameDataLoader: 10+ public properties (units, factions, metadata, etc.)
- **Proposed Standard**: Properties should be `private` or `protected` with public readonly getters. After initialization completes, state should be immutable from the consumer's perspective.
