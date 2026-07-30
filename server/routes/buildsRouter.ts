import { Router, type Request, type Response } from 'express';
import { z } from 'zod';

import {
  DELETED_USER_LABEL,
  getOwnerDisplayName,
  resolveOwnerUsernames,
  resolveClerkUserIdByUsername,
} from '../auth/armoryUsers.js';
import { getClerkUserId } from '../auth/clerkUser.js';
import { getClerkAuthState } from '../auth/middleware.js';
import { canReadBuild } from '../buildAccess.js';
import { getUserDb } from '../db/connection.js';
import {
  buildReadAccessContext,
  parseVisibility,
  resolveShareTokenForVisibility,
} from '../visibilityTokens.js';
import {
  BUILD_SELECT_LIST,
  BUILD_SELECT_LIST_FROM_B,
  COPY_PREFIX,
  MAX_BUILDS_PER_USER,
  MAX_LOADOUTS_PER_USER,
  MAX_NAME_LENGTH,
  countUserBuilds,
  fetchPublicLoadoutsForUser,
  normalizeUserDescription,
  parseListPagination,
  parseNumericId,
  sendInternalError,
  toBuildListItem,
  toBuildResponse,
  type BuildRow,
} from './apiShared.js';
import {
  EquipmentTypeSchema,
  MAX_EQUIPMENT_UNIQUE_NAME_LENGTH,
  ModConfigSchema,
} from './modConfigValidation.js';

const BuildCreateBodySchema = z.object({
  name: z.string().trim().min(1).max(MAX_NAME_LENGTH),
  equipment_type: EquipmentTypeSchema,
  equipment_unique_name: z.string().trim().min(1).max(MAX_EQUIPMENT_UNIQUE_NAME_LENGTH),
  mod_config: z.unknown(),
  visibility: z.unknown().optional(),
  description: z.unknown().optional(),
});

export const buildsRouter = Router();

buildsRouter.get('/users/:username/builds', async (req: Request, res: Response) => {
  try {
    const username = String(req.params.username ?? '').trim();
    if (!username) {
      res.status(400).json({ error: 'username is required' });
      return;
    }
    const clerkUserId = resolveClerkUserIdByUsername(username);
    if (!clerkUserId) {
      res.status(404).json({ error: 'User not found' });
      return;
    }
    const { limit, offset } = parseListPagination(req);
    const db = getUserDb();
    const rows = db
      .prepare(
        `SELECT ${BUILD_SELECT_LIST} FROM builds
         WHERE clerk_user_id = ? AND visibility = 'public'
         ORDER BY updated_at DESC
         LIMIT ? OFFSET ?`,
      )
      .all(clerkUserId, limit, offset) as BuildRow[];
    const ownerUsernames = await resolveOwnerUsernames([clerkUserId]);
    const loadouts = fetchPublicLoadoutsForUser(db, clerkUserId, ownerUsernames, {
      limit: MAX_LOADOUTS_PER_USER,
      offset: 0,
    });
    res.json({
      owner_user_id: clerkUserId,
      owner_username: getOwnerDisplayName(clerkUserId, ownerUsernames),
      builds: rows.map((row) => toBuildListItem(row, ownerUsernames)),
      loadouts,
      limit,
      offset,
    });
  } catch (err) {
    sendInternalError(res, 'users.buildsByUsername', err);
  }
});

buildsRouter.get('/builds', (req: Request, res: Response) => {
  try {
    const db = getUserDb();
    const clerkUserId = getClerkUserId(req);
    if (!clerkUserId) {
      res.status(401).json({ error: 'Not authenticated' });
      return;
    }

    const { limit, offset } = parseListPagination(req, {
      defaultLimit: MAX_BUILDS_PER_USER,
      max: MAX_BUILDS_PER_USER,
    });
    const rows = db
      .prepare(
        `SELECT ${BUILD_SELECT_LIST} FROM builds WHERE clerk_user_id = ? ORDER BY updated_at DESC LIMIT ? OFFSET ?`,
      )
      .all(clerkUserId, limit, offset) as BuildRow[];

    const builds = rows.map((row) => toBuildResponse(row));

    res.json({ builds, limit, offset });
  } catch (err) {
    sendInternalError(res, 'builds.list', err);
  }
});

