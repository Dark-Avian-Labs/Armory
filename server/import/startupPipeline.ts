import fs from 'fs';
import path from 'path';

import { EXPORTS_DIR, REQUIRED_EXPORTS } from '../config.js';
import { getDb } from '../db/connection.js';
import { processExports, backfillModDescriptions } from '../db/queries.js';
import { createAppSchema } from '../db/schema.js';
import { mergeScrapedData } from '../scraping/dataMerger.js';
import { syncExaltedStanceModsFromOverframe } from '../scraping/exaltedStanceMods.js';
import { syncHiddenCompanionWeaponsFromOverframe } from '../scraping/hiddenCompanionWeapons.js';
import { scrapeIndex } from '../scraping/indexScraper.js';
import { scrapeItems } from '../scraping/itemScraper.js';
import { runWikiScrape } from '../scraping/wikiScraper.js';
import { populateWarframeMarketLinksTable } from '../warframeMarket/populateWarframeMarketLinks.js';
import { syncHelminthFlagsFromWiki } from './helminthWiki.js';
import { downloadImages } from './images.js';
import { runImportPipeline, listExportFiles } from './pipeline.js';
import {
  printStartupPipelineSummary,
  type StartupPipelineSummary,
  type SummaryOutcome,
} from './pipelineSummary.js';

const TAG = '[DataPipeline]';
const EXPORT_HASH_STATE_FILE = path.join(EXPORTS_DIR, '.processed-export-hashes.json');

function getCurrentExportHashes(): Record<string, string> {
  const files = listExportFiles();
  const required = files.filter((f) =>
    REQUIRED_EXPORTS.some((prefix) => f.category.startsWith(prefix)),
  );
  const map: Record<string, string> = {};
  for (const file of required) {
    map[file.category] = file.hash || '';
  }
  return map;
}

function readProcessedExportHashes(): Record<string, string> | null {
  try {
    if (!fs.existsSync(EXPORT_HASH_STATE_FILE)) return null;
    const raw = fs.readFileSync(EXPORT_HASH_STATE_FILE, 'utf-8');
    const parsed = JSON.parse(raw) as unknown;
    if (!parsed || typeof parsed !== 'object') return null;
    return parsed as Record<string, string>;
  } catch {
    return null;
  }
}

function writeProcessedExportHashes(hashes: Record<string, string>): void {
  fs.writeFileSync(EXPORT_HASH_STATE_FILE, JSON.stringify(hashes, null, 2), 'utf-8');
}

function hashesChanged(
  current: Record<string, string>,
  previous: Record<string, string> | null,
): boolean {
  if (!previous) return true;
  const currentKeys = Object.keys(current).sort();
  const previousKeys = Object.keys(previous).sort();
  if (currentKeys.length !== previousKeys.length) return true;
  for (let i = 0; i < currentKeys.length; i++) {
    if (currentKeys[i] !== previousKeys[i]) return true;
    const key = currentKeys[i];
    if ((previous[key] || '') !== (current[key] || '')) return true;
  }
  return false;
}

function hasExportFiles(): boolean {
  try {
    const files = listExportFiles();
    return files.length > 0;
  } catch {
    return false;
  }
}

function hasDbData(): boolean {
  try {
    const db = getDb();
    const count = (db.prepare('SELECT COUNT(*) as c FROM warframes').get() as { c: number }).c;
    return count > 0;
  } catch {
    return false;
  }
}

function emptySummary(start: number): StartupPipelineSummary {
  return {
    durationMs: Date.now() - start,
    schema: { outcome: 'skipped', detail: 'Pipeline did not reach this step.' },
    officialExports: { outcome: 'skipped', detail: 'Pipeline did not reach this step.' },
    sqliteFromExports: { outcome: 'skipped', detail: 'Pipeline did not reach this step.' },
    exaltedStanceMods: { outcome: 'skipped', detail: 'Pipeline did not reach this step.' },
    images: { outcome: 'skipped', detail: 'Pipeline did not reach this step.' },
    hiddenCompanionWeapons: { outcome: 'skipped', detail: 'Pipeline did not reach this step.' },
    overframe: { outcome: 'skipped', detail: 'Pipeline did not reach this step.' },
    wiki: { outcome: 'skipped', detail: 'Pipeline did not reach this step.' },
    helminthWiki: { outcome: 'skipped', detail: 'Pipeline did not reach this step.' },
    warframeMarketLinks: { outcome: 'skipped', detail: 'Pipeline did not reach this step.' },
    blockingIssues: [],
  };
}

