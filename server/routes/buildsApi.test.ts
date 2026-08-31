import Database from 'better-sqlite3';
import express from 'express';
import request from 'supertest';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { __catalogResponseCacheTest } from '../cache/catalogResponseCache.js';
import { MAX_NAME_LENGTH } from './apiShared.js';
import { minimalModConfig } from './modConfigValidation.js';

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
  };
});

vi.mock('../auth/armoryUsers.js', () => ({
  DELETED_USER_LABEL: 'Deleted User',
  getOwnerDisplayName: (_id: string, map: Map<string, string>) => map.get(_id) ?? 'User',
  resolveOwnerUsernames: async (ids: string[]) => new Map(ids.map((id) => [id, 'testuser'])),
  resolveClerkUserIdByUsername: () => null,
}));

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

function createTestBuildsSchema(db: Database.Database): void {
  db.exec(`
    CREATE TABLE builds (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      clerk_user_id TEXT NOT NULL,
      name TEXT NOT NULL,
      visibility TEXT NOT NULL DEFAULT 'private',
      equipment_type TEXT NOT NULL,
      equipment_unique_name TEXT NOT NULL,
      mod_config TEXT NOT NULL,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now')),
      description TEXT,
      share_token TEXT
    );
    CREATE TABLE build_favorites (
      clerk_user_id TEXT NOT NULL,
      build_id INTEGER NOT NULL,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      PRIMARY KEY (clerk_user_id, build_id)
    );
  `);
}

function createTestApp() {
  const app = express();
  app.use(express.json());
  app.use('/api', apiRouter);
  return app;
}

