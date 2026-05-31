import { Router, type Request, type Response } from 'express';

import { parseForceSteps } from '../../shared/pipelineSteps.js';
import { classifyArcaneCompatTags } from '../arcaneCompat.js';
import { getClerkUserId } from '../auth/clerkUser.js';
import { requireArmoryAdmin } from '../auth/middleware.js';
import { getCachedModList } from '../cache/modListCache.js';
import { getDb } from '../db/connection.js';
import { dedupeHelminthAbilityRows } from '../helminthAbilityDedupe.js';
import {
  getAdminImportSnapshot,
  startAdminImportJob,
  subscribeAdminImportSnapshot,
} from '../import/adminImportJob.js';
import { log } from '../logger.js';
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

catalogRouter.get('/warframes', (_req: Request, res: Response) => {
  try {
    const db = getDb();
    const rows = db.prepare('SELECT * FROM warframes ORDER BY name').all();
    res.json({ items: rows });
  } catch (err) {
    sendInternalError(res, 'warframes.list', err);
  }
});

catalogRouter.get('/weapons', (req: Request, res: Response) => {
  try {
    const db = getDb();
    const type = typeof req.query.type === 'string' ? req.query.type : undefined;

    let rows;
    if (type) {
      rows = db.prepare('SELECT * FROM weapons WHERE product_category = ? ORDER BY name').all(type);
    } else {
      rows = db.prepare('SELECT * FROM weapons ORDER BY name').all();
    }

    const filtered = (rows as Array<{ unique_name: string }>).filter(
      (r) => !WEAPON_JUNK_PREFIXES.some((p) => r.unique_name.startsWith(p)),
    );

    res.json({ items: filtered });
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

    const db = getDb();
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

catalogRouter.get('/companions', (_req: Request, res: Response) => {
  try {
    const db = getDb();
    const rows = db.prepare('SELECT * FROM companions ORDER BY name').all();
    res.json({ items: rows });
  } catch (err) {
    sendInternalError(res, 'companions.list', err);
  }
});

catalogRouter.get('/search', (req: Request, res: Response) => {
  try {
    const db = getDb();
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
    const db = getDb();
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
    const db = getDb();
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
    const db = getDb();
    const equipmentType =
      typeof req.query.equipment_type === 'string' ? req.query.equipment_type : undefined;
    const rows = db
      .prepare("SELECT * FROM arcanes WHERE unique_name NOT LIKE '%Sub' ORDER BY name")
      .all() as Array<Record<string, unknown>>;

    const normalized = rows.map((row) => ({
      ...row,
      compat_tags: classifyArcaneCompatTags(row.unique_name, row.name),
    }));

    const allowedTags = getAllowedArcaneTags(equipmentType);
    const items =
      allowedTags === null
        ? normalized
        : normalized.filter((row) =>
            (row.compat_tags as string[]).some((tag) => allowedTags.has(tag)),
          );

    res.json({ items });
  } catch (err) {
    sendInternalError(res, 'arcanes.list', err);
  }
});

catalogRouter.get('/abilities', (req: Request, res: Response) => {
  try {
    const db = getDb();
    const warframe = typeof req.query.warframe === 'string' ? req.query.warframe : undefined;
    const abilityNames =
      typeof req.query.ability_names === 'string'
        ? req.query.ability_names.split(',').filter(Boolean)
        : [];

    let rows;
    if (warframe || abilityNames.length > 0) {
      const conditions: string[] = [];
      const params: unknown[] = [];
      if (warframe) {
        conditions.push('warframe_unique_name = ?');
        params.push(warframe);
      }
      if (abilityNames.length > 0) {
        conditions.push(`unique_name IN (${abilityNames.map(() => '?').join(',')})`);
        params.push(...abilityNames);
      }
      rows = db
        .prepare(`SELECT * FROM abilities WHERE ${conditions.join(' AND ')} ORDER BY name`)
        .all(...params);
    } else {
      rows = db.prepare('SELECT * FROM abilities ORDER BY name').all();
    }
    res.json({ items: rows });
  } catch (err) {
    sendInternalError(res, 'abilities.list', err);
  }
});

catalogRouter.get('/helminth-abilities', (_req: Request, res: Response) => {
  try {
    const db = getDb();
    const rows = db
      .prepare('SELECT * FROM abilities WHERE is_helminth_extractable = 1 ORDER BY name')
      .all() as Array<Record<string, unknown> & { unique_name: string; name?: string }>;
    res.json({ items: dedupeHelminthAbilityRows(rows) });
  } catch (err) {
    sendInternalError(res, 'helminthAbilities.list', err);
  }
});

catalogRouter.get('/riven-stats', (req: Request, res: Response) => {
  try {
    const db = getDb();
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
    const db = getDb();
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

catalogRouter.get('/admin/import/state', requireArmoryAdmin, (_req: Request, res: Response) => {
  try {
    res.json(getAdminImportSnapshot());
  } catch (err) {
    sendInternalError(res, 'admin.import.state', err);
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
