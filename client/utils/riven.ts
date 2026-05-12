import type {
  EquipmentType,
  Mod,
  RivenConfig,
  RivenStat,
  RivenWeaponType,
  Weapon,
} from '../types/warframe';
import { weaponOmitsRivenMod } from './specialItems';

export const RIVEN_PLACEHOLDER_UNIQUE = '__RIVEN_PLACEHOLDER__';
export const RIVEN_MOD_UNIQUE = '__RIVEN_MOD__';

type BaselineMap = Record<string, number>;
type RivenRollRule = {
  positiveMultiplier: number;
  negativeMultiplier: number;
};

export const FACTION_RIVEN_BASE = 0.45;

export const FACTION_RIVEN_STATS = [
  'Damage to Grineer',
  'Damage to Corpus',
  'Damage to Infested',
] as const;

export function isFactionRivenStat(stat: string): boolean {
  return (FACTION_RIVEN_STATS as readonly string[]).includes(stat);
}

const PRIMARY_BASELINES = {
  Damage: 165,
  Multishot: 90,
  'Critical Chance': 149.99,
  'Critical Damage': 120,
  'Status Chance': 90,
  'Status Duration': 99.99,
  'Fire Rate': 60.03,
  'Magazine Capacity': 50,
  'Reload Speed': 50,
  'Ammo Maximum': 49.95,
  'Flight Speed': 90,
  'Punch Through': 2.7,
  Recoil: 90,
  Zoom: 59.99,
  Impact: 119.97,
  Puncture: 119.97,
  Slash: 119.97,
  Heat: 90,
  Cold: 90,
  Electricity: 90,
  Toxin: 90,
} as const satisfies BaselineMap;

const SECONDARY_BASELINES = {
  Damage: 219.6,
  Multishot: 119.7,
  'Critical Chance': 149.99,
  'Critical Damage': 90,
  'Status Chance': 90,
  'Status Duration': 99.99,
  'Fire Rate': 74.7,
  'Magazine Capacity': 50,
  'Reload Speed': 50,
  'Ammo Maximum': 90,
  'Flight Speed': 90,
  'Punch Through': 2.7,
  Recoil: 90,
  Zoom: 80.1,
  Impact: 119.97,
  Puncture: 119.97,
  Slash: 119.97,
  Heat: 90,
  Cold: 90,
  Electricity: 90,
  Toxin: 90,
} as const satisfies BaselineMap;

const MELEE_BASELINES = {
  Damage: 164.7,
  'Critical Chance': 180,
  'Critical Damage': 90,
  'Status Chance': 90,
  'Status Duration': 99,
  'Attack Speed': 54.9,
  Range: 1.94,
  'Combo Duration': 8.1,
  'Initial Combo': 24.5,
  'Slide Critical Chance': 120,
  'Finisher Damage': 119.7,
  'Heavy Attack Efficiency': 73.44,
  Impact: 119.7,
  Puncture: 119.7,
  Slash: 119.7,
  Heat: 90,
  Cold: 90,
  Electricity: 90,
  Toxin: 90,
} as const satisfies BaselineMap;

const ARCHGUN_BASELINES = {
  Damage: 99.9,
  Multishot: 60.3,
  'Critical Chance': 99.9,
  'Critical Damage': 80.1,
  'Status Chance': 60.3,
  'Status Duration': 99.99,
  'Fire Rate': 60.03,
  'Magazine Capacity': 60.3,
  'Reload Speed': 99.9,
  'Ammo Maximum': 99.9,
  'Punch Through': 2.7,
  Recoil: 90,
  Zoom: 59.99,
  Impact: 90,
  Puncture: 90,
  Slash: 90,
  Heat: 119.7,
  Cold: 119.7,
  Electricity: 119.7,
  Toxin: 119.7,
} as const satisfies BaselineMap;

const BASELINES = {
  primary: PRIMARY_BASELINES,
  secondary: SECONDARY_BASELINES,
  melee: MELEE_BASELINES,
  archgun: ARCHGUN_BASELINES,
} as const satisfies Record<RivenWeaponType, BaselineMap>;

const RIVEN_ROLL_RULES: Record<string, RivenRollRule> = {
  '2-0': { positiveMultiplier: 0.99, negativeMultiplier: 0 },
  '2-1': { positiveMultiplier: 1.2375, negativeMultiplier: 0.495 },
  '3-0': { positiveMultiplier: 0.75, negativeMultiplier: 0 },
  '3-1': { positiveMultiplier: 0.9375, negativeMultiplier: 0.75 },
};