describe('builds API routes', () => {
  beforeEach(() => {
    authState.userId = null;
    authState.isArmoryAdmin = false;
    dbState.db?.close();
    dbState.db = new Database(':memory:');
    createTestBuildsSchema(dbState.db);
  });

  afterEach(() => {
    __catalogResponseCacheTest.bust();
    dbState.db?.close();
    dbState.db = null;
  });

  it('returns 401 when creating a build unauthenticated', async () => {
    const res = await request(createTestApp()).post('/api/builds').send({
      name: 'Test',
      equipment_type: 'warframe',
      equipment_unique_name: '/Lotus/Powersuits/Excalibur/Excalibur',
      mod_config: minimalModConfig(),
    });
    expect(res.status).toBe(401);
  });

  it('returns 400 for invalid mod_config', async () => {
    authState.userId = 'user_owner';
    const res = await request(createTestApp())
      .post('/api/builds')
      .send({
        name: 'Test',
        equipment_type: 'warframe',
        equipment_unique_name: '/Lotus/Powersuits/Excalibur/Excalibur',
        mod_config: { slots: 'not-an-array' },
      });
    expect(res.status).toBe(400);
    expect(res.body.error).toBe('Invalid mod_config');
  });

  it('creates a build with valid payload', async () => {
    authState.userId = 'user_owner';
    const res = await request(createTestApp()).post('/api/builds').send({
      name: 'Test',
      equipment_type: 'warframe',
      equipment_unique_name: '/Lotus/Powersuits/Excalibur/Excalibur',
      mod_config: minimalModConfig(),
      visibility: 'public',
    });
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.id).toBeGreaterThan(0);
  });

  it('hides private builds from non-owners', async () => {
    dbState
      .db!.prepare(
        `INSERT INTO builds (clerk_user_id, name, visibility, equipment_type, equipment_unique_name, mod_config)
         VALUES (?, ?, ?, ?, ?, ?)`,
      )
      .run(
        'user_owner',
        'Private',
        'private',
        'warframe',
        '/Lotus/Powersuits/Excalibur/Excalibur',
        JSON.stringify(minimalModConfig()),
      );
    authState.userId = 'user_other';
    const res = await request(createTestApp()).get('/api/builds/1');
    expect(res.status).toBe(404);
  });

  it('allows reading public builds from non-owners', async () => {
    dbState
      .db!.prepare(
        `INSERT INTO builds (clerk_user_id, name, visibility, equipment_type, equipment_unique_name, mod_config)
         VALUES (?, ?, ?, ?, ?, ?)`,
      )
      .run(
        'user_owner',
        'Public',
        'public',
        'warframe',
        '/Lotus/Powersuits/Excalibur/Excalibur',
        JSON.stringify(minimalModConfig()),
      );
    authState.userId = 'user_other';
    const res = await request(createTestApp()).get('/api/builds/1');
    expect(res.status).toBe(200);
    expect(res.body.build.name).toBe('Public');
    expect(res.body.is_owner).toBe(false);
  });

  it('denies unlisted builds without share token', async () => {
    dbState
      .db!.prepare(
        `INSERT INTO builds (clerk_user_id, name, visibility, share_token, equipment_type, equipment_unique_name, mod_config)
         VALUES (?, ?, ?, ?, ?, ?, ?)`,
      )
      .run(
        'user_owner',
        'Unlisted',
        'unlisted',
        'share-abc123',
        'warframe',
        '/Lotus/Powersuits/Excalibur/Excalibur',
        JSON.stringify(minimalModConfig()),
      );
    authState.userId = 'user_other';
    const denied = await request(createTestApp()).get('/api/builds/1');
    expect(denied.status).toBe(404);
  });

  it('allows unlisted builds with matching share token', async () => {
    dbState
      .db!.prepare(
        `INSERT INTO builds (clerk_user_id, name, visibility, share_token, equipment_type, equipment_unique_name, mod_config)
         VALUES (?, ?, ?, ?, ?, ?, ?)`,
      )
      .run(
        'user_owner',
        'Unlisted',
        'unlisted',
        'share-abc123',
        'warframe',
        '/Lotus/Powersuits/Excalibur/Excalibur',
        JSON.stringify(minimalModConfig()),
      );
    authState.userId = 'user_other';
    const allowed = await request(createTestApp()).get('/api/builds/1?token=share-abc123');
    expect(allowed.status).toBe(200);
    expect(allowed.body.build.name).toBe('Unlisted');
    expect(allowed.body.build.share_token).toBeUndefined();
  });

  it('returns share_token to owners for unlisted builds', async () => {
    dbState
      .db!.prepare(
        `INSERT INTO builds (clerk_user_id, name, visibility, share_token, equipment_type, equipment_unique_name, mod_config)
         VALUES (?, ?, ?, ?, ?, ?, ?)`,
      )
      .run(
        'user_owner',
        'Unlisted',
        'unlisted',
        'share-abc123',
        'warframe',
        '/Lotus/Powersuits/Excalibur/Excalibur',
        JSON.stringify(minimalModConfig()),
      );
    authState.userId = 'user_owner';
    const res = await request(createTestApp()).get('/api/builds/1');
    expect(res.status).toBe(200);
    expect(res.body.build.share_token).toBe('share-abc123');
  });

  it('rejects build updates whose name exceeds MAX_NAME_LENGTH', async () => {
    dbState
      .db!.prepare(
        `INSERT INTO builds (clerk_user_id, name, visibility, equipment_type, equipment_unique_name, mod_config)
         VALUES (?, ?, ?, ?, ?, ?)`,
      )
      .run(
        'user_owner',
        'Public',
        'public',
        'warframe',
        '/Lotus/Powersuits/Excalibur/Excalibur',
        JSON.stringify(minimalModConfig()),
      );
    authState.userId = 'user_owner';
    const res = await request(createTestApp())
      .put('/api/builds/1')
      .send({
        name: 'x'.repeat(MAX_NAME_LENGTH + 1),
        mod_config: minimalModConfig(),
      });
    expect(res.status).toBe(400);
    expect(res.body.error).toBe('Invalid name');
  });

  it('caches public build catalog responses and busts on create', async () => {
    dbState
      .db!.prepare(
        `INSERT INTO builds (clerk_user_id, name, visibility, equipment_type, equipment_unique_name, mod_config)
         VALUES (?, ?, ?, ?, ?, ?)`,
      )
      .run(
        'user_owner',
        'Public',
        'public',
        'warframe',
        '/Lotus/Powersuits/Excalibur/Excalibur',
        JSON.stringify(minimalModConfig()),
      );

    const first = await request(createTestApp()).get('/api/builds/catalog');
    expect(first.status).toBe(200);
    expect(first.headers['cache-control']).toBe('public, max-age=30');
    expect(first.body.entries).toEqual([
      {
        equipment_type: 'warframe',
        equipment_unique_name: '/Lotus/Powersuits/Excalibur/Excalibur',
        build_count: 1,
      },
    ]);

    const etag = first.headers.etag;
    expect(etag).toEqual(expect.any(String));
    const cached = await request(createTestApp()).get('/api/builds/catalog').set('If-None-Match', String(etag));
    expect(cached.status).toBe(304);

    authState.userId = 'user_owner';
    const created = await request(createTestApp()).post('/api/builds').send({
      name: 'Second',
      equipment_type: 'primary',
      equipment_unique_name: '/Lotus/Weapons/Tenno/Rifle/Rifle',
      mod_config: minimalModConfig(),
      visibility: 'public',
    });
    expect(created.status).toBe(200);

    const afterWrite = await request(createTestApp()).get('/api/builds/catalog');
    expect(afterWrite.status).toBe(200);
    expect(afterWrite.body.entries).toHaveLength(2);
  });
});
