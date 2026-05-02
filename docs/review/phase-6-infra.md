# Phase 6: Infrastructure & Cross-Cutting — Findings

**Overall Assessment**: Infrastructure is lean and well-configured for the project size. The Dockerfile uses multi-stage builds correctly. Terraform provisions GCP resources with Workload Identity Federation (keyless CI/CD). CI/CD pipelines handle both static (GitHub Pages) and full-stack (Cloud Run) deployments. Build config is standard Vite + ESLint + TypeScript. The main issue is the styling architecture — three competing approaches (CSS Modules, Tailwind, inline styles) with documented conflicts between them.

---

## 6.1: Dockerfile (33 LoC) + docker-compose.yml (18 LoC)

### Positive Notes
- Multi-stage build minimizes image size (alpine base, only prod deps in final stage)
- Frontend build separate from backend — no dev dependencies in production image
- `shared/` copied into backend build stage for path alias resolution
- docker-compose is minimal — just PostgreSQL for local development

### Findings

#### [F-081] No `.dockerignore` file observed — copies entire context
- **Category**: C2 (Performance)
- **Severity**: Minor
- **Effort**: XS
- **Location**: `Dockerfile:5` (`COPY . .`)
- **Issue**: The frontend stage copies the entire repo context (`COPY . .`). Without a `.dockerignore`, this includes `node_modules/`, `.git/`, `data/` (potentially large JSON files), `ai-tmp/`, test files, etc. This bloats the Docker build context and slows builds.
- **Suggestion**: Create `.dockerignore`:
  ```
  node_modules
  .git
  ai-tmp
  data
  dist
  coverage
  *.md
  ```

#### [F-082] `deletion_protection = false` on Cloud SQL
- **Category**: B4 (Safety)
- **Severity**: Minor
- **Effort**: XS
- **Location**: `terraform/main.tf:12`
- **Issue**: `deletion_protection = false` allows `terraform destroy` to delete the production database. The comment says "Prevent accidental destruction" but the value is `false`. This is likely correct for the current development stage but should be flipped before production holds real user data.
- **Suggestion**: Set to `true` when user data becomes valuable. Or use a variable: `deletion_protection = var.environment == "prod"`.

---

## 6.2: terraform/ (174 LoC + 14 LoC + 24 LoC)

### Positive Notes
- Workload Identity Federation for keyless CI/CD — security best practice
- Cloud SQL + Cloud Run + Secret Manager — well-architected GCP setup
- Lifecycle `ignore_changes` on container image prevents Terraform rollback of deploys
- Service account permissions are minimal/scoped (run.admin, sql.client, artifactregistry.admin)

### Findings

#### [F-083] DATABASE_URL uses `postgresql+asyncpg://` prefix (Python format)
- **Category**: C3 (Consistency)
- **Severity**: Nitpick
- **Effort**: XS
- **Location**: `terraform/main.tf:50`
- **Issue**: The DATABASE_URL env var uses `postgresql+asyncpg://` — the Python/SQLAlchemy format. The TypeScript backend has a `.replace()` to strip this prefix (noted in F-037). Since the Python backend is retired, this could be simplified to standard `postgresql://` in the Terraform config.
- **Suggestion**: Change to `postgresql://` once confirmed no other consumer needs the asyncpg prefix.

#### [F-084] No Terraform state backend configured
- **Category**: B4 (Operational Safety)
- **Severity**: Minor
- **Effort**: S
- **Location**: `terraform/provider.tf`
- **Issue**: No `backend` block — Terraform state defaults to local file. If the state file is lost (laptop failure, new dev machine), Terraform loses track of all managed resources. For a solo-developer project this is manageable but risky.
- **Suggestion**: Add GCS backend when ready: `terraform { backend "gcs" { bucket = "infinity-tfstate" } }`.

---

## 6.3: Build Config (vite, eslint, tsconfig, tailwind)

### Positive Notes
- Vite config is clean: path alias `@shared`, CSS modules with camelCase, dev proxy to backend
- ESLint config is modern (flat config) with focused rules (unused vars ignoring `_` prefix)
- TypeScript uses project references (app + node)
- Tailwind config extends with CSS custom properties — enables theme switching

### Findings

#### [F-085] Tailwind has legacy `cyber` theme AND new CSS variable-based theme
- **Category**: A3 (DRY / Dead Code)
- **Severity**: Minor
- **Effort**: S
- **Location**: `tailwind.config.js:14-25`
- **Issue**: The `cyber.*` color palette (lines 14-25) appears to be a legacy theme that's been superseded by the CSS variable-based `bg.*`, `text.*`, `surface.*`, `accent.*` tokens (lines 27-52). Having both in config means developers could accidentally use `cyber-cyan` instead of `accent` in new code.
- **Suggestion**: Check if any component still uses `cyber.*` classes. If not, remove the legacy palette.

---

## 6.4: scripts/process-data.ts (717 LoC)

### Positive Notes
- Well-structured ETL: reads raw CB JSON, transforms to processed format
- Uses `shared/game-model.ts` types — ETL output matches what consumers expect
- Movement unit conversion (cm → inches) centralized with clear threshold
- Constants extracted (`PERIPHERAL_SKILL_ID`, `MOVEMENT_CM_THRESHOLD`)

