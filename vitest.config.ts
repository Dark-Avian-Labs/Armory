import { defaultExclude, defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    exclude: [...defaultExclude, 'dist/**', 'node_modules/**'],
    include: [
      'server/**/*.test.ts',
      'client/**/*.test.ts',
      'shared/**/*.test.ts',
      'scripts/**/*.test.ts',
      'tests/**/*.test.ts',
    ],
    environment: 'node',
    env: {
      NODE_ENV: 'test',
      SESSION_SECRET: 'armory-dev-only-session-secret-32ch',
    },
    coverage: {
      provider: 'v8',
      include: ['server/**/*.ts', 'client/utils/**/*.ts', 'shared/**/*.ts', 'scripts/**/*.mjs'],
      exclude: ['**/*.test.ts', 'dist/**', 'node_modules/**'],
    },
  },
});
