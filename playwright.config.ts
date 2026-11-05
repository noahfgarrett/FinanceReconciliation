import { defineConfig, devices } from '@playwright/test'

// By default the suite builds the app and serves it locally with `vite preview`.
// Set RECON_BASE_URL to run against an already-running server or the hosted copy.
const PORT = 4173
const externalBaseURL = process.env.RECON_BASE_URL
const baseURL = externalBaseURL ?? `http://localhost:${PORT}/`

export default defineConfig({
  testDir: './e2e',
  globalSetup: './e2e/global-setup.ts',
  fullyParallel: false,
  forbidOnly: !!process.env.CI,
  retries: 0,
  workers: 1,
  reporter: process.env.CI ? [['list'], ['html', { open: 'never' }]] : 'list',
  timeout: 60_000,
  use: {
    baseURL,
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
    video: 'off',
  },
  webServer: externalBaseURL
    ? undefined
    : {
        // Plain `vite build` (not `npm run build`) so the output keeps the
        // index.html name that `vite preview` serves at /.
        command: `npx vite build --outDir e2e/.dist --emptyOutDir && npx vite preview --outDir e2e/.dist --port ${PORT} --strictPort`,
        url: baseURL,
        reuseExistingServer: !process.env.CI,
        timeout: 180_000,
      },
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],
})
