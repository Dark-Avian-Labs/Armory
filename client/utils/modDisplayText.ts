import type { Mod } from '../types/warframe';
import { sanitizeDisplayTextKeepDamageTokens } from './damageTypeTokens';
import {
  applyUmbraMultiplierToText,
  getUmbraSetBonusDescription,
  getUmbraSetMultiplier,
  isUmbraSelfScalingSetMod,
  parseSetStatsTiers,
  resolveModRankDescriptionText,
} from './umbraSet';

export interface ModCardDisplayTexts {
  mainDescription: string;
  setBonusDescription: string;
  effectiveSetRank: number;
}

export function getModCardDisplayTexts(
  mod: Mod,
  rank: number,
  opts: { umbraSetEquippedCount?: number; setRank?: number } = {},
): ModCardDisplayTexts {
  const maxSetRank = mod.set_num_in_set ?? 0;
  const isUmbra = isUmbraSelfScalingSetMod(mod);
  const umbraCount = opts.umbraSetEquippedCount;

  const effectiveSetRank =
    isUmbra && umbraCount != null && maxSetRank > 0
      ? Math.min(Math.max(umbraCount, 1), maxSetRank)
      : (opts.setRank ?? (maxSetRank > 0 ? 1 : 0));

  const rankBody = resolveModRankDescriptionText(mod, rank);
  let mainDescription: string;

  if (isUmbra && umbraCount != null && umbraCount >= 2) {
    const multiplier = getUmbraSetMultiplier(mod, umbraCount);
    mainDescription = sanitizeDisplayTextKeepDamageTokens(
      applyUmbraMultiplierToText(rankBody, multiplier),
    );
  } else {
    mainDescription = sanitizeDisplayTextKeepDamageTokens(rankBody);
  }

  let setBonusDescription = '';
  if (isUmbra && maxSetRank > 0) {
    setBonusDescription = getUmbraSetBonusDescription(umbraCount ?? 0);
  } else if (mod.set_stats && maxSetRank > 0) {
    const setStats = parseSetStatsTiers(mod.set_stats);
    if (setStats?.length) {
      const idx = Math.min(Math.max(effectiveSetRank - 1, 0), setStats.length - 1);
      setBonusDescription = sanitizeDisplayTextKeepDamageTokens(setStats[idx] ?? '');
    }
  }

  return { mainDescription, setBonusDescription, effectiveSetRank };
}
