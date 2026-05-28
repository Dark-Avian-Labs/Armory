import type Database from 'better-sqlite3';
import { Router, type Request, type Response } from 'express';

import { classifyArcaneCompatTags } from '../arcaneCompat.js';
import {
  DELETED_USER_LABEL,
  getOwnerDisplayName,
  resolveOwnerUsernames,
  resolveClerkUserIdByUsername,
} from '../auth/armoryUsers.js';
import { getClerkUserId } from '../auth/clerkUser.js';
import { getClerkAuthState, requireArmoryAdmin } from '../auth/middleware.js';
import { canReadBuild } from '../buildAccess.js';
import { getCachedModList } from '../cache/modListCache.js';
import { getDb } from '../db/connection.js';
import { dedupeHelminthAbilityRows } from '../helminthAbilityDedupe.js';
import { getRequestId } from '../http/requestId.js';
import {
  getAdminImportSnapshot,
  startAdminImportJob,
  subscribeAdminImportSnapshot,
} from '../import/adminImportJob.js';
import { log } from '../logger.js';
import { ModConfigSchema } from './modConfigValidation.js';

export const apiRouter = Router();

apiRouter.get('/health', (_req: Request, res: Response) => {
  res.json({ status: 'ok', app: 'Armory' });
});

apiRouter.get('/warframes', (_req: Request, res: Response) => {
  try {
    const db = getDb();
    const rows = db.prepare('SELECT * FROM warframes ORDER BY name').all();
    res.json({ items: rows });
  } catch (err) {
    sendInternalError(res, 'warframes.list', err);
  }
});

const MAX_NAME_LENGTH = 255;
const MAX_DESCRIPTION_LENGTH = 8000;
const COPY_PREFIX = 'Copy of ';
const BUILD_SELECT_LIST =
  'id, clerk_user_id, name, equipment_type, equipment_unique_name, mod_config, created_at, updated_at, visibility, description';
const BUILD_SELECT_LIST_FROM_B =
  'b.id, b.clerk_user_id, b.name, b.equipment_type, b.equipment_unique_name, b.mod_config, b.created_at, b.updated_at, b.visibility, b.description';
const LOADOUT_SELECT_LIST =
  'id, clerk_user_id, name, visibility, description, created_at, updated_at';
const MODS_PAGE_MAX = 500;

const WEAPON_JUNK_PREFIXES = [
  '/Lotus/Types/Friendly/Pets/CreaturePets/',
  '/Lotus/Types/Friendly/Pets/MoaPets/MoaPetParts/',
  '/Lotus/Types/Friendly/Pets/ZanukaPets/ZanukaPetParts/',
  '/Lotus/Types/Items/Deimos/',
  '/Lotus/Types/Vehicles/Hoverboard/',
];

const WEAPON_CATEGORY_TO_TYPE: Record<string, string> = {
  Pistols: 'secondary',
  Melee: 'melee',
  SpaceGuns: 'archgun',
  SpaceMelee: 'archmelee',
};

