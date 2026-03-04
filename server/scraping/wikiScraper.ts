import * as cheerio from 'cheerio';

import { getDb } from '../db/connection.js';

const WIKI_BASE = 'https://wiki.warframe.com';

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export interface WikiAbilityStats {
  energy_cost: number | null;
  strength: string | null;
  duration: string | null;
  range: string | null;
  misc: string[];
}

export interface WikiAbilityResult {
  uniqueName: string;
  name: string;
  stats: WikiAbilityStats;
}

export interface WikiPassiveResult {
  uniqueName: string;
  name: string;
  passive: string;
}

export interface WikiAugmentMapping {
  augmentName: string;
  abilityName: string;
  abilityUniqueName: string;
  warframeName: string;
}

export interface WikiShardType {
  id: string;
  name: string;
  icon_path: string;
  tauforged_icon_path: string;
  sort_order: number;
}

export interface WikiShardBuff {
  shard_type_id: string;
  description: string;
  base_value: number;
  tauforged_value: number;
  value_format: string;
  sort_order: number;
}

export interface WikiShardResult {
  types: WikiShardType[];
  buffs: WikiShardBuff[];
}

export interface WikiRivenDisposition {
  weapon_name: string;
  disposition: number;
}

export interface WikiScrapeResult {
  abilities: WikiAbilityResult[];
  passives: WikiPassiveResult[];
  augments: WikiAugmentMapping[];
  shards: WikiShardResult;
  dispositions: WikiRivenDisposition[];
}

export interface WikiScrapeProgress {
  phase:
    | 'abilities'
    | 'passives'
    | 'augments'
    | 'shards'
    | 'riven_disposition'
    | 'merging'
    | 'done';
  current: number;
  total: number;
  currentItem: string;
  log: string[];
}

function lastRankValue(text: string): string {
  const parts = text
    .split('/')
    .map((s) => s.trim())
    .filter(Boolean);
  return parts[parts.length - 1] || text.trim();
}

function cleanStatValue(raw: string): string | null {
  const text = raw.trim();
  if (!text || text === 'N/A') return null;
  return lastRankValue(text);
}