export function getRivenWeaponType(
  equipmentType: EquipmentType,
  equipmentName?: string | null,
): RivenWeaponType | null {
  if (weaponOmitsRivenMod(equipmentName, equipmentType)) {
    return null;
  }
  if (
    equipmentType === 'primary' ||
    equipmentType === 'secondary' ||
    equipmentType === 'melee' ||
    equipmentType === 'archgun'
  ) {
    return equipmentType;
  }
  return null;
}

export function getRivenStatsForType(type: EquipmentType, equipmentName?: string | null): string[] {
  const weaponType = getRivenWeaponType(type, equipmentName);
  if (!weaponType) return [];
  return [...Object.keys(BASELINES[weaponType]), ...FACTION_RIVEN_STATS];
}

export function getRivenBaselineValue(stat: string, weaponType: RivenWeaponType): number | null {
  if (isFactionRivenStat(stat)) return FACTION_RIVEN_BASE;
  const baselineMap = BASELINES[weaponType] as BaselineMap;
  return baselineMap[stat] ?? null;
}

export function getEffectiveRivenDisposition(
  weapon: Pick<Weapon, 'omega_attenuation' | 'riven_disposition'>,
): number | null {
  const v = weapon.omega_attenuation ?? weapon.riven_disposition;
  return typeof v === 'number' && Number.isFinite(v) ? v : null;
}

export function getDispositionPips(value: number): number {
  const v = Math.round(value * 1000) / 1000;
  if (v >= 1.31) return 5;
  if (v >= 1.11) return 4;
  if (v >= 0.9) return 3;
  if (v >= 0.7) return 2;
  if (v >= 0.5) return 1;
  return 1;
}

function toOneDecimal(value: number): number {
  const sign = value < 0 ? -1 : 1;
  return sign * parseFloat(Math.abs(value).toFixed(1));
}

function clamp(value: number, min: number, max: number): number {
  if (value < min) return min;
  if (value > max) return max;
  return value;
}

function getRollRule(positiveCount: number, hasNegative: boolean): RivenRollRule | null {
  const key = `${positiveCount}-${hasNegative ? 1 : 0}`;
  return RIVEN_ROLL_RULES[key] ?? null;
}

export const RIVEN_DISPOSITION_MIN = 0.5;
export const RIVEN_DISPOSITION_MAX = 1.55;

export function clampDisposition(disposition: number): number {
  return clamp(disposition, RIVEN_DISPOSITION_MIN, RIVEN_DISPOSITION_MAX);
}

function isFlatRivenStat(stat: string): boolean {
  return stat === 'Range' || stat === 'Initial Combo' || stat === 'Punch Through';
}

export function getRivenStatBounds(
  stat: string,
  weaponType: RivenWeaponType,
  disposition: number,
  isNegative: boolean,
  rollRule: RivenRollRule,
): { min: number; max: number } | null {
  const base = getRivenBaselineValue(stat, weaponType);
  if (base == null) return null;
  const d = clampDisposition(disposition);

  if (isFactionRivenStat(stat)) {
    if (isNegative) {
      if (rollRule.negativeMultiplier <= 0) return null;
      const mag = rollRule.negativeMultiplier;
      const fMax = base * d * 1.1 * mag;
      const fMin = base * d * 0.9 * mag;
      const multLo = 1 - fMax;
      const multHi = 1 - fMin;
      return { min: -multHi, max: -multLo };
    }
    const pos = rollRule.positiveMultiplier;
    const fMin = base * d * 0.9 * pos;
    const fMax = base * d * 1.1 * pos;
    return { min: 1 + fMin, max: 1 + fMax };
  }

  if (isNegative) {
    if (rollRule.negativeMultiplier <= 0) return null;
    const mag = rollRule.negativeMultiplier;
    const maxAbs = base * d * 1.1 * mag;
    const minAbs = base * d * 0.9 * mag;
    return { min: -maxAbs, max: -minAbs };
  }

  const pos = rollRule.positiveMultiplier;
  const max = base * d * 1.1 * pos;
  const min = base * d * 0.9 * pos;
  if (!isFlatRivenStat(stat)) {
    return { min, max };
  }
  return { min, max };
}

export interface RivenResolveContext {
  weaponType: RivenWeaponType;
  disposition: number;
  manualRank?: number | null;
  assumeValuesAreMaxRank?: boolean;
}

export interface RivenResolveResult {
  config: RivenConfig;
  rank: number;
  adjusted: boolean;
  warnings: string[];
  needsManualRank: boolean;
}

