import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

import { defineConfig, devices } from '@playwright/test';

import {
  clerkFrontendApiOrigin,
  readSignedInClerk,
  signedInStorageState,
} from './e2e/signedInClerk.js';

const e2eRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'armory-e2e-'));
const port = process.env.ARMORY_E2E_PORT?.trim() || '3102';
const baseURL = `http://127.0.0.1:${port}`;
const clerk = readSignedInClerk();
const signedInPort = '4102';
const signedInURL = `http://127.0.0.1:${signedInPort}`;
const signedInRoot = clerk ? fs.mkdtempSync(path.join(os.tmpdir(), 'armory-e2e-signed-in-')) : '';
const browser = { ...devices['Desktop Chrome'], locale: 'en-US' as const };

const signedOutServer = {
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
    COOKIE_DOMAIN: '',
    SECURE_COOKIES: '0',
    CLERK_PUBLISHABLE_KEY: '',
    CLERK_SECRET_KEY: '',
    VITE_CLERK_PUBLISHABLE_KEY: '',
  },
};

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
  webServer: clerk
    ? [
        signedOutServer,
        {
          command: 'node scripts/e2e-signed-in.mjs',
          url: `${signedInURL}/healthz`,
          reuseExistingServer: false,
          timeout: 120_000,
          env: {
            ...signedOutServer.env,
            PORT: signedInPort,
            ARMORY_DB_PATH: path.join(signedInRoot, 'catalog.db'),
            USER_DB_PATH: path.join(signedInRoot, 'user.db'),
            SESSION_DB_PATH: path.join(signedInRoot, 'session.db'),
            APP_PUBLIC_BASE_URL: signedInURL,
            CLERK_PUBLISHABLE_KEY: clerk.publishable,
            CLERK_SECRET_KEY: clerk.secret,
            VITE_CLERK_PUBLISHABLE_KEY: clerk.publishable,
            CLERK_FAPI_URL: clerkFrontendApiOrigin(clerk.publishable),
            E2E_CLIENT_DIR: path.resolve('dist/e2e-client'),
          },
        },
      ]
    : signedOutServer,
  projects: [
    {
      name: 'chromium',
      testIgnore: /signed-in\.spec\.ts|auth\.setup\.ts/,
      use: browser,
    },
    ...(clerk
      ? [
          {
            name: 'clerk-setup',
            testMatch: /auth\.setup\.ts/,
            use: { ...browser, baseURL: signedInURL },
          },
          {
            name: 'signed-in',
            testMatch: /signed-in\.spec\.ts/,
            dependencies: ['clerk-setup'],
            use: { ...browser, baseURL: signedInURL, storageState: signedInStorageState },
          },
        ]
      : []),
  ],
});