function wikiSlug(name: string): string {
  return encodeURIComponent(name.replace(/ /g, '_')).replace(/'/g, '%27');
}

function normalizeText(s: string): string {
  return s
    .replace(/\u00A0/g, ' ')
    .replace(/[\u2018\u2019]/g, "'")
    .trim();
}

async function scrapeAbilityPage(
  abilityName: string,
  overrideUrl?: string,
): Promise<WikiAbilityStats | null> {
  const url = overrideUrl ?? `${WIKI_BASE}/w/${wikiSlug(abilityName)}`;

  const res = await fetch(url);
  if (!res.ok) return null;

  const html = await res.text();
  const $ = cheerio.load(html);

  const abilityBox = $('table.ability-box').first();
  if (abilityBox.length === 0) return null;

  let energy_cost: number | null = null;
  let strength: string | null = null;
  let duration: string | null = null;
  let range: string | null = null;
  const misc: string[] = [];

  abilityBox.find('a[href="/w/Ability_Efficiency"]').each((_, el) => {
    const b = $(el).find('b[style*="font-size"]');
    if (b.length) {
      const val = parseInt(b.text().trim(), 10);
      if (!isNaN(val)) energy_cost = val;
    }
    const siblingB = $(el).prev('b[style*="font-size"]');
    if (siblingB.length) {
      const val = parseInt(siblingB.text().trim(), 10);
      if (!isNaN(val)) energy_cost = val;
    }
  });
  if (energy_cost === null) {
    abilityBox.find('b[style*="font-size:16px"]').each((_, el) => {
      const val = parseInt($(el).text().trim(), 10);
      if (!isNaN(val) && val > 0 && val <= 200) energy_cost = val;
    });
  }

  abilityBox.find('td').each((_, td) => {
    const $td = $(td);

    const paramSpan = $td.find('span.tooltip[data-param-name]').first();
    if (paramSpan.length === 0) return;

    const paramName = paramSpan.attr('data-param-name') || '';
    const valueSpan = $td.find('span[style*="float:right"]').first();
    const rawValue = valueSpan.length ? valueSpan.text().trim() : '';

    if (paramName === 'Ability Strength') {
      strength = cleanStatValue(rawValue);
    } else if (paramName === 'Ability Duration') {
      duration = cleanStatValue(rawValue);
    } else if (paramName === 'Ability Range') {
      range = cleanStatValue(rawValue);
    }
  });

  abilityBox.find('td').each((_, td) => {
    const $td = $(td);
    const boldTitle = $td.find('b[title*="unlisted"]');
    if (boldTitle.length === 0 && !$td.text().trim().startsWith('Misc')) return;

    const miscSpan = $td.find('span[style*="float:right"]').first();
    if (miscSpan.length === 0) return;

    miscSpan.find('br').replaceWith('\n');
    const lines = miscSpan
      .text()
      .split('\n')
      .map((l) => l.trim())
      .filter(Boolean);
    for (const line of lines) {
      const maxed = lastRankValue(line);
      if (maxed) misc.push(maxed);
    }
  });

  return { energy_cost, strength, duration, range, misc };
}

async function resolveAbilityUrls(
  abilities: { name: string; wf_name: string | null }[],
  onProgress?: (msg: string) => void,
): Promise<Map<string, string>> {
  const resolved = new Map<string, string>();

  const warframeNames = new Set<string>();
  for (const ab of abilities) {
    if (ab.wf_name) warframeNames.add(ab.wf_name);
  }

  for (const rawName of warframeNames) {
    const cleanName = rawName.replace(/^<ARCHWING>\s*/i, '').trim();
    const slug = cleanName.replace(/ /g, '_');
    const url = `${WIKI_BASE}/w/${encodeURIComponent(slug)}/Abilities`;

    try {
      const res = await fetch(url);
      if (!res.ok) {
        onProgress?.(
          `  Could not fetch ${cleanName}/Abilities (${res.status})`,
        );
        continue;
      }
      const html = await res.text();
      const $ = cheerio.load(html);

      const abilityNames = abilities
        .filter((a) => a.wf_name === rawName)
        .map((a) => a.name);

      for (const name of abilityNames) {
        const normName = normalizeText(name);
        $('a[href^="/w/"]').each((_, el) => {
          if (resolved.has(name)) return;
          const linkText = normalizeText($(el).text());
          const title = normalizeText($(el).attr('title') || '');
          const href = $(el).attr('href') || '';
          if (href.includes('/Abilities')) return;
          if (
            linkText === normName ||
            title === normName ||
            title.startsWith(`${normName} (`)
          ) {
            resolved.set(name, `${WIKI_BASE}${href}`);
          }
        });
      }
      await sleep(500);
    } catch (err) {
      onProgress?.(`  Error resolving ${rawName}: ${err}`);
    }
  }

  const helminthAbilities = abilities
    .filter((a) => !a.wf_name)
    .map((a) => a.name);
  if (helminthAbilities.length > 0) {
    try {
      const res = await fetch(`${WIKI_BASE}/w/Helminth`);
      if (res.ok) {
        const html = await res.text();
        const $ = cheerio.load(html);
        for (const name of helminthAbilities) {
          const normName = normalizeText(name);
          $('a[href^="/w/"]').each((_, el) => {
            if (resolved.has(name)) return;
            const linkText = normalizeText($(el).text());
            const title = normalizeText($(el).attr('title') || '');
            const href = $(el).attr('href') || '';
            if (
              linkText === normName ||
              title === normName ||
              title.startsWith(`${normName} (`)
            ) {
              resolved.set(name, `${WIKI_BASE}${href}`);
            }
          });
        }
      }
      await sleep(500);
    } catch {
      // ignore
    }
  }

  return resolved;
}

async function scrapeAbilityWithFallbacks(
  name: string,
  resolvedUrl?: string,
): Promise<WikiAbilityStats | null> {
  if (resolvedUrl) {
    const result = await scrapeAbilityPage(name, resolvedUrl);
    if (result) return result;
  }

  const result = await scrapeAbilityPage(name);
  if (result) return result;

  const slug = name.replace(/ /g, '_');

  const titleCased = name
    .split(' ')
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join('_');
  if (titleCased !== slug) {
    const r = await scrapeAbilityPage(
      name,
      `${WIKI_BASE}/w/${wikiSlug(titleCased)}`,
    );
    if (r) return r;
  }

  const r2 = await scrapeAbilityPage(
    name,
    `${WIKI_BASE}/w/${wikiSlug(`${slug}_(Ability)`)}`,
  );
  if (r2) return r2;

  return null;
}

export async function scrapeAbilities(
  onProgress?: (msg: string) => void,
  onlyMissing = false,
): Promise<WikiAbilityResult[]> {
  const db = getDb();
  const baseFilter = onlyMissing ? 'WHERE a.wiki_stats IS NULL' : '';
  const abilities = db
    .prepare(
      `
    SELECT a.unique_name, a.name, w.name as wf_name
    FROM abilities a
    LEFT JOIN warframes w ON a.warframe_unique_name = w.unique_name
    ${baseFilter}
    ORDER BY a.name
  `,
    )
    .all() as { unique_name: string; name: string; wf_name: string | null }[];

  if (onlyMissing) {
    const total = (
      db.prepare('SELECT COUNT(*) as c FROM abilities').get() as { c: number }
    ).c;
    onProgress?.(
      `${abilities.length} abilities need scraping (${total - abilities.length} already have data)`,
    );
  } else {
    onProgress?.(`Found ${abilities.length} abilities to scrape`);
  }

  if (abilities.length === 0) {
    onProgress?.('All abilities already have wiki data, skipping');
    return [];
  }

  onProgress?.('Resolving ability URLs from warframe pages...');
  const urlMap = await resolveAbilityUrls(abilities, onProgress);
  onProgress?.(
    `Resolved ${urlMap.size}/${abilities.length} ability URLs from warframe pages`,
  );

  const results: WikiAbilityResult[] = [];

  for (let i = 0; i < abilities.length; i++) {
    const ab = abilities[i];
    const resolvedUrl = urlMap.get(ab.name);
    onProgress?.(
      `[${i + 1}/${abilities.length}] ${ab.name}${resolvedUrl ? '' : ' (fallbacks)'}`,
    );

    try {
      const stats = await scrapeAbilityWithFallbacks(ab.name, resolvedUrl);
      if (stats) {
        results.push({ uniqueName: ab.unique_name, name: ab.name, stats });
      } else {
        onProgress?.(`  No data found for ${ab.name}`);
      }
    } catch (err) {
      onProgress?.(`  Failed: ${err instanceof Error ? err.message : err}`);
    }

    if (i < abilities.length - 1) await sleep(800);
  }

  onProgress?.(`Scraped ${results.length} abilities successfully`);
  return results;
}

async function scrapeWarframePage(wfName: string): Promise<string | null> {
  const slug = wfName.replace(/ /g, '_');
  const url = `${WIKI_BASE}/w/${encodeURIComponent(slug)}`;

  const res = await fetch(url);
  if (!res.ok) return null;

  const html = await res.text();
  const $ = cheerio.load(html);

  const infobox = $('div.infobox').first();
  if (infobox.length > 0) {
    const passiveGroup = infobox
      .find('div.group')
      .filter((_, el) => {
        const header = normalizeText($(el).find('> .header').first().text());
        return header.toLowerCase() === 'passive';
      })
      .first();

    if (passiveGroup.length > 0) {
      const caption = normalizeText(
        passiveGroup.find('.row .value.caption').first().text(),
      );
      if (caption.length > 0) {
        return caption;
      }

      const value = normalizeText(
        passiveGroup.find('.row .value').first().text(),
      );
      if (value.length > 0) {
        return value;
      }

      const fallbackGroupText = normalizeText(
        passiveGroup.text().replace(/^Passive\s*/i, ''),
      );
      if (fallbackGroupText.length > 0) {
        return fallbackGroupText;
      }
    }
  }

  const passiveHeader = $('h3:contains("Passive")').first();
  if (passiveHeader.length > 0) {
    const nextP = passiveHeader.nextAll('p').first();
    if (nextP.length > 0) {
      return normalizeText(nextP.text());
    }
  }

  let passiveHeading = $('h2 span#Passive').first().closest('h2').first();
  if (passiveHeading.length === 0) {
    passiveHeading = $('h3 span#Passive').first().closest('h3').first();
  }
  if (passiveHeading.length > 0) {
    const nextP = passiveHeading.nextAll('p').first();
    if (nextP.length > 0) {
      return normalizeText(nextP.text());
    }
  }

  if (infobox.length > 0) {
    const text = normalizeText(infobox.text());
    const passiveMatch = text.match(
      /Passive\s*(.+?)(?=Abilities|General Information|\d+(?:st|nd|rd|th)\s+Ability|Notes|Trivia|Gallery|References|$)/s,
    );
    if (passiveMatch) {
      return normalizeText(passiveMatch[1]);
    }
  }

  return null;
}

export async function scrapePassives(
  onProgress?: (msg: string) => void,
  onlyMissing = false,
): Promise<WikiPassiveResult[]> {
  const db = getDb();
  const baseFilter = `product_category = 'Suits' AND name NOT LIKE '%Prime' AND name NOT LIKE '%Umbra'`;
  const query = onlyMissing
    ? `SELECT unique_name, name FROM warframes WHERE ${baseFilter} AND passive_description_wiki IS NULL ORDER BY name`
    : `SELECT unique_name, name FROM warframes WHERE ${baseFilter} ORDER BY name`;
  const warframes = db.prepare(query).all() as {
    unique_name: string;
    name: string;
  }[];

  if (onlyMissing) {
    const total = (
      db
        .prepare(`SELECT COUNT(*) as c FROM warframes WHERE ${baseFilter}`)
        .get() as { c: number }
    ).c;
    onProgress?.(
      `${warframes.length} warframes need passive scraping (${total - warframes.length} already have data)`,
    );
  } else {
    onProgress?.(`Found ${warframes.length} warframes to scrape`);
  }

  if (warframes.length === 0) {
    onProgress?.('All warframes already have passive data, skipping');
    return [];
  }

  const results: WikiPassiveResult[] = [];

  for (let i = 0; i < warframes.length; i++) {
    const wf = warframes[i];
    onProgress?.(`[${i + 1}/${warframes.length}] ${wf.name}`);

    try {
      const passive = await scrapeWarframePage(wf.name);
      if (passive) {
        results.push({ uniqueName: wf.unique_name, name: wf.name, passive });
      }
    } catch (err) {
      onProgress?.(`  Failed: ${err instanceof Error ? err.message : err}`);
    }

    if (i < warframes.length - 1) await sleep(800);
  }

  onProgress?.(`Scraped ${results.length} passives successfully`);
  return results;
}

function extractBraceBlock(lua: string, startIdx: number): string {
  let depth = 1;
  let i = startIdx;
  while (i < lua.length && depth > 0) {
    if (lua[i] === '{') depth++;
    else if (lua[i] === '}') depth--;
    i++;
  }
  return lua.substring(startIdx, i - 1);
}

async function fetchAugmentMappings(): Promise<WikiAugmentMapping[]> {
  const url = `${WIKI_BASE}/w/Module:Ability/data?action=raw`;
  const res = await fetch(url);
  if (!res.ok)
    throw new Error(`Failed to fetch Module:Ability/data: ${res.status}`);

  const lua = await res.text();
  const mappings: WikiAugmentMapping[] = [];

  const entryPattern = /\["([^"]+)"\]\s*=\s*\{/g;
  let match;

  while ((match = entryPattern.exec(lua)) !== null) {
    const abilityName = match[1];
    const blockStart = match.index + match[0].length;
    const body = extractBraceBlock(lua, blockStart);

    const psMatch = body.match(/Powersuit\s*=\s*"([^"]+)"/);
    const warframeName = psMatch?.[1] || '';

    const inMatch = body.match(/InternalName\s*=\s*"([^"]+)"/);
    const internalName = inMatch?.[1] || '';

    const augMatch = body.match(/Augments\s*=\s*\{([^}]*)\}/);
    if (augMatch && warframeName) {
      const augNames = [...augMatch[1].matchAll(/"([^"]+)"/g)].map((m) => m[1]);
      for (const augName of augNames) {
        mappings.push({
          augmentName: augName,
          abilityName,
          abilityUniqueName: internalName,
          warframeName,
        });
      }
    }
  }

  return mappings;
}

