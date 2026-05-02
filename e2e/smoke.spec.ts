import { test, expect } from '@playwright/test';

// Minimal smoke test. Verifies that the SPA boots without throwing — the
// previous suite of UI-flow tests was deleted because it targeted a workspace
// design that no longer exists. See e2e/README.md for what to put back when
// the DOM is stable enough to reattach selectors.
test('SPA boots without console errors', async ({ page }) => {
    const errors: string[] = [];
    page.on('pageerror', e => errors.push(e.message));
    page.on('console', msg => {
        if (msg.type() === 'error' && !msg.text().includes('classifieds.json')) {
            errors.push(msg.text());
        }
    });

    await page.goto('/');
    await expect(page).toHaveTitle(/.+/);
    // Give async init (Database singleton, faction loads) a moment to settle.
    await page.waitForLoadState('networkidle');
    expect(errors).toEqual([]);
});
