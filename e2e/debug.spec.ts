import { test } from '@playwright/test';
test('debug', async ({ page }) => {
  page.on('console', msg => console.log('BROWSER CONSOLE:', msg.text()));
  page.on('pageerror', err => console.log('BROWSER PAGEERROR:', err.message));
  await page.goto('/#/calculator');
  await page.waitForTimeout(2000);
});
