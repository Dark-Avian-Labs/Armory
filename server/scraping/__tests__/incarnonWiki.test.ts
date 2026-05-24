import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import * as cheerio from 'cheerio';
import { describe, expect, it } from 'vitest';

import {
  extractFileNameFromCell,
  parseGenesisPageWithWeaponValues,
  parseIntrinsicPageHtml,
} from '../incarnonWikiParse.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const fixturesDir = path.join(__dirname, 'fixtures');

function readFixture(name: string): string {
  return fs.readFileSync(path.join(fixturesDir, name), 'utf8');
}

describe('incarnonWikiParse', () => {
  it('parses Boltor Genesis compatible weapons and four evolution tiers', () => {
    const html = readFixture('boltor-genesis.html');
    const parsed = parseGenesisPageWithWeaponValues(html);

    expect(parsed.compatibleWeaponNames).toEqual(expect.arrayContaining(['Boltor', 'Telos Boltor', 'Boltor Prime']));
    expect(parsed.tiers).toHaveLength(4);
    expect(parsed.tiers.map((tier) => tier.tier)).toEqual([1, 2, 3, 4]);
    expect(parsed.weaponEvolutions.has('Boltor')).toBe(true);
    expect(parsed.weaponEvolutions.has('Boltor Prime')).toBe(true);
  });

  it('resolves weapon-specific perk values for Boltor vs Prime', () => {
    const html = readFixture('boltor-genesis.html');
    const parsed = parseGenesisPageWithWeaponValues(html);

    const boltorEvolutions = parsed.weaponEvolutions.get('Boltor');
    const primeEvolutions = parsed.weaponEvolutions.get('Boltor Prime');
    expect(boltorEvolutions).toBeDefined();
    expect(primeEvolutions).toBeDefined();

    const boltorEvo2 = boltorEvolutions!.find((tier) => tier.tier === 2);
    const primeEvo2 = primeEvolutions!.find((tier) => tier.tier === 2);
    expect(boltorEvo2?.options.length).toBeGreaterThan(0);
    expect(primeEvo2?.options.length).toBeGreaterThan(0);

    const boltorDesc = boltorEvo2!.options[0]?.description ?? '';
    const primeDesc = primeEvo2!.options[0]?.description ?? '';
    expect(boltorDesc.length).toBeGreaterThan(0);
    expect(primeDesc.length).toBeGreaterThan(0);
    expect(boltorDesc).not.toEqual(primeDesc);
  });

  it('extracts perk image filenames from genesis table cells', () => {
    const html = readFixture('boltor-genesis.html');
    const $ = cheerio.load(html);
    const table = $('#Evolutions').closest('.mw-heading').nextAll('table.wikitable').first();
    expect(table.length).toBeGreaterThan(0);

    const fileNames = new Set<string>();
    table
      .find('tr')
      .slice(1)
      .each((_, tr) => {
        $(tr)
          .find('th,td')
          .each((__, cell) => {
            const fileName = extractFileNameFromCell($, cell);
            if (fileName) fileNames.add(fileName);
          });
      });

    expect(fileNames.size).toBeGreaterThan(0);
    expect([...fileNames].some((name) => name.endsWith('.png'))).toBe(true);
  });

  it('parses Felarx intrinsic page with five evolution tiers', () => {
    const html = readFixture('felarx-intrinsic.html');
    const parsed = parseIntrinsicPageHtml(html, 'Felarx');

    expect(parsed.weaponName).toBe('Felarx');
    expect(parsed.tiers).toHaveLength(5);
    expect(parsed.tiers.map((tier) => tier.tier)).toEqual([1, 2, 3, 4, 5]);
    expect(parsed.tiers[0]?.options.length).toBeGreaterThan(0);
    expect(parsed.tiers[0]?.options[0]?.name.length).toBeGreaterThan(0);
  });
});