buildsRouter.get('/builds/catalog', (_req: Request, res: Response) => {
  try {
    const db = getUserDb();
    const rows = db
      .prepare(
        `SELECT equipment_type, equipment_unique_name, COUNT(*) AS build_count
         FROM builds
         WHERE visibility = 'public'
         GROUP BY equipment_type, equipment_unique_name
         ORDER BY equipment_type ASC, equipment_unique_name ASC`,
      )
      .all() as Array<{
      equipment_type: string;
      equipment_unique_name: string;
      build_count: number;
    }>;

    res.json({ entries: rows });
  } catch (err) {
    sendInternalError(res, 'builds.catalog', err);
  }
});

buildsRouter.get('/builds/by-user', async (req: Request, res: Response) => {
  try {
    const db = getUserDb();

    const userIdRaw = req.query.clerk_user_id;
    const clerkUserId =
      typeof userIdRaw === 'string' && userIdRaw.trim() !== '' ? userIdRaw.trim() : null;
    if (!clerkUserId) {
      res.status(400).json({ error: 'clerk_user_id is required' });
      return;
    }

    const { limit, offset } = parseListPagination(req);
    const rows = db
      .prepare(
        `SELECT ${BUILD_SELECT_LIST} FROM builds
         WHERE clerk_user_id = ? AND visibility = 'public'
         ORDER BY updated_at DESC
         LIMIT ? OFFSET ?`,
      )
      .all(clerkUserId, limit, offset) as BuildRow[];

    const ownerUsernames = await resolveOwnerUsernames([clerkUserId]);
    const loadouts = fetchPublicLoadoutsForUser(db, clerkUserId, ownerUsernames, {
      limit: MAX_LOADOUTS_PER_USER,
      offset: 0,
    });

    res.json({
      owner_user_id: clerkUserId,
      owner_username: getOwnerDisplayName(clerkUserId, ownerUsernames),
      builds: rows.map((row) => toBuildListItem(row, ownerUsernames)),
      loadouts,
      limit,
      offset,
    });
  } catch (err) {
    sendInternalError(res, 'builds.byUser', err);
  }
});

buildsRouter.get('/builds/by-equipment', async (req: Request, res: Response) => {
  try {
    const db = getUserDb();
    const sessionUserId = getClerkUserId(req);

    const equipmentType =
      typeof req.query.equipment_type === 'string' ? req.query.equipment_type.trim() : '';
    const equipmentUniqueName =
      typeof req.query.equipment_unique_name === 'string'
        ? req.query.equipment_unique_name.trim()
        : '';

    if (!equipmentType || !equipmentUniqueName) {
      res.status(400).json({ error: 'equipment_type and equipment_unique_name are required' });
      return;
    }

    const { limit, offset } = parseListPagination(req);
    const rows = db
      .prepare(
        `SELECT ${BUILD_SELECT_LIST} FROM builds
         WHERE equipment_type = ? AND equipment_unique_name = ?
           AND visibility = 'public'
         ORDER BY updated_at DESC
         LIMIT ? OFFSET ?`,
      )
      .all(equipmentType, equipmentUniqueName, limit, offset) as BuildRow[];

    const ownerUsernames = await resolveOwnerUsernames(rows.map((r) => r.clerk_user_id));

    const loadoutRows = db
      .prepare(
        `SELECT DISTINCT l.id, l.name, l.clerk_user_id, l.visibility, l.updated_at
         FROM loadouts l
         INNER JOIN loadout_builds lb ON lb.loadout_id = l.id
         INNER JOIN builds b ON b.id = lb.build_id
         WHERE b.equipment_type = ? AND b.equipment_unique_name = ?
           AND (COALESCE(l.visibility, 'private') = 'public' OR l.clerk_user_id = ?)
         ORDER BY l.updated_at DESC
         LIMIT ? OFFSET ?`,
      )
      .all(equipmentType, equipmentUniqueName, sessionUserId ?? '', limit, offset) as Array<{
      id: number;
      name: string;
      clerk_user_id: string;
      visibility: string | null;
      updated_at: string;
    }>;

    const loadoutOwnerNames = await resolveOwnerUsernames(loadoutRows.map((r) => r.clerk_user_id));
    const loadouts = loadoutRows.map((row) => ({
      id: String(row.id),
      name: row.name,
      owner_user_id: row.clerk_user_id,
      owner_username: getOwnerDisplayName(row.clerk_user_id, loadoutOwnerNames),
      owner_deleted: loadoutOwnerNames.get(row.clerk_user_id) === DELETED_USER_LABEL,
      visibility: row.visibility ?? 'private',
      updated_at: row.updated_at,
      is_own: sessionUserId != null && row.clerk_user_id === sessionUserId,
    }));

    res.json({
      builds: rows.map((row) => toBuildListItem(row, ownerUsernames)),
      loadouts,
      limit,
      offset,
    });
  } catch (err) {
    sendInternalError(res, 'builds.byEquipment', err);
  }
});

