import type Database from 'better-sqlite3';

import { dedupeHelminthAbilityRows } from '../helminthAbilityDedupe.js';
import {
  fetchHelminthWikiHtml,
  parseHelminthExtractableAbilityNames,
} from '../scraping/helminthWikiPage.js';

function normalizeAbilityName(value: string): string {
  return value.replace(/\s+/g, ' ').trim().toLowerCase();
}

export async function fetchHelminthAbilityNameSet(options?: { html?: string | null }): Promise<{
  names: Set<string>;
  fetchOk: boolean;
  error?: string;
}> {
  let html = options?.html ?? null;
  if (html == null) {
    const fetched = await fetchHelminthWikiHtml();
    if (!fetched.fetchOk || fetched.html == null) {
      return {
        names: new Set(),
        fetchOk: fetched.fetchOk,
        error: fetched.error,
      };
    }
    html = fetched.html;
  }

  return { names: parseHelminthExtractableAbilityNames(html), fetchOk: true };
}

export interface HelminthWikiSyncResult {
  wikiNamesFound: number;
  abilitiesFlagged: number;
  fetchOk: boolean;
  error?: string;
}

export async function syncHelminthFlagsFromWiki(
  db: Database.Database,
  options?: { html?: string | null },
): Promise<HelminthWikiSyncResult> {
  const { names, fetchOk, error } = await fetchHelminthAbilityNameSet(options);
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
