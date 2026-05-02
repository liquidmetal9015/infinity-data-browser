# Phase 2: Backend — Findings

**Overall Assessment**: The backend is notably well-structured — small, focused, and clean. Hono + Zod-OpenAPI is used effectively. The code is readable, routes are well-documented, and the agent system has good separation of concerns. Few issues found, mostly minor.

---

## 2.1: backend-ts/src/db/schema.ts (51 LoC) + config.ts (43 LoC)

### Positive Notes
- Schema is appropriately minimal (user data only, game data stays in static JSON)
- Config uses Zod validation — environment issues surface at startup
- Production safety guard (DEV_AUTH=true blocks production start)
- Good comment explaining schema scope

### Findings

#### [F-036] schema.ts tags default is `[""]` not `[]` — bug
- **Category**: C1 (Correctness)
- **Severity**: Major
- **Effort**: XS
- **Location**: `backend-ts/src/db/schema.ts:27`
- **Issue**: `.default([""])` sets the default value for `tags` to an array containing one empty string `[""]`, not an empty array `[]`. This means newly created army lists that don't specify tags will have a phantom empty tag. Frontend filtering/display code must handle this edge case, and tag counts will be off-by-one.
- **Suggestion**: Change to `.default([])` — though this may require a migration if existing rows already have `[""]`. Check if this matches Drizzle's SQL generation expectations for PostgreSQL `varchar[]`.

#### [F-037] asyncpg URL prefix replacement is legacy artifact
- **Category**: B1 (YAGNI)
- **Severity**: Nitpick
- **Effort**: XS
- **Location**: `backend-ts/src/config.ts:22`
- **Issue**: `.replace('postgresql+asyncpg://', 'postgresql://')` handles a Python/SQLAlchemy connection string format. If the deployment environment now always provides a standard PostgreSQL URL, this is dead code. If the same env var is shared with a Python service, it's necessary.
- **Suggestion**: Add a comment explaining whether this is still needed, or remove if Python backend is fully retired.

---

## 2.2: backend-ts/src/auth/ (middleware.ts 70 LoC + firebase.ts 33 LoC)

### Positive Notes
- Clean middleware pattern with typed variables (`AuthVars`)
- Atomic upsert for user provisioning (insert → onConflictDoNothing → select)
- Firebase initialization with graceful fallback chain
- Dev-mode bypass is simple and guarded

### Findings

#### [F-038] Email null edge case with NOT NULL schema constraint
- **Category**: B4 (Error Handling)
- **Severity**: Minor
- **Effort**: XS
- **Location**: `backend-ts/src/auth/firebase.ts:31` + `backend-ts/src/db/schema.ts:9`
- **Issue**: `verifyIdToken` returns `email: string | null`. The middleware checks `!decoded.email` and returns 401 (correct). However, if a token somehow passes with a null email in the future (e.g., non-Google auth method), the `provisionUser` call would fail at the database level due to the `NOT NULL` constraint on `users.email`. The 401 guard currently prevents this, but the defense is fragile — a code change removing the `!decoded.email` check would cause a 500.
- **Suggestion**: Add a comment at the schema level noting the NOT NULL dependency on auth middleware filtering, or make email nullable in the schema with a default fallback.

---

## 2.3: backend-ts/src/routes/lists.ts (263 LoC)

### Positive Notes
- Excellent use of Zod-OpenAPI: schemas self-document the API
- Clean helper functions (`toSummary`, `toDetail`, `unitCount`)
- Opaque `units_json` is well-documented and pragmatic
- All routes enforce user ownership (`where(and(eq(army_lists.id, listId), eq(army_lists.user_id, user.id)))`)
- Consistent error responses (404 for not-found, 401 for unauth)

### Findings

#### [F-039] No pagination on list endpoint
- **Category**: C2 (Performance)
- **Severity**: Minor
- **Effort**: S
- **Location**: `backend-ts/src/routes/lists.ts:121-129`
- **Issue**: `GET /api/lists` returns ALL lists for a user with no pagination (`limit`/`offset`). For a user with dozens of lists (each containing a 50KB+ `units_json` blob), the response could be large. However, the route only returns summaries (not `units_json`), so payload size is bounded. This is acceptable for now but could become an issue at scale.
- **Suggestion**: No immediate change needed. If user list counts grow significantly, add cursor-based pagination. The summary-only approach already mitigates the biggest concern.

---

## 2.4: backend-ts/src/agent/ (~500 LoC across 7 files)

