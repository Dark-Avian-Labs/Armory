import { Router, type Request, type Response } from 'express';

import { ARTIFACT_SLOT_STORAGE_VALUES } from '../../shared/artifactSlotState.js';
import { MAX_ARTIFACT_SLOTS_STORAGE_LENGTH } from '../../shared/equipmentSlotConfig.js';
import { parseForceSteps } from '../../shared/pipelineSteps.js';
import { ARCANE_PUBLIC_LIST_SQL, bindArcanePublicListParams } from '../arcaneCatalog.js';
import {
  classifyArcaneCompatTags,
  isOperatorOnlyArcane,
  type ArcaneCompatTag,
} from '../arcaneCompat.js';
import { getClerkUserId } from '../auth/clerkUser.js';
import { requireArmoryAdmin } from '../auth/middleware.js';
import { sendCachedCatalogJson } from '../cache/catalogResponseCache.js';
import { getCachedModList } from '../cache/modListCache.js';
import { getCatalogDb } from '../db/connection.js';
import { dedupeHelminthAbilityRows } from '../helminthAbilityDedupe.js';
import {
  getAdminImportSnapshot,
  resetAdminImportLock,
  startAdminImportJob,
  subscribeAdminImportSnapshot,
} from '../import/adminImportJob.js';
import { log } from '../logger.js';
import { buildAbilitiesListQuery } from './abilitiesListQuery.js';
import {
  WEAPON_CATEGORY_TO_TYPE,
  WEAPON_JUNK_PREFIXES,
  MOD_API_FROM,
  MOD_API_SELECT_LIST,
  type ModListQuery,
  getAllowedArcaneTags,
  loadDedupedMods,
  normalizeModApiRow,
  parseListPagination,
  sendInternalError,
} from './apiShared.js';

export const catalogRouter = Router();

catalogRouter.get('/health', (_req: Request, res: Response) => {
  res.json({ status: 'ok', app: 'Armory' });
});

catalogRouter.get('/warframes', (req: Request, res: Response) => {
  try {
    sendCachedCatalogJson(req, res, 'warframes', () => {
      const db = getCatalogDb();
      const rows = db.prepare('SELECT * FROM warframes ORDER BY name').all();
      return { items: rows };
    });
  } catch (err) {
    sendInternalError(res, 'warframes.list', err);
  }
});

catalogRouter.get('/weapons', (req: Request, res: Response) => {
  try {
    const type = typeof req.query.type === 'string' ? req.query.type : undefined;
    sendCachedCatalogJson(req, res, `weapons:${type ?? ''}`, () => {
      const db = getCatalogDb();
      let rows;
      if (type) {
        rows = db
          .prepare('SELECT * FROM weapons WHERE product_category = ? ORDER BY name')
          .all(type);
      } else {
        rows = db.prepare('SELECT * FROM weapons ORDER BY name').all();
      }

      const filtered = (rows as Array<{ unique_name: string }>).filter(
        (r) => !WEAPON_JUNK_PREFIXES.some((p) => r.unique_name.startsWith(p)),
      );

      return { items: filtered };
    });
  } catch (err) {
    sendInternalError(res, 'weapons.list', err);
  }
});

catalogRouter.get('/incarnon', (req: Request, res: Response) => {
  try {
    const weaponUniqueName = typeof req.query.weapon === 'string' ? req.query.weapon.trim() : '';
    if (!weaponUniqueName) {
      res.status(400).json({ error: 'weapon query parameter is required' });
      return;
    }

    const db = getCatalogDb();
    const row = db
      .prepare('SELECT has_incarnon, incarnon_data FROM weapons WHERE unique_name = ?')
      .get(weaponUniqueName) as
      | { has_incarnon?: number; incarnon_data?: string | null }
      | undefined;

    if (!row) {
      res.status(404).json({ error: 'Weapon not found' });
      return;
    }

    let data = null;
    if (row.incarnon_data) {
      try {
        data = JSON.parse(row.incarnon_data);
      } catch (parseErr) {
        log('error', 'incarnon.get: failed to parse weapons.incarnon_data', {
          weaponUniqueName,
          incarnon_data: row.incarnon_data,
          err: parseErr instanceof Error ? parseErr.message : String(parseErr),
        });
        data = null;
      }
    }

    res.json({
      hasIncarnon: row.has_incarnon === 1,
      data,
    });
  } catch (err) {
    sendInternalError(res, 'incarnon.get', err);
  }
});

