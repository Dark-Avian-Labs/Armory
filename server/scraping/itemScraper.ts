import * as cheerio from 'cheerio';

import { FETCH_TIMEOUT_MS, fetchWithTimeout, isAbortError } from '../http/fetchWithTimeout.js';
import type { OverframeIndexEntry } from './indexScraper.js';

const BASE_URL = 'https://overframe.gg';

export interface ScrapedAbilityStat {
  label: string;
  value: string;
}

export interface ScrapedAbility {
  name: string;
  description: string;
  stats: ScrapedAbilityStat[];
}

export interface ScrapedItemData {
  entry: OverframeIndexEntry;
  nextData: Record<string, unknown>;
  itemData: Record<string, unknown>;
  artifactSlots: string[];
  abilities: ScrapedAbility[];
  fireBehaviors: Record<string, unknown>[];
}

interface NextDataShape {
  props?: {
    pageProps?: {
      item?: {
        data?: Record<string, unknown>;
      };
    };
  };
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export async function scrapeItemPage(entry: OverframeIndexEntry): Promise<ScrapedItemData> {
  const url = `${BASE_URL}/build/new/${entry.overframeId}/${entry.slug}/`;
  let res: Response;
  try {
    res = await fetchWithTimeout(url, {}, FETCH_TIMEOUT_MS.htmlPage);
  } catch (error: unknown) {
    if (isAbortError(error)) {
      throw new Error(`Failed to fetch ${url}: timed out after ${FETCH_TIMEOUT_MS.htmlPage}ms`);
    }
    throw error;
  }
  if (!res.ok) throw new Error(`Failed to fetch ${url}: ${res.status}`);

  const html = await res.text();
  const $ = cheerio.load(html);

  const scriptContent = $('#__NEXT_DATA__').html();
  if (!scriptContent) throw new Error(`No __NEXT_DATA__ found on ${url}`);

  let nextData: Record<string, unknown> = {};
  try {
    const parsed = JSON.parse(scriptContent) as unknown;
    if (parsed && typeof parsed === 'object') {
      nextData = parsed as Record<string, unknown>;
    } else {
      console.warn(`[Scraper] __NEXT_DATA__ for ${url} was not an object; using empty data`);
    }
  } catch (err) {
    console.warn(
      `[Scraper] Failed to parse __NEXT_DATA__ for ${url}:`,
      err instanceof Error ? err.message : err,
    );
  }
  const itemData = (nextData as NextDataShape).props?.pageProps?.item?.data || {};

  const artifactSlots = Array.isArray(itemData.ArtifactSlots)
    ? itemData.ArtifactSlots.filter((slot): slot is string => typeof slot === 'string')
    : [];
  const fireBehaviors = Array.isArray(itemData.Behaviors)
    ? itemData.Behaviors.filter(
        (behavior): behavior is Record<string, unknown> =>
          !!behavior && typeof behavior === 'object' && !Array.isArray(behavior),
      )
    : [];

  const abilities: ScrapedAbility[] = [];
  $('[class*="abilityTooltip"]').each((_, tooltipEl) => {
    const $tip = $(tooltipEl);
    const name = $tip.find('h1').first().text().trim();
    const description = $tip.find('.wfic').first().text().trim();
    const stats: ScrapedAbilityStat[] = [];

    $tip.find('[class*="abilityTooltipStatLine"]').each((__, statEl) => {
      const $stat = $(statEl);
      const divs = $stat.children('div');
      if (divs.length >= 2) {
        stats.push({
          label: $(divs[0]).text().trim(),
          value: $(divs[1]).text().trim(),
        });
      }
    });

    if (name) {
      abilities.push({ name, description, stats });
    }
  });

  return {
    entry,
    nextData,
    itemData,
    artifactSlots,
    abilities,
    fireBehaviors,
  };
}

export interface ScrapeProgress {
  current: number;
  total: number;
  currentItem: string;
  phase: 'index' | 'items' | 'merging' | 'done';
}

export async function scrapeItems(
  entries: OverframeIndexEntry[],
  delayMs = 1500,
  onProgress?: (progress: ScrapeProgress) => void,
): Promise<ScrapedItemData[]> {
  const results: ScrapedItemData[] = [];

  for (let i = 0; i < entries.length; i++) {
    const entry = entries[i];
    onProgress?.({
      current: i + 1,
      total: entries.length,
      currentItem: entry.name,
      phase: 'items',
    });

    try {
      const data = await scrapeItemPage(entry);
      results.push(data);
    } catch (err) {
      console.warn(
        `[Scraper] Failed to scrape ${entry.name}:`,
        err instanceof Error ? err.message : err,
      );
    }

    if (i < entries.length - 1) {
      await sleep(delayMs);
    }
  }

  return results;
}
