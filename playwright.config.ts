import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: './tests/e2e', fullyParallel: false, workers: 1, retries: 0, timeout: 90000,
  expect: { timeout: 5000 },
  use: { baseURL: 'http://127.0.0.1:5174', browserName: 'chromium', actionTimeout: 5000, viewport: { width: 1440, height: 1100 }, trace: 'retain-on-failure', screenshot: 'only-on-failure' },
  webServer: [
    { command: 'npm run build -w @shadow-clash/shared && node --import tsx apps/server/src/index.ts', url: 'http://127.0.0.1:3002/health', reuseExistingServer: false, timeout: 30000, env: { SERVER_PORT: '3002', ALLOWED_ORIGIN: 'http://127.0.0.1:5174' } },
    { command: 'npm run dev -w @shadow-clash/client -- --port 5174 --mode test', url: 'http://127.0.0.1:5174', reuseExistingServer: false, timeout: 30000, env: { SERVER_PORT: '3002' } },
  ],
});
