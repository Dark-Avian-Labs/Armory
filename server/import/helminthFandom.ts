import type Database from 'better-sqlite3';
import * as cheerio from 'cheerio';

const HELMINTH_WIKI_URL = 'https://warframe.fandom.com/wiki/Helminth';
const HELMINTH_WIKI_USER_AGENT =
  process.env.HELMINTH_WIKI_USER_AGENT?.trim() ||
  'Parametric/2.0 (data-import; +https://warframe.fandom.com/wiki/Helminth)';

function normalizeAbilityName(value: string): string {
  return value.replace(/\s+/g, ' ').trim().toLowerCase();
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
        'User-Agent': HELMINTH_WIKI_USER_AGENT,
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

    return { names, fetchOk: true };
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    return { names: new Set(), fetchOk: false, error: message };
  } finally {
    clearTimeout(timeout);
  }
}

export interface HelminthFandomSyncResult {
  wikiNamesFound: number;
  abilitiesFlagged: number;
  fetchOk: boolean;
  error?: string;
}

export async function syncHelminthFlagsFromFandom(
  db: Database.Database,
): Promise<HelminthFandomSyncResult> {
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
    .prepare(`SELECT id, name FROM abilities WHERE name IS NOT NULL AND TRIM(name) != ''`)
    .all() as Array<{ id: number; name: string }>;

  const toUpdate: number[] = [];
  for (const row of rows) {
    const key = normalizeAbilityName(row.name);
    if (key && names.has(key)) {
      toUpdate.push(row.id);
    }
  }

  const resetAll = db.prepare('UPDATE abilities SET is_helminth_extractable = 0');
  const stmt = db.prepare('UPDATE abilities SET is_helminth_extractable = 1 WHERE id = ?');
  const runMany = db.transaction((ids: number[]) => {
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
