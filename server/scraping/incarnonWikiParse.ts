import * as cheerio from 'cheerio';
import type { CheerioAPI } from 'cheerio';
import type { AnyNode, Element } from 'domhandler';

import {
  extractStatModifiers,
  normalizeWikiText,
  substitutePlaceholders,
} from './incarnonStatModifiers.js';
import type {
  IncarnonEvolutionTier,
  IncarnonPerkOption,
  ParsedGenesisPage,
  ParsedIntrinsicPage,
} from './incarnonTypes.js';

const EVO_TIER_RE = /^EVO(\d+)$/i;
const CHALLENGE_RE = /^Evolution(?:\s+[IVXLCDM]+)?\s+Challenge$/i;

export function extractFileNameFromCell($: CheerioAPI, cell: Element): string | null {
  const fileLink = $(cell).find('a[href*="/File:"]').first();
  const href = fileLink.attr('href');
  if (!href) return null;
  const match = href.match(/\/File:(.+)$/);
  return match ? decodeURIComponent(match[1]) : null;
}

export function parseCompatibleWeaponNames($: CheerioAPI): string[] {
  const intro = $('#mw-content-text p')
    .filter((_, p) => normalizeWikiText($(p).text()).includes('add Incarnon upgrades to the'))
    .first();

  const names = new Set<string>();
  intro.find('a[href^="/w/"]').each((_, a) => {
    const href = $(a).attr('href') ?? '';
    if (
      href.includes('Incarnon') ||
      href.includes('The_') ||
      href.includes('Steel_Path') ||
      href.includes('Cavalero')
    ) {
      return;
    }
    const title = normalizeWikiText($(a).attr('title') || $(a).text());
    if (title && title.length > 1 && title.length < 80) {
      names.add(title);
    }
  });

  return [...names];
}

function mapHeaderToWeaponName(header: string, compatibleWeaponNames: string[]): string | null {
  const normalizedHeader = normalizeWikiText(header);
  if (!normalizedHeader || normalizedHeader.toLowerCase() === 'evolution') {
    return null;
  }
  if (normalizedHeader.toLowerCase() === 'notes') {
    return null;
  }

  const exact = compatibleWeaponNames.find(
    (name) => name.toLowerCase() === normalizedHeader.toLowerCase(),
  );
  if (exact) return exact;

  const startsWith = compatibleWeaponNames.find((name) =>
    name.toLowerCase().startsWith(normalizedHeader.toLowerCase()),
  );
  if (startsWith) return startsWith;

  const endsWith = compatibleWeaponNames.find((name) =>
    name.toLowerCase().endsWith(normalizedHeader.toLowerCase()),
  );
  if (endsWith) return endsWith;

  const contains = compatibleWeaponNames.find((name) =>
    name.toLowerCase().includes(normalizedHeader.toLowerCase()),
  );
  return contains ?? null;
}

function buildWeaponColumnMap(
  headers: string[],
  compatibleWeaponNames: string[],
): Map<number, string> {
  const map = new Map<number, string>();
  for (let i = 1; i < headers.length - 1; i++) {
    const weaponName = mapHeaderToWeaponName(headers[i], compatibleWeaponNames);
    if (weaponName) {
      map.set(i, weaponName);
    }
  }
  return map;
}

function parseTierNumber(cell: string): number | null {
  const match = normalizeWikiText(cell).match(EVO_TIER_RE);
  return match ? parseInt(match[1], 10) : null;
}

function makePerkOption(
  $: CheerioAPI,
  name: string,
  description: string,
  notes: string | undefined,
  nameCell: Element | null,
): IncarnonPerkOption & { imageFile?: string } {
  const fileName = nameCell ? extractFileNameFromCell($, nameCell) : null;
  const resolvedDescription = normalizeWikiText(description);
  return {
    name: normalizeWikiText(name),
    description: resolvedDescription,
    notes: notes ? normalizeWikiText(notes) : undefined,
    imageFile: fileName ?? undefined,
    statModifiers: extractStatModifiers(resolvedDescription),
  };
}

function findEvolutionsTable($: CheerioAPI): cheerio.Cheerio<AnyNode> | null {
  const h3 = $('#Evolutions').closest('.mw-heading');
  const table = h3.nextAll('table.wikitable').first();
  return table.length > 0 ? table : null;
}

