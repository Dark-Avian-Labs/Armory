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
import { downloadImages } from './images.js';
import { runImportPipeline, listExportFiles } from './pipeline.js';
import {
  printStartupPipelineSummary,
  type StartupPipelineSummary,
  type SummaryOutcome,
} from './pipelineSummary.js';

const TAG = '[Startup]';
const CLI_TAG = '[DataPipeline]';
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
    schema: { outcome: 'skipped', detail: 'Not run.' },
    officialExports: { outcome: 'skipped' },
    sqliteFromExports: { outcome: 'skipped', reason: 'Not run.' },
    exaltedStanceMods: { outcome: 'skipped', reason: 'Not run.' },
    images: { outcome: 'skipped' },
    hiddenCompanionWeapons: { outcome: 'skipped', reason: 'Not run.' },
    overframe: { outcome: 'skipped', skipReason: 'Not run.' },
    wiki: { outcome: 'skipped', skipReason: 'Pipeline did not reach this step.' },
    blockingIssues: [],
  };
}

export interface StartupPipelineOptions {
  includeHiddenCompanionWeapons?: boolean;
  includeExaltedStanceMods?: boolean;
  /**
   * Manual CLI run: section headers, full export progress, and a printed summary at the end.
   * Server startup omits this for quieter logs.
   */
  cliReport?: boolean;
  reporter?: (line: string, level: 'info' | 'error') => void;
}