export async function scrapeAugments(
  onProgress?: (msg: string) => void,
): Promise<WikiAugmentMapping[]> {
  onProgress?.('Fetching Module:Ability/data...');
  const mappings = await fetchAugmentMappings();
  onProgress?.(`Found ${mappings.length} augment→ability mappings`);
  return mappings;
}

function parseBuffValues(text: string): {
  base: number;
  tauforged: number;
  isPercent: boolean;
} {
  const m = text.match(
    /\+?(\d+(?:\.\d+)?)(%?)\s*\((?:\+?(\d+(?:\.\d+)?))(%?)\)/,
  );
  if (m) {
    return {
      base: parseFloat(m[1]),
      tauforged: parseFloat(m[3]),
      isPercent: m[2] === '%' || m[4] === '%',
    };
  }
  return { base: 0, tauforged: 0, isPercent: false };
}

function deriveValueFormat(text: string, isPercent: boolean): string {
  if (isPercent) return '%';
  if (/\/s\b/i.test(text)) return '/s';
  return '+flat';
}

export async function scrapeArchonShards(
  onProgress?: (msg: string) => void,
): Promise<WikiShardResult> {
  onProgress?.('Fetching Archon Shard wiki page...');
  const url = `${WIKI_BASE}/w/Archon_Shard`;
  const res = await fetch(url);
  if (!res.ok)
    throw new Error(`Failed to fetch Archon Shard page: ${res.status}`);

  const html = await res.text();
  const $ = cheerio.load(html);

  const table = $('table.wikitable.sortable').first();
  if (table.length === 0) throw new Error('Shard buff table not found');

  const types: WikiShardType[] = [];
  const buffs: WikiShardBuff[] = [];

  let currentShardId = '';
  let shardSortOrder = 0;
  let buffSortOrder = 0;

  table.find('tr').each((i, row) => {
    if (i === 0) return;

    const cells = $(row).find('td');
    let buffCellIdx = 0;

    const rowspanCell = cells.filter('[rowspan]').first();
    if (rowspanCell.length > 0) {
      const paramSpan = rowspanCell
        .find('span.tooltip[data-param-name]')
        .first();
      const shardName =
        paramSpan.attr('data-param-name') || rowspanCell.text().trim();
      const color = shardName
        .replace(/\s*Archon Shard.*/, '')
        .replace('Tauforged ', '')
        .trim();
      const id = color.toLowerCase();

      shardSortOrder++;
      buffSortOrder = 0;
      currentShardId = id;

      types.push({
        id,
        name: color,
        icon_path: `/icons/shards/${color}ArchonShard.png`,
        tauforged_icon_path: `/icons/shards/Tauforged${color}ArchonShard.png`,
        sort_order: shardSortOrder,
      });

      buffCellIdx = 1;
    }

    const buffCell = cells.eq(buffCellIdx);
    const buffText = buffCell.text().trim();
    if (!buffText || !currentShardId) return;

    buffSortOrder++;
    const { base, tauforged, isPercent } = parseBuffValues(buffText);
    const valueFormat = deriveValueFormat(buffText, isPercent);

    buffs.push({
      shard_type_id: currentShardId,
      description: buffText,
      base_value: base,
      tauforged_value: tauforged,
      value_format: valueFormat,
      sort_order: buffSortOrder,
    });
  });

  onProgress?.(`Found ${types.length} shard types with ${buffs.length} buffs`);
  return { types, buffs };
}

