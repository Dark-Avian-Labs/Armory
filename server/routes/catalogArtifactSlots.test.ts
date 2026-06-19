import Database from 'better-sqlite3';
import express from 'express';
import request from 'supertest';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { __catalogResponseCacheTest } from '../cache/catalogResponseCache.js';

const authState = vi.hoisted(() => ({
  userId: null as string | null,
  isArmoryAdmin: false,
}));

const dbState = vi.hoisted(() => ({
  db: null as Database.Database | null,
}));

vi.mock('../auth/clerkUser.js', () => ({
  getClerkUserId: () => authState.userId,
}));

vi.mock('../auth/middleware.js', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../auth/middleware.js')>();
  return {
    ...actual,
    getClerkAuthState: () => ({
      authenticated: Boolean(authState.userId),
      userId: authState.userId,
      isArmoryAdmin: authState.isArmoryAdmin,
    }),
    requireArmoryAdmin: (
      _req: import('express').Request,
      res: import('express').Response,
      next: import('express').NextFunction,
    ) => {
      if (!authState.userId) {
        res.status(401).json({ error: 'Unauthorized' });
        return;
      }
      if (!authState.isArmoryAdmin) {
        res.status(403).json({ error: 'Game admin access required' });
        return;
      }
      next();
    },
  };
});

vi.mock('../db/connection.js', () => ({
  getCatalogDb: () => {
    if (!dbState.db) throw new Error('Test DB not initialized');
    return dbState.db;
  },
  getUserDb: () => {
    if (!dbState.db) throw new Error('Test DB not initialized');
    return dbState.db;
  },
}));

import { apiRouter } from './api.js';

const TEST_WF = '/Lotus/Powersuits/Test/TestSuit';
const UPDATED_SLOTS = [
  'AP_ATTACK',
  'AP_UNIVERSAL',
  'AP_UNIVERSAL',
  'AP_UNIVERSAL',
  'AP_UNIVERSAL',
  'AP_UNIVERSAL',
  'AP_UNIVERSAL',
  'AP_UNIVERSAL',
  'AP_POWER',
  'AP_UNIVERSAL',
];

function createTestCatalogSchema(db: Database.Database): void {
  db.exec(`
    CREATE TABLE warframes (
      unique_name TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      artifact_slots TEXT
    );
    CREATE TABLE weapons (
      unique_name TEXT PRIMARY KEY,
      artifact_slots TEXT
    );
    CREATE TABLE companions (
      unique_name TEXT PRIMARY KEY,
      artifact_slots TEXT
    );
  `);
  db.prepare('INSERT INTO warframes (unique_name, name, artifact_slots) VALUES (?, ?, ?)').run(
    TEST_WF,
    'Test Frame',
    null,
  );
}

function createTestApp() {
  const app = express();
  app.use(express.json());
  app.use('/api', apiRouter);
  return app;
}

function artifactSlotsFor(uniqueName: string, res: request.Response): string[] | null {
  const item = (res.body.items as Array<{ unique_name: string; artifact_slots: string | null }>).find(
    (row) => row.unique_name === uniqueName,
  );
  if (!item?.artifact_slots) return null;
  return JSON.parse(item.artifact_slots) as string[];
}

describe('PATCH /admin/catalog/artifact-slots', () => {
  beforeEach(() => {
    authState.userId = 'user_admin';
    authState.isArmoryAdmin = true;
    __catalogResponseCacheTest.bust();
    dbState.db?.close();
    dbState.db = new Database(':memory:');
    createTestCatalogSchema(dbState.db);
  });

  afterEach(() => {
    __catalogResponseCacheTest.bust();
    dbState.db?.close();
    dbState.db = null;
  });

  it('updates artifact_slots and busts the warframes catalog cache', async () => {
    const app = createTestApp();

    const cached = await request(app).get('/api/warframes');
    expect(cached.status).toBe(200);
    expect(artifactSlotsFor(TEST_WF, cached)).toBeNull();
    expect(__catalogResponseCacheTest.size()).toBeGreaterThan(0);

    const patch = await request(app)
      .patch('/api/admin/catalog/artifact-slots')
      .send({ unique_name: TEST_WF, artifact_slots: UPDATED_SLOTS });
    expect(patch.status).toBe(200);
    expect(patch.body).toMatchObject({ ok: true, unique_name: TEST_WF });

    const refreshed = await request(app).get('/api/warframes');
    expect(refreshed.status).toBe(200);
    expect(artifactSlotsFor(TEST_WF, refreshed)).toEqual(UPDATED_SLOTS);
  });
});
