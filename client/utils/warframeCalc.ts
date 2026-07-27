import { scaleWarframeStatsToMaxRank } from '../../shared/equipmentRankStats.js';
import type { ModSlot } from '../types/warframe';
import { aggregateAllMods } from './modStatParser';

export interface StatPair {
  base: number;
  modded: number;
}

export interface WarframeCalcResult {
  health: StatPair;
  shield: StatPair;
  armor: StatPair;
  energy: StatPair;
  sprintSpeed: StatPair;
  abilityStrength: StatPair;
  abilityDuration: StatPair;
  abilityEfficiency: StatPair;
  abilityRange: StatPair;
}

export interface WarframeBonusEffects {
  healthFlat?: number;
  healthPct?: number;
  shieldFlat?: number;
  shieldPct?: number;
  armorFlat?: number;
  armorPct?: number;
  energyFlat?: number;
  energyPct?: number;
  sprintSpeedFlat?: number;
  sprintSpeedPct?: number;
  abilityStrengthPct?: number;
  abilityDurationPct?: number;
  abilityEfficiencyPct?: number;
  abilityRangePct?: number;
}

/** Minimal shape for warframe / companion avatar stat scaling and modding. */
export interface AvatarStatsEntity {
  unique_name: string;
  health?: number;
  shield?: number;
  armor?: number;
  power?: number;
  sprint_speed?: number;
  product_category?: string;
}

export function getWarframeBaseStatsAtMaxRank(warframe: AvatarStatsEntity) {
  return scaleWarframeStatsToMaxRank(warframe);
}

export function calculateWarframeStats(
  warframe: AvatarStatsEntity,
  slots: ModSlot[],
  bonus?: WarframeBonusEffects,
): WarframeCalcResult {
  const baseStats = getWarframeBaseStatsAtMaxRank(warframe);
  const mods = aggregateAllMods(slots);

  const apply = (base: number, mult: number, bonusPct = 0, bonusFlat = 0): StatPair => ({
    base,
    modded: base * (1 + mult + bonusPct) + bonusFlat,
  });

  const applyPercent = (basePct: number, addPct: number, bonusPct = 0): StatPair => ({
    base: basePct,
    modded: basePct + (addPct + bonusPct) * 100,
  });

  return {
    health: apply(
      baseStats.health,
      mods.health,
      bonus?.healthPct,
      (bonus?.healthFlat ?? 0) + (mods.healthFlat ?? 0),
    ),
    shield: apply(
      baseStats.shield,
      mods.shield,
      bonus?.shieldPct,
      (bonus?.shieldFlat ?? 0) + (mods.shieldFlat ?? 0),
    ),
    armor: apply(
      baseStats.armor,
      mods.armor,
      bonus?.armorPct,
      (bonus?.armorFlat ?? 0) + (mods.armorFlat ?? 0),
    ),
    energy: apply(
      baseStats.power,
      mods.energy,
      bonus?.energyPct,
      (bonus?.energyFlat ?? 0) + (mods.energyFlat ?? 0),
    ),
    sprintSpeed: apply(
      warframe.sprint_speed ?? 1,
      mods.sprintSpeed,
      bonus?.sprintSpeedPct,
      bonus?.sprintSpeedFlat,
    ),
    abilityStrength: applyPercent(100, mods.abilityStrength, bonus?.abilityStrengthPct),
    abilityDuration: applyPercent(100, mods.abilityDuration, bonus?.abilityDurationPct),
    abilityEfficiency: applyPercent(100, mods.abilityEfficiency, bonus?.abilityEfficiencyPct),
    abilityRange: applyPercent(100, mods.abilityRange, bonus?.abilityRangePct),
  };
}
