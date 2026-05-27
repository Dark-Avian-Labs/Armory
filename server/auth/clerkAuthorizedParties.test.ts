import { afterEach, describe, expect, it } from 'vitest';

import { getClerkAuthorizedParties } from './clerkAuthorizedParties.js';

describe('getClerkAuthorizedParties', () => {
  const previousEnv = {
    NODE_ENV: process.env.NODE_ENV,
    APP_PUBLIC_BASE_URL: process.env.APP_PUBLIC_BASE_URL,
    ALLOWED_APP_ORIGINS: process.env.ALLOWED_APP_ORIGINS,
  };

  afterEach(() => {
    process.env.NODE_ENV = previousEnv.NODE_ENV;
    process.env.APP_PUBLIC_BASE_URL = previousEnv.APP_PUBLIC_BASE_URL;
    process.env.ALLOWED_APP_ORIGINS = previousEnv.ALLOWED_APP_ORIGINS;
  });

  it('includes app public URL and configured sibling origins', () => {
    process.env.NODE_ENV = 'production';
    process.env.APP_PUBLIC_BASE_URL = 'https://armory.example.com/';
    process.env.ALLOWED_APP_ORIGINS = 'https://codex.example.com,https://armory.example.com';

    expect(getClerkAuthorizedParties()).toEqual(['https://armory.example.com', 'https://codex.example.com']);
  });

  it('includes localhost origins in development', () => {
    process.env.NODE_ENV = 'development';
    process.env.APP_PUBLIC_BASE_URL = 'http://localhost:3002';
    delete process.env.ALLOWED_APP_ORIGINS;

    const parties = getClerkAuthorizedParties();
    expect(parties).toContain('http://localhost:3002');
    expect(parties).toContain('http://localhost:5173');
  });
});
