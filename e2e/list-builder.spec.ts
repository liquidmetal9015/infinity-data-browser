import { test, expect } from '@playwright/test';

test.describe('List Builder – Golden Path', () => {
    test.beforeEach(async ({ page }) => {
        // Fail tests on console errors or unhandled exceptions (catches React infinite loops)
        page.on('pageerror', exception => {
            expect(exception.message).toBeNull();
        });
        page.on('console', msg => {
            if (msg.type() === 'error') {
                const text = msg.text();
                // Ignore expected missing data or missing mocked images in tests
                if (!text.includes('classifieds.json') && !text.includes('404 (Not Found)')) {
                    expect(text).toBeNull();
                }
            }
        });

        // Navigate to the Workspace (root)
        await page.goto('/');

        // Open the Builder widget via the NavBar tab
        await page.locator('.tab-btn[title*="Builder"]').click();

        // Wait for the database to initialize and faction selector to appear inside the window
        await expect(page.getByRole('button', { name: '— Select Faction —' })).toBeVisible({ timeout: 15_000 });
    });

    test('should display the faction selector on load', async ({ page }) => {
        // The selector should be visible
        await expect(page.getByRole('button', { name: '— Select Faction —' })).toBeVisible();

        // The create button should be disabled initially
        const createBtn = page.getByRole('button', { name: 'Create List' });
        await expect(createBtn).toBeDisabled();
    });

    test('should select a faction and show the dashboard', async ({ page }) => {
        // Select the first available sectorial
        await page.getByRole('button', { name: '— Select Faction —' }).click();
        await page.waitForTimeout(150);
        await page.locator('[role="option"]').first().click();
        await page.getByRole('button', { name: 'Create List' }).click();

        // The dashboard should appear with the unit roster panel
        await expect(page.locator('.roster-panel')).toBeVisible({ timeout: 10_000 });
        await expect(page.locator('.roster-header h3')).toHaveText('Unit Roster');
    });

    test('should search and add a unit to the list', async ({ page }) => {
        // Select the first available faction
        await page.getByRole('button', { name: '— Select Faction —' }).click();
        await page.waitForTimeout(150);
        await page.locator('[role="option"]').first().click();
        await page.getByRole('button', { name: 'Create List' }).click();
        await expect(page.locator('.roster-panel')).toBeVisible({ timeout: 10_000 });

        // Record the initial points value
        const pointsValue = page.locator('.summary-bar .stat .value').first();
        const initialPoints = await pointsValue.textContent();

        // Search for a unit – just type a common prefix to filter the roster
        // First wait for the roster to fully populate
        await expect(page.locator('.roster-list > div').first()).toBeVisible({ timeout: 10_000 });
        const searchInput = page.locator('.roster-search input');
        await searchInput.fill('a');
        await page.waitForTimeout(300);

        // If filter returned nothing, clear it
        if (await page.locator('.roster-list > div').count() === 0) {
            await searchInput.fill('');
            await page.waitForTimeout(200);
        }

        // Click the first unit card header to expand it
        await page.locator('.roster-list > div').first().click();
        await page.waitForTimeout(200);

        // Now click the first loadout option row to add the unit
        const optionRow = page.locator('.roster-list [class*="flex items-stretch border"]').first();
        await optionRow.click();

        // A unit row should now be visible in the army list
        const unitRow = page.locator('.unit-row');
        await expect(unitRow.first()).toBeVisible({ timeout: 10_000 });

        // The points total should have changed (increased from the initial value)
        const updatedPoints = await pointsValue.textContent();
        expect(updatedPoints).not.toEqual(initialPoints);
    });

    test('should persist the army list across page reloads (Zustand persist)', async ({ page }) => {
        // Start a list and add something
        await page.getByRole('button', { name: '— Select Faction —' }).click();
        await page.waitForTimeout(150);
        await page.locator('[role="option"]').first().click();
        await page.getByRole('button', { name: 'Create List' }).click();
        await expect(page.locator('.roster-panel')).toBeVisible();

        const pointsValue = page.locator('.summary-bar .stat .value').first();
        const initialPoints = await pointsValue.textContent();

        // Wait for roster items, expand first card, and click first loadout option to add
        await expect(page.locator('.roster-list > div').first()).toBeVisible({ timeout: 10_000 });
        await page.locator('.roster-list > div').first().click();
        await page.waitForTimeout(200);
        await page.locator('.roster-list [class*="flex items-stretch border"]').first().click();

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
