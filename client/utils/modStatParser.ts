import type { Mod, ModSlot } from '../types/warframe';
import { isRivenMod } from './riven';
import {
  countEquippedUmbraSetMods,
  getUmbraSetMultiplier,
  isUmbraSelfScalingSetMod,
  resolveModRankDescriptionText,
} from './umbraSet';

export interface AggregateOptions {
  rivenDispositionMultiplier?: number;
}

export interface StatEffects {
  baseDamage: number;
  multishot: number;
  critChance: number;
  critMultiplier: number;
  fireRate: number;
  magazineCapacity: number;
  reloadSpeed: number;
  statusChance: number;
  statusDuration: number;
  impactDamage: number;
  punctureDamage: number;
  slashDamage: number;
  factionDamage: number;
  toxinDamage: number;
  heatDamage: number;
  coldDamage: number;
  electricityDamage: number;
  health: number;
  shield: number;
  armor: number;
  energy: number;
  sprintSpeed: number;
  abilityStrength: number;
  abilityDuration: number;
  abilityEfficiency: number;
  abilityRange: number;
  healthFlat: number;
  shieldFlat: number;
  armorFlat: number;
  energyFlat: number;
}

function emptyEffects(): StatEffects {
  return {
    baseDamage: 0,
    multishot: 0,
    critChance: 0,
    critMultiplier: 0,
    fireRate: 0,
    magazineCapacity: 0,
    reloadSpeed: 0,
    statusChance: 0,
    statusDuration: 0,
    impactDamage: 0,
    punctureDamage: 0,
    slashDamage: 0,
    factionDamage: 0,
    toxinDamage: 0,
    heatDamage: 0,
    coldDamage: 0,
    electricityDamage: 0,
    health: 0,
    shield: 0,
    armor: 0,
    energy: 0,
    sprintSpeed: 0,
    abilityStrength: 0,
    abilityDuration: 0,
    abilityEfficiency: 0,
    abilityRange: 0,
    healthFlat: 0,
    shieldFlat: 0,
    armorFlat: 0,
    energyFlat: 0,
  };
}

const STAT_PATTERNS: Array<{ regex: RegExp; key: keyof StatEffects }> = [
  { regex: /([+-][\d.]+)%\s+Damage(?!\s+to)(?:\s|$)/i, key: 'baseDamage' },
  { regex: /([+-][\d.]+)%\s+Melee Damage/i, key: 'baseDamage' },
  { regex: /([+-][\d.]+)%\s+Multishot/i, key: 'multishot' },
  { regex: /([+-][\d.]+)%\s+Critical Chance/i, key: 'critChance' },
  { regex: /([+-][\d.]+)%\s+Critical Damage/i, key: 'critMultiplier' },
  { regex: /([+-][\d.]+)%\s+Fire Rate/i, key: 'fireRate' },
  { regex: /([+-][\d.]+)%\s+Attack Speed/i, key: 'fireRate' },
  { regex: /([+-][\d.]+)%\s+Magazine Capacity/i, key: 'magazineCapacity' },
  { regex: /([+-][\d.]+)%\s+Reload Speed/i, key: 'reloadSpeed' },
  { regex: /([+-][\d.]+)%\s+Status Chance/i, key: 'statusChance' },
  { regex: /([+-][\d.]+)%\s+Status Duration/i, key: 'statusDuration' },
  { regex: /([+-][\d.]+)%\s+(?:<[^>]+>)?Impact/i, key: 'impactDamage' },
  { regex: /([+-][\d.]+)%\s+(?:<[^>]+>)?Puncture/i, key: 'punctureDamage' },
  { regex: /([+-][\d.]+)%\s+(?:<[^>]+>)?Slash/i, key: 'slashDamage' },
  { regex: /([+-][\d.]+)%\s+(?:<[^>]+>)?Heat/i, key: 'heatDamage' },
  { regex: /([+-][\d.]+)%\s+(?:<[^>]+>)?Cold/i, key: 'coldDamage' },
  {
    regex: /([+-][\d.]+)%\s+(?:<[^>]+>)?Electricity/i,
    key: 'electricityDamage',
  },
  { regex: /([+-][\d.]+)%\s+(?:<[^>]+>)?Toxin/i, key: 'toxinDamage' },
  { regex: /([+-][\d.]+)%\s+Damage to \w+/i, key: 'factionDamage' },
  { regex: /([+-][\d.]+)%\s+Health/i, key: 'health' },
  { regex: /([+-][\d.]+)%\s+Shield Capacity/i, key: 'shield' },
  { regex: /([+-][\d.]+)%\s+Armor/i, key: 'armor' },
  { regex: /([+-][\d.]+)%\s+Energy(?:\s+Max)?/i, key: 'energy' },
  { regex: /([+-][\d.]+)%\s+Sprint Speed/i, key: 'sprintSpeed' },
  { regex: /([+-][\d.]+)%\s+Ability Strength/i, key: 'abilityStrength' },
  { regex: /([+-][\d.]+)%\s+Ability Duration/i, key: 'abilityDuration' },
  { regex: /([+-][\d.]+)%\s+Ability Efficiency/i, key: 'abilityEfficiency' },
  { regex: /([+-][\d.]+)%\s+Ability Range/i, key: 'abilityRange' },
];

