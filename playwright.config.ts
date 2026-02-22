import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
    testDir: './e2e',
    fullyParallel: true,
    forbidOnly: !!process.env.CI,
    retries: process.env.CI ? 2 : 0,
    workers: process.env.CI ? 1 : undefined,
    reporter: 'html',

    use: {
        // The app uses HashRouter, so baseURL is the root
        baseURL: 'http://localhost:5173/infinity-data-browser/',
        trace: 'on-first-retry',
    },

    projects: [
        {
            name: 'chromium',
            use: { ...devices['Desktop Chrome'] },
        },
    ],

    // Auto-start the Vite dev server before running E2E tests
    webServer: {
        command: 'npm run dev',
        url: 'http://localhost:5173/infinity-data-browser/',
        reuseExistingServer: !process.env.CI,
        timeout: 30_000,
    },
});
