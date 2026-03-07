import type {
  EquipmentType,
  Mod,
  RivenConfig,
  RivenStat,
  RivenWeaponType,
} from '../types/warframe';

export const RIVEN_PLACEHOLDER_UNIQUE = '__RIVEN_PLACEHOLDER__';
export const RIVEN_MOD_UNIQUE = '__RIVEN_MOD__';

type BaselineMap = Record<string, number>;
type RivenRollRule = {
  positiveMultiplier: number;
  negativeMultiplier: number;
};

const PRIMARY_BASELINES = {
  Damage: 165,
  Multishot: 99,
  'Critical Chance': 149.9,
  'Critical Damage': 99.9,
  'Status Chance': 89.9,
  'Status Duration': 99.9,
  'Fire Rate': 59.9,
  'Magazine Capacity': 59.9,
  'Reload Speed': 59.9,
  'Ammo Maximum': 99.9,
  'Flight Speed': 89.9,
  Recoil: 89.9,
  Zoom: 44.9,
  Impact: 119.9,
  Puncture: 119.9,
  Slash: 119.9,
  Heat: 89.9,
  Cold: 89.9,
  Electricity: 89.9,
  Toxin: 89.9,
} as const satisfies BaselineMap;

const SECONDARY_BASELINES = {
  Damage: 220,
  Multishot: 120,
  'Critical Chance': 180,
  'Critical Damage': 120,
  'Status Chance': 120,
  'Status Duration': 120,
  'Fire Rate': 80,
  'Magazine Capacity': 60,
  'Reload Speed': 60,
  'Ammo Maximum': 120,
  'Flight Speed': 100,
  Recoil: 90,
  Zoom: 44.9,
  Impact: 120,
  Puncture: 120,
  Slash: 120,
  Heat: 90,
  Cold: 90,
  Electricity: 90,
  Toxin: 90,
} as const satisfies BaselineMap;

const MELEE_BASELINES = {
  Damage: 120,
  'Critical Chance': 180,
  'Critical Damage': 120,
  'Status Chance': 120,
  'Status Duration': 120,
  'Attack Speed': 60,
  Range: 1.5,
  'Combo Duration': 30,
  'Initial Combo': 20,
  'Slide Critical Chance': 120,
  'Finisher Damage': 120,
  Impact: 120,
  Puncture: 120,
  Slash: 120,
  Heat: 90,
  Cold: 90,
  Electricity: 90,
  Toxin: 90,
} as const satisfies BaselineMap;

const ARCHGUN_BASELINES = {
  ...PRIMARY_BASELINES,
  Damage: 140,
  Multishot: 80,
  'Critical Chance': 130,
  'Critical Damage': 90,
  'Fire Rate': 50,
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
): RivenWeaponType | null {
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

export function getRivenStatsForType(type: EquipmentType): string[] {
  const weaponType = getRivenWeaponType(type);
  if (!weaponType) return [];
  return Object.keys(BASELINES[weaponType]);
}

export function getRivenBaselineValue(
  stat: string,
  weaponType: RivenWeaponType,
): number | null {
  const baselineMap = BASELINES[weaponType] as BaselineMap;
  return baselineMap[stat] ?? null;
}

function toOneDecimal(value: number): number {
  return Math.round(value * 10) / 10;
}

function clamp(value: number, min: number, max: number): number {
  if (value < min) return min;
  if (value > max) return max;
  return value;
}

function getRollRule(
  positiveCount: number,
  hasNegative: boolean,
): RivenRollRule | null {
  const key = `${positiveCount}-${hasNegative ? 1 : 0}`;
  return RIVEN_ROLL_RULES[key] ?? null;
}

export function normalizeRivenValue(
  value: number,
  stat: string,
  weaponType: RivenWeaponType,
  isNegative: boolean,
): number {
  const baseline = getRivenBaselineValue(stat, weaponType);
  const absInput = Math.abs(value);
  const absNormalized = baseline == null ? absInput : baseline;
  const signed = isNegative ? -absNormalized : absNormalized;
  return toOneDecimal(signed);
}

export function verifyAndAdjustRivenConfig(
  config: RivenConfig,
  weaponType: RivenWeaponType,
): { config: RivenConfig; adjusted: boolean } {
  const positives = config.positive.filter((s) => s.stat.trim() !== '');
  const hasNegative = Boolean(config.negative?.stat);
  const rollRule = getRollRule(positives.length, hasNegative);

  let adjusted = false;
  const adjustedPositives = positives.map((stat) => {
    const baseline = getRivenBaselineValue(stat.stat, weaponType);
    const originalAbs = Math.abs(stat.value);
    let nextAbs = originalAbs;

    if (baseline != null && rollRule) {
      const target = baseline * rollRule.positiveMultiplier;
      const min = target * 0.9;
      const max = target * 1.1;
      nextAbs = clamp(originalAbs, min, max);
    }

    const nextValue = toOneDecimal(nextAbs);
    if (nextValue !== toOneDecimal(originalAbs) || stat.value < 0)
      adjusted = true;
    return { ...stat, value: nextValue, isNegative: false };
  });

  let adjustedNegative: RivenStat | undefined = undefined;
  if (config.negative?.stat) {
    const baseline = getRivenBaselineValue(config.negative.stat, weaponType);
    const originalAbs = Math.abs(config.negative.value);
    let nextAbs = originalAbs;

    if (baseline != null && rollRule && rollRule.negativeMultiplier > 0) {
      const target = baseline * rollRule.negativeMultiplier;
      const min = target * 0.9;
      const max = target * 1.1;
      nextAbs = clamp(originalAbs, min, max);
    }

    const nextValue = -toOneDecimal(nextAbs);
    if (nextValue !== -toOneDecimal(originalAbs) || config.negative.value > 0) {
      adjusted = true;
    }
    adjustedNegative = {
      ...config.negative,
      value: nextValue,
      isNegative: true,
    };
  }

  return {
    config: {
      ...config,
      positive: adjustedPositives,
      negative: adjustedNegative,
    },
    adjusted,
  };
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

export function formatRivenLine(stat: RivenStat): string {
  const magnitude = Math.abs(stat.value).toFixed(1).replace(/\.0$/, '');
  const sign = stat.isNegative ? '-' : '+';
  const isFlat = stat.stat === 'Range' || stat.stat === 'Initial Combo';
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

export function normalizeRivenConfigMembership(
  config: RivenConfig,
): RivenConfig {
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

export function createRivenMod(
  config: RivenConfig,
  imagePath: string | undefined,
): Mod {
  const normalizedConfig = normalizeRivenConfigMembership(config);
  return {
    unique_name: RIVEN_MOD_UNIQUE,
    name: 'Riven Mod',
    rarity: 'LEGENDARY',
    type: 'RIVEN',
    compat_name: 'RIVEN',
    polarity: normalizedConfig.polarity ?? 'AP_ATTACK',
    base_drain: 18,
    fusion_limit: 0,
    description: JSON.stringify([buildRivenDescription(normalizedConfig)]),
    image_path: imagePath,
  };
}

export function isRivenMod(mod: Mod | undefined): boolean {
  return !!mod && mod.unique_name === RIVEN_MOD_UNIQUE;
}
