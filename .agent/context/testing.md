# Testing Strategy

## 1. Unit Tests (Vitest)

Used for core logic, hooks, and components.

- **Run**: `npm test` (watch mode) or `npm test -- --run` (single pass)
- **Environment**: jsdom
- **Location**: Co-located with source (e.g., `Database.test.ts`, `useUnitSearch.test.ts`, `ListBuilder.test.tsx`)
- **Config**: `vite.config.ts` (ignores `/e2e` folder)
- **Libraries**: `@testing-library/react`, `@testing-library/jest-dom`

Key test files:
- `src/services/Database.test.ts` — Database loading and indexing
- `src/hooks/useUnitSearch.test.ts` — Unit search logic
- `src/stores/useListStore.test.ts` — List store actions
- `src/components/ListBuilder/ListBuilder.test.tsx` — List builder UI
- `src/components/DiceCalculator/DiceCalculator.test.tsx` — Dice calculator UI
- `mcp-server/DatabaseAdapter.test.ts` — MCP database adapter

## 2. End-to-End Tests (Playwright)

Used for critical user flows in a real browser.

- **Run**: `npm run test:e2e`
- **Config**: `playwright.config.ts`
- **Location**: `e2e/` folder
- **Dev server**: Playwright auto-starts Vite before testing

Test files:
- `e2e/list-builder.spec.ts` — Faction selection, dashboard, adding units
- `e2e/dice-calculator.spec.ts` — Calculations, panel swapping, mode toggling

Run E2E tests after UI or architectural changes.
