import path from 'node:path';

import react from '@vitejs/plugin-react';
import { defaultExclude, defineConfig } from 'vitest/config';

const testEnv = {
  NODE_ENV: 'test',
  SESSION_SECRET: 'armory-dev-only-session-secret-32ch',
  APP_PUBLIC_BASE_URL: 'http://127.0.0.1:3002',
  CLERK_PUBLISHABLE_KEY: '',
  CLERK_SECRET_KEY: '',
  VITE_CLERK_PUBLISHABLE_KEY: '',
} as const;

const coverage = {
  provider: 'v8' as const,
  all: true,
  reporter: ['text-summary', 'html'],
  reportsDirectory: 'coverage',
  include: ['server/**/*.ts', 'client/utils/**/*.ts', 'shared/**/*.ts', 'scripts/**/*.mjs'],
  exclude: [
    '**/*.test.ts',
    '**/*.test.tsx',
    'dist/**',
    'node_modules/**',
    'e2e/**',
    'server/index.ts',
  ],
};

export default defineConfig({
  test: {
    coverage,
    projects: [
      {
        test: {
          name: 'unit',
          environment: 'node',
          env: testEnv,
          exclude: [...defaultExclude, 'dist/**', 'e2e/**'],
          include: [
            'server/**/*.test.ts',
            'client/**/*.test.ts',
            'shared/**/*.test.ts',
            'scripts/**/*.test.ts',
          ],
        },
      },
      {
        plugins: [react()],
        resolve: {
          alias: {
            '@': path.resolve(import.meta.dirname, 'client'),
          },
        },
        test: {
          name: 'dom',
          environment: 'happy-dom',
          env: testEnv,
          include: ['client/**/*.test.tsx'],
        },
      },
    ],
  },
});
