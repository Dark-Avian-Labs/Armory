import type Database from 'better-sqlite3';
import { type Request, type Response } from 'express';

import { DELETED_USER_LABEL, getOwnerDisplayName } from '../auth/armoryUsers.js';
import { getRequestId } from '../http/requestId.js';
import { log } from '../logger.js';

export const MAX_NAME_LENGTH = 255;
export const MAX_DESCRIPTION_LENGTH = 8000;
export const MAX_BUILDS_PER_USER = 250;
export const MAX_LOADOUTS_PER_USER = 50;
export const MAX_EQUIPMENT_TYPE_LENGTH = 64;
export const MAX_EQUIPMENT_UNIQUE_NAME_LENGTH = 512;
export const COPY_PREFIX = 'Copy of ';
export const BUILD_SELECT_LIST =
  'id, clerk_user_id, name, equipment_type, equipment_unique_name, mod_config, created_at, updated_at, visibility, description, share_token';
export const BUILD_SELECT_LIST_FROM_B =
  'b.id, b.clerk_user_id, b.name, b.equipment_type, b.equipment_unique_name, b.mod_config, b.created_at, b.updated_at, b.visibility, b.description, b.share_token';
export const LOADOUT_SELECT_LIST =
  'id, clerk_user_id, name, visibility, description, created_at, updated_at, share_token';
export const MODS_PAGE_MAX = 500;
export const LIST_PAGE_DEFAULT = 100;

export const WEAPON_JUNK_PREFIXES = [
  '/Lotus/Types/Friendly/Pets/CreaturePets/',
  '/Lotus/Types/Friendly/Pets/MoaPets/MoaPetParts/',
  '/Lotus/Types/Friendly/Pets/ZanukaPets/ZanukaPetParts/',
  '/Lotus/Types/Items/Deimos/',
  '/Lotus/Types/Vehicles/Hoverboard/',
];

export const WEAPON_CATEGORY_TO_TYPE: Record<string, string> = {
  Pistols: 'secondary',
  Melee: 'melee',
  SpaceGuns: 'archgun',
  SpaceMelee: 'archmelee',
};
export function fetchPublicLoadoutsForUser(
  db: Database.Database,
  clerkUserId: string,
  ownerNames: Map<string, string | null>,
  pagination?: { limit: number; offset: number },
): Array<{
  id: string;
  name: string;
  owner_user_id: string;
  owner_username: string | null;
  visibility: string;
  updated_at: string;
  builds: Array<{ build_id: string; slot_type: string }>;
}> {
  const limit = pagination?.limit ?? LIST_PAGE_DEFAULT;
  const offset = pagination?.offset ?? 0;
  const loadoutRows = db
    .prepare(
      `SELECT id, name, clerk_user_id, visibility, updated_at
       FROM loadouts
       WHERE clerk_user_id = ? AND visibility = 'public'
       ORDER BY updated_at DESC
       LIMIT ? OFFSET ?`,
    )
    .all(clerkUserId, limit, offset) as Array<{
    id: number;
    name: string;
    clerk_user_id: string;
    visibility: string | null;
    updated_at: string;
  }>;
  if (loadoutRows.length === 0) return [];

  const loadoutIds = loadoutRows.map((row) => row.id);
  const placeholders = loadoutIds.map(() => '?').join(',');
  const linkRows = db
    .prepare(
      `SELECT lb.loadout_id, lb.build_id, lb.slot_type FROM loadout_builds lb
       INNER JOIN builds b ON b.id = lb.build_id
       WHERE lb.loadout_id IN (${placeholders}) AND b.visibility = 'public'`,
    )
    .all(...loadoutIds) as Array<{ loadout_id: number; build_id: number; slot_type: string }>;
  const linksByLoadout = new Map<number, Array<{ build_id: string; slot_type: string }>>();
  for (const link of linkRows) {
    const bucket = linksByLoadout.get(link.loadout_id) ?? [];
    bucket.push({ build_id: String(link.build_id), slot_type: link.slot_type });
    linksByLoadout.set(link.loadout_id, bucket);
  }

  return loadoutRows.map((row) => ({
    id: String(row.id),
    name: row.name,
    owner_user_id: row.clerk_user_id,
    owner_username: getOwnerDisplayName(row.clerk_user_id, ownerNames),
    visibility: row.visibility ?? 'private',
    updated_at: row.updated_at,
    builds: linksByLoadout.get(row.id) ?? [],
  }));
}

