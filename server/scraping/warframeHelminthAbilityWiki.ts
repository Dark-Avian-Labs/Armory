import * as cheerio from 'cheerio';

import { getDb } from '../db/connection.js';
import { dedupeHelminthAbilityRows } from '../helminthAbilityDedupe.js';
import { FETCH_TIMEOUT_MS, fetchWithTimeout } from '../http/fetchWithTimeout.js';
import { normalizeAbilityName } from './helminthWikiPage.js';
import { getWikiUserAgent } from './wikiUserAgent.js';

const WIKI_BASE = 'https://wiki.warframe.com';

function warframeWikiSlug(displayName: string): string {
  const clean = displayName.replace(/^<ARCHWING>\s*/i, '').trim();
  return encodeURIComponent(clean.replace(/ /g, '_'));
}

export function parseSubsumableAbilitiesFromWarframeAbilitiesHtml(html: string): string[] {
  const $ = cheerio.load(html);
  const names = new Set<string>();

  $('tr').each((_, row) => {
    const $row = $(row);
    const rowText = $row.text();
    if (!/subsumable\s+to\s+helminth/i.test(rowText)) return;

    const abilityLink = $row
      .find('a[data-param-source="Ability"][href^="/w/"], table.ability-box a[href^="/w/"]')
      .first();
    let name = abilityLink.text().replace(/\s+/g, ' ').trim();
    if (!name) {
      const title = abilityLink.attr('title')?.trim() ?? '';
      name = title.replace(/\s*\(ability\)\s*$/i, '').trim();
    }
    const normalized = normalizeAbilityName(name);
    if (normalized && normalized.length >= 3 && normalized.length <= 80) {
      names.add(normalized);
    }
  });

  return Array.from(names);
}

async function fetchWarframeAbilitiesHtml(warframeName: string): Promise<string | null> {
  const url = `${WIKI_BASE}/w/${warframeWikiSlug(warframeName)}/Abilities`;
  const res = await fetchWithTimeout(
    url,
    { headers: { 'User-Agent': getWikiUserAgent() } },
    FETCH_TIMEOUT_MS.wikiFetch,
  );
  if (!res.ok) return null;
  return res.text();
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export async function collectHelminthAbilityNamesFromWarframeWikiPages(
  onProgress?: (msg: string) => void,
): Promise<Set<string>> {
  const db = getDb();
  const warframes = db
    .prepare(
      `SELECT DISTINCT name FROM warframes WHERE name IS NOT NULL AND TRIM(name) <> '' ORDER BY name`,
    )
    .all() as Array<{ name: string }>;

  const names = new Set<string>();
  for (let i = 0; i < warframes.length; i++) {
    const wf = warframes[i]!;
    onProgress?.(`[Helminth wiki] ${i + 1}/${warframes.length} ${wf.name}`);
    try {
      const html = await fetchWarframeAbilitiesHtml(wf.name);
      if (!html) continue;
      for (const abilityName of parseSubsumableAbilitiesFromWarframeAbilitiesHtml(html)) {
        names.add(abilityName);
      }
    } catch (error) {
      onProgress?.(`  ${wf.name}: ${error instanceof Error ? error.message : String(error)}`);
    }
    if (i < warframes.length - 1) await sleep(300);
  }

  onProgress?.(`[Helminth wiki] ${names.size} subsumable ability name(s) from warframe pages`);
  return names;
}

export function applyHelminthFlagsFromWikiNames(
  db: import('better-sqlite3').Database,
  names: Set<string>,
): number {
  if (names.size === 0) {
    return 0;
  }

  const rows = db
    .prepare(`SELECT unique_name, name FROM abilities WHERE name IS NOT NULL AND TRIM(name) != ''`)
    .all() as Array<{ unique_name: string; name: string }>;

  const matched: Array<{ unique_name: string; name: string }> = [];
  for (const row of rows) {
    const key = normalizeAbilityName(row.name);
    if (key && names.has(key)) matched.push(row);
  }

  const toUpdate = dedupeHelminthAbilityRows(matched).map((r) => r.unique_name);
  const resetAll = db.prepare('UPDATE abilities SET is_helminth_extractable = 0');
  const stmt = db.prepare('UPDATE abilities SET is_helminth_extractable = 1 WHERE unique_name = ?');
  const runMany = db.transaction((ids: string[]) => {
    resetAll.run();
    for (const id of ids) stmt.run(id);
  });
  runMany(toUpdate);
  return toUpdate.length;
}