export async function runStartupPipeline(
  options: StartupPipelineOptions = {},
): Promise<StartupPipelineSummary> {
  const startTime = Date.now();
  const cli = options.cliReport === true;
  const emit = (level: 'info' | 'error', msg: string): void => {
    const line = `${cli ? CLI_TAG : TAG} ${msg}`;
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

  const phase = (title: string) => {
    if (cli) emit('info', `\n── ${title} ──`);
  };

  phase('Schema');
  log(cli ? 'Ensuring SQLite schema...' : 'Starting data pipeline...');
  try {
    createAppSchema();
    summary.schema = { outcome: 'ok', detail: 'App tables and indexes are ready.' };
  } catch (e) {
    summary.schema = {
      outcome: 'failed',
      detail: e instanceof Error ? e.message : String(e),
    };
    err('Schema creation failed:', e);
    summary.durationMs = Date.now() - startTime;
    summary.blockingIssues.push('Schema creation failed; pipeline stopped.');
    if (cli) printStartupPipelineSummary(summary);
    return summary;
  }

  phase('Official exports (manifest + download)');
  try {
    const importResult = await runImportPipeline((status) => {
      if (status.error) {
        err(`Import: ${status.message}`);
        return;
      }
      if (cli) {
        log(`Import: ${status.message}`);
        return;
      }
      if (!status.message.includes('Skipping')) {
        log(`Import: ${status.message}`);
      }
    });
    summary.officialExports = {
      outcome: importResult.stats.failed.length > 0 ? 'partial' : 'ok',
      stats: importResult.stats,
    };
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    summary.officialExports = { outcome: 'failed', error: msg };
    err('Export download failed:', e);
    if (!hasExportFiles()) {
      err('No export files available, cannot continue');
      summary.blockingIssues.push('No export JSON files on disk after manifest/download step.');
      summary.durationMs = Date.now() - startTime;
      if (cli) printStartupPipelineSummary(summary);
      return summary;
    }
  }

  phase('SQLite ← export JSON');
  try {
    const currentExportHashes = getCurrentExportHashes();
    const previousExportHashes = readProcessedExportHashes();
    const shouldProcess = hashesChanged(currentExportHashes, previousExportHashes);

    if (shouldProcess) {
      log(
        cli
          ? 'Export bundle fingerprint changed — rebuilding game tables from JSON...'
          : 'Processing exports into database...',
      );
      const counts = processExports();
      log(
        cli
          ? `Loaded: ${counts.warframes} warframes, ${counts.weapons} weapons, ${counts.companions} companions, ` +
              `${counts.mods} mods, ${counts.modSets} mod sets, ${counts.arcanes} arcanes, ${counts.abilities} abilities.`
          : `Processed: ${counts.warframes} warframes, ${counts.weapons} weapons, ${counts.mods} mods, ${counts.abilities} abilities`,
      );
      const backfillCount = backfillModDescriptions();
      writeProcessedExportHashes(currentExportHashes);
      log(
        cli
          ? `Saved export fingerprint; mod description backfill touched ${backfillCount} row(s).`
          : 'Export hashes updated after successful processing.',
      );
      summary.sqliteFromExports = {
        outcome: 'ok',
        reason:
          previousExportHashes === null
            ? 'First run or no prior fingerprint — full import from export JSON.'
            : 'On-disk export hashes differ from last successful DB build — rebuilt tables.',
        rows: counts,
        modDescriptionsBackfilled: backfillCount,
      };
    } else {
      log(
        cli
          ? 'Export fingerprint matches last run — skipping heavy JSON→SQLite rebuild (no game patch change detected for this bundle).'
          : 'Export hashes unchanged. Skipping export DB processing.',
      );
      summary.sqliteFromExports = {
        outcome: 'skipped',
        reason:
          'The combined hash state of required export files matches `.processed-export-hashes.json`. Delete that file to force a full rebuild.',
      };
    }
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    summary.sqliteFromExports = {
      outcome: 'failed',
      reason: 'Export processing threw.',
      error: msg,
    };
    err('Export processing failed:', e);
    if (!hasDbData()) {
      err('No DB data available, cannot continue to scrapers');
      summary.blockingIssues.push('Export DB step failed and warframes table is empty.');
    }
    summary.durationMs = Date.now() - startTime;
    if (cli) printStartupPipelineSummary(summary);
    return summary;
  }

  if (options.includeExaltedStanceMods) {
    phase('Exalted stance mods');
    try {
      const exaltedStanceResult = await syncExaltedStanceModsFromOverframe((msg) => {
        log(msg);
      });
      log(
        `Exalted stances: ${exaltedStanceResult.found} found, ${exaltedStanceResult.insertedOrUpdated} updated`,
      );
      summary.exaltedStanceMods = {
        outcome: 'ok',
        found: exaltedStanceResult.found,
        insertedOrUpdated: exaltedStanceResult.insertedOrUpdated,
      };
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      summary.exaltedStanceMods = { outcome: 'failed', error: msg };
      err('Exalted stance sync failed:', e);
    }
  } else {
    summary.exaltedStanceMods = {
      outcome: 'skipped',
      reason: 'Not requested for this run (enable on manual import / full pipeline).',
    };
  }

  phase('Images');
  try {
    const imgResult = await downloadImages((done, total, current) => {
      const step = cli ? 200 : 500;
      if (done === 1 || done % step === 0 || done === total) {
        log(`Images: ${done}/${total} (${current})`);
      }
    });
    if (imgResult.downloaded > 0) {
      log(
        `Images: ${imgResult.downloaded} downloaded, ${imgResult.skipped} skipped` +
          (imgResult.failed > 0 ? `, ${imgResult.failed} failed` : ''),
      );
    } else {
      log(`Images: all ${imgResult.skipped} up to date`);
    }
    const imgOutcome: SummaryOutcome =
      imgResult.failed > 0 ? (imgResult.downloaded > 0 ? 'partial' : 'failed') : 'ok';
    summary.images = {
      outcome: imgOutcome,
      total: imgResult.total,
      downloaded: imgResult.downloaded,
      skipped: imgResult.skipped,
      failed: imgResult.failed,
      sampleErrors: imgResult.errors.slice(0, 6),
    };
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    summary.images = { outcome: 'failed', error: msg };
    err('Image download failed:', e);
  }

  if (options.includeHiddenCompanionWeapons) {
    phase('Hidden companion weapons');
    try {
      const hiddenCompanionResult = await syncHiddenCompanionWeaponsFromOverframe((msg) => {
        log(msg);
      });
      log(
        `Hidden companion claws: ${hiddenCompanionResult.found} found, ${hiddenCompanionResult.insertedOrUpdated} updated`,
      );
      summary.hiddenCompanionWeapons = {
        outcome: 'ok',
        found: hiddenCompanionResult.found,
        insertedOrUpdated: hiddenCompanionResult.insertedOrUpdated,
      };
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      summary.hiddenCompanionWeapons = { outcome: 'failed', error: msg };
      err('Hidden companion claw sync failed:', e);
    }
  } else {
    summary.hiddenCompanionWeapons = {
      outcome: 'skipped',
      reason: 'Not requested for this run (enable on manual import / full pipeline).',
    };
  }

  phase('Overframe index + item scrape');
  try {
    const indexResult = await scrapeIndex(undefined, (msg) => log(`Overframe: ${msg}`), true);

    summary.overframe.totalIndexed = indexResult.totalFound;
    summary.overframe.matchedNeedingWork = indexResult.entries.length;

    if (indexResult.entries.length > 0) {
      log(
        cli
          ? `Scraping ${indexResult.entries.length} Overframe detail pages...`
          : `Overframe: scraping ${indexResult.entries.length} items...`,
      );
      const scrapedItems = await scrapeItems(indexResult.entries, 1500, (p) => {
        const step = cli ? 25 : 50;
        if (p.current === 1 || p.current % step === 0 || p.current === p.total) {
          log(`Overframe: ${p.current}/${p.total} ${p.currentItem}`);
        }
      });
      summary.overframe.pagesScraped = scrapedItems.length;

      let mergeLogN = 0;
      const mergeResult = mergeScrapedData(scrapedItems, (msg) => {
        if (!cli) {
          log(`Overframe merge: ${msg}`);
          return;
        }
        mergeLogN += 1;
        if (mergeLogN <= 3 || mergeLogN % 40 === 0) log(`Overframe merge: ${msg}`);
      });
      log(
        `Overframe: merged ${mergeResult.warframesUpdated} warframes, ${mergeResult.weaponsUpdated} weapons, ${mergeResult.companionsUpdated} companions`,
      );
      summary.overframe.outcome = 'ok';
      summary.overframe.merge = mergeResult;
      summary.overframe.skipReason = undefined;
    } else {
      log(
        cli
          ? 'Overframe: every matched item already has build data — no detail scrape.'
          : 'Overframe: all items up to date',
      );
      summary.overframe.outcome = 'skipped';
      summary.overframe.skipReason =
        'Only items missing `artifact_slots` (etc.) are scraped; none needed work this run.';
      summary.overframe.pagesScraped = 0;
    }
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    summary.overframe.outcome = 'failed';
    summary.overframe.error = msg;
    err('Overframe scrape failed:', e);
  }

  phase('Warframe Wiki');
  try {
    const wikiResult = await runWikiScrape((p) => {
      if (cli) {
        if (p.log.length > 0) {
          const last = p.log[p.log.length - 1];
          if (
            last.includes('Merged') ||
            last.includes('complete') ||
            last.includes('Merging') ||
            last.toLowerCase().includes('failed')
          ) {
            log(`Wiki: ${last}`);
          }
        }
        return;
      }
      if (p.log.length > 0) {
        const last = p.log[p.log.length - 1];
        if (
          last.includes('already have') ||
          last.includes('Found') ||
          last.includes('Scraped') ||
          last.includes('Merged') ||
          last.includes('Fetching') ||
          last.includes('complete')
        ) {
          log(`Wiki: ${last}`);
        }
      }
    }, true);
    log(
      `Wiki: ${wikiResult.abilitiesUpdated} abilities, ${wikiResult.passivesUpdated} passives, ${wikiResult.augmentsUpdated} augments`,
    );
    summary.wiki = { outcome: 'ok', merge: wikiResult };
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    summary.wiki = { outcome: 'failed', error: msg };
    err('Wiki scrape failed:', e);
  }

  summary.durationMs = Date.now() - startTime;
  log(
    cli
      ? `Finished in ${(summary.durationMs / 1000).toFixed(1)}s.`
      : `Data pipeline complete in ${(summary.durationMs / 1000).toFixed(1)}s`,
  );

  if (cli) printStartupPipelineSummary(summary);
  return summary;
}