export async function scrapeRivenDispositions(
  onProgress?: (msg: string) => void,
): Promise<WikiRivenDisposition[]> {
  onProgress?.('Fetching Riven Mods wiki page...');
  const res = await fetch(`${WIKI_BASE}/w/Riven_Mods`);
  if (!res.ok) {
    throw new Error(`Failed to fetch Riven Mods page: ${res.status}`);
  }

  const html = await res.text();
  const $ = cheerio.load(html);
  const dispositions: WikiRivenDisposition[] = [];

  $('table.wikitable').each((_, table) => {
    const headers = $(table)
      .find('tr')
      .first()
      .find('th')
      .toArray()
      .map((th) => normalizeText($(th).text()).toLowerCase());
    if (!headers.some((h) => h.includes('weapon'))) return;
    if (
      !headers.some(
        (h) =>
          h.includes('disposition') ||
          h.includes('attenuation') ||
          h.includes('multiplier'),
      )
    ) {
      return;
    }

    $(table)
      .find('tr')
      .slice(1)
      .each((__, row) => {
        const cells = $(row).find('td');
        if (cells.length < 2) return;
        const weaponName = normalizeText(cells.eq(0).text()).replace(
          /\s+/g,
          ' ',
        );
        const rowText = normalizeText($(row).text());
        const multMatch = rowText.match(/(\d+(?:\.\d+)?)\s*x/i);
        if (!weaponName || !multMatch) return;
        const disposition = parseFloat(multMatch[1]);
        if (!Number.isFinite(disposition)) return;
        dispositions.push({ weapon_name: weaponName, disposition });
      });
  });

  const deduped = new Map<string, WikiRivenDisposition>();
  for (const d of dispositions) {
    if (!deduped.has(d.weapon_name.toLowerCase())) {
      deduped.set(d.weapon_name.toLowerCase(), d);
    }
  }
  const output = Array.from(deduped.values());
  onProgress?.(`Found ${output.length} riven disposition rows`);
  return output;
}