buildsRouter.get('/builds/favorites', (req: Request, res: Response) => {
  try {
    const db = getUserDb();
    const clerkUserId = getClerkUserId(req);
    if (!clerkUserId) {
      res.status(401).json({ error: 'Not authenticated' });
      return;
    }

    const authState = getClerkAuthState(req);
    const readContext = buildReadAccessContext(req, clerkUserId, authState.isArmoryAdmin);
    const { limit, offset } = parseListPagination(req, {
      defaultLimit: MAX_BUILDS_PER_USER,
      max: MAX_BUILDS_PER_USER,
    });
    const rows = db
      .prepare(
        `SELECT ${BUILD_SELECT_LIST_FROM_B}
         FROM builds b
         INNER JOIN build_favorites f ON f.build_id = b.id
         WHERE f.clerk_user_id = ?
         ORDER BY f.created_at DESC
         LIMIT ? OFFSET ?`,
      )
      .all(clerkUserId, limit, offset) as BuildRow[];

    const builds = rows
      .filter((row) => canReadBuild(row, readContext))
      .map((row) => toBuildResponse(row));

    res.json({ builds, limit, offset });
  } catch (err) {
    sendInternalError(res, 'builds.favorites.list', err);
  }
});

buildsRouter.post('/builds/:id/favorite', (req: Request, res: Response) => {
  try {
    const db = getUserDb();
    const clerkUserId = getClerkUserId(req);
    if (!clerkUserId) {
      res.status(401).json({ error: 'Not authenticated' });
      return;
    }

    const id = parseNumericId(req.params.id);
    if (id === null) {
      res.status(400).json({ error: 'Invalid build id' });
      return;
    }

    const row = db.prepare(`SELECT ${BUILD_SELECT_LIST} FROM builds WHERE id = ?`).get(id) as
      | BuildRow
      | undefined;
    if (!row) {
      res.status(404).json({ error: 'Build not found' });
      return;
    }

    const authState = getClerkAuthState(req);
    const readContext = buildReadAccessContext(req, clerkUserId, authState.isArmoryAdmin);
    if (!canReadBuild(row, readContext)) {
      res.status(404).json({ error: 'Build not found' });
      return;
    }

    db.prepare(
      `INSERT OR IGNORE INTO build_favorites (clerk_user_id, build_id, created_at)
       VALUES (?, ?, datetime('now'))`,
    ).run(clerkUserId, id);

    res.json({ success: true, favorited: true });
  } catch (err) {
    sendInternalError(res, 'builds.favorite.add', err);
  }
});

buildsRouter.delete('/builds/:id/favorite', (req: Request, res: Response) => {
  try {
    const db = getUserDb();
    const clerkUserId = getClerkUserId(req);
    if (!clerkUserId) {
      res.status(401).json({ error: 'Not authenticated' });
      return;
    }

    const id = parseNumericId(req.params.id);
    if (id === null) {
      res.status(400).json({ error: 'Invalid build id' });
      return;
    }

    db.prepare('DELETE FROM build_favorites WHERE clerk_user_id = ? AND build_id = ?').run(
      clerkUserId,
      id,
    );

    res.json({ success: true, favorited: false });
  } catch (err) {
    sendInternalError(res, 'builds.favorite.remove', err);
  }
});

