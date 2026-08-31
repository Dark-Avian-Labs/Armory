import { Router, type Request, type Response } from 'express';

import { getClerkUserId } from '../auth/clerkUser.js';
import { getClerkAuthState } from '../auth/middleware.js';
import { canReadBuild } from '../buildAccess.js';
import { getUserDb } from '../db/connection.js';
import { timingSafeEqualString } from '../http/timingSafeEqual.js';
import { canReadLoadout } from '../loadoutAccess.js';
import {
  buildReadAccessContext,
  parseVisibility,
  resolveShareTokenForVisibility,
} from '../visibilityTokens.js';
import {
  BUILD_SELECT_LIST,
  COPY_PREFIX,
  LOADOUT_SELECT_LIST,
  MAX_LOADOUTS_PER_USER,
  MAX_NAME_LENGTH,
  countUserBuilds,
  countUserLoadouts,
  fetchBuildsByIds,
  MAX_BUILDS_PER_USER,
  normalizeUserDescription,
  parseListPagination,
  parseNumericId,
  sendInternalError,
  toBuildResponse,
  type BuildRow,
} from './apiShared.js';
import { LoadoutSlotTypeSchema } from './modConfigValidation.js';
import {
  LoadoutCreateBodySchema,
  LoadoutUpdateBodySchema,
  loadoutUpdateErrorMessage,
} from './userContentSchemas.js';

export const loadoutsRouter = Router();

loadoutsRouter.get('/loadouts', (req: Request, res: Response) => {
  try {
    const db = getUserDb();
    const clerkUserId = getClerkUserId(req);
    if (!clerkUserId) {
      res.status(401).json({ error: 'Not authenticated' });
      return;
    }
    const { limit, offset } = parseListPagination(req, {
      defaultLimit: MAX_LOADOUTS_PER_USER,
      max: MAX_LOADOUTS_PER_USER,
    });
    const loadouts = db
      .prepare(
        `SELECT ${LOADOUT_SELECT_LIST} FROM loadouts WHERE clerk_user_id = ? ORDER BY updated_at DESC LIMIT ? OFFSET ?`,
      )
      .all(clerkUserId, limit, offset) as Array<Record<string, unknown>>;
    if (loadouts.length === 0) {
      res.json({ loadouts, limit, offset });
      return;
    }
    const loadoutIds = loadouts
      .map((l) => l.id)
      .filter((id): id is number => typeof id === 'number' && Number.isFinite(id));
    if (loadoutIds.length === 0) {
      for (const l of loadouts) {
        (l as Record<string, unknown>).builds = [];
      }
      res.json({ loadouts, limit, offset });
      return;
    }
    const placeholders = loadoutIds.map(() => '?').join(',');
    const allBuilds = db
      .prepare(
        `SELECT loadout_id, build_id, slot_type FROM loadout_builds WHERE loadout_id IN (${placeholders})`,
      )
      .all(...loadoutIds) as Array<Record<string, unknown>>;
    const buildsByLoadoutId = new Map<number, Array<Record<string, unknown>>>();
    for (const b of allBuilds) {
      const lid = b.loadout_id;
      if (typeof lid !== 'number' || !Number.isFinite(lid)) continue;
      const list = buildsByLoadoutId.get(lid);
      if (list) {
        list.push(b);
      } else {
        buildsByLoadoutId.set(lid, [b]);
      }
    }
    for (const l of loadouts) {
      const id = l.id;
      (l as Record<string, unknown>).builds =
        typeof id === 'number' && Number.isFinite(id) ? (buildsByLoadoutId.get(id) ?? []) : [];
    }
    res.json({ loadouts, limit, offset });
  } catch (err) {
    sendInternalError(res, 'loadouts.list', err);
  }
});

