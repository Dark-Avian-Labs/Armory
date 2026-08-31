import Database from 'better-sqlite3';
import express from 'express';
import request from 'supertest';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { MAX_NAME_LENGTH } from './apiShared.js';

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

vi.mock('../db/connection.js', () => ({
  getUserDb: () => {
    if (!dbState.db) throw new Error('Test DB not initialized');
    return dbState.db;
  },
}));

import { apiRouter } from './api.js';

function createTestLoadoutsSchema(db: Database.Database): void {
  db.exec(`
    CREATE TABLE loadouts (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      clerk_user_id TEXT NOT NULL,
      name TEXT NOT NULL,
      description TEXT,
      visibility TEXT NOT NULL DEFAULT 'private',
      share_token TEXT,
      created_at TEXT DEFAULT (datetime('now')),
      updated_at TEXT DEFAULT (datetime('now'))
    );
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
    CREATE TABLE loadout_builds (
      loadout_id INTEGER NOT NULL,
      build_id INTEGER NOT NULL,
      slot_type TEXT NOT NULL,
      PRIMARY KEY (loadout_id, slot_type)
    );
  `);
}

function createTestApp() {
  const app = express();
  app.use(express.json());
  app.use('/api', apiRouter);
  return app;
}

describe('loadouts write validation', () => {
  beforeEach(() => {
    authState.userId = null;
    authState.isArmoryAdmin = false;
    dbState.db?.close();
    dbState.db = new Database(':memory:');
    createTestLoadoutsSchema(dbState.db);
  });

  afterEach(() => {
    dbState.db?.close();
    dbState.db = null;
  });

  it('rejects loadout create with an empty name', async () => {
    authState.userId = 'user_owner';
    const res = await request(createTestApp()).post('/api/loadouts').send({ name: '   ' });
    expect(res.status).toBe(400);
    expect(res.body.error).toBe('Invalid name');
  });

  it('rejects loadout updates whose name exceeds MAX_NAME_LENGTH', async () => {
    dbState.db!.prepare('INSERT INTO loadouts (clerk_user_id, name) VALUES (?, ?)').run('user_owner', 'Squad');
    authState.userId = 'user_owner';
    const res = await request(createTestApp())
      .put('/api/loadouts/1')
      .send({ name: 'x'.repeat(MAX_NAME_LENGTH + 1) });
    expect(res.status).toBe(400);
    expect(res.body.error).toBe('Invalid name');
  });

  it('rejects loadout updates with no writable fields', async () => {
    dbState.db!.prepare('INSERT INTO loadouts (clerk_user_id, name) VALUES (?, ?)').run('user_owner', 'Squad');
    authState.userId = 'user_owner';
    const res = await request(createTestApp()).put('/api/loadouts/1').send({});
    expect(res.status).toBe(400);
    expect(res.body.error).toBe('Provide at least name, visibility, or description');
  });
});