catalogRouter.get('/companions', (req: Request, res: Response) => {
  try {
    sendCachedCatalogJson(req, res, 'companions', () => {
      const db = getCatalogDb();
      const rows = db.prepare('SELECT * FROM companions ORDER BY name').all();
      return { items: rows };
    });
  } catch (err) {
    sendInternalError(res, 'companions.list', err);
  }
});

catalogRouter.get('/search', (req: Request, res: Response) => {
  try {
    const db = getCatalogDb();
    const term = String(req.query.q ?? '')
      .trim()
      .toLowerCase();
    const limitRaw = Number(req.query.limit ?? 20);
    const limit = Number.isFinite(limitRaw) ? Math.min(Math.max(Math.trunc(limitRaw), 1), 50) : 20;
    if (term.length < 2) {
      res.json({ equipment: [], users: [] });
      return;
    }

    const escapedTerm = term.replace(/[\\%_]/g, '\\$&');
    const like = `%${escapedTerm}%`;
    const warframes = db
      .prepare(
        `SELECT name, unique_name, image_path, product_category
         FROM warframes
         WHERE lower(name) LIKE ? ESCAPE '\\'
         LIMIT ?`,
      )
      .all(like, limit) as Array<{
      name: string;
      unique_name: string;
      image_path: string | null;
      product_category: string | null;
    }>;
    const weapons = db
      .prepare(
        `SELECT name, unique_name, image_path, product_category
         FROM weapons
         WHERE lower(name) LIKE ? ESCAPE '\\'
         LIMIT ?`,
      )
      .all(like, limit) as Array<{
      name: string;
      unique_name: string;
      image_path: string | null;
      product_category: string | null;
    }>;
    const companions = db
      .prepare(
        `SELECT name, unique_name, image_path
         FROM companions
         WHERE lower(name) LIKE ? ESCAPE '\\'
         LIMIT ?`,
      )
      .all(like, limit) as Array<{
      name: string;
      unique_name: string;
      image_path: string | null;
    }>;

    const equipment = [
      ...warframes.map((item) => ({
        category: item.product_category || 'Warframes',
        name: item.name,
        unique_name: item.unique_name,
        image_path: item.image_path ?? undefined,
        equipment_type:
          item.product_category === 'Archwings'
            ? 'archwing'
            : item.product_category === 'Necramechs'
              ? 'necramech'
              : 'warframe',
      })),
      ...weapons.map((item) => ({
        category: item.product_category || 'Weapons',
        name: item.name,
        unique_name: item.unique_name,
        image_path: item.image_path ?? undefined,
        equipment_type: WEAPON_CATEGORY_TO_TYPE[item.product_category ?? ''] ?? 'primary',
      })),
      ...companions.map((item) => ({
        category: 'Companions',
        name: item.name,
        unique_name: item.unique_name,
        image_path: item.image_path ?? undefined,
        equipment_type: 'companion',
      })),
    ]
      .sort((a, b) => a.name.localeCompare(b.name))
      .slice(0, limit);

    const userRows = db
      .prepare(
        `SELECT clerk_user_id, username FROM armory_users
         WHERE deleted_at IS NULL AND lower(username) LIKE ? ESCAPE '\\'
         ORDER BY username ASC
         LIMIT ?`,
      )
      .all(like, Math.min(limit, 10)) as Array<{ clerk_user_id: string; username: string }>;

    const users = userRows.map((u) => ({
      username: u.username,
      clerk_user_id: u.clerk_user_id,
      deleted: false,
    }));

    res.json({ equipment, users });
  } catch (err) {
    sendInternalError(res, 'search.query', err);
  }
});

