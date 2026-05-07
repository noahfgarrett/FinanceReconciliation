import { defineConfig } from 'vitest/config'
import path from 'path'

export default defineConfig({
  define: { __APP_VERSION__: JSON.stringify('0.1.0') },
  resolve: { alias: { '@': path.resolve(__dirname, 'src') } },
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: ['./test/setup.ts'],
    // Playwright e2e specs use @playwright/test runner, not vitest.
    exclude: ['node_modules', 'dist', 'e2e/**'],
  },
})
