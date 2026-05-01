import type Database from 'better-sqlite3';

import { WORKSHEET_ORDER, loadArmoryWorksheetSources } from './armorySources.js';
import { resolveCanonicalKey } from './canonical.js';
import { fetchWarframeMarketSlugSet } from './fetchWarframeMarketSlugs.js';
import type { WorksheetCategory } from './resolveHref.js';
import { resolveMarketHref } from './resolveHref.js';

export interface PopulateWarframeMarketLinksResult {
  rowsUpserted: number;
  slugCount: number;
}

const MARKET_HREF_LOOKUP_SQL = `SELECT market_href FROM warframe_market_links
  WHERE canonical_key = ? AND worksheet_category = ?`;

let cachedLookupDb: Database.Database | null = null;
let cachedLookupStmt: Database.Statement<[string, string], { market_href: string | null }> | null =
  null;

export async function populateWarframeMarketLinksTable(
  armoryDb: Database.Database,
): Promise<PopulateWarframeMarketLinksResult> {
  const wmSlugs = await fetchWarframeMarketSlugSet();
  const sources = loadArmoryWorksheetSources(armoryDb);

  const upsert = armoryDb.prepare(`
    INSERT INTO warframe_market_links (canonical_key, worksheet_category, market_href, link_kind, updated_at)
    VALUES (@canonical_key, @worksheet_category, @market_href, @link_kind, datetime('now'))
    ON CONFLICT(canonical_key, worksheet_category) DO UPDATE SET
      market_href = excluded.market_href,
      link_kind = excluded.link_kind,
      updated_at = datetime('now')
  `);

  let rowsUpserted = 0;

  const tx = armoryDb.transaction(() => {
    for (const worksheet of WORKSHEET_ORDER) {
      const names = sources[worksheet];
      for (const displayName of names) {
        const canonicalKey = resolveCanonicalKey(displayName);
        if (!canonicalKey) continue;
        const { href, kind } = resolveMarketHref(displayName, worksheet, wmSlugs);
        upsert.run({
          canonical_key: canonicalKey,
          worksheet_category: worksheet,
          market_href: href,
          link_kind: kind,
        });
        rowsUpserted += 1;
      }
    }
  });

  tx();

  return { rowsUpserted, slugCount: wmSlugs.size };
}

export function getMarketHrefForRow(
  armoryDb: Database.Database,
  canonicalKey: string,
  worksheetCategory: WorksheetCategory,
): string | null {
  if (cachedLookupStmt === null || cachedLookupDb !== armoryDb) {
    cachedLookupDb = armoryDb;
    cachedLookupStmt = armoryDb.prepare<[string, string], { market_href: string | null }>(
      MARKET_HREF_LOOKUP_SQL,
    );
  }
  const row = cachedLookupStmt.get(canonicalKey, worksheetCategory);
  return row?.market_href ?? null;
}