export function parseGenesisEvolutionTable($: CheerioAPI): {
  weaponColumnNames: string[];
  tiers: IncarnonEvolutionTier[];
} {
  const table = findEvolutionsTable($);
  if (!table) {
    return { weaponColumnNames: [], tiers: [] };
  }

  const headerCells: string[] = [];
  table
    .find('tr')
    .first()
    .find('th,td')
    .each((_, c) => {
      headerCells.push(normalizeWikiText($(c).text()));
    });

  const weaponColumnNames = headerCells.slice(1, -1);
  const notesIndex = headerCells.length - 1;
  const templateIndex = 2;

  const tiers: IncarnonEvolutionTier[] = [];
  let currentTier: IncarnonEvolutionTier | null = null;

  table
    .find('tr')
    .slice(1)
    .each((_, tr) => {
      const cells: Element[] = [];
      $(tr)
        .find('th,td')
        .each((__, c) => {
          cells.push(c);
        });

      if (cells.length === 0) return;

      const texts = cells.map((c) => normalizeWikiText($(c).text()));
      const first = texts[0] ?? '';

      if (CHALLENGE_RE.test(first)) {
        const challengeText = texts[1] ?? texts.slice(1).join(' ');
        if (currentTier) {
          currentTier.challenge = normalizeWikiText(challengeText);
        }
        return;
      }

      const tierFromFirst = parseTierNumber(first);
      if (tierFromFirst) {
        currentTier = { tier: tierFromFirst, options: [] };
        tiers.push(currentTier);
      }

      if (!currentTier) return;

      const perkName = tierFromFirst ? texts[1] : first;
      if (!perkName || CHALLENGE_RE.test(perkName)) return;

      const template = texts[templateIndex] ?? texts[1] ?? '';
      const notes = texts[notesIndex] || undefined;
      const nameCell = tierFromFirst ? cells[1] : cells[0];

      currentTier.options.push(
        makePerkOption($, perkName, template, notes, nameCell ?? null) as IncarnonPerkOption,
      );

      void weaponColumnNames;
    });

  return { weaponColumnNames, tiers };
}

export function buildGenesisWeaponData(
  parsed: ParsedGenesisPage,
  _weaponName: string,
): IncarnonEvolutionTier[] {
  return parsed.tiers.map((tier) => ({
    tier: tier.tier,
    challenge: tier.challenge,
    options: tier.options.map((option) => {
      const extended = option as IncarnonPerkOption & { imageFile?: string };
      return {
        name: option.name,
        description: option.description,
        notes: option.notes,
        imagePath: undefined,
        imageFile: extended.imageFile,
        statModifiers: option.statModifiers,
      };
    }),
  }));
}

export function parseGenesisPageHtml(html: string, overview?: string): ParsedGenesisPage {
  const $ = cheerio.load(html);
  const compatibleWeaponNames = parseCompatibleWeaponNames($);
  const { weaponColumnNames, tiers: rawTiers } = parseGenesisEvolutionTable($);

  const tiers: IncarnonEvolutionTier[] = rawTiers.map((tier) => ({
    tier: tier.tier,
    challenge: tier.challenge,
    options: tier.options.map((opt) => ({ ...opt })),
  }));

  return {
    compatibleWeaponNames,
    weaponColumnNames,
    overview,
    tiers,
  };
}

export function resolveGenesisPerkForWeapon(
  parsed: ParsedGenesisPage,
  weaponName: string,
  tier: IncarnonEvolutionTier,
  optionIndex: number,
  _rawTableRows?: never,
): IncarnonPerkOption {
  void _rawTableRows;
  const option = tier.options[optionIndex];
  return { ...option };
}

