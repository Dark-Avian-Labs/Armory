import * as cheerio from 'cheerio';
import { Router, type Request, type Response } from 'express';
import { rateLimit } from 'express-rate-limit';
import { z } from 'zod';

import { requireAdmin } from '../auth/middleware.js';
import { getDb } from '../db/connection.js';

export const apiRouter = Router();

apiRouter.use(
  rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 600,
    standardHeaders: true,
    legacyHeaders: false,
  }),
);

apiRouter.get('/health', (_req: Request, res: Response) => {
  res.json({ status: 'ok', app: 'Parametric' });
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
const COPY_PREFIX = 'Copy of ';

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

const HELMINTH_WIKI_URL = 'https://warframe.fandom.com/wiki/Helminth';
const HELMINTH_NAME_CACHE_TTL_MS = 30 * 60 * 1000;
const HELMINTH_WIKI_USER_AGENT =
  process.env.HELMINTH_WIKI_USER_AGENT?.trim() ||
  'Parametric/2.0 (manual-import; +https://warframe.fandom.com/wiki/Helminth)';
let helminthNameCache: { names: Set<string>; expiresAt: number } | null = null;

function normalizeAbilityName(value: string): string {
  return value.replace(/\s+/g, ' ').trim().toLowerCase();
}

async function fetchHelminthAbilityNameSet(): Promise<Set<string>> {
  const now = Date.now();
  if (helminthNameCache && helminthNameCache.expiresAt > now) {
    return helminthNameCache.names;
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 8000);
  try {
    const response = await fetch(HELMINTH_WIKI_URL, {
      signal: controller.signal,
      headers: {
        'User-Agent': HELMINTH_WIKI_USER_AGENT,
      },
    });
    if (!response.ok) return new Set<string>();
    const html = await response.text();
    const $ = cheerio.load(html);
    const names = new Set<string>();

    $('#mw-content-text a[href^="/w/"]').each((_, el) => {
      const text = normalizeAbilityName($(el).text());
      const title = normalizeAbilityName($(el).attr('title') || '');
      for (const raw of [text, title]) {
        if (!raw) continue;
        const cleaned = raw.replace(/\s*\(ability\)$/, '').trim();
        if (!cleaned || cleaned.length < 3 || cleaned.length > 80) continue;
        names.add(cleaned);
      }
    });

    helminthNameCache = {
      names,
      expiresAt: now + HELMINTH_NAME_CACHE_TTL_MS,
    };
    return names;
  } catch {
    return new Set<string>();
  } finally {
    clearTimeout(timeout);
  }
}

apiRouter.get('/weapons', (req: Request, res: Response) => {
  try {
    const db = getDb();
    const type =
      typeof req.query.type === 'string' ? req.query.type : undefined;

    let rows;
    if (type) {
      rows = db
        .prepare(
          'SELECT * FROM weapons WHERE product_category = ? ORDER BY name',
        )
        .all(type);
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

apiRouter.get('/companions', (_req: Request, res: Response) => {
  try {
    const db = getDb();
    const rows = db.prepare('SELECT * FROM companions ORDER BY name').all();
    res.json({ items: rows });
  } catch (err) {
    sendInternalError(res, 'companions.list', err);
  }
});

apiRouter.get('/search', (req: Request, res: Response) => {
  try {
    const db = getDb();
    const term = String(req.query.q ?? '')
      .trim()
      .toLowerCase();
    const limitRaw = Number(req.query.limit ?? 20);
    const limit = Number.isFinite(limitRaw)
      ? Math.min(Math.max(Math.trunc(limitRaw), 1), 50)
      : 20;
    if (term.length < 2) {
      res.json({ items: [] });
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

    const items = [
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
        equipment_type:
          WEAPON_CATEGORY_TO_TYPE[item.product_category ?? ''] ?? 'primary',
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

    res.json({ items });
  } catch (err) {
    sendInternalError(res, 'search.query', err);
  }
});

const MOD_JUNK_SEGMENTS = ['/Beginner/', '/Intermediate/', '/Nemesis/'];
const MOD_JUNK_SUFFIXES = ['SubMod'];

const shardBuffCreateSchema = z.object({
  shard_type_id: z.coerce.number().int().positive(),
  description: z.string().trim().min(1).max(200),
  base_value: z.number().finite(),
  tauforged_value: z.number().finite(),
  value_format: z.enum(['%', '+flat', '/s', 'proc']).default('%'),
  sort_order: z.number().int().min(0).max(999).default(0),
});

const shardBuffUpdateSchema = z.object({
  description: z.string().trim().min(1).max(200),
  base_value: z.number().finite(),
  tauforged_value: z.number().finite(),
  value_format: z.enum(['%', '+flat', '/s', 'proc']),
  sort_order: z.number().int().min(0).max(999),
});

const archonShardTypeSchema = z.object({
  name: z.string().trim().min(1),
  icon_path: z.string().trim().min(1),
  tauforged_icon_path: z.string().trim().min(1),
  sort_order: z.number().int().min(0).max(999).default(0),
});

const archonShardTypeUpdateSchema = z.object({
  name: z.string().trim().min(1),
  icon_path: z.union([z.string().trim().min(1), z.null()]).optional(),
  tauforged_icon_path: z.union([z.string().trim().min(1), z.null()]).optional(),
  sort_order: z.number().int().min(0).max(999).optional(),
});

const RivenStatSchema = z.object({
  stat: z.string().trim(),
  value: z.number().finite(),
  isNegative: z.boolean(),
});

const RivenConfigSchema = z
  .object({
    polarity: z.enum(['AP_ATTACK', 'AP_TACTIC', 'AP_DEFENSE']).optional(),
    positive: z.array(RivenStatSchema),
    negative: RivenStatSchema.optional(),
  })
  .superRefine((config, ctx) => {
    for (const [index, stat] of config.positive.entries()) {
      if (stat.isNegative) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: 'Positive Riven stats must have isNegative=false',
          path: ['positive', index, 'isNegative'],
        });
      }
    }
    if (config.negative && !config.negative.isNegative) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'Negative Riven stat must have isNegative=true',
        path: ['negative', 'isNegative'],
      });
    }
  });

const EquipmentTypeSchema = z.enum([
  'warframe',
  'primary',
  'secondary',
  'melee',
  'archgun',
  'archmelee',
  'companion',
  'beast_claws',
  'archwing',
  'necramech',
  'kdrive',
  'tektolyst',
]);

const ModConfigSchema = z.object({
  id: z.string().trim().min(1).optional(),
  name: z.string().trim().min(1).max(MAX_NAME_LENGTH),
  equipment_type: EquipmentTypeSchema,
  equipment_unique_name: z.string().trim().min(1),
  slots: z.array(
    z
      .object({
        index: z.number().int().min(0),
        type: z.enum(['general', 'aura', 'stance', 'exilus', 'posture']),
        polarity: z.string().trim().min(1).optional(),
        mod: z.record(z.string(), z.unknown()).optional(),
        rank: z.number().int().min(0).optional(),
        setRank: z.number().int().min(0).optional(),
        riven_art_path: z.string().trim().min(1).optional(),
        riven_config: RivenConfigSchema.optional(),
      })
      .passthrough(),
  ),
  helminth: z
    .object({
      replaced_ability_index: z.number().int().min(0),
      replacement_ability_unique_name: z.string().trim().min(1),
    })
    .optional(),
  arcaneSlots: z
    .array(
      z.object({
        arcane: z
          .object({
            unique_name: z.string().trim().min(1),
            name: z.string().trim().min(1),
            rarity: z.string().trim().min(1).optional(),
            image_path: z.string().trim().min(1).optional(),
            level_stats: z.string().trim().min(1).optional(),
          })
          .optional(),
        rank: z.number().int().min(0),
      }),
    )
    .optional(),
  shardSlots: z
    .array(
      z.object({
        shard_type_id: z.coerce.string().trim().min(1).optional(),
        buff_id: z.coerce.number().int().positive().optional(),
        tauforged: z.boolean(),
      }),
    )
    .optional(),
  orokinReactor: z.boolean().optional(),
  equipment_name: z.string().trim().min(1).optional(),
  equipment_image: z.string().trim().min(1).optional(),
});

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

type BuildRow = {
  id: number;
  user_id: number;
  name: string;
  equipment_type: string;
  equipment_unique_name: string;
  mod_config: string;
  created_at: string;
  updated_at: string;
};

function parseBuildConfig(raw: string): Record<string, unknown> | null {
  try {
    const parsed = JSON.parse(raw) as unknown;
    return parsed && typeof parsed === 'object'
      ? (parsed as Record<string, unknown>)
      : null;
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

function sendInternalError(res: Response, context: string, err: unknown): void {
  console.error(`[API] ${context} failed:`, err);
  res.status(500).json({ error: 'Internal server error' });
}

apiRouter.get('/mods', (req: Request, res: Response) => {
  try {
    const db = getDb();
    const typesRaw =
      typeof req.query.types === 'string' ? req.query.types : undefined;
    const typeRaw =
      typeof req.query.type === 'string' ? req.query.type : undefined;
    const rarity =
      typeof req.query.rarity === 'string' ? req.query.rarity : undefined;
    const search =
      typeof req.query.search === 'string' ? req.query.search : undefined;

    let sql = `SELECT m.*, ms.num_in_set AS set_num_in_set, ms.stats AS set_stats
      FROM mods m
      LEFT JOIN mod_sets ms ON m.mod_set = ms.unique_name
      WHERE 1=1`;
    const params: unknown[] = [];

    if (typesRaw) {
      const typeList = typesRaw
        .split(',')
        .map((t) => t.trim())
        .filter(Boolean);
      if (typeList.length === 1) {
        sql += ' AND m.type = ?';
        params.push(typeList[0]);
      } else if (typeList.length > 1) {
        sql += ` AND m.type IN (${typeList.map(() => '?').join(',')})`;
        params.push(...typeList);
      }
    } else if (typeRaw) {
      sql += ' AND m.type = ?';
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

    const rows = db.prepare(sql).all(...params) as Array<{
      unique_name: string;
      name: string;
      type: string;
    }>;

    const cleaned = rows.filter((r) => {
      if (MOD_JUNK_SEGMENTS.some((seg) => r.unique_name.includes(seg)))
        return false;
      if (MOD_JUNK_SUFFIXES.some((suf) => r.unique_name.endsWith(suf)))
        return false;
      return true;
    });

    const byKey = new Map<string, (typeof cleaned)[number]>();
    for (const mod of cleaned) {
      const key = `${mod.name}|||${mod.type}`;
      const existing = byKey.get(key);
      if (!existing) {
        byKey.set(key, mod);
      } else {
        const existingIsExpert = existing.unique_name.includes('/Expert/');
        const currentIsExpert = mod.unique_name.includes('/Expert/');
        if (existingIsExpert && !currentIsExpert) {
          byKey.set(key, mod);
        }
      }
    }

    res.json({ items: Array.from(byKey.values()) });
  } catch (err) {
    sendInternalError(res, 'mods.list', err);
  }
});

apiRouter.get('/mods/:uniqueName', (req: Request, res: Response) => {
  try {
    const db = getDb();
    const uniqueName = String(req.params.uniqueName);
    const mod = db
      .prepare('SELECT * FROM mods WHERE unique_name = ?')
      .get(uniqueName);
    if (!mod) {
      res.status(404).json({ error: 'Mod not found' });
      return;
    }

    const levelStats = db
      .prepare(
        'SELECT * FROM mod_level_stats WHERE mod_unique_name = ? ORDER BY rank',
      )
      .all(uniqueName);

    res.json({ mod, levelStats });
  } catch (err) {
    sendInternalError(res, 'mods.getByUniqueName', err);
  }
});

apiRouter.get('/arcanes', (_req: Request, res: Response) => {
  try {
    const db = getDb();
    const rows = db
      .prepare(
        "SELECT * FROM arcanes WHERE unique_name NOT LIKE '%Sub' ORDER BY name",
      )
      .all();
    res.json({ items: rows });
  } catch (err) {
    sendInternalError(res, 'arcanes.list', err);
  }
});

apiRouter.get('/abilities', (req: Request, res: Response) => {
  try {
    const db = getDb();
    const warframe =
      typeof req.query.warframe === 'string' ? req.query.warframe : undefined;
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
        conditions.push(
          `unique_name IN (${abilityNames.map(() => '?').join(',')})`,
        );
        params.push(...abilityNames);
      }
      rows = db
        .prepare(
          `SELECT * FROM abilities WHERE ${conditions.join(' OR ')} ORDER BY name`,
        )
        .all(...params);
    } else {
      rows = db.prepare('SELECT * FROM abilities ORDER BY name').all();
    }
    res.json({ items: rows });
  } catch (err) {
    sendInternalError(res, 'abilities.list', err);
  }
});

apiRouter.get('/helminth-abilities', async (_req: Request, res: Response) => {
  try {
    const db = getDb();
    const flaggedRows = db
      .prepare(
        'SELECT * FROM abilities WHERE is_helminth_extractable = 1 ORDER BY name',
      )
      .all() as Array<Record<string, unknown>>;

    const wikiNames = await fetchHelminthAbilityNameSet();
    if (wikiNames.size === 0) {
      res.json({ items: flaggedRows });
      return;
    }

    const allAbilities = db
      .prepare(
        `SELECT unique_name, name, description, image_path, energy_cost, is_helminth_extractable
         FROM abilities
         WHERE unique_name IS NOT NULL
           AND unique_name != ''
           AND name IS NOT NULL
           AND name != ''`,
      )
      .all() as Array<
      Record<string, unknown> & { name?: string; unique_name?: string }
    >;
    const inferred = allAbilities
      .filter((row) => {
        const name =
          typeof row.name === 'string' ? normalizeAbilityName(row.name) : '';
        return !!name && wikiNames.has(name);
      })
      .map((row) => ({ ...row, is_helminth_extractable: 1 }));

    const merged = new Map<string, Record<string, unknown>>();
    for (const row of flaggedRows) {
      const key = typeof row.unique_name === 'string' ? row.unique_name : '';
      if (key) merged.set(key, row);
    }
    for (const row of inferred) {
      const key = typeof row.unique_name === 'string' ? row.unique_name : '';
      if (key) merged.set(key, row);
    }

    const items = Array.from(merged.values()).sort((a, b) =>
      String(a.name ?? '').localeCompare(String(b.name ?? '')),
    );
    res.json({ items });
  } catch (err) {
    sendInternalError(res, 'helminthAbilities.list', err);
  }
});

apiRouter.get('/riven-stats', (req: Request, res: Response) => {
  try {
    const db = getDb();
    const weaponType =
      typeof req.query.weapon_type === 'string'
        ? req.query.weapon_type
        : undefined;

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
    const types = db
      .prepare('SELECT * FROM archon_shard_types ORDER BY sort_order')
      .all() as Array<Record<string, unknown>>;
    const buffs = db
      .prepare('SELECT * FROM archon_shard_buffs ORDER BY sort_order')
      .all() as Array<Record<string, unknown>>;

    const result = types.map((t) => ({
      ...t,
      buffs: buffs.filter((b) => b.shard_type_id === t.id),
    }));

    res.json({ shards: result });
  } catch (err) {
    sendInternalError(res, 'archonShards.list', err);
  }
});

apiRouter.put(
  '/archon-shards/types/:id',
  requireAdmin,
  (req: Request, res: Response) => {
    try {
      const typeId = parseNumericId(req.params.id);
      if (typeId === null) {
        res.status(400).json({ error: 'Invalid type id' });
        return;
      }
      const parsed = archonShardTypeUpdateSchema.safeParse(req.body);
      if (!parsed.success) {
        res.status(400).json({
          error:
            parsed.error.issues[0]?.message ||
            'Invalid archon shard type payload',
        });
        return;
      }
      const {
        name,
        icon_path = null,
        tauforged_icon_path = null,
        sort_order = 0,
      } = parsed.data;
      const db = getDb();
      db.prepare(
        'UPDATE archon_shard_types SET name = ?, icon_path = ?, tauforged_icon_path = ?, sort_order = ? WHERE id = ?',
      ).run(name, icon_path, tauforged_icon_path, sort_order, typeId);
      res.json({ success: true });
    } catch (err) {
      sendInternalError(res, 'archonShards.types.update', err);
    }
  },
);

apiRouter.post(
  '/archon-shards/types',
  requireAdmin,
  (req: Request, res: Response) => {
    try {
      const parsed = archonShardTypeSchema.safeParse(req.body);
      if (!parsed.success) {
        res.status(400).json({
          error:
            parsed.error.issues[0]?.message ||
            'Invalid archon shard type payload',
        });
        return;
      }
      const { name, icon_path, tauforged_icon_path, sort_order } = parsed.data;
      const db = getDb();
      db.prepare(
        'INSERT INTO archon_shard_types (name, icon_path, tauforged_icon_path, sort_order) VALUES (?, ?, ?, ?)',
      ).run(name, icon_path, tauforged_icon_path, sort_order);
      res.json({ success: true });
    } catch (err) {
      sendInternalError(res, 'archonShards.types.create', err);
    }
  },
);

apiRouter.post(
  '/archon-shards/buffs',
  requireAdmin,
  (req: Request, res: Response) => {
    try {
      const db = getDb();
      const parsed = shardBuffCreateSchema.safeParse(req.body);
      if (!parsed.success) {
        res.status(400).json({
          error:
            parsed.error.issues[0]?.message ||
            'Invalid archon shard buff payload',
        });
        return;
      }
      const {
        shard_type_id,
        description,
        base_value,
        tauforged_value,
        value_format,
        sort_order,
      } = parsed.data;
      const result = db
        .prepare(
          'INSERT INTO archon_shard_buffs (shard_type_id, description, base_value, tauforged_value, value_format, sort_order) VALUES (?, ?, ?, ?, ?, ?)',
        )
        .run(
          shard_type_id,
          description,
          base_value,
          tauforged_value,
          value_format,
          sort_order,
        );
      res.json({ success: true, id: result.lastInsertRowid });
    } catch (err) {
      sendInternalError(res, 'archonShards.buffs.create', err);
    }
  },
);

apiRouter.put(
  '/archon-shards/buffs/:id',
  requireAdmin,
  (req: Request, res: Response) => {
    try {
      const db = getDb();
      const buffId = parseNumericId(req.params.id);
      if (buffId === null) {
        res.status(400).json({ error: 'Invalid buff id' });
        return;
      }
      const parsed = shardBuffUpdateSchema.safeParse(req.body);
      if (!parsed.success) {
        res.status(400).json({
          error:
            parsed.error.issues[0]?.message ||
            'Invalid archon shard buff payload',
        });
        return;
      }
      const {
        description,
        base_value,
        tauforged_value,
        value_format,
        sort_order,
      } = parsed.data;
      db.prepare(
        'UPDATE archon_shard_buffs SET description = ?, base_value = ?, tauforged_value = ?, value_format = ?, sort_order = ? WHERE id = ?',
      ).run(
        description,
        base_value,
        tauforged_value,
        value_format,
        sort_order,
        buffId,
      );
      res.json({ success: true });
    } catch (err) {
      sendInternalError(res, 'archonShards.buffs.update', err);
    }
  },
);

apiRouter.delete(
  '/archon-shards/buffs/:id',
  requireAdmin,
  (req: Request, res: Response) => {
    try {
      const db = getDb();
      const buffId = parseNumericId(req.params.id);
      if (buffId === null) {
        res.status(400).json({ error: 'Invalid buff id' });
        return;
      }
      db.prepare('DELETE FROM archon_shard_buffs WHERE id = ?').run(buffId);
      res.json({ success: true });
    } catch (err) {
      sendInternalError(res, 'archonShards.buffs.delete', err);
    }
  },
);

apiRouter.get('/loadouts', (req: Request, res: Response) => {
  try {
    const db = getDb();
    if (!req.session.user_id) {
      res.status(401).json({ error: 'Not authenticated' });
      return;
    }
    const loadouts = db
      .prepare(
        'SELECT * FROM loadouts WHERE user_id = ? ORDER BY updated_at DESC',
      )
      .all(req.session.user_id) as Array<Record<string, unknown>>;
    for (const l of loadouts) {
      (l as Record<string, unknown>).builds = db
        .prepare('SELECT * FROM loadout_builds WHERE loadout_id = ?')
        .all(l.id);
    }
    res.json({ loadouts });
  } catch (err) {
    sendInternalError(res, 'loadouts.list', err);
  }
});

apiRouter.get('/loadouts/:id', (req: Request, res: Response) => {
  try {
    const db = getDb();
    if (!req.session.user_id) {
      res.status(401).json({ error: 'Not authenticated' });
      return;
    }
    const id = parseNumericId(req.params.id);
    if (id === null) {
      res.status(400).json({ error: 'Invalid loadout id' });
      return;
    }

    const loadout = db
      .prepare('SELECT * FROM loadouts WHERE id = ?')
      .get(id) as Record<string, unknown> | undefined;
    if (!loadout) {
      res.status(404).json({ error: 'Loadout not found' });
      return;
    }
    if (loadout.user_id !== req.session.user_id) {
      res.status(403).json({ error: 'Forbidden' });
      return;
    }
    const links = db
      .prepare('SELECT * FROM loadout_builds WHERE loadout_id = ?')
      .all(id) as Array<Record<string, unknown>>;

    res.json({
      loadout: {
        ...loadout,
        builds: links,
      },
    });
  } catch (err) {
    sendInternalError(res, 'loadouts.getById', err);
  }
});

apiRouter.post('/loadouts', (req: Request, res: Response) => {
  try {
    const db = getDb();
    if (!req.session.user_id) {
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
      .prepare('INSERT INTO loadouts (user_id, name) VALUES (?, ?)')
      .run(req.session.user_id, sanitizedName);
    res.json({ success: true, id: result.lastInsertRowid });
  } catch (err) {
    sendInternalError(res, 'loadouts.create', err);
  }
});

apiRouter.put('/loadouts/:id', (req: Request, res: Response) => {
  try {
    const db = getDb();
    if (!req.session.user_id) {
      res.status(401).json({ error: 'Not authenticated' });
      return;
    }
    const parsedId = parseNumericId(req.params.id);
    if (parsedId === null) {
      res.status(400).json({ error: 'Invalid loadout id' });
      return;
    }
    const { name } = req.body;
    if (typeof name !== 'string' || name.trim().length === 0) {
      res.status(400).json({ error: 'Invalid name' });
      return;
    }
    const trimmedName = name.trim();
    if (trimmedName.length > 255) {
      res.status(400).json({ error: 'Invalid name' });
      return;
    }
    db.prepare(
      "UPDATE loadouts SET name = ?, updated_at = datetime('now') WHERE id = ? AND user_id = ?",
    ).run(trimmedName, parsedId, req.session.user_id);
    res.json({ success: true });
  } catch (err) {
    sendInternalError(res, 'loadouts.update', err);
  }
});

apiRouter.delete('/loadouts/:id', (req: Request, res: Response) => {
  try {
    const db = getDb();
    if (!req.session.user_id) {
      res.status(401).json({ error: 'Not authenticated' });
      return;
    }
    const id = parseNumericId(req.params.id);
    if (id === null) {
      res.status(400).json({ error: 'Invalid loadout id' });
      return;
    }
    const owned = db
      .prepare('SELECT id FROM loadouts WHERE id = ? AND user_id = ?')
      .get(id, req.session.user_id) as { id: number } | undefined;
    if (!owned) {
      res.status(404).json({ error: 'Loadout not found' });
      return;
    }
    db.transaction(() => {
      db.prepare('DELETE FROM loadout_builds WHERE loadout_id = ?').run(id);
      db.prepare('DELETE FROM loadouts WHERE id = ? AND user_id = ?').run(
        id,
        req.session.user_id,
      );
    })();
    res.json({ success: true });
  } catch (err) {
    sendInternalError(res, 'loadouts.delete', err);
  }
});

apiRouter.post('/loadouts/:id/copy', (req: Request, res: Response) => {
  try {
    const db = getDb();
    if (!req.session.user_id) {
      res.status(401).json({ error: 'Not authenticated' });
      return;
    }
    const id = parseNumericId(req.params.id);
    if (id === null) {
      res.status(400).json({ error: 'Invalid loadout id' });
      return;
    }

    const sourceLoadout = db
      .prepare('SELECT * FROM loadouts WHERE id = ?')
      .get(id) as { id: number; user_id: number; name: string } | undefined;
    if (!sourceLoadout) {
      res.status(404).json({ error: 'Loadout not found' });
      return;
    }
    if (sourceLoadout.user_id !== req.session.user_id) {
      res.status(403).json({ error: 'Forbidden' });
      return;
    }

    const requestedName =
      typeof req.body?.name === 'string' ? req.body.name.trim() : '';
    const requestedNameTruncated = requestedName.slice(0, MAX_NAME_LENGTH);
    const copyName =
      requestedNameTruncated.length > 0
        ? requestedNameTruncated
        : `${COPY_PREFIX}${sourceLoadout.name.trim().slice(0, MAX_NAME_LENGTH - COPY_PREFIX.length)}`;

    const newLoadoutId = db.transaction(() => {
      const createdLoadout = db
        .prepare('INSERT INTO loadouts (user_id, name) VALUES (?, ?)')
        .run(req.session.user_id, copyName);
      const newId = Number(createdLoadout.lastInsertRowid);

      const sourceLinks = db
        .prepare(
          'SELECT build_id, slot_type FROM loadout_builds WHERE loadout_id = ?',
        )
        .all(sourceLoadout.id) as Array<{
        build_id: number;
        slot_type: string;
      }>;

      for (const link of sourceLinks) {
        const sourceBuild = db
          .prepare('SELECT * FROM builds WHERE id = ?')
          .get(link.build_id) as BuildRow | undefined;
        if (!sourceBuild) {
          continue;
        }
        const copiedBuild = db
          .prepare(
            `INSERT INTO builds (user_id, name, equipment_type, equipment_unique_name, mod_config, created_at, updated_at)
             VALUES (?, ?, ?, ?, ?, datetime('now'), datetime('now'))`,
          )
          .run(
            req.session.user_id,
            `Copy of ${sourceBuild.name}`,
            sourceBuild.equipment_type,
            sourceBuild.equipment_unique_name,
            sourceBuild.mod_config,
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
    if (!req.session.user_id) {
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
    if (
      !Number.isFinite(buildId) ||
      buildId <= 0 ||
      typeof slot_type !== 'string'
    ) {
      res.status(400).json({ error: 'Invalid loadout build payload' });
      return;
    }
    const result = db
      .prepare(
        'INSERT OR REPLACE INTO loadout_builds (loadout_id, build_id, slot_type) SELECT ?, ?, ? WHERE EXISTS (SELECT 1 FROM loadouts WHERE id = ? AND user_id = ?) AND EXISTS (SELECT 1 FROM builds WHERE id = ? AND user_id = ?)',
      )
      .run(
        loadoutId,
        buildId,
        slot_type,
        loadoutId,
        req.session.user_id,
        buildId,
        req.session.user_id,
      );
    if (result.changes === 0) {
      res.status(404).json({
        error:
          'Loadout or build not found, or you do not have permission to add it',
      });
      return;
    }
    res.json({ success: true });
  } catch (err) {
    sendInternalError(res, 'loadouts.addBuild', err);
  }
});

apiRouter.delete(
  '/loadouts/:id/builds/:slotType',
  (req: Request, res: Response) => {
    try {
      const db = getDb();
      if (!req.session.user_id) {
        res.status(401).json({ error: 'Not authenticated' });
        return;
      }
      const loadoutId = parseNumericId(req.params.id);
      if (loadoutId === null) {
        res.status(400).json({ error: 'Invalid loadout id' });
        return;
      }
      db.prepare(
        'DELETE FROM loadout_builds WHERE loadout_id = ? AND slot_type = ? AND EXISTS (SELECT 1 FROM loadouts WHERE id = ? AND user_id = ?)',
      ).run(loadoutId, req.params.slotType, loadoutId, req.session.user_id);
      res.json({ success: true });
    } catch (err) {
      sendInternalError(res, 'loadouts.removeBuild', err);
    }
  },
);

apiRouter.get('/builds', (req: Request, res: Response) => {
  try {
    const db = getDb();
    if (!req.session.user_id) {
      res.status(401).json({ error: 'Not authenticated' });
      return;
    }

    const rows = db
      .prepare(
        'SELECT * FROM builds WHERE user_id = ? ORDER BY updated_at DESC',
      )
      .all(req.session.user_id) as BuildRow[];

    const builds = rows.map((row) => toBuildResponse(row));

    res.json({ builds });
  } catch (err) {
    sendInternalError(res, 'builds.list', err);
  }
});

apiRouter.get('/builds/:id', (req: Request, res: Response) => {
  try {
    const db = getDb();
    if (!req.session.user_id) {
      res.status(401).json({ error: 'Not authenticated' });
      return;
    }
    const id = parseNumericId(req.params.id);
    if (id === null) {
      res.status(400).json({ error: 'Invalid build id' });
      return;
    }

    const row = db.prepare('SELECT * FROM builds WHERE id = ?').get(id) as
      | BuildRow
      | undefined;
    if (!row) {
      res.status(404).json({ error: 'Build not found' });
      return;
    }
    if (row.user_id !== req.session.user_id) {
      res.status(403).json({ error: 'Forbidden' });
      return;
    }

    res.json({
      build: toBuildResponse(row),
      owner_user_id: row.user_id,
    });
  } catch (err) {
    sendInternalError(res, 'builds.getById', err);
  }
});

apiRouter.post('/builds', (req: Request, res: Response) => {
  try {
    const db = getDb();
    if (!req.session.user_id) {
      res.status(401).json({ error: 'Not authenticated' });
      return;
    }

    const { name, equipment_type, equipment_unique_name, mod_config } =
      req.body;

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
        `INSERT INTO builds (user_id, name, equipment_type, equipment_unique_name, mod_config, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, datetime('now'), datetime('now'))`,
      )
      .run(
        req.session.user_id,
        name,
        equipment_type,
        equipment_unique_name,
        JSON.stringify(modConfigResult.data),
      );

    res.json({ success: true, id: result.lastInsertRowid });
  } catch (err) {
    sendInternalError(res, 'builds.create', err);
  }
});

apiRouter.put('/builds/:id', (req: Request, res: Response) => {
  try {
    const db = getDb();
    if (!req.session.user_id) {
      res.status(401).json({ error: 'Not authenticated' });
      return;
    }

    const id = parseNumericId(req.params.id);
    if (id === null) {
      res.status(400).json({ error: 'Invalid build id' });
      return;
    }
    const { name, mod_config } = req.body;
    const modConfigResult = ModConfigSchema.safeParse(mod_config);
    if (typeof name !== 'string') {
      res.status(400).json({ error: 'Invalid build payload' });
      return;
    }
    if (!modConfigResult.success) {
      res.status(400).json({ error: 'Invalid mod_config' });
      return;
    }

    db.prepare(
      `UPDATE builds SET name = ?, mod_config = ?, updated_at = datetime('now')
       WHERE id = ? AND user_id = ?`,
    ).run(name, JSON.stringify(modConfigResult.data), id, req.session.user_id);

    res.json({ success: true });
  } catch (err) {
    sendInternalError(res, 'builds.update', err);
  }
});

apiRouter.delete('/builds/:id', (req: Request, res: Response) => {
  try {
    const db = getDb();
    if (!req.session.user_id) {
      res.status(401).json({ error: 'Not authenticated' });
      return;
    }

    const id = parseNumericId(req.params.id);
    if (id === null) {
      res.status(400).json({ error: 'Invalid build id' });
      return;
    }
    db.prepare('DELETE FROM builds WHERE id = ? AND user_id = ?').run(
      id,
      req.session.user_id,
    );
    res.json({ success: true });
  } catch (err) {
    sendInternalError(res, 'builds.delete', err);
  }
});

apiRouter.post('/builds/:id/copy', (req: Request, res: Response) => {
  try {
    const db = getDb();
    if (!req.session.user_id) {
      res.status(401).json({ error: 'Not authenticated' });
      return;
    }
    const id = parseNumericId(req.params.id);
    if (id === null) {
      res.status(400).json({ error: 'Invalid build id' });
      return;
    }
    const source = db.prepare('SELECT * FROM builds WHERE id = ?').get(id) as
      | BuildRow
      | undefined;
    if (!source) {
      res.status(404).json({ error: 'Build not found' });
      return;
    }
    if (source.user_id !== req.session.user_id) {
      res.status(403).json({ error: 'Forbidden' });
      return;
    }

    const requestedName =
      typeof req.body?.name === 'string' ? req.body.name.trim() : '';
    const requestedNameTruncated = requestedName.slice(0, MAX_NAME_LENGTH);
    const copyName =
      requestedNameTruncated.length > 0
        ? requestedNameTruncated
        : `${COPY_PREFIX}${source.name.trim().slice(0, MAX_NAME_LENGTH - COPY_PREFIX.length)}`;

    const result = db
      .prepare(
        `INSERT INTO builds (user_id, name, equipment_type, equipment_unique_name, mod_config, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, datetime('now'), datetime('now'))`,
      )
      .run(
        req.session.user_id,
        copyName,
        source.equipment_type,
        source.equipment_unique_name,
        source.mod_config,
      );

    res.json({ success: true, id: result.lastInsertRowid });
  } catch (err) {
    sendInternalError(res, 'builds.copy', err);
  }
});