### Findings

#### [F-086] No findings for ETL script
- The script is a one-pass transformation that's well-typed and uses the canonical `game-model.ts` types. Error handling at file boundaries is appropriate (fail fast if source files are missing). No issues identified.

---

## 6.5: .github/workflows/ (pages.yml + production.yml)

### Positive Notes
- Two clean deployment targets: GitHub Pages (static) and Cloud Run (full-stack)
- Workload Identity Federation (no stored credentials for GCP)
- Lint job is comprehensive: Python (Ruff + mypy), Frontend (ESLint + tsc), Backend-ts (ESLint + tsc)
- `workflow_dispatch` trigger — deliberate deployments, not on every push

### Findings

#### [F-087] Production workflow lints retired Python backend
- **Category**: B1 (YAGNI)
- **Severity**: Minor
- **Effort**: XS
- **Location**: `.github/workflows/production.yml:22-39`
- **Issue**: The lint job installs Python, uv, and runs `ruff format`, `ruff check`, and `mypy` on `./backend/`. If the Python backend is retired (TypeScript backend is the production server), this adds ~30s to CI for no value. However, it's retained for Alembic migration linting — the Python code still manages DB migrations.
- **Suggestion**: If Alembic is the only remaining Python code, consider migrating to Drizzle migrations. If kept, add a comment explaining why Python lint is still needed.

#### [F-088] No test step in either workflow
- **Category**: C4 (Testability)
- **Severity**: Minor
- **Effort**: S
- **Location**: Both workflow files
- **Issue**: Neither CI pipeline runs tests. The project has test files (`*.test.ts`) with Vitest configured but they're not executed in CI. This means regressions can ship to production without being caught.
- **Suggestion**: Add `npm test` step after lint in the pages workflow. For production, add after the lint job: `run: npm test -- --run` and `run: cd backend-ts && npm test`.

---

## 6.6: Styling Architecture

### Assessment

The project uses **three competing styling approaches**:

| Approach | Where Used | Files |
|----------|-----------|-------|
| CSS Modules | ListBuilder, Workspace, AIPanel, DiceCalculator, NavBar | ~15 `.module.css` files |
| Inline `style={{}}` | Pages (MyLists, Search, Reference), some Panels | ~70+ style blocks in MyLists alone |
| Tailwind utilities | Some components, `className` usage | Sparse, partially broken (see below) |

### Findings

#### [F-089] Global CSS in `index.css` overrides Tailwind utilities
- **Category**: A4 (Dependency Direction)
- **Severity**: Major
- **Effort**: M
- **Location**: `src/index.css` (mentioned in component comments at `UnitDetailPanel.tsx:120` and `UnitRosterPanel.tsx:342`)
- **Issue**: Components have comments like "Tailwind py-N/px-N don't work here — see index.css cascade note" and "use inline styles for any padding that must actually take effect." This means global CSS specificity overrides utility classes, forcing developers to use inline styles as workarounds. This is why MyLists.tsx has 74 inline style blocks — developers learned that utility classes are unreliable.
- **Suggestion**: Audit `index.css` for overly-specific selectors. Either scope them to specific components or increase Tailwind's specificity (`important: true` in config, or use CSS layers). This is likely the root cause of the inline style explosion.

#### [F-090] No clear styling standard or migration path
- **Category**: A2 (Separation of Concerns)
- **Severity**: Minor
- **Effort**: L (across project)
- **Location**: Project-wide
- **Issue**: Three competing approaches with no documented standard. New code can't easily determine which to use. CSS Modules are the most consistent pattern (used in well-structured components), but pages default to inline styles.
- **Suggestion**: Document the standard: CSS Modules for component-scoped styles, Tailwind for utility/layout (once `index.css` conflicts are resolved), inline only for truly dynamic values (e.g., calculated positions in the workspace). Add to CLAUDE.md or a style guide.

---

## Phase 6 Summary

| Unit | Findings | Critical | Major | Minor | Nitpick |
|------|----------|----------|-------|-------|---------|
| 6.1 Dockerfile + docker-compose | 1 | 0 | 0 | 1 | 0 |
| 6.2 terraform/ | 2 | 0 | 0 | 1 | 1 |
| 6.3 Build config | 1 | 0 | 0 | 1 | 0 |
| 6.4 scripts/process-data.ts | 0 | 0 | 0 | 0 | 0 |
| 6.5 .github/workflows/ | 2 | 0 | 0 | 2 | 0 |
| 6.6 Styling architecture | 2 | 0 | 1 | 1 | 0 |
| **Total** | **8** | **0** | **1** | **6** | **1** |

### Key Observations
- The styling architecture conflict (F-089) is the root cause of the inline style explosion found in Phase 5 (F-069). These should be remediated together.
- Infrastructure is appropriately scaled — no over-engineering for a solo-developer project
- CI/CD security (Workload Identity Federation) is excellent
- Missing test step in CI is the most actionable gap
- The Python backend lint/migration step is the only remaining dependency on the retired Python codebase
