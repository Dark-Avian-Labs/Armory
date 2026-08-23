import { clerkClient } from '@clerk/express';

import { getCatalogDb } from '../db/connection.js';
import { log } from '../logger.js';

const DELETED_USER_LABEL = '[Deleted User]';
let schemaInitialized = false;

function isDuplicateColumnError(err: unknown): boolean {
  return err instanceof Error && err.message.toLowerCase().includes('duplicate column');
}

export function ensureArmoryUsersSchema(db: ReturnType<typeof getCatalogDb>): void {
  db.exec(`
    CREATE TABLE IF NOT EXISTS armory_users (
      clerk_user_id TEXT PRIMARY KEY,
      username TEXT NOT NULL UNIQUE COLLATE NOCASE,
      deleted_at TEXT
    );
  `);
  const cols = db.prepare('PRAGMA table_info(armory_users)').all() as { name: string }[];
  if (!cols.some((c) => c.name === 'deleted_at')) {
    try {
      db.exec('ALTER TABLE armory_users ADD COLUMN deleted_at TEXT');
    } catch (err) {
      if (isDuplicateColumnError(err)) {
        log('warn', 'armory_users.deleted_at already exists (benign)', {
          err: err instanceof Error ? err.message : String(err),
        });
        return;
      }
      throw err;
    }
  }
}

export function upsertArmoryUser(clerkUserId: string, username: string | null): void {
  const db = getCatalogDb();
  if (!schemaInitialized) {
    ensureArmoryUsersSchema(db);
    schemaInitialized = true;
  }
  const trimmed = typeof username === 'string' ? username.trim() : '';
  if (trimmed.length > 0) {
    db.prepare(
      `INSERT INTO armory_users (clerk_user_id, username, deleted_at)
       VALUES (?, ?, NULL)
       ON CONFLICT(clerk_user_id) DO UPDATE SET
         username = excluded.username,
         deleted_at = NULL`,
    ).run(clerkUserId, trimmed);
    return;
  }
  db.prepare(`UPDATE armory_users SET deleted_at = NULL WHERE clerk_user_id = ?`).run(clerkUserId);
}

export function markArmoryUserDeleted(clerkUserId: string): void {
  const db = getCatalogDb();
  ensureArmoryUsersSchema(db);
  db.prepare(`UPDATE armory_users SET deleted_at = datetime('now') WHERE clerk_user_id = ?`).run(
    clerkUserId,
  );
}

const CLERK_SYNC_TIMEOUT_MS = 5_000;
const CLERK_FANOUT_MAX_PER_REQUEST = 25;

export function hasActiveArmoryUser(clerkUserId: string): boolean {
  try {
    const db = getCatalogDb();
    if (!schemaInitialized) {
      ensureArmoryUsersSchema(db);
      schemaInitialized = true;
    }
    const row = db
      .prepare('SELECT 1 FROM armory_users WHERE clerk_user_id = ? AND deleted_at IS NULL')
      .get(clerkUserId);
    return row !== undefined;
  } catch {
    return false;
  }
}

export async function syncArmoryUserFromClerk(clerkUserId: string): Promise<string | null> {
  let timeoutTimer: NodeJS.Timeout | undefined;
  try {
    const user = await Promise.race([
      clerkClient.users.getUser(clerkUserId),
      new Promise<never>((_, reject) => {
        timeoutTimer = setTimeout(() => {
          const err = new Error(`Clerk getUser timed out after ${CLERK_SYNC_TIMEOUT_MS}ms`);
          err.name = 'TimeoutError';
          reject(err);
        }, CLERK_SYNC_TIMEOUT_MS);
      }),
    ]);
    const username = user.username?.trim();
    if (!username) return null;
    upsertArmoryUser(clerkUserId, username);
    return username;
  } catch (err) {
    log('warn', 'Failed to sync armory_users from Clerk', {
      clerkUserId,
      err: err instanceof Error ? err.message : String(err),
    });
    return null;
  } finally {
    if (timeoutTimer) clearTimeout(timeoutTimer);
  }
}