export function resolveRivenConfig(
  config: RivenConfig,
  ctx: RivenResolveContext,
): RivenResolveResult {
  const warnings: string[] = [];
  const normalized = normalizeRivenConfigMembership(config);
  const positives = normalized.positive.filter((s) => s.stat.trim() !== '');
  const hasNegative = Boolean(normalized.negative?.stat);
  const rollRule = getRollRule(positives.length, hasNegative);

  if (!rollRule) {
    warnings.push(
      'Could not determine riven roll type (need 2–3 positives and valid curse layout).',
    );
    return {
      config: normalized,
      rank: normalized.rivenRank ?? 8,
      adjusted: false,
      warnings,
      needsManualRank: false,
    };
  }

  const disp = Number.isFinite(ctx.disposition) ? ctx.disposition : 1;
  const assumeMax = ctx.assumeValuesAreMaxRank !== false;
  let adjusted = false;

  const toMaxRankMag = (absInput: number): number => {
    if (assumeMax) return absInput;
    const r = ctx.manualRank ?? normalized.rivenRank ?? 8;
    const slotR = clamp(Math.round(r), 0, 8);
    return absInput * (9 / (slotR + 1));
  };

  const adjustedPositives = positives.map((stat) => {
    const originalAbs = Math.abs(stat.value);
    const scaled = toMaxRankMag(originalAbs);
    const bounds = getRivenStatBounds(stat.stat, ctx.weaponType, disp, false, rollRule);
    let nextAbs = scaled;
    if (bounds) {
      nextAbs = clamp(scaled, bounds.min, bounds.max);
      if (Math.abs(nextAbs - scaled) > 1e-6) {
        warnings.push(
          `${stat.stat}: ${originalAbs.toFixed(1)} exceeds the allowed ${bounds.min.toFixed(1)}–${bounds.max.toFixed(1)} range at disposition ${disp.toFixed(2)} (wiki-style bounds for this roll).`,
        );
      }
    }
    const nextValue = toOneDecimal(nextAbs);
    if (nextValue !== toOneDecimal(originalAbs) || stat.value < 0) adjusted = true;
    return { ...stat, value: nextValue, isNegative: false };
  });

  let adjustedNegative: RivenStat | undefined;
  if (normalized.negative?.stat) {
    const originalAbs = Math.abs(normalized.negative.value);
    const scaled = toMaxRankMag(originalAbs);
    const bounds = getRivenStatBounds(
      normalized.negative.stat,
      ctx.weaponType,
      disp,
      true,
      rollRule,
    );
    let nextAbs = scaled;
    if (bounds) {
      const a = Math.abs(bounds.min);
      const b = Math.abs(bounds.max);
      const lo = Math.min(a, b);
      const hi = Math.max(a, b);
      nextAbs = clamp(scaled, lo, hi);
      if (Math.abs(nextAbs - scaled) > 1e-6) {
        warnings.push(
          `${normalized.negative.stat}: curse magnitude ${originalAbs.toFixed(1)} exceeds the allowed ${lo.toFixed(1)}–${hi.toFixed(1)} at disposition ${disp.toFixed(2)} (stronger curses need higher disposition).`,
        );
      }
    }
    const nextValue = -toOneDecimal(nextAbs);
    if (nextValue !== -toOneDecimal(originalAbs) || normalized.negative.value > 0) adjusted = true;
    adjustedNegative = {
      ...normalized.negative,
      value: nextValue,
      isNegative: true,
    };
  }

  let rank = 8;
  if (!assumeMax) {
    const mr = ctx.manualRank ?? normalized.rivenRank;
    if (mr != null && !Number.isNaN(mr)) {
      rank = clamp(Math.round(mr), 0, 8);
    } else {
      warnings.push('Choose mod rank (0–8) when entering values at less than max rank.');
      rank = 8;
    }
  } else if (normalized.rivenRank != null) {
    rank = clamp(Math.round(normalized.rivenRank), 0, 8);
  }

  const inferredRanks: number[] = [];
  for (const s of adjustedPositives) {
    if (isFactionRivenStat(s.stat)) continue;
    const bounds = getRivenStatBounds(s.stat, ctx.weaponType, disp, false, rollRule);
    if (!bounds || bounds.max <= 0) continue;
    inferredRanks.push(9 * (Math.abs(s.value) / bounds.max) - 1);
  }
  if (adjustedNegative?.stat && !isFactionRivenStat(adjustedNegative.stat)) {
    const bounds = getRivenStatBounds(adjustedNegative.stat, ctx.weaponType, disp, true, rollRule);
    if (bounds && bounds.min < 0) {
      const maxAbs = Math.abs(bounds.min);
      if (maxAbs > 0) {
        inferredRanks.push(9 * (Math.abs(adjustedNegative.value) / maxAbs) - 1);
      }
    }
  }

  let needsManualRank = false;
  if (assumeMax && inferredRanks.length >= 2) {
    const spread = Math.max(...inferredRanks) - Math.min(...inferredRanks);
    if (spread > 1.5) {
      warnings.push(
        'These values do not match a single mod rank at this disposition (spread > 1.5 ranks).',
      );
    }
  }

  const outConfig: RivenConfig = {
    ...config,
    polarity: normalized.polarity,
    positive: adjustedPositives,
    negative: adjustedNegative,
    rivenRank: rank,
  };

  return {
    config: outConfig,
    rank,
    adjusted,
    warnings,
    needsManualRank,
  };
}