loadoutsRouter.get('/loadouts/:id', (req: Request, res: Response) => {
  try {
    const db = getUserDb();
    const id = parseNumericId(req.params.id);
    if (id === null) {
      res.status(400).json({ error: 'Invalid loadout id' });
      return;
    }

    const loadout = db
      .prepare(`SELECT ${LOADOUT_SELECT_LIST} FROM loadouts WHERE id = ?`)
      .get(id) as Record<string, unknown> | undefined;
    if (!loadout) {
      res.status(404).json({ error: 'Loadout not found' });
      return;
    }
    const uid = getClerkUserId(req);
    const authState = getClerkAuthState(req);
    const isGameAdmin = authState.isArmoryAdmin;
    const readContext = buildReadAccessContext(req, uid, isGameAdmin);
    const ownerUserId = loadout.clerk_user_id;
    const isOwner = typeof ownerUserId === 'string' && uid === ownerUserId;
    const vis = typeof loadout.visibility === 'string' ? loadout.visibility : 'private';
    const loadoutAccessRow = {
      clerk_user_id: typeof ownerUserId === 'string' ? ownerUserId : '',
      visibility: vis,
      share_token: typeof loadout.share_token === 'string' ? loadout.share_token : null,
    };
    if (!canReadLoadout(loadoutAccessRow, readContext)) {
      res.status(404).json({ error: 'Loadout not found' });
      return;
    }

    const hasLoadoutTokenAccess =
      vis === 'unlisted' &&
      readContext.shareToken != null &&
      loadoutAccessRow.share_token != null &&
      timingSafeEqualString(loadoutAccessRow.share_token, readContext.shareToken);

    const linkRows = db
      .prepare('SELECT build_id, slot_type FROM loadout_builds WHERE loadout_id = ?')
      .all(id) as Array<{ build_id: number; slot_type: string }>;

    const buildsById = new Map(
      fetchBuildsByIds(
        db,
        linkRows.map((link) => link.build_id),
      ).map((row) => [row.id, row]),
    );

    const buildsWithSlots: Array<{ slot_type: string; build: Record<string, unknown> }> = [];
    for (const link of linkRows) {
      const buildRow = buildsById.get(link.build_id);
      if (!buildRow) continue;
      const buildVis = buildRow.visibility ?? 'private';
      let canSeeBuild = canReadBuild(buildRow, readContext);
      if (
        !canSeeBuild &&
        hasLoadoutTokenAccess &&
        buildRow.clerk_user_id === loadoutAccessRow.clerk_user_id &&
        (buildVis === 'public' || buildVis === 'unlisted')
      ) {
        canSeeBuild = true;
      }
      if (!canSeeBuild) continue;
      buildsWithSlots.push({
        slot_type: link.slot_type,
        build: toBuildResponse(buildRow, isOwner || isGameAdmin),
      });
    }

    res.json({
      loadout: {
        id: loadout.id,
        name: loadout.name,
        user_id: loadout.clerk_user_id,
        visibility: vis,
        description: typeof loadout.description === 'string' ? loadout.description : null,
        share_token: isOwner || isGameAdmin ? loadoutAccessRow.share_token : undefined,
        created_at: loadout.created_at,
        updated_at: loadout.updated_at,
        builds: buildsWithSlots,
      },
      is_own: isOwner,
    });
  } catch (err) {
    sendInternalError(res, 'loadouts.getById', err);
  }
});

loadoutsRouter.post('/loadouts', (req: Request, res: Response) => {
  try {
    const db = getUserDb();
    const clerkUserId = getClerkUserId(req);
    if (!clerkUserId) {
      res.status(401).json({ error: 'Not authenticated' });
      return;
    }
    const bodyResult = LoadoutCreateBodySchema.safeParse(req.body);
    if (!bodyResult.success) {
      res.status(400).json({ error: 'Invalid name' });
      return;
    }
    const sanitizedName = bodyResult.data.name;

    if (countUserLoadouts(db, clerkUserId) >= MAX_LOADOUTS_PER_USER) {
      res.status(403).json({
        error: `Loadout limit reached (max ${MAX_LOADOUTS_PER_USER} per user)`,
      });
      return;
    }

    const result = db
      .prepare('INSERT INTO loadouts (clerk_user_id, name) VALUES (?, ?)')
      .run(clerkUserId, sanitizedName);
    res.json({ success: true, id: result.lastInsertRowid });
  } catch (err) {
    sendInternalError(res, 'loadouts.create', err);
  }
});

