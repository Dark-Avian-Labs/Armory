import { describe, expect, it } from 'vitest';

import { splitDisplayTextByDamageWords } from '../damageTypeWords';

describe('splitDisplayTextByDamageWords', () => {
  it('keeps matched phrases in the text segments', () => {
    const segments = splitDisplayTextByDamageWords('Gain +10% Ability Damage on enemies affected by Corrosion Status.');
    expect(segments).toEqual([
      { kind: 'text', value: 'Gain +10% Ability Damage on enemies affected by ' },
      { kind: 'damageWord', value: 'Corrosion Status', iconFile: '13_corrosive' },
      { kind: 'text', value: '.' },
    ]);
  });

  it('prefers longer phrases such as Primary Electricity Damage', () => {
    const segments = splitDisplayTextByDamageWords('Gain +30% Primary Electricity Damage.');
    expect(segments).toEqual([
      { kind: 'text', value: 'Gain +30% ' },
      { kind: 'damageWord', value: 'Primary Electricity Damage', iconFile: '06_electricity' },
      { kind: 'text', value: '.' },
    ]);
  });

  it('matches multiple damage phrases in one description', () => {
    const segments = splitDisplayTextByDamageWords(
      'Toxin Status Effects deal more damage. Recover Health from a Toxin Status Effect.',
    );
    expect(segments.filter((segment) => segment.kind === 'damageWord')).toEqual([
      { kind: 'damageWord', value: 'Toxin Status Effects', iconFile: '07_toxin' },
      { kind: 'damageWord', value: 'Toxin Status Effect', iconFile: '07_toxin' },
    ]);
  });
});
