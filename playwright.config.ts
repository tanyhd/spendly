import { defineConfig, devices } from '@playwright/test';

// End-to-end tests: real browsers driving Spendly, against the app on port 3100 with an
// in-memory database (e2e/start-app.mjs), never Atlas. See e2e/README.md.
export default defineConfig({
    testDir: 'e2e',
    timeout: 90_000,
    expect: { timeout: 15_000 },
    // Every test signs up its own user, so tests can run side by side
    fullyParallel: true,
    workers: process.env.CI ? 2 : 3,
    retries: process.env.CI ? 1 : 0,
    reporter: [['list'], ['html', { open: 'never', outputFolder: 'e2e-report' }]],
    use: {
        baseURL: 'http://localhost:3100',
        // SLOW_MO=500 waits between actions, to watch a headed run
        launchOptions: { slowMo: Number(process.env.SLOW_MO ?? 0) },
        trace: 'retain-on-failure',
        screenshot: 'only-on-failure',
    },
    projects: [
        { name: 'desktop', use: { ...devices['Desktop Chrome'], viewport: { width: 1280, height: 800 } } },
        { name: 'phone', use: { ...devices['Pixel 7'], viewport: { width: 390, height: 844 } } },
    ],
    webServer: {
        command: 'node e2e/start-app.mjs',
        url: 'http://localhost:3100/login',
        reuseExistingServer: !process.env.CI,
        timeout: 180_000,
    },
});
