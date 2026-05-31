import { describe, expect, it } from 'vitest';

import { parseSubsumableAbilitiesFromWarframeAbilitiesHtml } from './warframeHelminthAbilityWiki.js';

describe('parseSubsumableAbilitiesFromWarframeAbilitiesHtml', () => {
  it('detects subsumable abilities from ability table rows', () => {
    const html = `
      <table>
        <tr>
          <td><a data-param-source="Ability" href="/w/Elemental_Ward" title="Elemental Ward (Ability)">Elemental Ward</a></td>
          <td><a href="/w/Helminth">Subsumable to Helminth</a></td>
        </tr>
        <tr>
          <td><a data-param-source="Ability" href="/w/Effigy" title="Effigy (Ability)">Effigy</a></td>
          <td></td>
        </tr>
      </table>
    `;
    const names = parseSubsumableAbilitiesFromWarframeAbilitiesHtml(html);
    expect(names).toContain('elemental ward');
    expect(names).not.toContain('effigy');
  });
});