export function resolveClerkUserIdByUsername(username: string): string | null {
  const db = getCatalogDb();
  ensureArmoryUsersSchema(db);
  const row = db
    .prepare(
      `SELECT clerk_user_id FROM armory_users
       WHERE lower(username) = lower(?) AND deleted_at IS NULL`,
    )
    .get(username.trim()) as { clerk_user_id: string } | undefined;
  return row?.clerk_user_id ?? null;
}

export function getOwnerDisplayName(
  clerkUserId: string,
  map: Map<string, string | null>,
): string | null {
  const entry = map.get(clerkUserId);
  if (entry === DELETED_USER_LABEL) return DELETED_USER_LABEL;
  if (typeof entry === 'string' && entry.length > 0) return entry;
  return null;
}

const CLERK_SYNC_COOLDOWN_MS = 5 * 60 * 1000;
const CLERK_SYNC_COOLDOWN_MAX_ENTRIES = 2000;
const clerkSyncCooldown = new Map<string, number>();

function pruneClerkSyncCooldown(now: number): void {
  if (clerkSyncCooldown.size <= CLERK_SYNC_COOLDOWN_MAX_ENTRIES) return;
  for (const [id, retryAt] of clerkSyncCooldown) {
    if (retryAt <= now) {
      clerkSyncCooldown.delete(id);
    }
  }
  while (clerkSyncCooldown.size > CLERK_SYNC_COOLDOWN_MAX_ENTRIES) {
    const oldest = clerkSyncCooldown.keys().next().value;
    if (oldest === undefined) break;
    clerkSyncCooldown.delete(oldest);
  }
}

export async function resolveOwnerUsernames(
  clerkUserIds: string[],
): Promise<Map<string, string | null>> {
  const map = getOwnerUsernames(clerkUserIds);
  const missing = [...new Set(clerkUserIds)].filter(
    (id) => typeof id === 'string' && id.length > 0 && !map.has(id),
  );
  if (missing.length === 0) return map;

  const now = Date.now();
  const toSync = missing
    .filter((id) => (clerkSyncCooldown.get(id) ?? 0) <= now)
    .slice(0, CLERK_FANOUT_MAX_PER_REQUEST);
  if (toSync.length === 0) return map;

  await Promise.all(
    toSync.map(async (clerkUserId) => {
      const username = await syncArmoryUserFromClerk(clerkUserId);
      if (username) {
        map.set(clerkUserId, username);
        clerkSyncCooldown.delete(clerkUserId);
      } else {
        clerkSyncCooldown.set(clerkUserId, now + CLERK_SYNC_COOLDOWN_MS);
      }
    }),
  );
  pruneClerkSyncCooldown(now);

  return map;
}

export function getOwnerUsernames(clerkUserIds: string[]): Map<string, string | null> {
  const map = new Map<string, string | null>();
  const unique = [...new Set(clerkUserIds)].filter((id) => typeof id === 'string' && id.length > 0);
  if (unique.length === 0) return map;

  try {
    const db = getCatalogDb();
    ensureArmoryUsersSchema(db);
    const placeholders = unique.map(() => '?').join(',');
    const rows = db
      .prepare(
        `SELECT clerk_user_id, username, deleted_at FROM armory_users WHERE clerk_user_id IN (${placeholders})`,
      )
      .all(...unique) as Array<{
      clerk_user_id: string;
      username: string;
      deleted_at: string | null;
    }>;
    for (const r of rows) {
      map.set(r.clerk_user_id, r.deleted_at ? DELETED_USER_LABEL : r.username);
    }
  } catch (err) {
    log('error', 'Armory user username lookup failed', {
      err: err instanceof Error ? err.message : String(err),
    });
  }

  return map;
}

export { DELETED_USER_LABEL };
