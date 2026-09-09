import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

import { defineConfig, devices } from '@playwright/test';

const e2eRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'armory-e2e-'));
const port = process.env.ARMORY_E2E_PORT?.trim() || '3102';
const baseURL = `http://127.0.0.1:${port}`;

export default defineConfig({
  testDir: './e2e',
  fullyParallel: true,
  forbidOnly: Boolean(process.env.CI),
  retries: process.env.CI ? 1 : 0,
  workers: 1,
  reporter: process.env.CI ? 'github' : 'list',
  use: {
    baseURL,
    trace: 'on-first-retry',
  },
  webServer: {
    command: 'node dist/server/index.js',
    url: `${baseURL}/healthz`,
    reuseExistingServer: !process.env.CI,
    timeout: 30_000,
    env: {
      NODE_ENV: 'test',
      HOST: '127.0.0.1',
      PORT: port,
      SESSION_SECRET: 'armory-dev-only-session-secret-32ch',
      ARMORY_DB_PATH: path.join(e2eRoot, 'catalog.db'),
      USER_DB_PATH: path.join(e2eRoot, 'user.db'),
      SESSION_DB_PATH: path.join(e2eRoot, 'session.db'),
      APP_PUBLIC_BASE_URL: baseURL,
      CLERK_PUBLISHABLE_KEY: '',
      CLERK_SECRET_KEY: '',
      VITE_CLERK_PUBLISHABLE_KEY: '',
    },
  },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
});