buildsRouter.get('/builds/:id/loadouts', async (req: Request, res: Response) => {
  try {
    const db = getUserDb();
    const id = parseNumericId(req.params.id);
    if (id === null) {
      res.status(400).json({ error: 'Invalid build id' });
      return;
    }

    const uid = getClerkUserId(req);
    const buildRow = db.prepare(`SELECT ${BUILD_SELECT_LIST} FROM builds WHERE id = ?`).get(id) as
      | BuildRow
      | undefined;
    const authState = getClerkAuthState(req);
    const readContext = buildReadAccessContext(req, uid, authState.isArmoryAdmin);
    if (!buildRow || !canReadBuild(buildRow, readContext)) {
      res.status(404).json({ error: 'Build not found' });
      return;
    }

    const rows = db
      .prepare(
        `SELECT l.id, l.name, l.clerk_user_id, l.visibility
         FROM loadout_builds lb
         INNER JOIN loadouts l ON l.id = lb.loadout_id
         WHERE lb.build_id = ?
           AND (l.visibility = 'public' OR (? IS NOT NULL AND l.clerk_user_id = ?))
         ORDER BY l.updated_at DESC`,
      )
      .all(id, uid, uid) as Array<{
      id: number;
      name: string;
      clerk_user_id: string;
      visibility: string;
    }>;

    const ownerUsernames = await resolveOwnerUsernames(rows.map((r) => r.clerk_user_id));
    const loadouts = rows.map((row) => ({
      id: String(row.id),
      name: row.name,
      owner_user_id: row.clerk_user_id,
      owner_username: getOwnerDisplayName(row.clerk_user_id, ownerUsernames),
      owner_deleted: ownerUsernames.get(row.clerk_user_id) === DELETED_USER_LABEL,
      is_own: row.clerk_user_id === uid,
    }));

    res.json({ loadouts });
  } catch (err) {
    sendInternalError(res, 'builds.loadouts', err);
  }
});

buildsRouter.get('/builds/:id', async (req: Request, res: Response) => {
  try {
    const db = getUserDb();
    const id = parseNumericId(req.params.id);
    if (id === null) {
      res.status(400).json({ error: 'Invalid build id' });
      return;
    }

    const row = db.prepare(`SELECT ${BUILD_SELECT_LIST} FROM builds WHERE id = ?`).get(id) as
      | BuildRow
      | undefined;
    if (!row) {
      res.status(404).json({ error: 'Build not found' });
      return;
    }

    const sessionUserId = getClerkUserId(req);
    const isOwner = row.clerk_user_id === sessionUserId;
    const authState = getClerkAuthState(req);
    const isGameAdmin = authState.isArmoryAdmin;
    const accessContext = buildReadAccessContext(req, sessionUserId, isGameAdmin);
    if (!canReadBuild(row, accessContext)) {
      res.status(404).json({ error: 'Build not found' });
      return;
    }

    const canEdit = isOwner || isGameAdmin;
    const ownerUsernames = await resolveOwnerUsernames([row.clerk_user_id]);
    const isFavorited =
      sessionUserId != null
        ? Boolean(
            db
              .prepare(
                'SELECT 1 FROM build_favorites WHERE clerk_user_id = ? AND build_id = ? LIMIT 1',
              )
              .get(sessionUserId, id),
          )
        : false;

    res.json({
      build: toBuildResponse(row, isOwner || isGameAdmin),
      owner_user_id: row.clerk_user_id,
      owner_username: getOwnerDisplayName(row.clerk_user_id, ownerUsernames),
      owner_deleted: ownerUsernames.get(row.clerk_user_id) === DELETED_USER_LABEL,
      is_owner: isOwner,
      can_edit: canEdit,
      is_favorited: isFavorited,
    });
  } catch (err) {
    sendInternalError(res, 'builds.getById', err);
  }
});

