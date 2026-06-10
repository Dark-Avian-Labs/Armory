import { describe, expect, it } from 'vitest';

import { atragraphSetKeyFromModName, parseAtragraphModsWikiHtml } from '../atragraphModsWiki.js';

const FIXTURE_HTML = `
<html><body>
  <h2><span class="mw-headline">List of Atragraph Mods</span></h2>
  <table class="wikitable">
    <tr><th>Mod Name</th><th>Overlay Image</th><th>Card Image</th></tr>
    <tr>
      <td>Animal Instinct</td>
      <td><a href="/w/File:AtragraphAnimalInstinct.png"><img src="/images/thumb/1/1a/AtragraphAnimalInstinct.png/64px-AtragraphAnimalInstinct.png" /></a></td>
      <td><a href="/w/File:AtragraphAnimalInstinct_Opaque.png"><img src="/images/thumb/2/2b/AtragraphAnimalInstinct_Opaque.png/64px-AtragraphAnimalInstinct_Opaque.png" /></a></td>
    </tr>
    <tr>
      <td>Hell's Chamber</td>
      <td><a href="/w/File:AtragraphHell%27sChamber.png"><img /></a></td>
      <td><a href="/w/File:AtragraphHell%27sChamber_Opaque.png"><img /></a></td>
    </tr>
  </table>
  <h2><span class="mw-headline">Atragraph Mods Checklist</span></h2>
  <ul>
    <li>Atragraph Animal Instinct
      <ul>
        <li>Animal Instinct</li>
        <li>Primed Animal Instinct</li>
      </ul>
    </li>
    <li>Atragraph Hell's Chamber
      <ul>
        <li>Hell's Chamber</li>
        <li>Galvanized Hell</li>
      </ul>
    </li>
  </ul>
</body></html>
`;

describe('atragraphModsWiki', () => {
  it('derives stable set keys from mod names', () => {
    expect(atragraphSetKeyFromModName('Animal Instinct')).toBe('AnimalInstinct');
    expect(atragraphSetKeyFromModName("Hell's Chamber")).toBe('HellsChamber');
  });

  it('parses atragraph table rows and checklist-compatible mods', () => {
    const sets = parseAtragraphModsWikiHtml(FIXTURE_HTML);
    expect(sets).toHaveLength(2);

    const animal = sets.find((set) => set.setKey === 'AnimalInstinct');
    expect(animal).toMatchObject({
      displayName: 'Animal Instinct',
      overlayFileName: 'AtragraphAnimalInstinct.png',
      cardFileName: 'AtragraphAnimalInstinct_Opaque.png',
    });
    expect(animal?.compatibleModNames).toEqual(expect.arrayContaining(['Animal Instinct', 'Primed Animal Instinct']));

    const hells = sets.find((set) => set.setKey === 'HellsChamber');
    expect(hells?.compatibleModNames).toEqual(expect.arrayContaining(["Hell's Chamber", 'Galvanized Hell']));
  });
});
