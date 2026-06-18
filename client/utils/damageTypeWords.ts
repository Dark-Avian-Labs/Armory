export interface DamageWordSegment {
  kind: 'text' | 'damageWord';
  value: string;
  iconFile?: string;
}

const DAMAGE_TYPE_PHRASES: readonly { phrase: string; iconFile: string }[] = [
  { phrase: 'Toxin Status Effects', iconFile: '07_toxin' },
  { phrase: 'Toxin Status Effect', iconFile: '07_toxin' },
  { phrase: 'Primary Electricity Damage', iconFile: '06_electricity' },
  { phrase: 'Toxin Status', iconFile: '07_toxin' },
  { phrase: 'Toxin Damage', iconFile: '07_toxin' },
  { phrase: 'Corrosion Status', iconFile: '13_corrosive' },
  { phrase: 'Radiation Status', iconFile: '09_radiation' },
  { phrase: 'Radiation Damage', iconFile: '09_radiation' },
  { phrase: 'Electricity Status', iconFile: '06_electricity' },
  { phrase: 'Electricity Damage', iconFile: '06_electricity' },
  { phrase: 'Heat Status', iconFile: '04_heat' },
  { phrase: 'Heat Damage', iconFile: '04_heat' },
  { phrase: 'Blast Status', iconFile: '08_blast' },
  { phrase: 'Blast Damage', iconFile: '08_blast' },
];

const PHRASE_ICON_MAP = new Map(
  DAMAGE_TYPE_PHRASES.map((entry) => [entry.phrase.toLowerCase(), entry.iconFile]),
);

const DAMAGE_WORD_REGEX = new RegExp(
  `(${[...DAMAGE_TYPE_PHRASES]
    .sort((a, b) => b.phrase.length - a.phrase.length)
    .map((entry) => entry.phrase.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'))
    .join('|')})`,
  'gi',
);

export function splitDisplayTextByDamageWords(text: string): DamageWordSegment[] {
  if (!text) return [];

  const segments: DamageWordSegment[] = [];
  let lastIndex = 0;

  for (const match of text.matchAll(DAMAGE_WORD_REGEX)) {
    const matched = match[0];
    const start = match.index ?? 0;
    if (start > lastIndex) {
      segments.push({ kind: 'text', value: text.slice(lastIndex, start) });
    }
    segments.push({
      kind: 'damageWord',
      value: matched,
      iconFile: PHRASE_ICON_MAP.get(matched.toLowerCase()),
    });
    lastIndex = start + matched.length;
  }

  if (lastIndex < text.length) {
    segments.push({ kind: 'text', value: text.slice(lastIndex) });
  }

  return segments.length > 0 ? segments : [{ kind: 'text', value: text }];
}