catalogRouter.get('/mods', async (req: Request, res: Response) => {
  try {
    const db = getCatalogDb();
    const typesRaw = typeof req.query.types === 'string' ? req.query.types : undefined;
    const typeRaw = typeof req.query.type === 'string' ? req.query.type : undefined;
    const rarity = typeof req.query.rarity === 'string' ? req.query.rarity : undefined;
    const search = typeof req.query.search === 'string' ? req.query.search : undefined;
    const query: ModListQuery = { typesRaw, typeRaw, rarity, search };
    const cacheKey = JSON.stringify(query);
    const { limit, offset } = parseListPagination(req);

    const allItems = await getCachedModList(cacheKey, () => loadDedupedMods(db, query));

    const responseLimit = limit === null ? allItems.length : limit;
    const responseOffset = limit === null ? 0 : offset;
    const page = allItems.slice(responseOffset, responseOffset + responseLimit);
    res.json({
      items: page,
      total: allItems.length,
      limit: responseLimit,
      offset: responseOffset,
    });
  } catch (err) {
    sendInternalError(res, 'mods.list', err);
  }
});

catalogRouter.get('/mods/:uniqueName', (req: Request, res: Response) => {
  try {
    const db = getCatalogDb();
    const uniqueName = String(req.params.uniqueName);
    const raw = db
      .prepare(`SELECT ${MOD_API_SELECT_LIST} ${MOD_API_FROM} WHERE m.unique_name = ?`)
      .get(uniqueName) as Record<string, unknown> | undefined;
    const mod = raw ? normalizeModApiRow(raw) : undefined;
    if (!mod) {
      res.status(404).json({ error: 'Mod not found' });
      return;
    }

    const levelStats = db
      .prepare('SELECT * FROM mod_level_stats WHERE mod_unique_name = ? ORDER BY rank')
      .all(uniqueName);

    res.json({ mod, levelStats });
  } catch (err) {
    sendInternalError(res, 'mods.getByUniqueName', err);
  }
});

catalogRouter.get('/arcanes', (req: Request, res: Response) => {
  try {
    const equipmentType =
      typeof req.query.equipment_type === 'string' ? req.query.equipment_type : undefined;
    sendCachedCatalogJson(req, res, `arcanes:${equipmentType ?? ''}`, () => {
      const db = getCatalogDb();
      const rows = db
        .prepare(`SELECT * FROM arcanes WHERE ${ARCANE_PUBLIC_LIST_SQL} ORDER BY name`)
        .all(...bindArcanePublicListParams()) as Array<Record<string, unknown>>;

      const normalized: Array<Record<string, unknown> & { compat_tags: ArcaneCompatTag[] }> =
        rows.map((row) => ({
          ...row,
          compat_tags: classifyArcaneCompatTags(row.unique_name, row.name),
        }));

      const allowedTags = getAllowedArcaneTags(equipmentType);
      const items =
        allowedTags === null
          ? normalized
          : normalized.filter((row) => {
              if (allowedTags.has('warframe') && isOperatorOnlyArcane(row.unique_name, row.name)) {
                return false;
              }
              return row.compat_tags.some((tag) => allowedTags.has(tag));
            });

      return { items };
    });
  } catch (err) {
    sendInternalError(res, 'arcanes.list', err);
  }
});

catalogRouter.get('/abilities', (req: Request, res: Response) => {
  try {
    const warframe = typeof req.query.warframe === 'string' ? req.query.warframe : undefined;
    const abilityNames =
      typeof req.query.ability_names === 'string'
        ? req.query.ability_names.split(',').filter(Boolean)
        : [];

    const cacheKey = `abilities:${warframe ?? ''}:${abilityNames.join(',')}`;
    sendCachedCatalogJson(req, res, cacheKey, () => {
      const db = getCatalogDb();
      const filter = buildAbilitiesListQuery(warframe, abilityNames);
      const rows = filter
        ? db
            .prepare(`SELECT * FROM abilities WHERE ${filter.whereSql} ORDER BY name`)
            .all(...filter.params)
        : db.prepare('SELECT * FROM abilities ORDER BY name').all();
      return { items: rows };
    });
  } catch (err) {
    sendInternalError(res, 'abilities.list', err);
  }
});

