# E2E tests

This directory is intentionally empty. The previous Playwright specs targeted a
workspace UI design that has since been replaced (workspace tabs, faction
selector, etc.) and were stale long before the May 2026 backend cleanup. They
were removed rather than rewritten so the empty `npm run test:e2e` doesn't
report false failures.

The Playwright runner stays wired up via `playwright.config.ts` and
`npm run test:e2e` so a future effort can drop new specs in here without
re-installing the toolchain.

## When to add specs back

A useful E2E suite for this project would cover at minimum:

- Sign-in flow (Google OAuth happy path with mocked Firebase)
- Create / rename / delete an army list end-to-end
- Open the workspace, drag a unit into a combat group, save, reload, see it persist
- Send an AI agent message and observe a tool-call reply (with provider mocked)

Before writing them: stabilise the DOM with `data-testid` attributes on the
target elements (the workspace, list rows, the agent panel). The previous specs
broke because they used class-name selectors that mutated on every UI tweak.