buildsRouter.post('/builds', (req: Request, res: Response) => {
  try {
    const db = getUserDb();
    const clerkUserId = getClerkUserId(req);
    if (!clerkUserId) {
      res.status(401).json({ error: 'Not authenticated' });
      return;
    }

    const bodyResult = BuildCreateBodySchema.safeParse(req.body);
    if (!bodyResult.success) {
      res.status(400).json({ error: 'Invalid build payload' });
      return;
    }

    const { name, equipment_type, equipment_unique_name, mod_config } = bodyResult.data;
    const visRaw = bodyResult.data.visibility;
    const visibility = parseVisibility(visRaw);
    const shareToken = resolveShareTokenForVisibility(undefined, visibility, null);
    const description = normalizeUserDescription(bodyResult.data.description);

    const modConfigResult = ModConfigSchema.safeParse(mod_config);
    if (!modConfigResult.success) {
      res.status(400).json({ error: 'Invalid mod_config' });
      return;
    }

    if (countUserBuilds(db, clerkUserId) >= MAX_BUILDS_PER_USER) {
      res.status(403).json({
        error: `Build limit reached (max ${MAX_BUILDS_PER_USER} per user)`,
      });
      return;
    }

    const result = db
      .prepare(
        `INSERT INTO builds (clerk_user_id, name, equipment_type, equipment_unique_name, mod_config, visibility, description, share_token, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, datetime('now'), datetime('now'))`,
      )
      .run(
        clerkUserId,
        name,
        equipment_type,
        equipment_unique_name,
        JSON.stringify(modConfigResult.data),
        visibility,
        description,
        shareToken,
      );

    res.json({ success: true, id: result.lastInsertRowid });
  } catch (err) {
    sendInternalError(res, 'builds.create', err);
  }
});

buildsRouter.put('/builds/:id', (req: Request, res: Response) => {
  try {
    const db = getUserDb();
    const clerkUserId = getClerkUserId(req);
    if (!clerkUserId) {
      res.status(401).json({ error: 'Not authenticated' });
      return;
    }

    const id = parseNumericId(req.params.id);
    if (id === null) {
      res.status(400).json({ error: 'Invalid build id' });
      return;
    }
    const { name, mod_config, visibility: visRaw } = req.body;
    const modConfigResult = ModConfigSchema.safeParse(mod_config);
    if (typeof name !== 'string') {
      res.status(400).json({ error: 'Invalid build payload' });
      return;
    }
    const sanitizedName = name.trim();
    if (sanitizedName.length === 0 || sanitizedName.length > MAX_NAME_LENGTH) {
      res.status(400).json({ error: 'Invalid name' });
      return;
    }
    if (!modConfigResult.success) {
      res.status(400).json({ error: 'Invalid mod_config' });
      return;
    }
    const bodyRecord = req.body as Record<string, unknown>;
    const hasVisibility = Object.prototype.hasOwnProperty.call(bodyRecord, 'visibility');

    const authState = getClerkAuthState(req);
    const isGameAdmin = authState.isArmoryAdmin;

    const existing = isGameAdmin
      ? (db.prepare('SELECT visibility, share_token FROM builds WHERE id = ?').get(id) as
          | { visibility: string | null; share_token: string | null }
          | undefined)
      : (db
          .prepare('SELECT visibility, share_token FROM builds WHERE id = ? AND clerk_user_id = ?')
          .get(id, clerkUserId) as
          | { visibility: string | null; share_token: string | null }
          | undefined);
    if (!existing) {
      res.status(404).json({ error: 'Build not found' });
      return;
    }

    const visibility = hasVisibility
      ? parseVisibility(visRaw)
      : parseVisibility(existing.visibility, 'private');
    const shareToken = hasVisibility
      ? resolveShareTokenForVisibility(existing.visibility, visibility, existing.share_token)
      : existing.share_token;
    const hasDescription = Object.prototype.hasOwnProperty.call(bodyRecord, 'description');
    const description = hasDescription
      ? normalizeUserDescription(bodyRecord.description)
      : undefined;

    let sql = 'UPDATE builds SET name = ?, mod_config = ?';
    const params: Array<string | number | null> = [
      sanitizedName,
      JSON.stringify(modConfigResult.data),
    ];
    if (hasVisibility) {
      sql += ', visibility = ?, share_token = ?';
      params.push(visibility, shareToken);
    }
    if (description !== undefined) {
      sql += ', description = ?';
      params.push(description);
    }
    sql += ", updated_at = datetime('now') WHERE id = ?";
    params.push(id);
    if (!isGameAdmin) {
      sql += ' AND clerk_user_id = ?';
      params.push(clerkUserId);
    }

    const result = db.prepare(sql).run(...params);

    if (result.changes < 1) {
      res.status(404).json({ error: 'Build not found' });
      return;
    }

    res.json({ success: true });
  } catch (err) {
    sendInternalError(res, 'builds.update', err);
  }
});