loadoutsRouter.put('/loadouts/:id', (req: Request, res: Response) => {
  try {
    const db = getUserDb();
    const clerkUserId = getClerkUserId(req);
    if (!clerkUserId) {
      res.status(401).json({ error: 'Not authenticated' });
      return;
    }
    const parsedId = parseNumericId(req.params.id);
    if (parsedId === null) {
      res.status(400).json({ error: 'Invalid loadout id' });
      return;
    }
    const existing = db
      .prepare(`SELECT ${LOADOUT_SELECT_LIST} FROM loadouts WHERE id = ? AND clerk_user_id = ?`)
      .get(parsedId, clerkUserId) as Record<string, unknown> | undefined;
    if (!existing) {
      res.status(404).json({ error: 'Loadout not found' });
      return;
    }

    const bodyResult = LoadoutUpdateBodySchema.safeParse(req.body);
    if (!bodyResult.success) {
      res.status(400).json({ error: loadoutUpdateErrorMessage(bodyResult.error) });
      return;
    }

    const hasName = bodyResult.data.name !== undefined;
    const hasVisibility = bodyResult.data.visibility !== undefined;
    const hasDescription = bodyResult.data.description !== undefined;

    let nextName = String(existing.name ?? '').trim();
    if (hasName && bodyResult.data.name !== undefined) {
      nextName = bodyResult.data.name;
    }

    let nextVisibility = String(existing.visibility ?? 'private');
    if (hasVisibility && bodyResult.data.visibility !== undefined) {
      nextVisibility = bodyResult.data.visibility;
    }

    let nextDescription: string | null =
      typeof existing.description === 'string' ? existing.description : null;
    if (hasDescription) {
      nextDescription = normalizeUserDescription(bodyResult.data.description);
    }

    if (nextVisibility === 'public' || nextVisibility === 'unlisted') {
      const blocked = db
        .prepare(
          `SELECT COUNT(*) AS c FROM loadout_builds lb
           INNER JOIN builds b ON b.id = lb.build_id
           WHERE lb.loadout_id = ?
             AND COALESCE(b.visibility, 'private') NOT IN ('public', 'unlisted')`,
        )
        .get(parsedId) as { c: number } | undefined;
      if (blocked && blocked.c > 0) {
        res.status(400).json({
          error:
            'Every build in this loadout must be public or unlisted before the loadout can be public or unlisted.',
        });
        return;
      }
    }

    const nextShareToken = resolveShareTokenForVisibility(
      String(existing.visibility ?? 'private'),
      parseVisibility(nextVisibility),
      typeof existing.share_token === 'string' ? existing.share_token : null,
    );

    db.prepare(
      "UPDATE loadouts SET name = ?, visibility = ?, description = ?, share_token = ?, updated_at = datetime('now') WHERE id = ? AND clerk_user_id = ?",
    ).run(nextName, nextVisibility, nextDescription, nextShareToken, parsedId, clerkUserId);
    res.json({
      success: true,
      name: nextName,
      visibility: nextVisibility,
      description: nextDescription,
      share_token: nextShareToken,
    });
  } catch (err) {
    sendInternalError(res, 'loadouts.update', err);
  }
});

loadoutsRouter.post('/loadouts/:id/publish', (req: Request, res: Response) => {
  try {
    const db = getUserDb();
    const clerkUserId = getClerkUserId(req);
    if (!clerkUserId) {
      res.status(401).json({ error: 'Not authenticated' });
      return;
    }
    const loadoutId = parseNumericId(req.params.id);
    if (loadoutId === null) {
      res.status(400).json({ error: 'Invalid loadout id' });
      return;
    }
    const owned = db
      .prepare('SELECT id FROM loadouts WHERE id = ? AND clerk_user_id = ?')
      .get(loadoutId, clerkUserId) as { id: number } | undefined;
    if (!owned) {
      res.status(404).json({ error: 'Loadout not found' });
      return;
    }
    const links = db
      .prepare('SELECT build_id FROM loadout_builds WHERE loadout_id = ?')
      .all(loadoutId) as Array<{ build_id: number }>;
    if (links.length === 0) {
      res.status(400).json({ error: 'Add at least one build to the loadout before publishing.' });
      return;
    }
    try {
      db.transaction(() => {
        for (const { build_id } of links) {
          const result = db
            .prepare(
              "UPDATE builds SET visibility = 'public', updated_at = datetime('now') WHERE id = ? AND clerk_user_id = ?",
            )
            .run(build_id, clerkUserId);
          if (result.changes < 1) {
            throw new Error('LOADOUT_BUILD_NOT_OWNED');
          }
        }
        db.prepare(
          "UPDATE loadouts SET visibility = 'public', share_token = NULL, updated_at = datetime('now') WHERE id = ? AND clerk_user_id = ?",
        ).run(loadoutId, clerkUserId);
      })();
    } catch (e) {
      if (e instanceof Error && e.message === 'LOADOUT_BUILD_NOT_OWNED') {
        res.status(400).json({
          error:
            'This loadout references a build you do not own; remove it or copy the build before publishing.',
        });
        return;
      }
      throw e;
    }
    res.json({ success: true });
  } catch (err) {
    sendInternalError(res, 'loadouts.publish', err);
  }
});