catalogRouter.get('/helminth-abilities', (req: Request, res: Response) => {
  try {
    sendCachedCatalogJson(req, res, 'helminth-abilities', () => {
      const db = getCatalogDb();
      const rows = db
        .prepare('SELECT * FROM abilities WHERE is_helminth_extractable = 1 ORDER BY name')
        .all() as Array<Record<string, unknown> & { unique_name: string; name?: string }>;
      return { items: dedupeHelminthAbilityRows(rows) };
    });
  } catch (err) {
    sendInternalError(res, 'helminthAbilities.list', err);
  }
});

catalogRouter.get('/riven-stats', (req: Request, res: Response) => {
  try {
    const db = getCatalogDb();
    const weaponType =
      typeof req.query.weapon_type === 'string' ? req.query.weapon_type : undefined;

    let sql =
      "SELECT unique_name, name, compat_name, upgrade_entries FROM mods WHERE upgrade_entries IS NOT NULL AND upgrade_entries != ''";
    const params: string[] = [];

    if (weaponType) {
      sql += ' AND type = ?';
      params.push(weaponType);
    }

    sql += ' ORDER BY name';
    const rows = db.prepare(sql).all(...params);
    res.json({ items: rows });
  } catch (err) {
    sendInternalError(res, 'rivenStats.list', err);
  }
});

catalogRouter.get('/archon-shards', (_req: Request, res: Response) => {
  try {
    const db = getCatalogDb();
    const types = db.prepare('SELECT * FROM archon_shard_types ORDER BY sort_order').all() as Array<
      Record<string, unknown>
    >;
    const buffs = db.prepare('SELECT * FROM archon_shard_buffs ORDER BY sort_order').all() as Array<
      Record<string, unknown>
    >;

    const result = types.map((t) => ({
      ...t,
      buffs: buffs.filter((b) => b.shard_type_id === t.id),
    }));

    res.json({ shards: result });
  } catch (err) {
    sendInternalError(res, 'archonShards.list', err);
  }
});

function resolveArtifactSlotsTable(
  uniqueName: string,
): 'warframes' | 'weapons' | 'companions' | null {
  const db = getCatalogDb();
  const row = db
    .prepare(
      `SELECT 'warframes' AS tbl FROM warframes WHERE unique_name = ?
       UNION ALL SELECT 'weapons' FROM weapons WHERE unique_name = ?
       UNION ALL SELECT 'companions' FROM companions WHERE unique_name = ?`,
    )
    .get(uniqueName, uniqueName, uniqueName) as { tbl: string } | undefined;
  const tbl = row?.tbl;
  if (tbl === 'warframes' || tbl === 'weapons' || tbl === 'companions') return tbl;
  return null;
}

catalogRouter.patch(
  '/admin/catalog/artifact-slots',
  requireArmoryAdmin,
  (req: Request, res: Response) => {
    try {
      const body = req.body as { unique_name?: unknown; artifact_slots?: unknown };
      const uniqueName = typeof body.unique_name === 'string' ? body.unique_name.trim() : '';
      if (!uniqueName) {
        res.status(400).json({ error: 'unique_name is required' });
        return;
      }
      if (!Array.isArray(body.artifact_slots) || body.artifact_slots.length === 0) {
        res.status(400).json({ error: 'artifact_slots must be a non-empty array' });
        return;
      }
      if (body.artifact_slots.length > MAX_ARTIFACT_SLOTS_STORAGE_LENGTH) {
        res.status(400).json({
          error: `artifact_slots supports at most ${MAX_ARTIFACT_SLOTS_STORAGE_LENGTH} entries`,
        });
        return;
      }
      for (const entry of body.artifact_slots) {
        if (typeof entry !== 'string' || !ARTIFACT_SLOT_STORAGE_VALUES.has(entry)) {
          res.status(400).json({ error: 'artifact_slots contains invalid polarity values' });
          return;
        }
      }

      const table = resolveArtifactSlotsTable(uniqueName);
      if (!table) {
        res.status(404).json({ error: 'Equipment not found' });
        return;
      }

      const db = getCatalogDb();
      const json = JSON.stringify(body.artifact_slots);
      const stmt = db.prepare(`UPDATE ${table} SET artifact_slots = ? WHERE unique_name = ?`);
      const result = stmt.run(json, uniqueName);
      if (result.changes === 0) {
        res.status(404).json({ error: 'Equipment not found' });
        return;
      }

      res.json({ ok: true, unique_name: uniqueName, artifact_slots: body.artifact_slots });
    } catch (err) {
      sendInternalError(res, 'admin.catalog.artifactSlots', err);
    }
  },
);

