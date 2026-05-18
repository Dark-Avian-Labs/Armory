import { afterEach, describe, expect, it, vi } from 'vitest';

import { pingAuthServiceHealth } from './authHealth.js';

describe('pingAuthServiceHealth', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('returns true when auth healthz responds ok', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => new Response(JSON.stringify({ status: 'ok' }), { status: 200 })),
    );
    await expect(pingAuthServiceHealth('https://auth.example.com/')).resolves.toBe(true);
  });

  it('returns false on non-ok response', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => new Response('', { status: 500 })),
    );
    await expect(pingAuthServiceHealth('https://auth.example.com')).resolves.toBe(false);
  });

  it('returns false for empty or whitespace URLs without calling fetch', async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);

    await expect(pingAuthServiceHealth('')).resolves.toBe(false);
    await expect(pingAuthServiceHealth('   ')).resolves.toBe(false);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('returns false when fetch rejects', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => {
        throw new Error('network');
      }),
    );
    await expect(pingAuthServiceHealth('https://auth.example.com')).resolves.toBe(false);
  });

  it('returns false when the request times out', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(
        (_url: string, init?: RequestInit) =>
          new Promise<Response>((_resolve, reject) => {
            init?.signal?.addEventListener('abort', () => {
              reject(new DOMException('The operation was aborted.', 'AbortError'));
            });
          }),
      ),
    );
    await expect(pingAuthServiceHealth('https://auth.example.com', 25)).resolves.toBe(false);
  });

  it('normalizes trailing slashes before calling healthz', async () => {
    const fetchMock = vi.fn(async () => new Response('', { status: 200 }));
    vi.stubGlobal('fetch', fetchMock);

    await expect(pingAuthServiceHealth('https://auth.example.com///')).resolves.toBe(true);
    expect(fetchMock).toHaveBeenCalledWith(
      'https://auth.example.com/healthz',
      expect.objectContaining({ method: 'GET' }),
    );
  });
});