const FLAT_STAT_PATTERNS: Array<{
  regex: RegExp;
  key: 'healthFlat' | 'shieldFlat' | 'armorFlat' | 'energyFlat';
}> = [
  { regex: /\+(\d+(?:\.\d+)?)\s+Health\b/i, key: 'healthFlat' },
  { regex: /\+(\d+(?:\.\d+)?)\s+Shield(?:\s+Capacity)?\b/i, key: 'shieldFlat' },
  { regex: /\+(\d+(?:\.\d+)?)\s+Armor\b/i, key: 'armorFlat' },
  { regex: /\+(\d+(?:\.\d+)?)\s+(?:Max\s+)?Energy\b/i, key: 'energyFlat' },
];

export interface ParseModEffectsOptions {
  umbraSetEquippedCount?: number;
}

function applyStatLineToEffects(line: string, effects: StatEffects): void {
  for (const { regex, key } of STAT_PATTERNS) {
    const match = line.match(regex);
    if (match) {
      effects[key] += parseFloat(match[1]) / 100;
      return;
    }
  }
  for (const { regex, key } of FLAT_STAT_PATTERNS) {
    const match = line.match(regex);
    if (match) {
      effects[key] += parseFloat(match[1]);
      return;
    }
  }
}

export function parseModEffects(
  mod: Mod,
  rank: number,
  options?: ParseModEffectsOptions,
): StatEffects {
  const effects = emptyEffects();

  if (mod.description) {
    const text = resolveModRankDescriptionText(mod, rank);
    if (!text.trim()) return effects;

    for (const line of text.split('\n')) {
      applyStatLineToEffects(line, effects);
    }
  }

  if (isUmbraSelfScalingSetMod(mod) && options?.umbraSetEquippedCount != null) {
    const multiplier = getUmbraSetMultiplier(mod, options.umbraSetEquippedCount);
    if (multiplier > 1) {
      for (const key of Object.keys(effects) as (keyof StatEffects)[]) {
        effects[key] *= multiplier;
      }
    }
  }

  if (isRivenMod(mod)) {
    const rivenCap = mod.fusion_limit ?? 8;
    const r = Math.min(Math.max(rank, 0), rivenCap);
    const scale = (r + 1) / (rivenCap + 1);
    for (const key of Object.keys(effects) as (keyof StatEffects)[]) {
      effects[key] *= scale;
    }
  }

  return effects;
}

export function aggregateAllMods(slots: ModSlot[], _options?: AggregateOptions): StatEffects {
  void _options;
  const total = emptyEffects();
  const umbraSetEquippedCount = countEquippedUmbraSetMods(slots);

  for (const slot of slots) {
    if (!slot.mod) continue;
    const rank = slot.rank ?? slot.mod.fusion_limit ?? 0;
    const effects = parseModEffects(slot.mod, rank, { umbraSetEquippedCount });
    for (const key of Object.keys(total) as (keyof StatEffects)[]) {
      total[key] += effects[key];
    }
  }

  return total;
}