export interface StartupPipelineOptions {
  cliReport?: boolean;
  forceImport?: boolean;
  forceImages?: boolean;
  reporter?: (line: string, level: 'info' | 'error') => void;
}

export async function runStartupPipeline(
  options: StartupPipelineOptions = {},
): Promise<StartupPipelineSummary> {
  const startTime = Date.now();
  const cli = options.cliReport === true;
  const forceImport = options.forceImport === true;
  const forceImages = options.forceImages === true;

  const emit = (level: 'info' | 'error', msg: string): void => {
    const line = `${TAG} ${msg}`;
    options.reporter?.(line, level);
    if (level === 'error') console.error(line);
    else console.log(line);
  };
  const log = (msg: string) => emit('info', msg);
  const err = (msg: string, e?: unknown) => {
    const detail = e !== undefined ? (e instanceof Error ? e.message : String(e)) : '';
    emit('error', detail ? `${msg} ${detail}` : msg);
  };

  const summary = emptySummary(startTime);

  if (forceImport || forceImages) {
    const flags = [forceImport && 'forceImport', forceImages && 'forceImages']
      .filter(Boolean)
      .join(', ');
    log(`Starting pipeline with force flags: ${flags}`);
  }

  log('[Schema] Ensuring SQLite schema...');
  try {
    createAppSchema();
    summary.schema = { outcome: 'ok', detail: 'App tables and indexes are ready.' };
  } catch (e) {
    summary.schema = {
      outcome: 'failed',
      detail: 'Schema creation failed.',
      error: e instanceof Error ? e.message : String(e),
    };
    err('[Schema] Failed —', e);
    summary.durationMs = Date.now() - startTime;
    summary.blockingIssues.push('Schema creation failed; pipeline stopped.');
    if (cli) printStartupPipelineSummary(summary);
    return summary;
  }

  log('[Exports] Downloading manifest and export files...');
  try {
    const importResult = await runImportPipeline((status) => {
      if (status.error) {
        err(`[Exports] ${status.message}`);
        return;
      }
      if (!status.message.includes('Skipping')) {
        log(`[Exports] ${status.message}`);
      }
    });
    const failCount = importResult.stats.failed.length;
    summary.officialExports = {
      outcome: failCount > 0 ? 'partial' : 'ok',
      detail:
        `Updated ${importResult.stats.downloaded.length}, ` +
        `unchanged ${importResult.stats.skippedUnchanged.length}` +
        (failCount > 0 ? `, ${failCount} failed` : '') +
        '.',
      stats: importResult.stats,
    };
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    summary.officialExports = { outcome: 'failed', detail: 'Export download failed.', error: msg };
    err('[Exports] Download failed —', e);
    if (!hasExportFiles()) {
      err('[Exports] No export files on disk, cannot continue.');
      summary.blockingIssues.push('No export JSON files on disk after manifest/download step.');
      summary.durationMs = Date.now() - startTime;
      if (cli) printStartupPipelineSummary(summary);
      return summary;
    }
  }

  let dataChanged = false;
  try {
    const currentExportHashes = getCurrentExportHashes();
    const previousExportHashes = readProcessedExportHashes();
    const shouldProcess = forceImport || hashesChanged(currentExportHashes, previousExportHashes);
    dataChanged = shouldProcess;

    if (shouldProcess) {
      const reason = forceImport
        ? 'Force import requested — rebuilding all game tables.'
        : previousExportHashes === null
          ? 'First run — importing export JSON into database.'
          : 'Export hashes changed — rebuilding game tables.';
      log(`[Database] ${reason}`);
      const counts = processExports();
      const backfillCount = backfillModDescriptions();
      writeProcessedExportHashes(currentExportHashes);
      log(
        `[Database] Loaded ${counts.warframes} warframes, ${counts.weapons} weapons, ${counts.companions} companions, ` +
          `${counts.mods} mods, ${counts.modSets} mod sets, ${counts.arcanes} arcanes, ${counts.abilities} abilities.`,
      );
      log(`[Database] Mod description backfill: ${backfillCount} row(s).`);
      summary.sqliteFromExports = {
        outcome: 'ok',
        detail: reason,
        rows: counts,
        modDescriptionsBackfilled: backfillCount,
      };
    } else {
      log('[Database] Skipped — export hashes unchanged since last run.');
      summary.sqliteFromExports = {
        outcome: 'skipped',
        detail: 'Export hashes unchanged since last successful build.',
      };
    }
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    summary.sqliteFromExports = {
      outcome: 'failed',
      detail: 'Export processing threw an error.',
      error: msg,
    };
    err('[Database] Processing failed —', e);
    if (!hasDbData()) {
      err('[Database] No data in warframes table, cannot continue.');
      summary.blockingIssues.push('Export DB step failed and warframes table is empty.');
    }
    summary.durationMs = Date.now() - startTime;
    if (cli) printStartupPipelineSummary(summary);
    return summary;
  }

  let warframeMarketLinkRowCount = 0;
  try {
    const db = getDb();
    warframeMarketLinkRowCount = (
      db.prepare('SELECT COUNT(*) as c FROM warframe_market_links').get() as { c: number }
    ).c;
  } catch {
    warframeMarketLinkRowCount = 0;
  }

  const shouldRefreshWarframeMarket =
    hasDbData() && (dataChanged || warframeMarketLinkRowCount === 0);

  if (shouldRefreshWarframeMarket) {
    log('[Warframe Market] Building trade link index from api.warframe.market...');
    try {
      const db = getDb();
      const wmResult = await populateWarframeMarketLinksTable(db);
      log(
        `[Warframe Market] Done — ${wmResult.rowsUpserted} rows upserted, ${wmResult.slugCount} catalog slugs.`,
      );
      summary.warframeMarketLinks = {
        outcome: 'ok',
        detail: `Upserted ${wmResult.rowsUpserted} worksheet rows using ${wmResult.slugCount} market slugs.`,
        rowsUpserted: wmResult.rowsUpserted,
        slugCount: wmResult.slugCount,
      };
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      summary.warframeMarketLinks = {
        outcome: 'failed',
        detail: 'Could not refresh Warframe Market link index.',
        error: msg,
      };
      err('[Warframe Market] Failed —', e);
    }
  } else {
    const detail = !hasDbData()
      ? 'Skipped — no game data in SQLite yet.'
      : 'Skipped — link index already populated and export hashes unchanged.';
    log(`[Warframe Market] ${detail}`);
    summary.warframeMarketLinks = {
      outcome: 'skipped',
      detail,
    };
  }

  if (dataChanged) {
    log('[Exalted Stances] Syncing exalted stance mods from Overframe...');
    try {
      const result = await syncExaltedStanceModsFromOverframe((msg) => {
        log(`[Exalted Stances] ${msg}`);
      });
      log(`[Exalted Stances] Done — ${result.found} found, ${result.insertedOrUpdated} updated.`);
      summary.exaltedStanceMods = {
        outcome: 'ok',
        detail: `Fetched ${result.found} stances, updated ${result.insertedOrUpdated} rows.`,
        found: result.found,
        insertedOrUpdated: result.insertedOrUpdated,
      };
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      summary.exaltedStanceMods = { outcome: 'failed', detail: 'Sync failed.', error: msg };
      err('[Exalted Stances] Sync failed —', e);
    }
  } else {
    log('[Exalted Stances] Skipped — no data changes this run.');
    summary.exaltedStanceMods = {
      outcome: 'skipped',
      detail: 'No data changes detected; skipped re-fetch.',
    };
  }

  log(
    forceImages
      ? '[Images] Force re-downloading all images...'
      : '[Images] Downloading new and changed images...',
  );
  try {
    const imgResult = await downloadImages((done, total, current) => {
      const step = cli ? 200 : 500;
      if (done === 1 || done % step === 0 || done === total) {
        log(`[Images] ${done}/${total} — ${current}`);
      }
    }, forceImages);
    if (imgResult.downloaded > 0) {
      log(
        `[Images] Done — ${imgResult.downloaded} downloaded, ${imgResult.skipped} skipped` +
          (imgResult.failed > 0 ? `, ${imgResult.failed} failed` : '') +
          '.',
      );
    } else {
      log(`[Images] Done — all ${imgResult.skipped} images up to date.`);
    }
    const imgOutcome: SummaryOutcome =
      imgResult.failed > 0 ? (imgResult.downloaded > 0 ? 'partial' : 'failed') : 'ok';
    summary.images = {
      outcome: imgOutcome,
      detail:
        imgResult.downloaded > 0
          ? `Downloaded ${imgResult.downloaded}, skipped ${imgResult.skipped}, failed ${imgResult.failed}.`
          : `All ${imgResult.skipped} images up to date.`,
      total: imgResult.total,
      downloaded: imgResult.downloaded,
      skipped: imgResult.skipped,
      failed: imgResult.failed,
      sampleErrors: imgResult.errors.slice(0, 6),
    };
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    summary.images = { outcome: 'failed', detail: 'Image download failed.', error: msg };
    err('[Images] Download failed —', e);
  }

  if (dataChanged) {
    log('[Companion Weapons] Syncing hidden companion weapons from Overframe...');
    try {
      const result = await syncHiddenCompanionWeaponsFromOverframe((msg) => {
        log(`[Companion Weapons] ${msg}`);
      });
      log(`[Companion Weapons] Done — ${result.found} found, ${result.insertedOrUpdated} updated.`);
      summary.hiddenCompanionWeapons = {
        outcome: 'ok',
        detail: `Fetched ${result.found} weapons, updated ${result.insertedOrUpdated} rows.`,
        found: result.found,
        insertedOrUpdated: result.insertedOrUpdated,
      };
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      summary.hiddenCompanionWeapons = { outcome: 'failed', detail: 'Sync failed.', error: msg };
      err('[Companion Weapons] Sync failed —', e);
    }
  } else {
    log('[Companion Weapons] Skipped — no data changes this run.');
    summary.hiddenCompanionWeapons = {
      outcome: 'skipped',
      detail: 'No data changes detected; skipped re-fetch.',
    };
  }

  log('[Overframe] Indexing and scraping build data...');
  try {
    const onlyMissing = !forceImport;
    const indexResult = await scrapeIndex(
      undefined,
      (msg) => log(`[Overframe] ${msg}`),
      onlyMissing,
    );

    summary.overframe.totalIndexed = indexResult.totalFound;
    summary.overframe.matchedNeedingWork = indexResult.entries.length;

    if (indexResult.entries.length > 0) {
      log(`[Overframe] Scraping ${indexResult.entries.length} detail pages...`);
      const scrapedItems = await scrapeItems(indexResult.entries, 1500, (p) => {
        const step = cli ? 25 : 50;
        if (p.current === 1 || p.current % step === 0 || p.current === p.total) {
          log(`[Overframe] ${p.current}/${p.total} — ${p.currentItem}`);
        }
      });
      summary.overframe.pagesScraped = scrapedItems.length;

      let mergeLogN = 0;
      const mergeResult = mergeScrapedData(scrapedItems, (msg) => {
        mergeLogN += 1;
        if (mergeLogN <= 3 || mergeLogN % 40 === 0) log(`[Overframe] Merge: ${msg}`);
      });
      log(
        `[Overframe] Done — merged ${mergeResult.warframesUpdated} warframes, ${mergeResult.weaponsUpdated} weapons, ${mergeResult.companionsUpdated} companions.`,
      );
      summary.overframe.outcome = 'ok';
      summary.overframe.detail = `Scraped ${scrapedItems.length} pages, merged results into DB.`;
      summary.overframe.merge = mergeResult;
    } else {
      log('[Overframe] Skipped — all matched items already have build data.');
      summary.overframe.outcome = 'skipped';
      summary.overframe.detail = 'All matched items already have build data; no scraping needed.';
      summary.overframe.pagesScraped = 0;
    }
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    summary.overframe.outcome = 'failed';
    summary.overframe.detail = 'Overframe scrape failed.';
    summary.overframe.error = msg;
    err('[Overframe] Scrape failed —', e);
  }

  log('[Wiki] Scraping warframe wiki for ability stats, shards, riven dispositions...');
  try {
    const wikiResult = await runWikiScrape((p) => {
      if (p.log.length > 0) {
        const last = p.log[p.log.length - 1];
        if (
          last.includes('Merged') ||
          last.includes('complete') ||
          last.includes('Merging') ||
          last.includes('Found') ||
          last.includes('Scraped') ||
          last.includes('Fetching') ||
          last.toLowerCase().includes('failed')
        ) {
          log(`[Wiki] ${last}`);
        }
      }
    }, true);
    log(
      `[Wiki] Done — ${wikiResult.abilitiesUpdated} abilities, ${wikiResult.passivesUpdated} passives, ` +
        `${wikiResult.augmentsUpdated} augments, ${wikiResult.weaponsProjectileSpeedsUpdated} projectile speeds.`,
    );
    summary.wiki = {
      outcome: 'ok',
      detail: `Updated ${wikiResult.abilitiesUpdated} abilities, ${wikiResult.passivesUpdated} passives, ${wikiResult.augmentsUpdated} augments.`,
      merge: wikiResult,
    };
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    summary.wiki = { outcome: 'failed', detail: 'Wiki scrape failed.', error: msg };
    err('[Wiki] Scrape failed —', e);
  }

  log('[Helminth] Syncing helminth-infusable ability flags from wiki...');
  try {
    const db = getDb();
    const helminthResult = await syncHelminthFlagsFromWiki(db);
    if (!helminthResult.fetchOk) {
      summary.helminthWiki = {
        outcome: 'failed',
        detail: 'Wiki fetch failed.',
        wikiNamesFound: helminthResult.wikiNamesFound,
        abilitiesFlagged: helminthResult.abilitiesFlagged,
        fetchOk: false,
        error: helminthResult.error ?? 'Unknown fetch error.',
      };
      err(
        `[Helminth] Fetch failed — ${helminthResult.error ?? 'unknown'} (names parsed: ${helminthResult.wikiNamesFound})`,
      );
    } else if (helminthResult.wikiNamesFound === 0) {
      summary.helminthWiki = {
        outcome: 'partial',
        detail: 'No ability names parsed from wiki page (HTML layout may have changed).',
        wikiNamesFound: 0,
        abilitiesFlagged: 0,
        fetchOk: true,
      };
      log('[Helminth] No ability names parsed from wiki page.');
    } else {
      log(
        `[Helminth] Done — ${helminthResult.wikiNamesFound} wiki tokens, ${helminthResult.abilitiesFlagged} abilities flagged.`,
      );
      summary.helminthWiki = {
        outcome: helminthResult.abilitiesFlagged > 0 ? 'ok' : 'partial',
        detail:
          helminthResult.abilitiesFlagged > 0
            ? `Matched ${helminthResult.abilitiesFlagged} abilities from ${helminthResult.wikiNamesFound} wiki tokens.`
            : `Found ${helminthResult.wikiNamesFound} wiki tokens but none matched DB ability names.`,
        wikiNamesFound: helminthResult.wikiNamesFound,
        abilitiesFlagged: helminthResult.abilitiesFlagged,
        fetchOk: true,
      };
    }
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    summary.helminthWiki = {
      outcome: 'failed',
      detail: 'Helminth sync failed.',
      error: msg,
      fetchOk: false,
    };
    err('[Helminth] Sync failed —', e);
  }

  summary.durationMs = Date.now() - startTime;
  log(`Pipeline complete in ${(summary.durationMs / 1000).toFixed(1)}s.`);

  if (cli) printStartupPipelineSummary(summary);
  return summary;
}
