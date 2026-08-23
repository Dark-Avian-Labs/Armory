import Database from 'better-sqlite3';
import type { SessionData } from 'express-session';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { SqliteSessionStore } from './sqliteSessionStore.js';

function sessionWith(cookie: Record<string, unknown>, extra?: Record<string, unknown>): SessionData {
  return { cookie, ...extra } as unknown as SessionData;
}

function getAsync(store: SqliteSessionStore, sid: string): Promise<SessionData | null | undefined> {
  return new Promise((resolve, reject) => {
    store.get(sid, (err, session) => (err ? reject(err) : resolve(session)));
  });
}

function setAsync(store: SqliteSessionStore, sid: string, session: SessionData): Promise<void> {
  return new Promise((resolve, reject) => {
    store.set(sid, session, (err) => (err ? reject(err) : resolve()));
  });
}

describe('SqliteSessionStore', () => {
  let db: Database.Database;
  let store: SqliteSessionStore;

  beforeEach(() => {
    db = new Database(':memory:');
    store = new SqliteSessionStore({ db, cleanupIntervalMs: 0 });
  });

  afterEach(() => {
    store.dispose();
    db.close();
  });

  it('creates the sessions table on construction', () => {
    const table = db.prepare("SELECT name FROM sqlite_master WHERE type = 'table' AND name = 'sessions'").get() as
      | { name: string }
      | undefined;
    expect(table?.name).toBe('sessions');
  });

  it('round-trips a session', async () => {
    const session = sessionWith({ maxAge: 60_000 }, { userId: 'user_1' });
    await setAsync(store, 'sid-1', session);

    const loaded = await getAsync(store, 'sid-1');
    expect(loaded).toMatchObject({ userId: 'user_1' });
  });

  it('returns undefined for unknown sessions', async () => {
    await expect(getAsync(store, 'missing')).resolves.toBeUndefined();
  });

  it('overwrites an existing session on set', async () => {
    await setAsync(store, 'sid-1', sessionWith({ maxAge: 60_000 }, { value: 'a' }));
    await setAsync(store, 'sid-1', sessionWith({ maxAge: 60_000 }, { value: 'b' }));

    const loaded = await getAsync(store, 'sid-1');
    expect(loaded).toMatchObject({ value: 'b' });
  });

  it('treats expired sessions as missing and deletes them', async () => {
    await setAsync(store, 'sid-expired', sessionWith({ expires: new Date(Date.now() - 1000).toISOString() }));

    await expect(getAsync(store, 'sid-expired')).resolves.toBeUndefined();
    const row = db.prepare('SELECT sid FROM sessions WHERE sid = ?').get('sid-expired');
    expect(row).toBeUndefined();
  });

  it('destroys sessions', async () => {
    await setAsync(store, 'sid-1', sessionWith({ maxAge: 60_000 }));
    await new Promise<void>((resolve, reject) => {
      store.destroy('sid-1', (err) => (err ? reject(err) : resolve()));
    });
    await expect(getAsync(store, 'sid-1')).resolves.toBeUndefined();
  });

  it('touch extends the expiry', async () => {
    await setAsync(store, 'sid-1', sessionWith({ maxAge: 1000 }));
    const before = (
      db.prepare('SELECT expire FROM sessions WHERE sid = ?').get('sid-1') as {
        expire: string;
      }
    ).expire;

    await new Promise<void>((resolve, reject) => {
      store.touch('sid-1', sessionWith({ maxAge: 60_000 }), (err) => (err ? reject(err) : resolve()));
    });

    const after = (
      db.prepare('SELECT expire FROM sessions WHERE sid = ?').get('sid-1') as {
        expire: string;
      }
    ).expire;
    expect(after > before).toBe(true);
  });

  it('clearExpired removes only expired rows', async () => {
    await setAsync(store, 'live', sessionWith({ maxAge: 60_000 }));
    await setAsync(store, 'dead', sessionWith({ expires: new Date(Date.now() - 1000).toISOString() }));

    const removed = store.clearExpired();
    expect(removed).toBe(1);
    await expect(getAsync(store, 'live')).resolves.toBeTruthy();
  });

  it('length and clear work', async () => {
    await setAsync(store, 'a', sessionWith({ maxAge: 60_000 }));
    await setAsync(store, 'b', sessionWith({ maxAge: 60_000 }));

    const count = await new Promise<number | undefined>((resolve, reject) => {
      store.length((err, length) => (err ? reject(err) : resolve(length)));
    });
    expect(count).toBe(2);

    await new Promise<void>((resolve, reject) => {
      store.clear((err) => (err ? reject(err) : resolve()));
    });
    const emptied = await new Promise<number | undefined>((resolve, reject) => {
      store.length((err, length) => (err ? reject(err) : resolve(length)));
    });
    expect(emptied).toBe(0);
  });
});
