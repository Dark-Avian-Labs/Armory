import express from 'express';
import request from 'supertest';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { APP_NAME } from '../server/config.js';
import { getDb, getSessionDb } from '../server/db/connection.js';
import { testRateLimiter } from './helpers/testExpress.js';

const dbMocks = vi.hoisted(() => ({
  appOk: true,
  sessionOk: true,
}));

vi.mock('../server/db/connection.js', () => ({
  getDb: () => ({
    prepare: () => ({
      get: () => {
        if (!dbMocks.appOk) throw new Error('app db unavailable');
        return { ok: 1 };
      },
    }),
  }),
  getSessionDb: () => ({
    prepare: () => ({
      get: () => {
        if (!dbMocks.sessionOk) throw new Error('session db unavailable');
        return { ok: 1 };
      },
    }),
  }),
}));

function createProbeApp() {
  const app = express();
  app.use(testRateLimiter);
  app.get('/healthz', (_req, res) => {
    res.json({ status: 'ok', app: APP_NAME });
  });
  app.get('/readyz', (_req, res) => {
    try {
      getSessionDb().prepare('SELECT 1').get();
      getDb().prepare('SELECT 1').get();
      res.json({ status: 'ready', app: APP_NAME });
    } catch {
      res.status(503).json({ status: 'not_ready', app: APP_NAME });
    }
  });
  app.get('/api/health', (_req, res) => {
    res.json({ status: 'ok', app: 'Armory' });
  });
  return app;
}

describe('health and readiness routes', () => {
  beforeEach(() => {
    dbMocks.appOk = true;
    dbMocks.sessionOk = true;
  });

  it('GET /healthz returns ok', async () => {
    const app = createProbeApp();
    await request(app)
      .get('/healthz')
      .expect(200)
      .expect((res) => {
        expect(res.body).toEqual({ status: 'ok', app: APP_NAME });
      });
  });

  it('GET /api/health returns ok', async () => {
    const app = createProbeApp();
    await request(app)
      .get('/api/health')
      .expect(200)
      .expect((res) => {
        expect(res.body).toEqual({ status: 'ok', app: 'Armory' });
      });
  });

  it('GET /readyz returns ready when databases respond', async () => {
    const app = createProbeApp();
    await request(app)
      .get('/readyz')
      .expect(200)
      .expect((res) => {
        expect(res.body.status).toBe('ready');
      });
  });

  it('GET /readyz returns 503 when database probe fails', async () => {
    dbMocks.sessionOk = false;
    const app = createProbeApp();
    await request(app)
      .get('/readyz')
      .expect(503)
      .expect((res) => {
        expect(res.body.status).toBe('not_ready');
      });
  });
});
