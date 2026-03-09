import fs from 'fs';
import path from 'path';

import { EXPORTS_DIR, REQUIRED_EXPORTS } from '../config.js';
import { downloadImages } from './images.js';
import { runImportPipeline, listExportFiles } from './pipeline.js';
import { getDb } from '../db/connection.js';
import { processExports, backfillModDescriptions } from '../db/queries.js';
import { createAppSchema } from '../db/schema.js';
import { mergeScrapedData } from '../scraping/dataMerger.js';
import { syncExaltedStanceModsFromOverframe } from '../scraping/exaltedStanceMods.js';
import { syncHiddenCompanionWeaponsFromOverframe } from '../scraping/hiddenCompanionWeapons.js';
import { scrapeIndex } from '../scraping/indexScraper.js';
import { scrapeItems } from '../scraping/itemScraper.js';
import { runWikiScrape } from '../scraping/wikiScraper.js';

const TAG = '[Startup]';
const EXPORT_HASH_STATE_FILE = path.join(
  EXPORTS_DIR,
  '.processed-export-hashes.json',
);

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
  fs.writeFileSync(
    EXPORT_HASH_STATE_FILE,
    JSON.stringify(hashes, null, 2),
    'utf-8',
  );
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
    const count = (
      db.prepare('SELECT COUNT(*) as c FROM warframes').get() as { c: number }
    ).c;
    return count > 0;
  } catch {
    return false;
  }
}

interface StartupPipelineOptions {
  includeHiddenCompanionWeapons?: boolean;
  includeExaltedStanceMods?: boolean;
}

export async function runStartupPipeline(
  options: StartupPipelineOptions = {},
): Promise<void> {
  const startTime = Date.now();
  console.log(`${TAG} Starting data pipeline...`);

  try {
    createAppSchema();
  } catch (err) {
    console.error(`${TAG} Schema creation failed:`, err);
    return;
  }

  try {
    await runImportPipeline((status) => {
      if (status.error) {
        console.error(`${TAG} Import: ${status.message}`);
      } else if (!status.message.includes('Skipping')) {
        console.log(`${TAG} Import: ${status.message}`);
      }
    });
  } catch (err) {
    console.error(
      `${TAG} Export download failed:`,
      err instanceof Error ? err.message : err,
    );
    if (!hasExportFiles()) {
      console.error(`${TAG} No export files available, cannot continue`);
      return;
    }
  }

  try {
    const currentExportHashes = getCurrentExportHashes();
    const previousExportHashes = readProcessedExportHashes();
    const shouldProcess = hashesChanged(
      currentExportHashes,
      previousExportHashes,
    );

    if (shouldProcess) {
      console.log(`${TAG} Processing exports into database...`);
      const counts = processExports();
      console.log(
        `${TAG} Processed: ${counts.warframes} warframes, ${counts.weapons} weapons, ` +
          `${counts.mods} mods, ${counts.abilities} abilities`,
      );
      backfillModDescriptions();
      writeProcessedExportHashes(currentExportHashes);
      console.log(`${TAG} Export hashes updated after successful processing.`);
    } else {
      console.log(
        `${TAG} Export hashes unchanged. Skipping export DB processing.`,
      );
    }
  } catch (err) {
    console.error(
      `${TAG} Export processing failed:`,
      err instanceof Error ? err.message : err,
    );
    if (!hasDbData()) {
      console.error(`${TAG} No DB data available, cannot continue to scrapers`);
    }
    return;
  }

  if (options.includeExaltedStanceMods) {
    try {
      const exaltedStanceResult = await syncExaltedStanceModsFromOverframe(
        (msg) => {
          console.log(`${TAG} ${msg}`);
        },
      );
      console.log(
        `${TAG} Exalted stances: ${exaltedStanceResult.found} found, ${exaltedStanceResult.insertedOrUpdated} updated`,
      );
    } catch (err) {
      console.error(
        `${TAG} Exalted stance sync failed:`,
        err instanceof Error ? err.message : err,
      );
    }
  }

  try {
    const imgResult = await downloadImages((done, total, current) => {
      if (done === 1 || done % 500 === 0 || done === total) {
        console.log(`${TAG} Images: ${done}/${total} (${current})`);
      }
    });
    if (imgResult.downloaded > 0) {
      console.log(
        `${TAG} Images: ${imgResult.downloaded} downloaded, ${imgResult.skipped} skipped`,
      );
    } else {
      console.log(`${TAG} Images: all ${imgResult.skipped} up to date`);
    }
  } catch (err) {
    console.error(
      `${TAG} Image download failed:`,
      err instanceof Error ? err.message : err,
    );
  }

  if (options.includeHiddenCompanionWeapons) {
    try {
      const hiddenCompanionResult =
        await syncHiddenCompanionWeaponsFromOverframe((msg) => {
          console.log(`${TAG} ${msg}`);
        });
      console.log(
        `${TAG} Hidden companion claws: ${hiddenCompanionResult.found} found, ${hiddenCompanionResult.insertedOrUpdated} updated`,
      );
    } catch (err) {
      console.error(
        `${TAG} Hidden companion claw sync failed:`,
        err instanceof Error ? err.message : err,
      );
    }
  }

  try {
    const indexResult = await scrapeIndex(
      undefined,
      (msg) => {
        console.log(`${TAG} Overframe: ${msg}`);
      },
      true,
    );

    if (indexResult.entries.length > 0) {
      console.log(
        `${TAG} Overframe: scraping ${indexResult.entries.length} items...`,
      );
      const scrapedItems = await scrapeItems(indexResult.entries, 1500, (p) => {
        if (p.current === 1 || p.current % 50 === 0 || p.current === p.total) {
          console.log(
            `${TAG} Overframe: ${p.current}/${p.total} ${p.currentItem}`,
          );
        }
      });

      const mergeResult = mergeScrapedData(scrapedItems, (msg) => {
        console.log(`${TAG} Overframe merge: ${msg}`);
      });
      console.log(
        `${TAG} Overframe: merged ${mergeResult.warframesUpdated} warframes, ` +
          `${mergeResult.weaponsUpdated} weapons, ${mergeResult.companionsUpdated} companions`,
      );
    } else {
      console.log(`${TAG} Overframe: all items up to date`);
    }
  } catch (err) {
    console.error(
      `${TAG} Overframe scrape failed:`,
      err instanceof Error ? err.message : err,
    );
  }

  try {
    const wikiResult = await runWikiScrape((p) => {
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
          console.log(`${TAG} Wiki: ${last}`);
        }
      }
    }, true);
    console.log(
      `${TAG} Wiki: ${wikiResult.abilitiesUpdated} abilities, ` +
        `${wikiResult.passivesUpdated} passives, ${wikiResult.augmentsUpdated} augments`,
    );
  } catch (err) {
    console.error(
      `${TAG} Wiki scrape failed:`,
      err instanceof Error ? err.message : err,
    );
  }

  const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
  console.log(`${TAG} Data pipeline complete in ${elapsed}s`);
}
