import type { Mod, ModSlot } from '../types/warframe';

const UMBRA_MOD_SET_MARKER = 'UmbraModSet';

const UMBRA_SET_MARKETING = /^\s*Enhance mods in this set\.?\s*$/i;

export function stripUmbraSetMarketingLines(text: string): string {
  return text
    .split('\n')
    .map((line) => line.replace(/^\s*Enhance mods in this set\.?\s*/i, '').trim())
    .filter(Boolean)
    .join('\n')
    .trim();
}

function tierBlockHasParseableStats(text: string): boolean {
  const t = stripUmbraSetMarketingLines(text);
  if (!t) return false;
  if (UMBRA_SET_MARKETING.test(t)) return false;
  return /[+-]?\d/.test(t);
}

export function parseSetStatsTiers(raw: string | undefined | null): string[] | null {
  if (raw == null || String(raw).trim() === '') return null;
  try {
    const parsed: unknown = JSON.parse(raw);
    if (Array.isArray(parsed)) {
      const lines = parsed.filter((x): x is string => typeof x === 'string');
      return lines.length > 0 ? lines : null;
    }
    if (parsed && typeof parsed === 'object') {
      const rec = parsed as Record<string, unknown>;
      const entries = Object.entries(rec).sort(([a], [b]) => Number(a) - Number(b));
      const lines = entries.map(([, v]) => v).filter((x): x is string => typeof x === 'string');
      return lines.length > 0 ? lines : null;
    }
    return null;
  } catch {
    return null;
  }
}

export function isUmbraSelfScalingSetMod(mod: Mod | undefined): boolean {
  if (!mod) return false;
  if (mod.mod_set?.includes(UMBRA_MOD_SET_MARKER)) return true;
  if (mod.unique_name?.includes(UMBRA_MOD_SET_MARKER)) return true;
  if (mod.name?.startsWith('Umbral ')) return true;
  return false;
}

export function resolveModRankDescriptionText(mod: Mod, rank: number): string {
  if (!mod.description) return '';
  try {
    const descriptions: string[] = JSON.parse(mod.description);
    if (!descriptions.length) return '';
    const clampedRank = Math.min(rank, descriptions.length - 1);
    if (clampedRank < 0) return '';
    let text = stripUmbraSetMarketingLines(descriptions[clampedRank] ?? '');
    if (isUmbraSelfScalingSetMod(mod) && !text.trim()) {
      for (let r = clampedRank - 1; r >= 0; r--) {
        const candidate = stripUmbraSetMarketingLines(descriptions[r] ?? '');
        if (candidate.trim()) return candidate;
      }
    }
    return text;
  } catch {
    return stripUmbraSetMarketingLines(mod.description ?? '');
  }
}

export function getUmbraTierStatBlockAtMaxRank(
  mod: Mod,
  rank: number,
  umbraSetEquippedCount: number | undefined,
): string | null {
  const fusionLimit = mod.fusion_limit ?? 0;
  const atMaxRank = fusionLimit > 0 && rank >= fusionLimit;
  if (
    !isUmbraSelfScalingSetMod(mod) ||
    !atMaxRank ||
    umbraSetEquippedCount == null ||
    !mod.set_stats
  ) {
    return null;
  }
  const setStats = parseSetStatsTiers(mod.set_stats);
  if (!setStats?.length) return null;
  const tier = Math.min(Math.max(umbraSetEquippedCount, 1), setStats.length);
  const raw = setStats[tier - 1]?.trim();
  if (!raw) return null;
  const block = stripUmbraSetMarketingLines(raw);
  if (!tierBlockHasParseableStats(block)) return null;
  return block;
}

export function countEquippedUmbraSetMods(slots: ModSlot[]): number {
  let n = 0;
  for (const slot of slots) {
    if (slot.mod && isUmbraSelfScalingSetMod(slot.mod)) n += 1;
  }
  return n;
}

export function countEquippedUmbraSetModsFromModList(mods: Mod[]): number {
  let n = 0;
  for (const mod of mods) {
    if (isUmbraSelfScalingSetMod(mod)) n += 1;
  }
  return n;
}
