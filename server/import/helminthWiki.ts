import type Database from 'better-sqlite3';
import * as cheerio from 'cheerio';

import { dedupeHelminthAbilityRows } from '../helminthAbilityDedupe.js';
import { getWikiUserAgent } from '../scraping/wikiUserAgent.js';

const HELMINTH_WIKI_URL = 'https://wiki.warframe.com/w/Helminth';

function normalizeAbilityName(value: string): string {
  return value.replace(/\s+/g, ' ').trim().toLowerCase();
}

const ABILITY_TOOLTIP = '.tooltip[data-param-source="Ability"]';

function collectHelminthAbilityLinkElements($: cheerio.CheerioAPI) {
  const $content = $('#mw-content-text');
  const checklistLinks = $content.find(
    `table[data-tableid="Subsumable Ability Checklist"] tr td:nth-child(2) ${ABILITY_TOOLTIP} a[href^="/w/"]`,
  );
  const helminthSectionLinks = $content
    .find('h3#Helminth_Abilities')
    .closest('div.mw-heading')
    .nextAll('table.ability-box')
    .find(`${ABILITY_TOOLTIP} a[href^="/w/"]`);

  if (checklistLinks.length > 0 || helminthSectionLinks.length > 0) {
    return checklistLinks.add(helminthSectionLinks);
  }

  return $content.find(`${ABILITY_TOOLTIP} a[href^="/w/"]`);
}

export async function fetchHelminthAbilityNameSet(): Promise<{
  names: Set<string>;
  fetchOk: boolean;
  error?: string;
}> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 15_000);
  try {
    const response = await fetch(HELMINTH_WIKI_URL, {
      signal: controller.signal,
      headers: {
        'User-Agent': getWikiUserAgent(),
      },
    });
    if (!response.ok) {
      return {
        names: new Set(),
        fetchOk: false,
        error: `HTTP ${response.status} ${response.statusText}`,
      };
    }
    const html = await response.text();
    const $ = cheerio.load(html);
    const names = new Set<string>();

    collectHelminthAbilityLinkElements($).each((_, el) => {
      const text = normalizeAbilityName($(el).text());
      const title = normalizeAbilityName($(el).attr('title') || '');
      for (const raw of [text, title]) {
        if (!raw) continue;
        const cleaned = raw.replace(/\s*\(ability\)$/, '').trim();
        if (!cleaned || cleaned.length < 3 || cleaned.length > 80) continue;
        names.add(cleaned);
      }
    });

    return { names, fetchOk: true };
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    return { names: new Set(), fetchOk: false, error: message };
  } finally {
    clearTimeout(timeout);
  }
}

export interface HelminthWikiSyncResult {
  wikiNamesFound: number;
  abilitiesFlagged: number;
  fetchOk: boolean;
  error?: string;
}

export async function syncHelminthFlagsFromWiki(
  db: Database.Database,
): Promise<HelminthWikiSyncResult> {
  const { names, fetchOk, error } = await fetchHelminthAbilityNameSet();
  if (!fetchOk || names.size === 0) {
    return {
      wikiNamesFound: names.size,
      abilitiesFlagged: 0,
      fetchOk,
      error,
    };
  }

  const rows = db
    .prepare(`SELECT unique_name, name FROM abilities WHERE name IS NOT NULL AND TRIM(name) != ''`)
    .all() as Array<{ unique_name: string; name: string }>;

  const matched: Array<{ unique_name: string; name: string }> = [];
  for (const row of rows) {
    const key = normalizeAbilityName(row.name);
    if (key && names.has(key)) {
      matched.push(row);
    }
  }
  const toUpdate = dedupeHelminthAbilityRows(matched).map((r) => r.unique_name);

  const resetAll = db.prepare('UPDATE abilities SET is_helminth_extractable = 0');
  const stmt = db.prepare('UPDATE abilities SET is_helminth_extractable = 1 WHERE unique_name = ?');
  const runMany = db.transaction((ids: string[]) => {
    resetAll.run();
    for (const id of ids) {
      stmt.run(id);
    }
  });

  runMany(toUpdate);

  return {
    wikiNamesFound: names.size,
    abilitiesFlagged: toUpdate.length,
    fetchOk: true,
  };
}