export interface WikiMergeResult {
  abilitiesUpdated: number;
  passivesUpdated: number;
  augmentsUpdated: number;
  shardTypes: number;
  shardBuffs: number;
  rivenDispositionsUpdated: number;
  rivenDispositionsFallbackFromOmega: number;
}

export function mergeWikiData(
  data: WikiScrapeResult,
  onProgress?: (msg: string) => void,
): WikiMergeResult {
  const db = getDb();
  const result: WikiMergeResult = {
    abilitiesUpdated: 0,
    passivesUpdated: 0,
    augmentsUpdated: 0,
    shardTypes: 0,
    shardBuffs: 0,
    rivenDispositionsUpdated: 0,
    rivenDispositionsFallbackFromOmega: 0,
  };

  const updateAbility = db.prepare(
    'UPDATE abilities SET wiki_stats = ?, energy_cost = ? WHERE unique_name = ?',
  );
  const updatePassive = db.prepare(
    'UPDATE warframes SET passive_description_wiki = ? WHERE unique_name = ?',
  );
  const updatePassiveLike = db.prepare(
    `UPDATE warframes SET passive_description_wiki = ?
     WHERE unique_name LIKE ? AND passive_description_wiki IS NULL`,
  );
  const updateAugment = db.prepare(
    'UPDATE mods SET augment_for_ability = ? WHERE name = ? AND is_augment = 1',
  );
  const updateRivenDisposition = db.prepare(
    'UPDATE weapons SET riven_disposition = ? WHERE lower(name) = lower(?)',
  );
  const fallbackRivenDisposition = db.prepare(
    'UPDATE weapons SET riven_disposition = omega_attenuation WHERE riven_disposition IS NULL AND omega_attenuation IS NOT NULL',
  );

  const mergeAll = db.transaction(() => {
    for (const ab of data.abilities) {
      const statsJson = JSON.stringify(ab.stats);
      const changes = updateAbility.run(
        statsJson,
        ab.stats.energy_cost,
        ab.uniqueName,
      );
      if (changes.changes > 0) result.abilitiesUpdated++;
    }

    for (const p of data.passives) {
      const changes = updatePassive.run(p.passive, p.uniqueName);
      if (changes.changes > 0) result.passivesUpdated++;

      const pathBase = `${p.uniqueName.substring(0, p.uniqueName.lastIndexOf('/') + 1)}%`;
      updatePassiveLike.run(p.passive, pathBase);
    }

    for (const aug of data.augments) {
      const changes = updateAugment.run(aug.abilityName, aug.augmentName);
      if (changes.changes > 0) result.augmentsUpdated++;
    }

    if (data.shards.types.length > 0) {
      db.prepare('DELETE FROM archon_shard_buffs').run();
      db.prepare('DELETE FROM archon_shard_types').run();

      const insertType = db.prepare(
        'INSERT INTO archon_shard_types (name, icon_path, tauforged_icon_path, sort_order) VALUES (?, ?, ?, ?)',
      );
      const insertBuff = db.prepare(
        'INSERT INTO archon_shard_buffs (shard_type_id, description, base_value, tauforged_value, value_format, sort_order) VALUES (?, ?, ?, ?, ?, ?)',
      );

      const typeIdMap = new Map<string, number>();
      for (const st of data.shards.types) {
        const insertResult = insertType.run(
          st.name,
          st.icon_path,
          st.tauforged_icon_path,
          st.sort_order,
        );
        typeIdMap.set(
          st.id,
          Number(
            (insertResult as { lastInsertRowid: number | bigint })
              .lastInsertRowid,
          ),
        );
        result.shardTypes++;
      }
      for (const sb of data.shards.buffs) {
        const shardTypeId = typeIdMap.get(sb.shard_type_id);
        if (shardTypeId === undefined) {
          console.warn(
            `[wikiScraper] Missing shard type mapping for buff: shard_type_id=${sb.shard_type_id}, description=${sb.description}, sort_order=${sb.sort_order}`,
          );
          continue;
        }
        insertBuff.run(
          shardTypeId,
          sb.description,
          sb.base_value,
          sb.tauforged_value,
          sb.value_format,
          sb.sort_order,
        );
        result.shardBuffs++;
      }
    }

    for (const d of data.dispositions) {
      const changes = updateRivenDisposition.run(d.disposition, d.weapon_name);
      if (changes.changes > 0)
        result.rivenDispositionsUpdated += changes.changes;
    }
    const fallback = fallbackRivenDisposition.run();
    result.rivenDispositionsFallbackFromOmega = fallback.changes;
  });

  mergeAll();
  onProgress?.(
    `Merged: ${result.abilitiesUpdated} abilities, ` +
      `${result.passivesUpdated} passives, ` +
      `${result.augmentsUpdated} augments, ` +
      `${result.shardTypes} shard types, ${result.shardBuffs} shard buffs, ` +
      `${result.rivenDispositionsUpdated} dispositions, ` +
      `${result.rivenDispositionsFallbackFromOmega} fallback dispositions`,
  );
  return result;
}