buildsRouter.delete('/builds/:id', (req: Request, res: Response) => {
  try {
    const db = getUserDb();
    const clerkUserId = getClerkUserId(req);
    if (!clerkUserId) {
      res.status(401).json({ error: 'Not authenticated' });
      return;
    }

    const id = parseNumericId(req.params.id);
    if (id === null) {
      res.status(400).json({ error: 'Invalid build id' });
      return;
    }
    const authState = getClerkAuthState(req);
    const isGameAdmin = authState.isArmoryAdmin;

    const changes = db.transaction(() => {
      const row = isGameAdmin
        ? (db.prepare('SELECT id FROM builds WHERE id = ?').get(id) as { id: number } | undefined)
        : (db
            .prepare('SELECT id FROM builds WHERE id = ? AND clerk_user_id = ?')
            .get(id, clerkUserId) as { id: number } | undefined);
      if (!row) {
        return 0;
      }
      db.prepare('DELETE FROM loadout_builds WHERE build_id = ?').run(id);
      const buildResult = isGameAdmin
        ? db.prepare('DELETE FROM builds WHERE id = ?').run(id)
        : db.prepare('DELETE FROM builds WHERE id = ? AND clerk_user_id = ?').run(id, clerkUserId);
      return buildResult.changes;
    })();

    if (changes < 1) {
      res.status(404).json({ error: 'Build not found' });
      return;
    }
    res.json({ success: true });
  } catch (err) {
    sendInternalError(res, 'builds.delete', err);
  }
});

buildsRouter.post('/builds/:id/copy', (req: Request, res: Response) => {
  try {
    const db = getUserDb();
    const clerkUserId = getClerkUserId(req);
    if (!clerkUserId) {
      res.status(401).json({ error: 'Not authenticated' });
      return;
    }
    const id = parseNumericId(req.params.id);
    if (id === null) {
      res.status(400).json({ error: 'Invalid build id' });
      return;
    }
    const source = db.prepare(`SELECT ${BUILD_SELECT_LIST} FROM builds WHERE id = ?`).get(id) as
      | BuildRow
      | undefined;
    if (!source) {
      res.status(404).json({ error: 'Build not found' });
      return;
    }

    const authState = getClerkAuthState(req);
    const isGameAdmin = authState.isArmoryAdmin;
    const readContext = buildReadAccessContext(req, clerkUserId, isGameAdmin);
    if (!canReadBuild(source, readContext)) {
      res.status(404).json({ error: 'Build not found' });
      return;
    }

    const requestedName = typeof req.body?.name === 'string' ? req.body.name.trim() : '';
    const requestedNameTruncated = requestedName.slice(0, MAX_NAME_LENGTH);
    const copyName =
      requestedNameTruncated.length > 0
        ? requestedNameTruncated
        : `${COPY_PREFIX}${source.name.trim().slice(0, MAX_NAME_LENGTH - COPY_PREFIX.length)}`;

    if (countUserBuilds(db, clerkUserId) >= MAX_BUILDS_PER_USER) {
      res.status(403).json({
        error: `Build limit reached (max ${MAX_BUILDS_PER_USER} per user)`,
      });
      return;
    }

    const result = db
      .prepare(
        `INSERT INTO builds (clerk_user_id, name, equipment_type, equipment_unique_name, mod_config, visibility, description, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, 'private', ?, datetime('now'), datetime('now'))`,
      )
      .run(
        clerkUserId,
        copyName,
        source.equipment_type,
        source.equipment_unique_name,
        source.mod_config,
        normalizeUserDescription(source.description),
      );

    res.json({ success: true, id: result.lastInsertRowid });
  } catch (err) {
    sendInternalError(res, 'builds.copy', err);
  }
});