catalogRouter.get('/admin/import/state', requireArmoryAdmin, (_req: Request, res: Response) => {
  try {
    res.json(getAdminImportSnapshot());
  } catch (err) {
    sendInternalError(res, 'admin.import.state', err);
  }
});

catalogRouter.post('/admin/import/reset', requireArmoryAdmin, (_req: Request, res: Response) => {
  try {
    const result = resetAdminImportLock();
    if (!result.cleared) {
      res.status(409).json({
        error: result.reason ?? 'Import job is still running.',
        snapshot: result.snapshot,
      });
      return;
    }
    res.json({ ok: true, snapshot: result.snapshot });
  } catch (err) {
    sendInternalError(res, 'admin.import.reset', err);
  }
});

catalogRouter.post('/admin/import/run', requireArmoryAdmin, (req: Request, res: Response) => {
  try {
    const userId = getClerkUserId(req);
    if (!userId) {
      res.status(401).json({ error: 'Not authenticated' });
      return;
    }
    const body = req.body as Record<string, unknown> | undefined;
    const forceImport = body?.forceImport === true;
    const forceImages = body?.forceImages === true;
    const forceSteps = parseForceSteps(body?.forceSteps);
    const result = startAdminImportJob(userId, { forceImport, forceImages, forceSteps });
    if (!result.started) {
      res.status(409).json({
        error: result.reason ?? 'Import job is already running.',
        snapshot: result.snapshot,
      });
      return;
    }
    res.status(202).json({
      started: true,
      snapshot: result.snapshot,
    });
  } catch (err) {
    sendInternalError(res, 'admin.import.run', err);
  }
});

catalogRouter.get('/admin/import/stream', requireArmoryAdmin, (req: Request, res: Response) => {
  res.setHeader('Content-Type', 'text/event-stream; charset=utf-8');
  res.setHeader('Cache-Control', 'no-cache, no-transform');
  res.setHeader('Connection', 'keep-alive');
  res.flushHeaders();

  let closed = false;
  let heartbeat: ReturnType<typeof setInterval> | null = null;

  const cleanup = () => {
    if (closed) return;
    closed = true;
    if (heartbeat) {
      clearInterval(heartbeat);
      heartbeat = null;
    }
    unsubscribe();
  };

  const canWrite = () => !closed && !res.writableEnded && !res.writableFinished && res.writable;

  const sendSnapshot = () => {
    if (!canWrite()) {
      cleanup();
      return;
    }
    try {
      const payload = JSON.stringify(getAdminImportSnapshot());
      res.write(`event: snapshot\n`);
      res.write(`data: ${payload}\n\n`);
    } catch {
      cleanup();
    }
  };

  const unsubscribe = subscribeAdminImportSnapshot(() => {
    sendSnapshot();
  });

  sendSnapshot();
  heartbeat = setInterval(() => {
    if (!canWrite()) {
      cleanup();
      return;
    }
    try {
      res.write(': ping\n\n');
    } catch {
      cleanup();
    }
  }, 15_000);

  req.on('close', () => {
    cleanup();
  });
});