export const MOD_JUNK_SEGMENTS = ['/Beginner/', '/Intermediate/', '/Nemesis/'];
export const MOD_JUNK_SUFFIXES = ['SubMod'];
export const ARMORY_STANCE_WIKI_IMAGE_PREFIX = '/ArmoryWiki/StanceMod/';

export const MOD_API_SELECT_LIST = `m.*,
  ms_member.set_unique_name AS _set_unique_from_member,
  COALESCE(ms_direct.num_in_set, ms_member.num_in_set) AS set_num_in_set,
  COALESCE(NULLIF(TRIM(COALESCE(ms_direct.stats, '')), ''), ms_member.stats) AS set_stats`;

export const MOD_API_FROM = `
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

export function normalizeModApiRow(row: Record<string, unknown>): Record<string, unknown> {
  const { _set_unique_from_member, ...rest } = row;
  const modSet = rest.mod_set;
  const filled =
    modSet != null && String(modSet).trim() !== '' ? modSet : (_set_unique_from_member ?? modSet);
  return { ...rest, mod_set: filled };
}

export function parseNumericId(raw: string | string[] | undefined): number | null {
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

export function normalizeUserDescription(raw: unknown): string | null {
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

export type BuildRow = {
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
  share_token?: string | null;
};

export function parseBuildConfig(raw: string): Record<string, unknown> | null {
  try {
    const parsed = JSON.parse(raw) as unknown;
    return parsed && typeof parsed === 'object' ? (parsed as Record<string, unknown>) : null;
  } catch {
    return null;
  }
}

export function toBuildResponse(row: BuildRow, includeShareToken = false): Record<string, unknown> {
  const response: Record<string, unknown> = {
    ...row,
    mod_config: parseBuildConfig(row.mod_config),
  };
  if (!includeShareToken) {
    delete response.share_token;
  }
  return response;
}

export function toBuildListItem(row: BuildRow, ownerUsernames: Map<string, string | null>) {
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

export function sendInternalError(res: Response, context: string, err: unknown): void {
  log('error', `API handler failed: ${context}`, {
    requestId: getRequestId(res),
    err: err instanceof Error ? err.message : String(err),
  });
  res.status(500).json({ error: 'Internal server error' });
}

export function parseListPagination(
  req: Request,
  options?: { defaultLimit?: number; max?: number },
): { limit: number; offset: number } {
  const defaultLimit = options?.defaultLimit ?? LIST_PAGE_DEFAULT;
  const max = options?.max ?? MODS_PAGE_MAX;
  const limitRaw = Number(req.query.limit ?? defaultLimit);
  const offsetRaw = Number(req.query.offset ?? 0);
  const limit = Number.isFinite(limitRaw)
    ? Math.min(Math.max(Math.trunc(limitRaw), 1), max)
    : defaultLimit;
  const offset = Number.isFinite(offsetRaw) ? Math.max(Math.trunc(offsetRaw), 0) : 0;
  return { limit, offset };
}

export function countUserBuilds(db: Database.Database, clerkUserId: string): number {
  const row = db
    .prepare('SELECT COUNT(*) AS c FROM builds WHERE clerk_user_id = ?')
    .get(clerkUserId) as { c: number };
  return row?.c ?? 0;
}

export function countUserLoadouts(db: Database.Database, clerkUserId: string): number {
  const row = db
    .prepare('SELECT COUNT(*) AS c FROM loadouts WHERE clerk_user_id = ?')
    .get(clerkUserId) as { c: number };
  return row?.c ?? 0;
}

export function fetchBuildsByIds(db: Database.Database, ids: number[]): BuildRow[] {
  const uniqueIds = [...new Set(ids)].filter((id) => Number.isFinite(id) && id > 0);
  if (uniqueIds.length === 0) {
    return [];
  }
  const placeholders = uniqueIds.map(() => '?').join(',');
  return db
    .prepare(`SELECT ${BUILD_SELECT_LIST} FROM builds WHERE id IN (${placeholders})`)
    .all(...uniqueIds) as BuildRow[];
}

export type ModListQuery = {
  typesRaw?: string;
  typeRaw?: string;
  rarity?: string;
  search?: string;
};

export function loadDedupedMods(
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

export function getAllowedArcaneTags(equipmentType: string | undefined): Set<string> | null {
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
