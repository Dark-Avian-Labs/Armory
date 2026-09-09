import Database from 'better-sqlite3';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import type { AppBundle } from './app.js';
import { createApp } from './app.js';
import { APP_NAME, APP_VERSION, SESSION_COOKIE_NAME } from './config.js';
import { createMemoryUserDb } from './testing/memoryUserDb.js';

let bundle: AppBundle | undefined;
let catalogDb: Database.Database | undefined;
let userDb: Database.Database | undefined;

beforeAll(() => {
  catalogDb = new Database(':memory:');
  catalogDb.pragma('foreign_keys = ON');
  userDb = createMemoryUserDb();
  bundle = createApp({
    sessionDb: new Database(':memory:'),
    catalogDb,
    userDb,
  });
});

afterAll(() => {
  bundle?.sessionStore.dispose();
  bundle?.sessionDb.close();
  catalogDb?.close();
  userDb?.close();
});

describe('health endpoints', () => {
  it('GET /healthz responds ok without creating a session cookie', async () => {
    const res = await request(bundle!.app).get('/healthz');
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ status: 'ok', app: APP_NAME });
    expect(res.headers['set-cookie']).toBeUndefined();
  });

  it('GET /readyz probes session, catalog, and user DBs', async () => {
    const res = await request(bundle!.app).get('/readyz');
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ status: 'ready', app: APP_NAME });
  });

  it('GET /readyz returns 503 when a database probe fails', async () => {
    const down = createApp({
      sessionDb: new Database(':memory:'),
      catalogDb: {
        prepare: () => {
          throw new Error('catalog unavailable');
        },
      } as unknown as Database.Database,
      userDb,
    });
    const res = await request(down.app).get('/readyz');
    expect(res.status).toBe(503);
    expect(res.body).toEqual({ status: 'not_ready', app: APP_NAME });
    down.sessionStore.dispose();
    down.sessionDb.close();
  });

  it('GET /api/version returns the package version', async () => {
    const res = await request(bundle!.app).get('/api/version');
    expect(res.status).toBe(200);
    expect(res.body.version).toBe(APP_VERSION);
    expect(res.headers['cache-control']).toBe('no-store');
  });
});

describe('security headers', () => {
  it('sets helmet headers including a CSP with Clerk origins', async () => {
    const res = await request(bundle!.app).get('/healthz');
    expect(res.headers['x-content-type-options']).toBe('nosniff');
    expect(res.headers['content-security-policy']).toContain("script-src 'self'");
    expect(res.headers['content-security-policy']).toContain('https://challenges.cloudflare.com');
    expect(res.headers['content-security-policy']).toContain('https://*.protect.clerk.com');
  });

  it('emits rate limit headers on API routes', async () => {
    const res = await request(bundle!.app).get('/api/auth/csrf');
    const hasRateLimitHeader = Boolean(res.headers['ratelimit'] ?? res.headers['ratelimit-limit']);
    expect(hasRateLimitHeader).toBe(true);
  });
});

describe('request IDs', () => {
  it('echoes a well-formed X-Request-Id', async () => {
    const res = await request(bundle!.app).get('/healthz').set('X-Request-Id', 'abc-123-def-456');
    expect(res.headers['x-request-id']).toBe('abc-123-def-456');
  });

  it('replaces a malformed X-Request-Id', async () => {
    const res = await request(bundle!.app).get('/healthz').set('X-Request-Id', 'bad id! <script>');
    expect(res.headers['x-request-id']).toBeDefined();
    expect(res.headers['x-request-id']).not.toBe('bad id! <script>');
  });
});

describe('CSRF protection', () => {
  it('GET /api/auth/csrf issues a token and a session cookie', async () => {
    const res = await request(bundle!.app).get('/api/auth/csrf');
    expect(res.status).toBe(200);
    expect(res.body.csrfToken).toBeTruthy();
    expect(res.headers['set-cookie']?.[0]).toContain(SESSION_COOKIE_NAME);
    expect(res.headers['set-cookie']?.[0]).toContain('HttpOnly');
  });

  it('rejects state-changing requests without a token', async () => {
    const res = await request(bundle!.app).post('/api/builds').send({});
    expect(res.status).toBe(403);
    expect(res.body.code).toBe('CSRF_INVALID');
    expect(res.headers['x-csrf-error']).toBe('1');
  });

  it('accepts state-changing requests with a valid token', async () => {
    const agent = request.agent(bundle!.app);
    const csrfRes = await agent.get('/api/auth/csrf');
    const token = csrfRes.body.csrfToken as string;

    const res = await agent.post('/api/nope').set('X-CSRF-Token', token).send({});
    expect(res.status).toBe(404);
    expect(res.body.error).toBe('Not found');
  });

  it('blocks cross-site state-changing requests', async () => {
    const agent = request.agent(bundle!.app);
    const csrfRes = await agent.get('/api/auth/csrf');
    const token = csrfRes.body.csrfToken as string;

    const res = await agent.post('/api/nope').set('X-CSRF-Token', token).set('Sec-Fetch-Site', 'cross-site').send({});
    expect(res.status).toBe(403);
    expect(res.body.code).toBe('CSRF_ORIGIN_INVALID');
  });
});

describe('API 404 handling', () => {
  it('returns JSON 404 for unknown API routes', async () => {
    const res = await request(bundle!.app).get('/api/nope');
    expect(res.status).toBe(404);
    expect(res.body.error).toBe('Not found');
  });
});
