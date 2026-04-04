export interface DisplayTextSegment {
  kind: 'text' | 'token';
  value: string;
}

const DAMAGE_TOKEN_REGEX = /<DT_[A-Z0-9_]+>/g;

const DAMAGE_TYPE_ICON_MAP: Record<string, string> = {
  '<DT_IMPACT_COLOR>': '/icons/elements/01_impact.png',
  '<DT_PUNCTURE_COLOR>': '/icons/elements/02_puncture.png',
  '<DT_SLASH_COLOR>': '/icons/elements/03_slash.png',
  '<DT_FIRE_COLOR>': '/icons/elements/04_heat.png',
  '<DT_FREEZE_COLOR>': '/icons/elements/05_cold.png',
  '<DT_ELECTRICITY_COLOR>': '/icons/elements/06_electricity.png',
  '<DT_POISON_COLOR>': '/icons/elements/07_toxin.png',
  '<DT_EXPLOSION_COLOR>': '/icons/elements/08_blast.png',
  '<DT_RADIATION_COLOR>': '/icons/elements/09_radiation.png',
  '<DT_GAS_COLOR>': '/icons/elements/10_gas.png',
  '<DT_MAGNETIC_COLOR>': '/icons/elements/11_magnetic.png',
  '<DT_VIRAL_COLOR>': '/icons/elements/12_viral.png',
  '<DT_CORROSIVE_COLOR>': '/icons/elements/13_corrosive.png',
  '<DT_RADIANT_COLOR>': '/icons/elements/14_void.png',
  '<DT_SENTIENT_COLOR>': '/icons/elements/15_tau.png',
};

export function getDamageTypeIconPath(token: string): string | undefined {
  const direct = DAMAGE_TYPE_ICON_MAP[token];
  if (direct) return direct;
  if (token.endsWith('_COLOR>')) {
    return undefined;
  }
  const m = token.match(/^<DT_([A-Z0-9_]+)>$/);
  if (!m) return undefined;
  const withColor = `<DT_${m[1]}_COLOR>`;
  return DAMAGE_TYPE_ICON_MAP[withColor];
}

export function sanitizeDisplayTextKeepDamageTokens(value: unknown): string {
  if (typeof value !== 'string') return '';

  const preservedTokens: string[] = [];
  const withPlaceholders = value.replace(DAMAGE_TOKEN_REGEX, (match) => {
    const index = preservedTokens.length;
    preservedTokens.push(match);
    return `__DT_TOKEN_${index}__`;
  });

  const stripped = withPlaceholders
    .replace(/<[^>]*>/g, ' ')
    .replace(/[<>]/g, '')
    .trim();

  return stripped.replace(/__DT_TOKEN_(\d+)__/g, (_, indexText: string) => {
    const index = Number(indexText);
    return preservedTokens[index] ?? '';
  });
}

export function splitDisplayTextByDamageTokens(text: string): DisplayTextSegment[] {
  const segments: DisplayTextSegment[] = [];
  let lastIndex = 0;

  for (const match of text.matchAll(DAMAGE_TOKEN_REGEX)) {
    const token = match[0];
    const start = match.index ?? 0;
    if (start > lastIndex) {
      segments.push({
        kind: 'text',
        value: text.slice(lastIndex, start),
      });
    }
    segments.push({ kind: 'token', value: token });
    lastIndex = start + token.length;
  }

  if (lastIndex < text.length) {
    segments.push({ kind: 'text', value: text.slice(lastIndex) });
  }

  return segments;
}

export function truncateDamageTokenText(text: string, maxVisibleChars: number): string {
  if (maxVisibleChars <= 0 || !text) return '';

  let visibleChars = 0;
  let out = '';
  let truncated = false;

  for (const segment of splitDisplayTextByDamageTokens(text)) {
    if (visibleChars >= maxVisibleChars) {
      truncated = true;
      break;
    }

    if (segment.kind === 'token') {
      out += segment.value;
      visibleChars += 1;
      continue;
    }

    for (const char of segment.value) {
      if (visibleChars >= maxVisibleChars) {
        truncated = true;
        break;
      }
      out += char;
      visibleChars += 1;
    }
  }

  return truncated ? `${out}...` : out;
}