### Positive Notes
- Clean Strategy pattern for LLM providers (`LLMProvider` interface)
- Good separation: `agent.ts` (orchestration), `providers/` (LLM communication), `tools/` (game data operations), `gameData/` (data loading)
- `ToolExecutor` registry pattern is extensible — add a tool by adding handler + definition
- `GameDataLoader.ready()` pattern handles race conditions between startup and first request
- Tool definitions have excellent descriptions for LLM comprehension
- Output capping (ROSTER_CAP, LOADOUT_CAP) prevents token-bomb responses

### Findings

#### [F-040] GameDataLoader duplicates BaseDatabase's data loading pattern
- **Category**: A3 (DRY)
- **Severity**: Minor
- **Effort**: L
- **Location**: `backend-ts/src/agent/gameData/loader.ts` (entire file)
- **Issue**: `GameDataLoader` reimplements the same pattern as `shared/BaseDatabase.ts` — loading processed JSON files, deduplicating by ISC, building Maps by slug/ID/faction. It stores `ProcessedUnit` directly (not the enriched `Unit` type), but the loading logic is structurally identical. Two parallel implementations of the same data loading exist in the codebase.
- **Suggestion**: Could extend `BaseDatabase` with a Node.js implementation of the abstract methods. However, `GameDataLoader` intentionally works with `ProcessedUnit` (not `Unit`) because the agent doesn't need Set-based search indexes. The duplication is moderate — if `BaseDatabase` were refactored to not force `Unit` wrapper creation, the loader could reuse it. Low priority since the backend is small and stable.

#### [F-041] `as unknown as Fireteam[]` type cast in loader.ts
- **Category**: C1 (Type Safety)
- **Severity**: Minor
- **Effort**: XS (fix by resolving F-006)
- **Location**: `backend-ts/src/agent/gameData/loader.ts:92`
- **Issue**: Same type escape hatch as F-018 in BaseDatabase. Same root cause: parallel fireteam type hierarchies.
- **Suggestion**: Resolving F-006 eliminates this.

#### [F-042] ErrorSchema duplicated between lists.ts and agent.ts
- **Category**: A3 (DRY)
- **Severity**: Nitpick
- **Effort**: XS
- **Location**: `backend-ts/src/routes/lists.ts:60` and `backend-ts/src/routes/agent.ts:49`
- **Issue**: Both route files define identical `ErrorSchema = z.object({ detail: z.union([z.string(), z.array(z.unknown())]) }).openapi('Error')`. Minor duplication.
- **Suggestion**: Extract to a shared schemas file (e.g., `backend-ts/src/routes/schemas.ts`) and import in both.

---

## 2.5: backend-ts/src/app.ts (57 LoC) + index.ts (17 LoC)

### Positive Notes
- Clean app composition (middleware → routes → SPA fallback)
- Graceful shutdown with pool cleanup
- SPA root auto-detection (`public` or `dist`)
- Fire-and-forget initialization with `void` prefix
- Dev user provisioning isolated in devAuth guard

### Findings

#### [F-043] GameDataLoader.initialize is fire-and-forget
- **Category**: B4 (Error Handling)
- **Severity**: Minor
- **Effort**: XS
- **Location**: `backend-ts/src/app.ts:49`
- **Issue**: `void GameDataLoader.getInstance().initialize(config.dataDir)` — if initialization fails (e.g., data directory missing, JSON parse error), the error is swallowed by the `void`. The agent routes call `loader.ready()` which would hang forever since `initPromise` never resolves. However, looking at `loader.ts`, errors in sub-loads (metadata, factions) are handled with `null` returns, so the promise WILL resolve — just with empty data. A complete failure (e.g., permission error) could still hang.
- **Suggestion**: Add `.catch(e => console.error('GameDataLoader init failed:', e))` to surface catastrophic failures. Or ensure `runInit` catches and logs before resolving.

---

## Phase 2 Summary

| Unit | Findings | Critical | Major | Minor | Nitpick |
|------|----------|----------|-------|-------|---------|
| 2.1 schema.ts + config.ts | 2 | 0 | 1 | 0 | 1 |
| 2.2 auth/ | 1 | 0 | 0 | 1 | 0 |
| 2.3 routes/lists.ts | 1 | 0 | 0 | 1 | 0 |
| 2.4 agent/ | 3 | 0 | 0 | 2 | 1 |
| 2.5 app.ts + index.ts | 1 | 0 | 0 | 1 | 0 |
| **Total** | **8** | **0** | **1** | **5** | **2** |

### Key Observations
- Backend is notably well-structured — small surface area, good patterns
- Only 1 Major finding (tags default bug) which is an XS fix
- The parallel data loading pattern (F-040) is the biggest structural concern but low priority given the backend's stability
- Cross-cutting: the `as unknown as Fireteam[]` cast (F-041) reappears — confirming XC pattern from Phase 1