export async function runWikiScrape(
  onProgress?: (progress: WikiScrapeProgress) => void,
  onlyMissing = false,
): Promise<WikiMergeResult> {
  const state: WikiScrapeProgress = {
    phase: 'augments',
    current: 0,
    total: 0,
    currentItem: '',
    log: [],
  };

  const log = (msg: string) => {
    state.log.push(msg);
    onProgress?.(state);
  };

  state.phase = 'augments';
  const augments = await scrapeAugments(log);

  state.phase = 'shards';
  const shards = await scrapeArchonShards(log);

  state.phase = 'riven_disposition';
  const dispositions = await scrapeRivenDispositions(log);

  state.phase = 'abilities';
  const abilities = await scrapeAbilities((msg) => {
    const m = msg.match(/\[(\d+)\/(\d+)\]\s*(.*)/);
    if (m) {
      state.current = parseInt(m[1]);
      state.total = parseInt(m[2]);
      state.currentItem = m[3];
    }
    log(msg);
  }, onlyMissing);

  state.phase = 'passives';
  const passives = await scrapePassives((msg) => {
    const m = msg.match(/\[(\d+)\/(\d+)\]\s*(.*)/);
    if (m) {
      state.current = parseInt(m[1]);
      state.total = parseInt(m[2]);
      state.currentItem = m[3];
    }
    log(msg);
  }, onlyMissing);

  state.phase = 'merging';
  log('Merging wiki data into database...');
  const result = mergeWikiData(
    { abilities, passives, augments, shards, dispositions },
    log,
  );

  state.phase = 'done';
  log('Wiki scrape complete');
  onProgress?.(state);

  return result;
}
