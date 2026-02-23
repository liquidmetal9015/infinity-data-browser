# Testing Strategy

Infinity Data Explorer uses a two-pronged testing approach:

## 1. Unit Tests (Vitest)
Used for core logic, hooks, and simple components.
- **Framework**: Vitest (`npm test` to run, `npm test -- --run` for single execution)
- **Environment**: jsdom
- **Files**: Co-located with source files (e.g., `Database.test.ts`, `useUnitSearch.test.ts`)
- `vite.config.ts` explicitly ignores the `/e2e` folder for unit testing.

## 2. End-to-End Tests (Playwright)
Used to verify critical user flows in a real browser.
- **Framework**: Playwright (`npm run test:e2e`)
- **Config**: `/playwright.config.ts`
- **Location**: `/e2e/` folder.
- Playwright automatically spins up the Vite dev server before testing.

### E2E Test Examples
- `/e2e/list-builder.spec.ts`: Verifies faction selection, dashboard rendering, and adding a unit.
- `/e2e/dice-calculator.spec.ts`: Verifies calculation logic, panel swapping, and mode toggling.

Always run `npm run test:e2e` after making UI or architectural changes to verify nothing is broken.