loadoutsRouter.delete('/loadouts/:id', (req: Request, res: Response) => {
  try {
    const db = getUserDb();
    const clerkUserId = getClerkUserId(req);
    if (!clerkUserId) {
      res.status(401).json({ error: 'Not authenticated' });
      return;
    }
    const id = parseNumericId(req.params.id);
    if (id === null) {
      res.status(400).json({ error: 'Invalid loadout id' });
      return;
    }
    const owned = db
      .prepare('SELECT id FROM loadouts WHERE id = ? AND clerk_user_id = ?')
      .get(id, clerkUserId) as { id: number } | undefined;
    if (!owned) {
      res.status(404).json({ error: 'Loadout not found' });
      return;
    }
    db.transaction(() => {
      db.prepare('DELETE FROM loadout_builds WHERE loadout_id = ?').run(id);
      db.prepare('DELETE FROM loadouts WHERE id = ? AND clerk_user_id = ?').run(id, clerkUserId);
    })();
    res.json({ success: true });
  } catch (err) {
    sendInternalError(res, 'loadouts.delete', err);
  }
});

loadoutsRouter.post('/loadouts/:id/copy', (req: Request, res: Response) => {
  try {
    const db = getUserDb();
    const clerkUserId = getClerkUserId(req);
    if (!clerkUserId) {
      res.status(401).json({ error: 'Not authenticated' });
      return;
    }
    const id = parseNumericId(req.params.id);
    if (id === null) {
      res.status(400).json({ error: 'Invalid loadout id' });
      return;
    }

    const sourceLoadout = db
      .prepare(`SELECT ${LOADOUT_SELECT_LIST} FROM loadouts WHERE id = ?`)
      .get(id) as Record<string, unknown> | undefined;
    if (!sourceLoadout) {
      res.status(404).json({ error: 'Loadout not found' });
      return;
    }
    const sourceUserId = sourceLoadout.clerk_user_id;
    if (typeof sourceUserId !== 'string' || sourceUserId !== clerkUserId) {
      res.status(403).json({ error: 'Forbidden' });
      return;
    }

    if (countUserLoadouts(db, clerkUserId) >= MAX_LOADOUTS_PER_USER) {
      res.status(403).json({
        error: `Loadout limit reached (max ${MAX_LOADOUTS_PER_USER} per user)`,
      });
      return;
    }

    const sourceLinks = db
      .prepare('SELECT build_id, slot_type FROM loadout_builds WHERE loadout_id = ?')
      .all(id) as Array<{
      build_id: number;
      slot_type: string;
    }>;
    const buildsNeeded = sourceLinks.length;
    if (countUserBuilds(db, clerkUserId) + buildsNeeded > MAX_BUILDS_PER_USER) {
      res.status(403).json({
        error: `Build limit would be exceeded (max ${MAX_BUILDS_PER_USER} per user)`,
      });
      return;
    }

    const requestedName = typeof req.body?.name === 'string' ? req.body.name.trim() : '';
    const requestedNameTruncated = requestedName.slice(0, MAX_NAME_LENGTH);
    const sourceName =
      typeof sourceLoadout.name === 'string' ? sourceLoadout.name.trim() : 'Loadout';
    const copyName =
      requestedNameTruncated.length > 0
        ? requestedNameTruncated
        : `${COPY_PREFIX}${sourceName.slice(0, MAX_NAME_LENGTH - COPY_PREFIX.length)}`;

    const newLoadoutId = db.transaction(() => {
      const createdLoadout = db
        .prepare('INSERT INTO loadouts (clerk_user_id, name, description) VALUES (?, ?, ?)')
        .run(clerkUserId, copyName, normalizeUserDescription(sourceLoadout.description));
      const newId = Number(createdLoadout.lastInsertRowid);

      for (const link of sourceLinks) {
        const slotParsed = LoadoutSlotTypeSchema.safeParse(link.slot_type);
        if (!slotParsed.success) continue;
        const sourceBuild = db
          .prepare(`SELECT ${BUILD_SELECT_LIST} FROM builds WHERE id = ?`)
          .get(link.build_id) as BuildRow | undefined;
        if (!sourceBuild) {
          continue;
        }
        const copiedBuild = db
          .prepare(
            `INSERT INTO builds (clerk_user_id, name, equipment_type, equipment_unique_name, mod_config, visibility, description, share_token, created_at, updated_at)
             VALUES (?, ?, ?, ?, ?, 'private', ?, NULL, datetime('now'), datetime('now'))`,
          )
          .run(
            clerkUserId,
            `${COPY_PREFIX}${sourceBuild.name.slice(0, MAX_NAME_LENGTH - COPY_PREFIX.length)}`,
            sourceBuild.equipment_type,
            sourceBuild.equipment_unique_name,
            sourceBuild.mod_config,
            normalizeUserDescription(sourceBuild.description),
          );
        db.prepare(
          'INSERT OR REPLACE INTO loadout_builds (loadout_id, build_id, slot_type) VALUES (?, ?, ?)',
        ).run(newId, copiedBuild.lastInsertRowid, slotParsed.data);
      }

      return newId;
    })();

    res.json({ success: true, id: newLoadoutId });
  } catch (err) {
    sendInternalError(res, 'loadouts.copy', err);
  }
});

