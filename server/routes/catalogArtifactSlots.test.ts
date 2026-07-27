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
      artifact_slots TEXT,
      aura_polarity TEXT,
      exilus_polarity TEXT,
      polarities TEXT
    );
    CREATE TABLE weapons (
      unique_name TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      artifact_slots TEXT,
      product_category TEXT,
      slot INTEGER,
      sentinel INTEGER
    );
    CREATE TABLE companions (
      unique_name TEXT PRIMARY KEY,
      artifact_slots TEXT
    );
    CREATE TABLE builds (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      clerk_user_id TEXT NOT NULL,
      name TEXT NOT NULL,
      equipment_type TEXT NOT NULL,
      equipment_unique_name TEXT NOT NULL,
      mod_config TEXT NOT NULL,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    );
  `);
  db.prepare('INSERT INTO warframes (unique_name, name, artifact_slots) VALUES (?, ?, ?)').run(
    TEST_WF,
    'Test Frame',
    null,
  );
}

const TEST_WEAPON = '/Lotus/Weapons/Tenno/Pistols/TestRegulators/TestRegulators';
const WEAPON_SLOTS_WITH_EXILUS = [
  'AP_UNIVERSAL',
  'AP_UNIVERSAL',
  'AP_UNIVERSAL',
  'AP_UNIVERSAL',
  'AP_UNIVERSAL',
  'AP_UNIVERSAL',
  'AP_UNIVERSAL',
  'AP_UNIVERSAL',
  'AP_POWER',
];

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
    expect(patch.body).toMatchObject({ ok: true, unique_name: TEST_WF, updated_builds: 0 });

    const refreshed = await request(app).get('/api/warframes');
    expect(refreshed.status).toBe(200);
    expect(artifactSlotsFor(TEST_WF, refreshed)).toEqual(UPDATED_SLOTS);
  });

  it('reconciles existing builds when artifact slots change', async () => {
    const db = dbState.db!;
    db.prepare(
      'INSERT INTO weapons (unique_name, name, product_category, slot, sentinel, artifact_slots) VALUES (?, ?, ?, ?, ?, ?)',
    ).run(TEST_WEAPON, 'Regulators Prime', 'SpecialItems', 0, 0, null);

    const existingSlots = Array.from({ length: 8 }, (_, index) => ({
      index,
      type: 'general',
      mod: { unique_name: `/Lotus/Upgrades/Mods/Pistol/TestMod${index}`, name: `Mod ${index}` },
    }));
    db.prepare(
      `INSERT INTO builds (clerk_user_id, name, equipment_type, equipment_unique_name, mod_config)
       VALUES (?, ?, ?, ?, ?)`,
    ).run(
      'user_1',
      'Regulators Build',
      'secondary',
      TEST_WEAPON,
      JSON.stringify({
        name: 'Regulators Build',
        equipment_type: 'secondary',
        equipment_unique_name: TEST_WEAPON,
        slots: existingSlots,
      }),
    );

    const app = createTestApp();
    const patch = await request(app)
      .patch('/api/admin/catalog/artifact-slots')
      .send({ unique_name: TEST_WEAPON, artifact_slots: WEAPON_SLOTS_WITH_EXILUS });
    expect(patch.status).toBe(200);
    expect(patch.body.updated_builds).toBe(1);

    const row = db.prepare('SELECT mod_config FROM builds WHERE equipment_unique_name = ?').get(TEST_WEAPON) as {
      mod_config: string;
    };
    const config = JSON.parse(row.mod_config) as {
      slots: Array<{ type: string; mod?: { unique_name?: string } }>;
    };
    expect(config.slots).toHaveLength(9);
    expect(config.slots[8]?.type).toBe('exilus');
    expect(config.slots[0]?.mod?.unique_name).toBe('/Lotus/Upgrades/Mods/Pistol/TestMod0');
  });
});
