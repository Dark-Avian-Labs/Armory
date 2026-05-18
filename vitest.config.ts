import { defaultExclude, defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    exclude: [...defaultExclude, 'dist/**', 'node_modules/**'],
    env: {
      NODE_ENV: 'test',
      SESSION_SECRET: 'armory-dev-only-session-secret-32ch',
    },
  },
});
