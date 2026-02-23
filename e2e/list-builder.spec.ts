import { test, expect } from '@playwright/test';

test.describe('List Builder – Golden Path', () => {
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

        // Navigate to the Workspace (root)
        await page.goto('/');

        // Open the Builder widget via the NavBar tab
        await page.locator('.tab-btn[title*="Builder"]').click();

        // Wait for the database to initialize and faction selector to appear inside the window
        await expect(page.locator('.window-frame .compact-faction-selector')).toBeVisible({ timeout: 15_000 });
    });

    test('should display the faction selector on load', async ({ page }) => {
        // The compact selector should be visible
        await expect(page.locator('.compact-faction-selector')).toBeVisible();

        // The create button should be disabled initially
        const createBtn = page.getByRole('button', { name: 'Create List' });
        await expect(createBtn).toBeDisabled();
    });

    test('should select a faction and show the dashboard', async ({ page }) => {
        // Select the first available sectorial
        await page.locator('.faction-select').selectOption({ index: 1 });
        await page.getByRole('button', { name: 'Create List' }).click();

        // The dashboard should appear with the unit roster panel
        await expect(page.locator('.roster-panel')).toBeVisible({ timeout: 10_000 });
        await expect(page.locator('.roster-header h3')).toHaveText('Unit Roster');
    });

    test('should search and add a unit to the list', async ({ page }) => {
        // Select the first available faction
        await page.locator('.faction-select').selectOption({ index: 1 });
        await page.getByRole('button', { name: 'Create List' }).click();
        await expect(page.locator('.roster-panel')).toBeVisible({ timeout: 10_000 });

        // Record the initial points value
        const pointsValue = page.locator('.summary-bar .stat .value').first();
        const initialPoints = await pointsValue.textContent();

        // Search for a unit – just type a common prefix to filter the roster
        const searchInput = page.locator('.roster-search input');
        await searchInput.fill('f');

        // Wait for roster to filter
        await page.waitForTimeout(300);

        // The roster should still have items after filtering
        const rosterItems = page.locator('.roster-item');
        expect(await rosterItems.count()).toBeGreaterThan(0);

        // Click the first matching roster item to add it
        await rosterItems.first().click();

        // Wait for either: a unit to appear in the table, or a modal to open for loadout selection
        const unitRow = page.locator('.unit-row');

        // The UnitStatsModal in selection mode shows a "Select" button.
        // Wait briefly then check if a modal appeared.
        await page.waitForTimeout(500);

        const selectBtn = page.getByRole('button', { name: 'Select' }).first();
        if (await selectBtn.isVisible().catch(() => false)) {
            await selectBtn.click();
        }

        // A unit row should now be visible in the army list
        await expect(unitRow.first()).toBeVisible({ timeout: 10_000 });

        // The points total should have changed (increased from the initial value)
        const updatedPoints = await pointsValue.textContent();
        expect(updatedPoints).not.toEqual(initialPoints);
    });

    test('should persist the army list across page reloads (Zustand persist)', async ({ page }) => {
        // Start a list and add something
        await page.locator('.faction-select').selectOption({ index: 1 });
        await page.getByRole('button', { name: 'Create List' }).click();
        await expect(page.locator('.roster-panel')).toBeVisible();

        const pointsValue = page.locator('.summary-bar .stat .value').first();
        const initialPoints = await pointsValue.textContent();

        const rosterItems = page.locator('.roster-item');
        await rosterItems.first().click();

        await page.waitForTimeout(500);
        const selectBtn = page.getByRole('button', { name: 'Select' }).first();
        if (await selectBtn.isVisible().catch(() => false)) {
            await selectBtn.click();
        }

        const updatedPoints = await pointsValue.textContent();
        expect(updatedPoints).not.toEqual(initialPoints);

        // Reload the page
        await page.reload();

        // Should completely skip the faction selector and go straight to dashboard
        await expect(page.locator('.roster-panel')).toBeVisible({ timeout: 10_000 });

        // The points should be the same as right before the reload
        const reloadedPoints = await pointsValue.textContent();
        expect(reloadedPoints).toEqual(updatedPoints);
    });
});