apiRouter.get('/weapons', (req: Request, res: Response) => {
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

apiRouter.get('/incarnon', (req: Request, res: Response) => {
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

apiRouter.get('/companions', (_req: Request, res: Response) => {
  try {
    const db = getDb();
    const rows = db.prepare('SELECT * FROM companions ORDER BY name').all();
    res.json({ items: rows });
  } catch (err) {
    sendInternalError(res, 'companions.list', err);
  }
});

apiRouter.get('/users/:username/builds', async (req: Request, res: Response) => {
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
    const db = getDb();
    const rows = db
      .prepare(
        `SELECT ${BUILD_SELECT_LIST} FROM builds
         WHERE clerk_user_id = ? AND visibility = 'public'
         ORDER BY updated_at DESC`,
      )
      .all(clerkUserId) as BuildRow[];
    const ownerUsernames = await resolveOwnerUsernames([clerkUserId]);
    const loadouts = fetchPublicLoadoutsForUser(db, clerkUserId, ownerUsernames);
    res.json({
      owner_user_id: clerkUserId,
      owner_username: getOwnerDisplayName(clerkUserId, ownerUsernames),
      builds: rows.map((row) => toBuildListItem(row, ownerUsernames)),
      loadouts,
    });
  } catch (err) {
    sendInternalError(res, 'users.buildsByUsername', err);
  }
});

function fetchPublicLoadoutsForUser(
  db: Database.Database,
  clerkUserId: string,
  ownerNames: Map<string, string | null>,
): Array<{
  id: string;
  name: string;
  owner_user_id: string;
  owner_username: string | null;
  visibility: string;
  updated_at: string;
  builds: Array<{ build_id: string; slot_type: string }>;
}> {
  const loadoutRows = db
    .prepare(
      `SELECT id, name, clerk_user_id, visibility, updated_at
       FROM loadouts
       WHERE clerk_user_id = ? AND visibility = 'public'
       ORDER BY updated_at DESC`,
    )
    .all(clerkUserId) as Array<{
    id: number;
    name: string;
    clerk_user_id: string;
    visibility: string | null;
    updated_at: string;
  }>;
  if (loadoutRows.length === 0) return [];
  const result: Array<{
    id: string;
    name: string;
    owner_user_id: string;
    owner_username: string | null;
    visibility: string;
    updated_at: string;
    builds: Array<{ build_id: string; slot_type: string }>;
  }> = [];
  for (const row of loadoutRows) {
    const links = db
      .prepare(
        `SELECT lb.build_id, lb.slot_type FROM loadout_builds lb
         INNER JOIN builds b ON b.id = lb.build_id
         WHERE lb.loadout_id = ? AND b.visibility = 'public'`,
      )
      .all(row.id) as Array<{ build_id: number; slot_type: string }>;
    result.push({
      id: String(row.id),
      name: row.name,
      owner_user_id: row.clerk_user_id,
      owner_username: getOwnerDisplayName(row.clerk_user_id, ownerNames),
      visibility: row.visibility ?? 'private',
      updated_at: row.updated_at,
      builds: links.map((l) => ({
        build_id: String(l.build_id),
        slot_type: l.slot_type,
      })),
    });
  }
  return result;
}

apiRouter.get('/search', (req: Request, res: Response) => {
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

    res.json({ equipment, users, items: equipment });
  } catch (err) {
    sendInternalError(res, 'search.query', err);
  }
});

const MOD_JUNK_SEGMENTS = ['/Beginner/', '/Intermediate/', '/Nemesis/'];
const MOD_JUNK_SUFFIXES = ['SubMod'];
const ARMORY_STANCE_WIKI_IMAGE_PREFIX = '/ArmoryWiki/StanceMod/';

const MOD_API_SELECT_LIST = `m.*,
  ms_member.set_unique_name AS _set_unique_from_member,
  COALESCE(ms_direct.num_in_set, ms_member.num_in_set) AS set_num_in_set,
  COALESCE(NULLIF(TRIM(COALESCE(ms_direct.stats, '')), ''), ms_member.stats) AS set_stats`;

const MOD_API_FROM = `
FROM mods m
LEFT JOIN mod_sets ms_direct ON ms_direct.unique_name = m.mod_set
LEFT JOIN (
  SELECT mod_unique_name, set_unique_name, num_in_set, stats
  FROM (
    SELECT
      msm.mod_unique_name AS mod_unique_name,
      msm.set_unique_name AS set_unique_name,
      ms2.num_in_set AS num_in_set,
      ms2.stats AS stats,
      ROW_NUMBER() OVER (PARTITION BY msm.mod_unique_name ORDER BY msm.set_unique_name) AS rn
    FROM mod_set_members msm
    INNER JOIN mod_sets ms2 ON ms2.unique_name = msm.set_unique_name
  ) AS ranked_member_set
  WHERE ranked_member_set.rn = 1
) AS ms_member ON ms_member.mod_unique_name = m.unique_name`;

function normalizeModApiRow(row: Record<string, unknown>): Record<string, unknown> {
  const { _set_unique_from_member, ...rest } = row;
  const modSet = rest.mod_set;
  const filled =
    modSet != null && String(modSet).trim() !== '' ? modSet : (_set_unique_from_member ?? modSet);
  return { ...rest, mod_set: filled };
}

function parseNumericId(raw: string | string[] | undefined): number | null {
  if (Array.isArray(raw)) {
    return parseNumericId(raw[0]);
  }
  if (typeof raw !== 'string') {
    return null;
  }
  const trimmed = raw.trim();
  if (!/^\d+$/.test(trimmed)) {
    return null;
  }
  const value = Number.parseInt(trimmed, 10);
  if (value <= 0) {
    return null;
  }
  return value;
}

function normalizeUserDescription(raw: unknown): string | null {
  if (raw === undefined || raw === null) {
    return null;
  }
  if (typeof raw !== 'string') {
    return null;
  }
  const trimmed = raw.replaceAll('\0', '').trim();
  if (!trimmed) {
    return null;
  }
  return trimmed.slice(0, MAX_DESCRIPTION_LENGTH);
}

type BuildRow = {
  id: number;
  clerk_user_id: string;
  name: string;
  equipment_type: string;
  equipment_unique_name: string;
  mod_config: string;
  created_at: string;
  updated_at: string;
  visibility?: string;
  description?: string | null;
};

function parseBuildConfig(raw: string): Record<string, unknown> | null {
  try {
    const parsed = JSON.parse(raw) as unknown;
    return parsed && typeof parsed === 'object' ? (parsed as Record<string, unknown>) : null;
  } catch {
    return null;
  }
}

function toBuildResponse(row: BuildRow): Record<string, unknown> {
  return {
    ...row,
    mod_config: parseBuildConfig(row.mod_config),
  };
}

function toBuildListItem(row: BuildRow, ownerUsernames: Map<string, string | null>) {
  const cfg = parseBuildConfig(row.mod_config);
  const equipmentName =
    typeof cfg?.equipment_name === 'string' ? cfg.equipment_name : row.equipment_unique_name;
  const equipmentImage = typeof cfg?.equipment_image === 'string' ? cfg.equipment_image : undefined;
  const slots = Array.isArray(cfg?.slots) ? cfg.slots : [];
  return {
    id: row.id,
    name: row.name,
    equipment_type: row.equipment_type,
    equipment_unique_name: row.equipment_unique_name,
    equipment_name: equipmentName,
    equipment_image: equipmentImage,
    slots,
    updated_at: row.updated_at,
    created_at: row.created_at,
    owner_user_id: row.clerk_user_id,
    owner_username: getOwnerDisplayName(row.clerk_user_id, ownerUsernames),
    owner_deleted: ownerUsernames.get(row.clerk_user_id) === DELETED_USER_LABEL,
    description: typeof row.description === 'string' ? row.description : null,
  };
}

function sendInternalError(res: Response, context: string, err: unknown): void {
  log('error', `API handler failed: ${context}`, {
    requestId: getRequestId(res),
    err: err instanceof Error ? err.message : String(err),
  });
  res.status(500).json({ error: 'Internal server error' });
}

function parseListPagination(req: Request): { limit: number | null; offset: number } {
  const hasLimit = req.query.limit !== undefined;
  const hasOffset = req.query.offset !== undefined;
  if (!hasLimit && !hasOffset) {
    return { limit: null, offset: 0 };
  }
  const limitRaw = Number(req.query.limit ?? 100);
  const offsetRaw = Number(req.query.offset ?? 0);
  const limit = Number.isFinite(limitRaw)
    ? Math.min(Math.max(Math.trunc(limitRaw), 1), MODS_PAGE_MAX)
    : 100;
  const offset = Number.isFinite(offsetRaw) ? Math.max(Math.trunc(offsetRaw), 0) : 0;
  return { limit, offset };
}

function fetchBuildsByIds(db: Database.Database, ids: number[]): BuildRow[] {
  const uniqueIds = [...new Set(ids)].filter((id) => Number.isFinite(id) && id > 0);
  if (uniqueIds.length === 0) {
    return [];
  }
  const placeholders = uniqueIds.map(() => '?').join(',');
  return db
    .prepare(`SELECT ${BUILD_SELECT_LIST} FROM builds WHERE id IN (${placeholders})`)
    .all(...uniqueIds) as BuildRow[];
}

type ModListQuery = {
  typesRaw?: string;
  typeRaw?: string;
  rarity?: string;
  search?: string;
};

function loadDedupedMods(
  db: Database.Database,
  query: ModListQuery,
): Array<Record<string, unknown>> {
  const { typesRaw, typeRaw, rarity, search } = query;

  let sql = `SELECT ${MOD_API_SELECT_LIST}
      ${MOD_API_FROM}
      WHERE 1=1`;
  const params: unknown[] = [];

  if (typesRaw) {
    const typeList = typesRaw
      .split(',')
      .map((t) => t.trim())
      .filter(Boolean)
      .map((t) => t.toLowerCase());
    if (typeList.length === 1) {
      sql += ' AND LOWER(m.type) = ?';
      params.push(typeList[0]);
    } else if (typeList.length > 1) {
      sql += ` AND LOWER(m.type) IN (${typeList.map(() => '?').join(',')})`;
      params.push(...typeList);
    }
  } else if (typeRaw) {
    sql += ' AND LOWER(m.type) = LOWER(?)';
    params.push(typeRaw);
  }

  if (rarity) {
    sql += ' AND m.rarity = ?';
    params.push(rarity);
  }
  if (search) {
    const escapedSearch = search.replace(/[\\%_]/g, '\\$&');
    sql += " AND m.name LIKE ? ESCAPE '\\'";
    params.push(`%${escapedSearch}%`);
  }

  sql += ' ORDER BY m.name';

  const rows = db.prepare(sql).all(...params) as Array<Record<string, unknown>>;
  const normalizedRows = rows.map(normalizeModApiRow) as Array<{
    unique_name: string;
    name: string;
    type: string;
    image_path?: string;
  }>;

  const cleaned = normalizedRows.filter((r) => {
    if (MOD_JUNK_SEGMENTS.some((seg) => r.unique_name.includes(seg))) return false;
    if (MOD_JUNK_SUFFIXES.some((suf) => r.unique_name.endsWith(suf))) return false;
    return true;
  });

  const byKey = new Map<string, (typeof cleaned)[number]>();
  for (const mod of cleaned) {
    const key = `${mod.name}|||${mod.type}`;
    const existing = byKey.get(key);
    if (!existing) {
      byKey.set(key, mod);
    } else {
      const existingWiki = (existing.image_path ?? '').startsWith(ARMORY_STANCE_WIKI_IMAGE_PREFIX);
      const currentWiki = (mod.image_path ?? '').startsWith(ARMORY_STANCE_WIKI_IMAGE_PREFIX);
      if (!existingWiki && currentWiki) {
        byKey.set(key, mod);
        continue;
      }
      const existingIsExpert = existing.unique_name.includes('/Expert/');
      const currentIsExpert = mod.unique_name.includes('/Expert/');
      if (existingIsExpert && !currentIsExpert) {
        byKey.set(key, mod);
      }
    }
  }

  return Array.from(byKey.values()) as Array<Record<string, unknown>>;
}

function getAllowedArcaneTags(equipmentType: string | undefined): Set<string> | null {
  if (!equipmentType) {
    return null;
  }
  switch (equipmentType) {
    case 'warframe':
      return new Set(['warframe']);
    case 'primary':
      return new Set(['primary']);
    case 'secondary':
      return new Set(['secondary']);
    case 'melee':
      return new Set(['melee']);
    case 'archgun':
    case 'archmelee':
    case 'archwing':
    case 'necramech':
      return new Set();
    default:
      return new Set();
  }
}

apiRouter.get('/mods', async (req: Request, res: Response) => {
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

apiRouter.get('/mods/:uniqueName', (req: Request, res: Response) => {
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

apiRouter.get('/arcanes', (req: Request, res: Response) => {
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

apiRouter.get('/abilities', (req: Request, res: Response) => {
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
        .prepare(`SELECT * FROM abilities WHERE ${conditions.join(' OR ')} ORDER BY name`)
        .all(...params);
    } else {
      rows = db.prepare('SELECT * FROM abilities ORDER BY name').all();
    }
    res.json({ items: rows });
  } catch (err) {
    sendInternalError(res, 'abilities.list', err);
  }
});

apiRouter.get('/helminth-abilities', (_req: Request, res: Response) => {
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

apiRouter.get('/riven-stats', (req: Request, res: Response) => {
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

apiRouter.get('/archon-shards', (_req: Request, res: Response) => {
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

apiRouter.get('/admin/import/state', requireArmoryAdmin, (_req: Request, res: Response) => {
  try {
    res.json(getAdminImportSnapshot());
  } catch (err) {
    sendInternalError(res, 'admin.import.state', err);
  }
});

apiRouter.post('/admin/import/run', requireArmoryAdmin, (req: Request, res: Response) => {
  try {
    const userId = getClerkUserId(req);
    if (!userId) {
      res.status(401).json({ error: 'Not authenticated' });
      return;
    }
    const body = req.body as Record<string, unknown> | undefined;
    const forceImport = body?.forceImport === true;
    const forceImages = body?.forceImages === true;
    const result = startAdminImportJob(userId, { forceImport, forceImages });
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

apiRouter.get('/admin/import/stream', requireArmoryAdmin, (req: Request, res: Response) => {
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

apiRouter.get('/loadouts', (req: Request, res: Response) => {
  try {
    const db = getDb();
    const clerkUserId = getClerkUserId(req);
    if (!clerkUserId) {
      res.status(401).json({ error: 'Not authenticated' });
      return;
    }
    const loadouts = db
      .prepare('SELECT * FROM loadouts WHERE clerk_user_id = ? ORDER BY updated_at DESC')
      .all(clerkUserId) as Array<Record<string, unknown>>;
    if (loadouts.length === 0) {
      res.json({ loadouts });
      return;
    }
    const loadoutIds = loadouts
      .map((l) => l.id)
      .filter((id): id is number => typeof id === 'number' && Number.isFinite(id));
    if (loadoutIds.length === 0) {
      for (const l of loadouts) {
        (l as Record<string, unknown>).builds = [];
      }
      res.json({ loadouts });
      return;
    }
    const placeholders = loadoutIds.map(() => '?').join(',');
    const allBuilds = db
      .prepare(`SELECT * FROM loadout_builds WHERE loadout_id IN (${placeholders})`)
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
    res.json({ loadouts });
  } catch (err) {
    sendInternalError(res, 'loadouts.list', err);
  }
});

apiRouter.get('/loadouts/:id', (req: Request, res: Response) => {
  try {
    const db = getDb();
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
    const ownerUserId = loadout.clerk_user_id;
    const isOwner = typeof ownerUserId === 'string' && uid === ownerUserId;
    const vis = typeof loadout.visibility === 'string' ? loadout.visibility : 'private';
    if (!isOwner && vis !== 'public' && vis !== 'unlisted') {
      res.status(404).json({ error: 'Loadout not found' });
      return;
    }

    const authState = getClerkAuthState(req);
    const isGameAdmin = authState.isArmoryAdmin;

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
      const canSeeBuild =
        isOwner ||
        isGameAdmin ||
        buildRow.clerk_user_id === uid ||
        buildVis === 'public' ||
        buildVis === 'unlisted';
      if (!canSeeBuild) continue;
      buildsWithSlots.push({
        slot_type: link.slot_type,
        build: toBuildResponse(buildRow),
      });
    }

    res.json({
      loadout: {
        id: loadout.id,
        name: loadout.name,
        user_id: loadout.clerk_user_id,
        visibility: vis,
        description: typeof loadout.description === 'string' ? loadout.description : null,
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

apiRouter.post('/loadouts', (req: Request, res: Response) => {
  try {
    const db = getDb();
    const clerkUserId = getClerkUserId(req);
    if (!clerkUserId) {
      res.status(401).json({ error: 'Not authenticated' });
      return;
    }
    const { name } = req.body;
    if (typeof name !== 'string') {
      res.status(400).json({ error: 'Invalid name' });
      return;
    }

    const sanitizedName = name.trim();
    if (sanitizedName.length === 0 || sanitizedName.length > 255) {
      res.status(400).json({ error: 'Invalid name' });
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

apiRouter.put('/loadouts/:id', (req: Request, res: Response) => {
  try {
    const db = getDb();
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
      .prepare('SELECT * FROM loadouts WHERE id = ? AND clerk_user_id = ?')
      .get(parsedId, clerkUserId) as Record<string, unknown> | undefined;
    if (!existing) {
      res.status(404).json({ error: 'Loadout not found' });
      return;
    }

    const body = req.body as Record<string, unknown> | undefined;
    const hasName = body != null && Object.prototype.hasOwnProperty.call(body, 'name');
    const hasVisibility = body != null && Object.prototype.hasOwnProperty.call(body, 'visibility');
    const hasDescription =
      body != null && Object.prototype.hasOwnProperty.call(body, 'description');
    if (!hasName && !hasVisibility && !hasDescription) {
      res.status(400).json({ error: 'Provide at least name, visibility, or description' });
      return;
    }

    let nextName = String(existing.name ?? '').trim();
    if (hasName) {
      const name = body?.name;
      if (typeof name !== 'string' || name.trim().length === 0 || name.trim().length > 255) {
        res.status(400).json({ error: 'Invalid name' });
        return;
      }
      nextName = name.trim();
    }

    let nextVisibility = String(existing.visibility ?? 'private');
    if (hasVisibility) {
      const visRaw = body?.visibility;
      if (visRaw !== 'public' && visRaw !== 'private' && visRaw !== 'unlisted') {
        res.status(400).json({ error: 'Invalid visibility' });
        return;
      }
      nextVisibility = visRaw;
    }

    let nextDescription: string | null =
      typeof existing.description === 'string' ? existing.description : null;
    if (hasDescription) {
      nextDescription = normalizeUserDescription(body?.description);
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

    db.prepare(
      "UPDATE loadouts SET name = ?, visibility = ?, description = ?, updated_at = datetime('now') WHERE id = ? AND clerk_user_id = ?",
    ).run(nextName, nextVisibility, nextDescription, parsedId, clerkUserId);
    res.json({
      success: true,
      name: nextName,
      visibility: nextVisibility,
      description: nextDescription,
    });
  } catch (err) {
    sendInternalError(res, 'loadouts.update', err);
  }
});

apiRouter.post('/loadouts/:id/publish', (req: Request, res: Response) => {
  try {
    const db = getDb();
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
          "UPDATE loadouts SET visibility = 'public', updated_at = datetime('now') WHERE id = ? AND clerk_user_id = ?",
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

apiRouter.delete('/loadouts/:id', (req: Request, res: Response) => {
  try {
    const db = getDb();
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

apiRouter.post('/loadouts/:id/copy', (req: Request, res: Response) => {
  try {
    const db = getDb();
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

    const sourceLoadout = db.prepare('SELECT * FROM loadouts WHERE id = ?').get(id) as
      | Record<string, unknown>
      | undefined;
    if (!sourceLoadout) {
      res.status(404).json({ error: 'Loadout not found' });
      return;
    }
    const sourceUserId = sourceLoadout.clerk_user_id;
    if (typeof sourceUserId !== 'string' || sourceUserId !== clerkUserId) {
      res.status(403).json({ error: 'Forbidden' });
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

      const sourceLinks = db
        .prepare('SELECT build_id, slot_type FROM loadout_builds WHERE loadout_id = ?')
        .all(id) as Array<{
        build_id: number;
        slot_type: string;
      }>;

      for (const link of sourceLinks) {
        const sourceBuild = db
          .prepare(`SELECT ${BUILD_SELECT_LIST} FROM builds WHERE id = ?`)
          .get(link.build_id) as BuildRow | undefined;
        if (!sourceBuild) {
          continue;
        }
        const copiedBuild = db
          .prepare(
            `INSERT INTO builds (clerk_user_id, name, equipment_type, equipment_unique_name, mod_config, visibility, description, created_at, updated_at)
             VALUES (?, ?, ?, ?, ?, 'private', ?, datetime('now'), datetime('now'))`,
          )
          .run(
            clerkUserId,
            `Copy of ${sourceBuild.name}`,
            sourceBuild.equipment_type,
            sourceBuild.equipment_unique_name,
            sourceBuild.mod_config,
            normalizeUserDescription(sourceBuild.description),
          );
        db.prepare(
          'INSERT OR REPLACE INTO loadout_builds (loadout_id, build_id, slot_type) VALUES (?, ?, ?)',
        ).run(newId, copiedBuild.lastInsertRowid, link.slot_type);
      }

      return newId;
    })();

    res.json({ success: true, id: newLoadoutId });
  } catch (err) {
    sendInternalError(res, 'loadouts.copy', err);
  }
});

apiRouter.post('/loadouts/:id/builds', (req: Request, res: Response) => {
  try {
    const db = getDb();
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
    if (!Number.isFinite(buildId) || buildId <= 0 || typeof slot_type !== 'string') {
      res.status(400).json({ error: 'Invalid loadout build payload' });
      return;
    }
    const result = db
      .prepare(
        'INSERT OR REPLACE INTO loadout_builds (loadout_id, build_id, slot_type) SELECT ?, ?, ? WHERE EXISTS (SELECT 1 FROM loadouts WHERE id = ? AND clerk_user_id = ?) AND EXISTS (SELECT 1 FROM builds WHERE id = ? AND clerk_user_id = ?)',
      )
      .run(loadoutId, buildId, slot_type, loadoutId, clerkUserId, buildId, clerkUserId);
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

apiRouter.delete('/loadouts/:id/builds/:slotType', (req: Request, res: Response) => {
  try {
    const db = getDb();
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
    db.prepare(
      'DELETE FROM loadout_builds WHERE loadout_id = ? AND slot_type = ? AND EXISTS (SELECT 1 FROM loadouts WHERE id = ? AND clerk_user_id = ?)',
    ).run(loadoutId, req.params.slotType, loadoutId, clerkUserId);
    res.json({ success: true });
  } catch (err) {
    sendInternalError(res, 'loadouts.removeBuild', err);
  }
});

apiRouter.get('/builds', (req: Request, res: Response) => {
  try {
    const db = getDb();
    const clerkUserId = getClerkUserId(req);
    if (!clerkUserId) {
      res.status(401).json({ error: 'Not authenticated' });
      return;
    }

    const rows = db
      .prepare(
        `SELECT ${BUILD_SELECT_LIST} FROM builds WHERE clerk_user_id = ? ORDER BY updated_at DESC`,
      )
      .all(clerkUserId) as BuildRow[];

    const builds = rows.map((row) => toBuildResponse(row));

    res.json({ builds });
  } catch (err) {
    sendInternalError(res, 'builds.list', err);
  }
});

apiRouter.get('/builds/catalog', (_req: Request, res: Response) => {
  try {
    const db = getDb();
    const rows = db
      .prepare(
        `SELECT equipment_type, equipment_unique_name, COUNT(*) AS build_count
         FROM builds
         WHERE visibility IN ('public', 'unlisted')
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

apiRouter.get('/builds/by-user', async (req: Request, res: Response) => {
  try {
    const db = getDb();

    const userIdRaw = req.query.clerk_user_id;
    const clerkUserId =
      typeof userIdRaw === 'string' && userIdRaw.trim() !== '' ? userIdRaw.trim() : null;
    if (!clerkUserId) {
      res.status(400).json({ error: 'clerk_user_id is required' });
      return;
    }

    const rows = db
      .prepare(
        `SELECT ${BUILD_SELECT_LIST} FROM builds
         WHERE clerk_user_id = ? AND visibility = 'public'
         ORDER BY updated_at DESC`,
      )
      .all(clerkUserId) as BuildRow[];

    const ownerUsernames = await resolveOwnerUsernames([clerkUserId]);
    const loadouts = fetchPublicLoadoutsForUser(db, clerkUserId, ownerUsernames);

    res.json({
      owner_user_id: clerkUserId,
      owner_username: getOwnerDisplayName(clerkUserId, ownerUsernames),
      builds: rows.map((row) => toBuildListItem(row, ownerUsernames)),
      loadouts,
    });
  } catch (err) {
    sendInternalError(res, 'builds.byUser', err);
  }
});

apiRouter.get('/builds/by-equipment', async (req: Request, res: Response) => {
  try {
    const db = getDb();
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

    const rows = db
      .prepare(
        `SELECT ${BUILD_SELECT_LIST} FROM builds
         WHERE equipment_type = ? AND equipment_unique_name = ?
           AND visibility IN ('public', 'unlisted')
         ORDER BY updated_at DESC`,
      )
      .all(equipmentType, equipmentUniqueName) as BuildRow[];

    const ownerUsernames = await resolveOwnerUsernames(rows.map((r) => r.clerk_user_id));

    const loadoutRows = db
      .prepare(
        `SELECT DISTINCT l.id, l.name, l.clerk_user_id, l.visibility, l.updated_at
         FROM loadouts l
         INNER JOIN loadout_builds lb ON lb.loadout_id = l.id
         INNER JOIN builds b ON b.id = lb.build_id
         WHERE b.equipment_type = ? AND b.equipment_unique_name = ?
           AND (COALESCE(l.visibility, 'private') IN ('public', 'unlisted') OR l.clerk_user_id = ?)
         ORDER BY l.updated_at DESC`,
      )
      .all(equipmentType, equipmentUniqueName, sessionUserId ?? '') as Array<{
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
    });
  } catch (err) {
    sendInternalError(res, 'builds.byEquipment', err);
  }
});

apiRouter.get('/builds/favorites', (req: Request, res: Response) => {
  try {
    const db = getDb();
    const clerkUserId = getClerkUserId(req);
    if (!clerkUserId) {
      res.status(401).json({ error: 'Not authenticated' });
      return;
    }

    const authState = getClerkAuthState(req);
    const rows = db
      .prepare(
        `SELECT ${BUILD_SELECT_LIST_FROM_B}
         FROM builds b
         INNER JOIN build_favorites f ON f.build_id = b.id
         WHERE f.clerk_user_id = ?
         ORDER BY f.created_at DESC`,
      )
      .all(clerkUserId) as BuildRow[];

    const builds = rows
      .filter((row) => canReadBuild(row, clerkUserId, authState.isArmoryAdmin))
      .map((row) => toBuildResponse(row));

    res.json({ builds });
  } catch (err) {
    sendInternalError(res, 'builds.favorites.list', err);
  }
});

apiRouter.post('/builds/:id/favorite', (req: Request, res: Response) => {
  try {
    const db = getDb();
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
    if (!canReadBuild(row, clerkUserId, authState.isArmoryAdmin)) {
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

apiRouter.delete('/builds/:id/favorite', (req: Request, res: Response) => {
  try {
    const db = getDb();
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

apiRouter.get('/builds/:id/loadouts', async (req: Request, res: Response) => {
  try {
    const db = getDb();
    const id = parseNumericId(req.params.id);
    if (id === null) {
      res.status(400).json({ error: 'Invalid build id' });
      return;
    }

    const buildExists = db.prepare('SELECT 1 FROM builds WHERE id = ?').get(id);
    if (!buildExists) {
      res.status(404).json({ error: 'Build not found' });
      return;
    }

    const uid = getClerkUserId(req);
    const rows = db
      .prepare(
        `SELECT l.id, l.name, l.clerk_user_id, l.visibility
         FROM loadout_builds lb
         INNER JOIN loadouts l ON l.id = lb.loadout_id
         WHERE lb.build_id = ?
           AND (l.visibility IN ('public', 'unlisted') OR (? IS NOT NULL AND l.clerk_user_id = ?))
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

apiRouter.get('/builds/:id', async (req: Request, res: Response) => {
  try {
    const db = getDb();
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
    if (!canReadBuild(row, sessionUserId, isGameAdmin)) {
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
      build: toBuildResponse(row),
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

apiRouter.post('/builds', (req: Request, res: Response) => {
  try {
    const db = getDb();
    const clerkUserId = getClerkUserId(req);
    if (!clerkUserId) {
      res.status(401).json({ error: 'Not authenticated' });
      return;
    }

    const { name, equipment_type, equipment_unique_name, mod_config } = req.body;
    const visRaw = req.body?.visibility;
    const visibility =
      visRaw === 'public' || visRaw === 'private' || visRaw === 'unlisted' ? visRaw : 'private';
    const description = normalizeUserDescription(req.body?.description);

    const modConfigResult = ModConfigSchema.safeParse(mod_config);
    if (
      typeof name !== 'string' ||
      typeof equipment_type !== 'string' ||
      typeof equipment_unique_name !== 'string' ||
      !modConfigResult.success
    ) {
      if (!modConfigResult.success) {
        res.status(400).json({ error: 'Invalid mod_config' });
        return;
      }
      res.status(400).json({ error: 'Invalid build payload' });
      return;
    }

    const result = db
      .prepare(
        `INSERT INTO builds (clerk_user_id, name, equipment_type, equipment_unique_name, mod_config, visibility, description, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, datetime('now'), datetime('now'))`,
      )
      .run(
        clerkUserId,
        name,
        equipment_type,
        equipment_unique_name,
        JSON.stringify(modConfigResult.data),
        visibility,
        description,
      );

    res.json({ success: true, id: result.lastInsertRowid });
  } catch (err) {
    sendInternalError(res, 'builds.create', err);
  }
});

apiRouter.put('/builds/:id', (req: Request, res: Response) => {
  try {
    const db = getDb();
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
    if (!modConfigResult.success) {
      res.status(400).json({ error: 'Invalid mod_config' });
      return;
    }
    const visibility =
      visRaw === 'public' || visRaw === 'private' || visRaw === 'unlisted' ? visRaw : 'private';
    const bodyRecord = req.body as Record<string, unknown>;
    const hasDescription = Object.prototype.hasOwnProperty.call(bodyRecord, 'description');
    const description = hasDescription
      ? normalizeUserDescription(bodyRecord.description)
      : undefined;

    const authState = getClerkAuthState(req);
    const isGameAdmin = authState.isArmoryAdmin;

    let sql = 'UPDATE builds SET name = ?, mod_config = ?, visibility = ?';
    const params: Array<string | number | null> = [
      name,
      JSON.stringify(modConfigResult.data),
      visibility,
    ];
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

apiRouter.delete('/builds/:id', (req: Request, res: Response) => {
  try {
    const db = getDb();
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

apiRouter.post('/builds/:id/copy', (req: Request, res: Response) => {
  try {
    const db = getDb();
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
    if (!canReadBuild(source, clerkUserId, isGameAdmin)) {
      res.status(404).json({ error: 'Build not found' });
      return;
    }

    const requestedName = typeof req.body?.name === 'string' ? req.body.name.trim() : '';
    const requestedNameTruncated = requestedName.slice(0, MAX_NAME_LENGTH);
    const copyName =
      requestedNameTruncated.length > 0
        ? requestedNameTruncated
        : `${COPY_PREFIX}${source.name.trim().slice(0, MAX_NAME_LENGTH - COPY_PREFIX.length)}`;

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
