import type Database from 'better-sqlite3';
import express from 'express';
import request from 'supertest';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { createMemoryUserDb, insertTestBuild, insertTestLoadout, linkLoadoutBuild } from '../testing/memoryUserDb.js';
import { MAX_LOADOUTS_PER_USER, MAX_NAME_LENGTH } from './apiShared.js';

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

function createTestApp() {
  const app = express();
  app.use(express.json());
  app.use('/api', apiRouter);
  return app;
}

describe('loadouts API routes', () => {
  beforeEach(() => {
    authState.userId = null;
    authState.isArmoryAdmin = false;
    dbState.db?.close();
    dbState.db = createMemoryUserDb();
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
    insertTestLoadout(dbState.db!);
    authState.userId = 'user_owner';
    const res = await request(createTestApp())
      .put('/api/loadouts/1')
      .send({ name: 'x'.repeat(MAX_NAME_LENGTH + 1) });
    expect(res.status).toBe(400);
    expect(res.body.error).toBe('Invalid name');
  });

  it('rejects loadout updates with no writable fields', async () => {
    insertTestLoadout(dbState.db!);
    authState.userId = 'user_owner';
    const res = await request(createTestApp()).put('/api/loadouts/1').send({});
    expect(res.status).toBe(400);
    expect(res.body.error).toBe('Provide at least name, visibility, or description');
  });

  it('rejects create when the per-user loadout cap is reached', async () => {
    dbState.db!.transaction(() => {
      for (let i = 0; i < MAX_LOADOUTS_PER_USER; i += 1) {
        insertTestLoadout(dbState.db!, { name: `Loadout ${i}` });
      }
    })();
    authState.userId = 'user_owner';
    const res = await request(createTestApp()).post('/api/loadouts').send({ name: 'Overflow' });
    expect(res.status).toBe(403);
    expect(res.body.error).toBe(`Loadout limit reached (max ${MAX_LOADOUTS_PER_USER} per user)`);
  });

  it('hides private loadouts from non-owners with 404', async () => {
    insertTestLoadout(dbState.db!, { visibility: 'private' });
    authState.userId = 'user_other';
    const res = await request(createTestApp()).get('/api/loadouts/1');
    expect(res.status).toBe(404);
    expect(res.body.error).toBe('Loadout not found');
  });

  it('refuses public visibility while a linked build is private', async () => {
    const loadoutId = insertTestLoadout(dbState.db!);
    const buildId = insertTestBuild(dbState.db!, { visibility: 'private' });
    linkLoadoutBuild(dbState.db!, loadoutId, buildId);
    authState.userId = 'user_owner';
    const res = await request(createTestApp()).put('/api/loadouts/1').send({ visibility: 'public' });
    expect(res.status).toBe(400);
    expect(res.body.error).toBe(
      'Every build in this loadout must be public or unlisted before the loadout can be public or unlisted.',
    );
  });

  it('allows public visibility when every linked build is public or unlisted', async () => {
    const loadoutId = insertTestLoadout(dbState.db!);
    const publicId = insertTestBuild(dbState.db!, { name: 'Public', visibility: 'public' });
    const unlistedId = insertTestBuild(dbState.db!, {
      name: 'Unlisted',
      visibility: 'unlisted',
      shareToken: 'build-token',
      equipmentUniqueName: '/Lotus/Weapons/Tenno/Rifle/Rifle',
    });
    linkLoadoutBuild(dbState.db!, loadoutId, publicId, 'warframe');
    linkLoadoutBuild(dbState.db!, loadoutId, unlistedId, 'primary');
    authState.userId = 'user_owner';
    const res = await request(createTestApp()).put('/api/loadouts/1').send({ visibility: 'public' });
    expect(res.status).toBe(200);
    expect(res.body.visibility).toBe('public');
  });

  it('lets an unlisted loadout token reveal the owner public and unlisted builds', async () => {
    const loadoutId = insertTestLoadout(dbState.db!, {
      visibility: 'unlisted',
      shareToken: 'loadout-token',
    });
    const publicId = insertTestBuild(dbState.db!, { name: 'Public Frame', visibility: 'public' });
    const unlistedId = insertTestBuild(dbState.db!, {
      name: 'Unlisted Rifle',
      visibility: 'unlisted',
      shareToken: 'build-only-token',
      equipmentType: 'primary',
      equipmentUniqueName: '/Lotus/Weapons/Tenno/Rifle/Rifle',
    });
    const privateId = insertTestBuild(dbState.db!, {
      name: 'Private Melee',
      visibility: 'private',
      equipmentType: 'melee',
      equipmentUniqueName: '/Lotus/Weapons/Tenno/Melee/Sword',
    });
    linkLoadoutBuild(dbState.db!, loadoutId, publicId, 'warframe');
    linkLoadoutBuild(dbState.db!, loadoutId, unlistedId, 'primary');
    linkLoadoutBuild(dbState.db!, loadoutId, privateId, 'melee');

    authState.userId = 'user_other';
    const denied = await request(createTestApp()).get('/api/loadouts/1');
    expect(denied.status).toBe(404);

    const allowed = await request(createTestApp()).get('/api/loadouts/1?token=loadout-token');
    expect(allowed.status).toBe(200);
    const names = (allowed.body.loadout.builds as Array<{ build: { name: string } }>).map((row) => row.build.name);
    expect(names).toEqual(expect.arrayContaining(['Public Frame', 'Unlisted Rifle']));
    expect(names).toHaveLength(2);
    expect(allowed.body.loadout.share_token).toBeUndefined();
  });
});