export function parseGenesisPageWithWeaponValues(
  html: string,
  overview?: string,
): ParsedGenesisPage & { weaponEvolutions: Map<string, IncarnonEvolutionTier[]> } {
  const $ = cheerio.load(html);
  const compatibleWeaponNames = parseCompatibleWeaponNames($);
  const parsed = parseGenesisPageHtml(html, overview);

  const table = findEvolutionsTable($);

  const headerCells: string[] = [];
  if (table) {
    table
      .find('tr')
      .first()
      .find('th,td')
      .each((_, c) => {
        headerCells.push(normalizeWikiText($(c).text()));
      });
  }

  const columnMap = buildWeaponColumnMap(headerCells, compatibleWeaponNames);
  const notesIndex = headerCells.length - 1;
  const templateIndex = 2;

  const tierData = new Map<number, IncarnonEvolutionTier>();
  let currentTier: IncarnonEvolutionTier | null = null;

  if (table) {
    table
      .find('tr')
      .slice(1)
      .each((_, tr) => {
        const cells: Element[] = [];
        $(tr)
          .find('th,td')
          .each((__, c) => {
            cells.push(c);
          });
        if (cells.length === 0) return;

        const texts = cells.map((c) => normalizeWikiText($(c).text()));
        const first = texts[0] ?? '';

        if (CHALLENGE_RE.test(first)) {
          if (currentTier) {
            currentTier.challenge = normalizeWikiText(texts[1] ?? '');
          }
          return;
        }

        const tierFromFirst = parseTierNumber(first);
        if (tierFromFirst) {
          currentTier = { tier: tierFromFirst, options: [] };
          tierData.set(tierFromFirst, currentTier);
        }
        if (!currentTier) return;

        const perkName = tierFromFirst ? texts[1] : first;
        if (!perkName) return;

        const template = texts[templateIndex] ?? '';
        const notes = texts[notesIndex] || undefined;
        const nameCell = tierFromFirst ? cells[1] : cells[0];
        const fileName = nameCell ? extractFileNameFromCell($, nameCell) : null;

        const weaponDescriptions = new Map<string, string>();
        for (const [colIndex, wName] of columnMap) {
          const valueCell = texts[colIndex] ?? '-';
          weaponDescriptions.set(wName, substitutePlaceholders(template, valueCell));
        }

        const baseOption: IncarnonPerkOption & {
          imageFile?: string;
          weaponDescriptions?: Map<string, string>;
        } = {
          name: normalizeWikiText(perkName),
          description: template,
          notes: notes ? normalizeWikiText(notes) : undefined,
          imageFile: fileName ?? undefined,
          statModifiers: extractStatModifiers(template),
          weaponDescriptions,
        };

        currentTier.options.push(baseOption);
      });
  }

  const weaponEvolutions = new Map<string, IncarnonEvolutionTier[]>();
  for (const weaponName of compatibleWeaponNames) {
    const evolutions: IncarnonEvolutionTier[] = [];
    for (const tier of [...tierData.values()].sort((a, b) => a.tier - b.tier)) {
      evolutions.push({
        tier: tier.tier,
        challenge: tier.challenge,
        options: tier.options.map((opt) => {
          const extended = opt as IncarnonPerkOption & {
            imageFile?: string;
            weaponDescriptions?: Map<string, string>;
          };
          const description = extended.weaponDescriptions?.get(weaponName) ?? extended.description;
          return {
            name: opt.name,
            description,
            notes: opt.notes,
            imageFile: extended.imageFile,
            statModifiers: extractStatModifiers(description),
          } as IncarnonPerkOption & { imageFile?: string };
        }),
      });
    }
    weaponEvolutions.set(weaponName, evolutions);
  }

  return {
    ...parsed,
    weaponEvolutions,
  };
}

export function parseIntrinsicEvolutionTable($: CheerioAPI): IncarnonEvolutionTier[] {
  const table = findEvolutionsTable($);
  if (!table) return [];

  const tiers: IncarnonEvolutionTier[] = [];
  let currentTier: IncarnonEvolutionTier | null = null;

  table
    .find('tr')
    .slice(1)
    .each((_, tr) => {
      const cells: Element[] = [];
      $(tr)
        .find('th,td')
        .each((__, c) => {
          cells.push(c);
        });
      if (cells.length === 0) return;

      const texts = cells.map((c) => normalizeWikiText($(c).text()));
      const first = texts[0] ?? '';

      if (CHALLENGE_RE.test(first)) {
        if (currentTier) {
          currentTier.challenge = normalizeWikiText(texts[1] ?? texts.slice(1).join(' '));
        }
        return;
      }

      const tierFromFirst = parseTierNumber(first);
      if (tierFromFirst) {
        currentTier = { tier: tierFromFirst, options: [] };
        tiers.push(currentTier);
      }
      if (!currentTier) return;

      const perkName = tierFromFirst ? texts[1] : first;
      if (!perkName) return;

      const description = texts[2] ?? texts[1] ?? '';
      const notes = texts[3] || texts[cells.length - 1] || undefined;
      const nameCell = tierFromFirst ? cells[1] : cells[0];

      currentTier.options.push(
        makePerkOption(
          $,
          perkName,
          description,
          notes !== description ? notes : undefined,
          nameCell,
        ),
      );
    });

  return tiers;
}

export function parseIntrinsicPageHtml(html: string, weaponName: string): ParsedIntrinsicPage {
  const $ = cheerio.load(html);
  const overview = normalizeWikiText($('#Overview').closest('.mw-heading').next('ul').text());
  return {
    weaponName,
    overview: overview || undefined,
    tiers: parseIntrinsicEvolutionTable($),
  };
}
