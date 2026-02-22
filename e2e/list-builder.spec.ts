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

        // Navigate to the List Builder page (HashRouter)
        await page.goto('/#/builder');

        // Wait for the database to initialize and faction cards to appear
        await expect(page.locator('.faction-grid-container')).toBeVisible({ timeout: 15_000 });
    });

    test('should display the faction selector on load', async ({ page }) => {
        // The hero title should be visible
        await expect(page.locator('.faction-selector-hero h1')).toHaveText('Army Builder');

        // There should be multiple super-faction cards rendered
        const factionCards = page.locator('.super-faction-card');
        await expect(factionCards.first()).toBeVisible();
        expect(await factionCards.count()).toBeGreaterThan(0);
    });

    test('should select a faction and show the dashboard', async ({ page }) => {
        // Click the first available sectorial button (not Vanilla)
        const firstSectorial = page.locator('.sectorial-btn').first();
        await firstSectorial.click();

        // The dashboard should appear with the unit roster panel
        await expect(page.locator('.roster-panel')).toBeVisible({ timeout: 10_000 });
        await expect(page.locator('.roster-header h3')).toHaveText('Unit Roster');
    });

    test('should search and add a unit to the list', async ({ page }) => {
        // Select the first available faction
        await page.locator('.sectorial-btn').first().click();
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
        await page.locator('.sectorial-btn').first().click();
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

    test('should share state directly between builder and workspace routes', async ({ page }) => {
        // Start a list
        await page.locator('.sectorial-btn').first().click();
        await expect(page.locator('.roster-panel')).toBeVisible();

        // Add a unit
        await page.locator('.roster-item').first().click();
        await page.waitForTimeout(500);
        const selectBtn = page.getByRole('button', { name: 'Select' }).first();
        if (await selectBtn.isVisible().catch(() => false)) {
            await selectBtn.click();
        }

        const pointsValue = await page.locator('.summary-bar .stat .value').first().textContent();

        // Navigate to the workspace
        await page.goto('/#/workspace');

        // Open the Army Builder widget in the workspace
        await page.locator('.launcher-btn').filter({ hasText: 'Builder' }).click();

        // Inside the workspace widget, the list dashboard should immediately appear (not faction selector)
        const workspaceWidget = page.locator('.window-frame');
        await expect(workspaceWidget.locator('.roster-panel')).toBeVisible({ timeout: 10_000 });

        // The points value inside the widget should match the full-screen page
        const workspacePointsValue = await workspaceWidget.locator('.summary-bar .stat .value').first().textContent();
        expect(workspacePointsValue).toEqual(pointsValue);
    });
});