export function verifyAndAdjustRivenConfig(
  config: RivenConfig,
  weaponType: RivenWeaponType,
  disposition: number = 1,
): { config: RivenConfig; adjusted: boolean } {
  const { config: resolved, adjusted } = resolveRivenConfig(config, {
    weaponType,
    disposition,
    assumeValuesAreMaxRank: true,
    manualRank: 8,
  });
  return { config: resolved, adjusted };
}

export function validateRivenConfig(config: RivenConfig): string | null {
  if (
    config.polarity !== 'AP_ATTACK' &&
    config.polarity !== 'AP_TACTIC' &&
    config.polarity !== 'AP_DEFENSE'
  ) {
    return 'Please select a valid Riven polarity.';
  }

  const validPositives = config.positive.filter((s) => s.stat.trim() !== '');
  if (validPositives.length < 2 || validPositives.length > 3) {
    return 'Riven requires 2 to 3 positive stats.';
  }

  const allStats = new Set<string>();
  for (const s of validPositives) {
    if (allStats.has(s.stat)) return 'Riven stats must be unique.';
    allStats.add(s.stat);
  }
  if (config.negative?.stat) {
    if (allStats.has(config.negative.stat))
      return 'Negative stat must be different from positive stats.';
  }
  return null;
}

function formatRivenMultiplierSegment(value: number): string {
  const m = Math.abs(value).toFixed(1).replace(/\.0$/, '');
  return `x${m}`;
}

export function formatRivenLine(stat: RivenStat): string {
  if (isFactionRivenStat(stat.stat)) {
    return `${formatRivenMultiplierSegment(stat.value)} ${stat.stat}`;
  }
  const magnitude = Math.abs(stat.value).toFixed(1).replace(/\.0$/, '');
  const sign = stat.isNegative ? '-' : '+';
  const isFlat =
    stat.stat === 'Range' || stat.stat === 'Initial Combo' || stat.stat === 'Punch Through';
  return `${sign}${magnitude}${isFlat ? '' : '%'} ${stat.stat}`;
}

export function buildRivenDescription(config: RivenConfig): string {
  const normalized = normalizeRivenConfigMembership(config);
  const lines: string[] = [];
  for (const positive of normalized.positive) {
    if (!positive.stat) continue;
    lines.push(formatRivenLine({ ...positive, isNegative: false }));
  }
  if (normalized.negative?.stat) {
    lines.push(formatRivenLine({ ...normalized.negative, isNegative: true }));
  }
  return lines.join('\n');
}

export function normalizeRivenConfigMembership(config: RivenConfig): RivenConfig {
  return {
    ...config,
    positive: (config.positive || []).map((stat) => ({
      ...stat,
      value: Math.abs(stat.value),
      isNegative: false,
    })),
    negative: config.negative
      ? {
          ...config.negative,
          value: -Math.abs(config.negative.value),
          isNegative: true,
        }
      : undefined,
  };
}

export function createRivenPlaceholderMod(imagePath?: string): Mod {
  return {
    unique_name: RIVEN_PLACEHOLDER_UNIQUE,
    name: 'Riven Mod',
    rarity: 'LEGENDARY',
    type: 'RIVEN',
    compat_name: 'RIVEN',
    base_drain: 0,
    fusion_limit: 0,
    description: JSON.stringify(['Place the mod to edit the perks']),
    image_path: imagePath,
  };
}

export function createRivenMod(config: RivenConfig, imagePath: string | undefined): Mod {
  const normalizedConfig = normalizeRivenConfigMembership(config);
  return {
    unique_name: RIVEN_MOD_UNIQUE,
    name: 'Riven Mod',
    rarity: 'LEGENDARY',
    type: 'RIVEN',
    compat_name: 'RIVEN',
    polarity: normalizedConfig.polarity ?? 'AP_ATTACK',
    base_drain: 18,
    fusion_limit: 8,
    description: JSON.stringify([buildRivenDescription(normalizedConfig)]),
    image_path: imagePath,
  };
}

export function isRivenMod(mod: Mod | undefined): boolean {
  return !!mod && mod.unique_name === RIVEN_MOD_UNIQUE;
}