loadoutsRouter.post('/loadouts/:id/builds', (req: Request, res: Response) => {
  try {
    const db = getUserDb();
    const clerkUserId = getClerkUserId(req);
    if (!clerkUserId) {
      res.status(401).json({ error: 'Not authenticated' });
      return;
    }
    const loadoutId = parseNumericId(req.params.id);
    if (loadoutId === null) {
      res.status(400).json({ error: 'Invalid loadout id' });
      return;
    }
    const { build_id, slot_type } = req.body;
    const buildId = Number.parseInt(String(build_id), 10);
    const slotParsed = LoadoutSlotTypeSchema.safeParse(slot_type);
    if (!Number.isFinite(buildId) || buildId <= 0 || !slotParsed.success) {
      res.status(400).json({ error: 'Invalid loadout build payload' });
      return;
    }
    const result = db
      .prepare(
        'INSERT OR REPLACE INTO loadout_builds (loadout_id, build_id, slot_type) SELECT ?, ?, ? WHERE EXISTS (SELECT 1 FROM loadouts WHERE id = ? AND clerk_user_id = ?) AND EXISTS (SELECT 1 FROM builds WHERE id = ? AND clerk_user_id = ?)',
      )
      .run(loadoutId, buildId, slotParsed.data, loadoutId, clerkUserId, buildId, clerkUserId);
    if (result.changes === 0) {
      res.status(404).json({
        error: 'Loadout or build not found, or you do not have permission to add it',
      });
      return;
    }
    res.json({ success: true });
  } catch (err) {
    sendInternalError(res, 'loadouts.addBuild', err);
  }
});

loadoutsRouter.delete('/loadouts/:id/builds/:slotType', (req: Request, res: Response) => {
  try {
    const db = getUserDb();
    const clerkUserId = getClerkUserId(req);
    if (!clerkUserId) {
      res.status(401).json({ error: 'Not authenticated' });
      return;
    }
    const loadoutId = parseNumericId(req.params.id);
    if (loadoutId === null) {
      res.status(400).json({ error: 'Invalid loadout id' });
      return;
    }
    const slotParsed = LoadoutSlotTypeSchema.safeParse(req.params.slotType);
    if (!slotParsed.success) {
      res.status(400).json({ error: 'Invalid slot type' });
      return;
    }
    db.prepare(
      'DELETE FROM loadout_builds WHERE loadout_id = ? AND slot_type = ? AND EXISTS (SELECT 1 FROM loadouts WHERE id = ? AND clerk_user_id = ?)',
    ).run(loadoutId, slotParsed.data, loadoutId, clerkUserId);
    res.json({ success: true });
  } catch (err) {
    sendInternalError(res, 'loadouts.removeBuild', err);
  }
});
