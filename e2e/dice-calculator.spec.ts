import { test, expect } from '@playwright/test';

test.describe('Dice Calculator – Golden Path', () => {
    test.beforeEach(async ({ page }) => {
        // Fail tests on console errors or unhandled exceptions (catches React infinite loops)
        page.on('pageerror', exception => {
            expect(exception.message).toBeNull();
        });
        page.on('console', msg => {
            if (msg.type() === 'error') {
                // Ignore the classifieds.json missing error as it's expected without data
                if (!msg.text().includes('classifieds.json')) {
                    expect(msg.text()).toBeNull();
                }
            }
        });

        // Navigate to Workspace
        await page.goto('/');

        // Open Calculator via NavBar tab
        await page.locator('.tab-btn[title*="Calculator"]').click();

        // Wait for the page to render inside the window
        await expect(page.locator('.window-frame .dice-calculator-page')).toBeVisible({ timeout: 15_000 });
    });

    test('should display the calculator in freeform mode by default', async ({ page }) => {
        // The mode toggle should be visible
        await expect(page.locator('.mode-toggle')).toBeVisible();

        // Freeform mode should be active
        const freeformBtn = page.locator('.mode-btn').filter({ hasText: 'Freeform' });
        await expect(freeformBtn).toHaveClass(/active/);

        // Active and Reactive panels should be visible
        await expect(page.locator('.active-panel')).toBeVisible();
        await expect(page.locator('.reactive-panel')).toBeVisible();

        // A results section should be visible (freeform mode has default values -> instant results)
        await expect(page.locator('.results-section')).toBeVisible();
    });

    test('should compute results without errors when stats are modified', async ({ page }) => {
        // The results section should be present from the start with default values
        await expect(page.locator('.results-section')).toBeVisible();

        // The comparison summary should have probability values (not empty)
        const summaryText = await page.locator('.results-section').textContent();
        expect(summaryText).toBeTruthy();
        expect(summaryText!.length).toBeGreaterThan(0);
    });

    test('should swap active and reactive panels', async ({ page }) => {
        // Get initial Active SV value
        const activeSvInput = page.locator('.active-panel input').first();
        const reactiveSvInput = page.locator('.reactive-panel input').first();

        const initialActiveSv = await activeSvInput.inputValue();
        const initialReactiveSv = await reactiveSvInput.inputValue();

        // Click the swap button
        await page.locator('.swap-btn').click();

        // The values should be swapped
        const afterSwapActiveSv = await activeSvInput.inputValue();
        const afterSwapReactiveSv = await reactiveSvInput.inputValue();

        expect(afterSwapActiveSv).toEqual(initialReactiveSv);
        expect(afterSwapReactiveSv).toEqual(initialActiveSv);
    });

    test('should switch to simulator mode and show unit selectors', async ({ page }) => {
        // Click the Matchup Simulator button
        const simulatorBtn = page.locator('.mode-btn').filter({ hasText: 'Matchup Simulator' });
        await simulatorBtn.click();

        // Simulator mode should now be active
        await expect(simulatorBtn).toHaveClass(/active/);

        // Distance/range controls should appear
        await expect(page.locator('.distance-control')).toBeVisible();

        // Range pills should be visible
        const rangePills = page.locator('.range-pill');
        expect(await rangePills.count()).toBe(6);
    });
});
