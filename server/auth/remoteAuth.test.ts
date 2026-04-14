import { describe, expect, it, vi } from 'vitest';

describe('buildAuthLoginUrl', () => {
  it('builds next URL from canonical public base when configured', async () => {
    const original = process.env.APP_PUBLIC_BASE_URL;
    process.env.APP_PUBLIC_BASE_URL = 'https://parametric.example.com';
    try {
      vi.resetModules();
      const { buildAuthLoginUrl } = await import('./remoteAuth.js');
      const req = {
        originalUrl: '/builder/builds',
        protocol: 'http',
        headers: {
          'x-forwarded-host': 'attacker.example.com',
          'x-forwarded-proto': 'http',
        },
        get(name: string) {
          if (name === 'host') return 'attacker.example.com';
          return '';
        },
      } as unknown as Parameters<typeof buildAuthLoginUrl>[0];

      const loginUrl = buildAuthLoginUrl(req);
      const parsed = new URL(loginUrl);
      expect(parsed.pathname).toBe('/login');
      expect(parsed.searchParams.get('next')).toBe('https://parametric.example.com/builder/builds');
    } finally {
      if (original == null) {
        delete process.env.APP_PUBLIC_BASE_URL;
      } else {
        process.env.APP_PUBLIC_BASE_URL = original;
      }
      vi.resetModules();
    }
  });
});
