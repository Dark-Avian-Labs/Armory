import type Database from 'better-sqlite3';

import { WORKSHEET_ORDER, loadArmoryWorksheetSources } from './armorySources.js';
import { isPrimeVariantName, resolveCanonicalKey } from './canonical.js';
import { fetchWarframeMarketSlugSet } from './fetchWarframeMarketSlugs.js';
import type { MarketLinkKind, WorksheetCategory } from './resolveHref.js';
import { resolveMarketHref } from './resolveHref.js';

export interface PopulateWarframeMarketLinksResult {
  rowsUpserted: number;
  slugCount: number;
}

const MARKET_HREF_LOOKUP_SQL = `SELECT market_href, market_href_prime FROM warframe_market_links
  WHERE canonical_key = ? AND worksheet_category = ?`;

let cachedLookupDb: Database.Database | null = null;
let cachedLookupStmt: Database.Statement<
  [string, string],
  { market_href: string | null; market_href_prime: string | null }
> | null = null;

type MergedRow = {
  market_href: string | null;
  market_href_prime: string | null;
  link_kind: MarketLinkKind | null;
};

export async function populateWarframeMarketLinksTable(
  armoryDb: Database.Database,
): Promise<PopulateWarframeMarketLinksResult> {
  const wmSlugs = await fetchWarframeMarketSlugSet();
  const sources = loadArmoryWorksheetSources(armoryDb);

  const mergedByCanonicalKey = new Map<string, Map<WorksheetCategory, MergedRow>>();

  for (const worksheet of WORKSHEET_ORDER) {
    const names = sources[worksheet];
    for (const displayName of names) {
      const canonicalKey = resolveCanonicalKey(displayName);
      if (!canonicalKey) continue;
      const { href, kind } = resolveMarketHref(displayName, worksheet, wmSlugs);

      const outer =
        mergedByCanonicalKey.get(canonicalKey) ?? new Map<WorksheetCategory, MergedRow>();
      const entry: MergedRow = outer.get(worksheet) ?? {
        market_href: null,
        market_href_prime: null,
        link_kind: null,
      };

      if (isPrimeVariantName(displayName)) {
        entry.market_href_prime = href;
        if (entry.link_kind == null) entry.link_kind = kind;
      } else {
        entry.market_href = href;
        entry.link_kind = kind;
      }

      outer.set(worksheet, entry);
      mergedByCanonicalKey.set(canonicalKey, outer);
    }
  }

  const upsert = armoryDb.prepare(`
    INSERT INTO warframe_market_links (canonical_key, worksheet_category, market_href, market_href_prime, link_kind, updated_at)
    VALUES (@canonical_key, @worksheet_category, @market_href, @market_href_prime, @link_kind, datetime('now'))
    ON CONFLICT(canonical_key, worksheet_category) DO UPDATE SET
      market_href = excluded.market_href,
      market_href_prime = excluded.market_href_prime,
      link_kind = excluded.link_kind,
      updated_at = datetime('now')
  `);

  let rowsUpserted = 0;

  const tx = armoryDb.transaction(() => {
    for (const [canonicalKey, worksheetMap] of mergedByCanonicalKey) {
      for (const [worksheet, row] of worksheetMap) {
        upsert.run({
          canonical_key: canonicalKey,
          worksheet_category: worksheet,
          market_href: row.market_href,
          market_href_prime: row.market_href_prime,
          link_kind: row.link_kind,
        });
        rowsUpserted += 1;
      }
    }
  });

  tx();

  return { rowsUpserted, slugCount: wmSlugs.size };
}

export function getMarketHrefsForCanonicalKey(
  armoryDb: Database.Database,
  canonicalKey: string,
  worksheetCategory: WorksheetCategory,
): { market_href: string | null; market_href_prime: string | null } | undefined {
  if (cachedLookupStmt === null || cachedLookupDb !== armoryDb) {
    cachedLookupDb = armoryDb;
    cachedLookupStmt = armoryDb.prepare<
      [string, string],
      { market_href: string | null; market_href_prime: string | null }
    >(MARKET_HREF_LOOKUP_SQL);
  }
  return cachedLookupStmt.get(canonicalKey, worksheetCategory);
}

export function getMarketHrefForRow(
  armoryDb: Database.Database,
  canonicalKey: string,
  worksheetCategory: WorksheetCategory,
): string | null {
  return (
    getMarketHrefsForCanonicalKey(armoryDb, canonicalKey, worksheetCategory)?.market_href ?? null
  );
}
