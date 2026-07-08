import {
  DAMAGE_TYPES,
  PRIMARY_ELEMENTS,
  type DamageType,
  type ModSlot,
  type PrimaryElement,
} from '../types/warframe';
import type { DamageEntry } from './elements';
import { resolveModRankDescriptionText } from './umbraSet';

const PHYSICAL_TYPES: DamageType[] = ['Impact', 'Puncture', 'Slash'];

const PHYSICAL_CONDITIONING_TARGETS: Record<string, DamageType> = {
  'Brute Conditioning': 'Impact',
  'Disabling Conditioning': 'Puncture',
  'Precision Conditioning': 'Slash',
};

const ELEMENTAL_CLAWS_TARGETS: Record<string, PrimaryElement> = {
  'Chilling Claws': 'Cold',
  'Burning Claws': 'Heat',
  'Sepsis Claws': 'Toxin',
  'Shocking Claws': 'Electricity',
};

export interface DamageConversions {
  physicalTarget?: DamageType;
  elementalTarget?: PrimaryElement;
}

function getSlotRank(slot: ModSlot): number {
  const currentRank = (slot as ModSlot & { currentRank?: number }).currentRank;
  if (typeof slot.rank === 'number') return slot.rank;
  if (typeof currentRank === 'number') return currentRank;
  return slot.mod?.fusion_limit ?? 0;
}

function parsePhysicalConversionTarget(text: string, modName: string): DamageType | null {
  const named = PHYSICAL_CONDITIONING_TARGETS[modName];
  if (named) return named;

  const match = text.match(
    /convert(?:ing|s)?\s+all\s+(?:base\s+)?physical\s+damage\s+(?:to|into)\s+(?:<[^>]+>\s*)?(impact|puncture|slash)/i,
  );
  if (!match) return null;

  const target = match[1];
  if (target.toLowerCase() === 'impact') return 'Impact';
  if (target.toLowerCase() === 'puncture') return 'Puncture';
  return 'Slash';
}

function parseElementalConversionTarget(text: string, modName: string): PrimaryElement | null {
  const named = ELEMENTAL_CLAWS_TARGETS[modName];
  if (named) return named;

  const match = text.match(
    /convert(?:ing|s)?\s+all\s+elemental\s+damage(?:\s+from\s+the\s+claws)?\s+(?:to|into)\s+(?:<[^>]+>\s*)?(heat|cold|electricity|toxin)/i,
  );
  if (!match) return null;

  const target = match[1].toLowerCase();
  if (target === 'heat') return 'Heat';
  if (target === 'cold') return 'Cold';
  if (target === 'electricity') return 'Electricity';
  return 'Toxin';
}

export function detectDamageConversions(slots: ModSlot[]): DamageConversions {
  const conversions: DamageConversions = {};

  for (const slot of slots) {
    if (!slot.mod || slot.type !== 'general') continue;

    const rank = getSlotRank(slot);
    const text = resolveModRankDescriptionText(slot.mod, rank);
    if (!text.trim()) continue;

    const physicalTarget = parsePhysicalConversionTarget(text, slot.mod.name);
    if (physicalTarget) {
      conversions.physicalTarget = physicalTarget;
    }

    const elementalTarget = parseElementalConversionTarget(text, slot.mod.name);
    if (elementalTarget) {
      conversions.elementalTarget = elementalTarget;
    }
  }

  return conversions;
}

export function padDamageArray(base: number[]): number[] {
  return base.length >= DAMAGE_TYPES.length
    ? [...base]
    : [...base, ...Array.from({ length: DAMAGE_TYPES.length - base.length }, () => 0)];
}

export function applyMultipliersToBaseDamage(
  base: number[],
  multipliers: Partial<Record<DamageType, number>>,
): number[] {
  const copy = padDamageArray(base);

  for (let i = 0; i < DAMAGE_TYPES.length; i++) {
    const type = DAMAGE_TYPES[i];
    const mult = multipliers[type];
    if (mult && copy[i] > 0) {
      copy[i] *= 1 + mult;
    }
  }

  return copy;
}

export function applyPhysicalConversionToBase(base: number[], target?: DamageType): number[] {
  if (!target || !PHYSICAL_TYPES.includes(target)) return base;

  const copy = padDamageArray(base);
  const targetIdx = DAMAGE_TYPES.indexOf(target);
  let total = 0;

  for (const type of PHYSICAL_TYPES) {
    const idx = DAMAGE_TYPES.indexOf(type);
    total += copy[idx] || 0;
    copy[idx] = 0;
  }

  copy[targetIdx] = (copy[targetIdx] || 0) + total;
  return copy;
}

export function applyPrimaryElementConversionToBase(
  base: number[],
  target?: PrimaryElement,
): number[] {
  if (!target) return base;

  const copy = padDamageArray(base);
  const targetIdx = DAMAGE_TYPES.indexOf(target);
  let total = 0;

  for (const element of PRIMARY_ELEMENTS) {
    const idx = DAMAGE_TYPES.indexOf(element);
    total += copy[idx] || 0;
    copy[idx] = 0;
  }

  copy[targetIdx] = (copy[targetIdx] || 0) + total;
  return copy;
}

export function prepareBaseDamageForCalculation(
  base: number[],
  multipliers: Partial<Record<DamageType, number>>,
  conversions: DamageConversions,
): number[] {
  let working = applyMultipliersToBaseDamage(base, multipliers);
  working = applyPhysicalConversionToBase(working, conversions.physicalTarget);
  working = applyPrimaryElementConversionToBase(working, conversions.elementalTarget);
  return working;
}

export function applyPhysicalConversion(
  breakdown: DamageEntry[],
  target: DamageType,
): DamageEntry[] {
  if (!PHYSICAL_TYPES.includes(target)) return breakdown;

  let physicalTotal = 0;
  const remaining: DamageEntry[] = [];

  for (const entry of breakdown) {
    if (PHYSICAL_TYPES.includes(entry.type)) {
      physicalTotal += entry.value;
    } else {
      remaining.push(entry);
    }
  }

  if (physicalTotal <= 0) return breakdown;

  const existing = remaining.find((entry) => entry.type === target);
  if (existing) {
    existing.value += physicalTotal;
  } else {
    remaining.push({ type: target, value: physicalTotal });
  }

  return remaining;
}

export function applyPrimaryElementConversion(
  breakdown: DamageEntry[],
  target: PrimaryElement,
): DamageEntry[] {
  if (!PRIMARY_ELEMENTS.includes(target)) return breakdown;

  let primaryTotal = 0;
  const remaining: DamageEntry[] = [];

  for (const entry of breakdown) {
    if (PRIMARY_ELEMENTS.includes(entry.type as PrimaryElement)) {
      primaryTotal += entry.value;
    } else {
      remaining.push(entry);
    }
  }

  if (primaryTotal <= 0) return breakdown;

  const existing = remaining.find((entry) => entry.type === target);
  if (existing) {
    existing.value += primaryTotal;
  } else {
    remaining.push({ type: target, value: primaryTotal });
  }

  return remaining;
}

export function applyDamageConversions(
  breakdown: DamageEntry[],
  conversions: DamageConversions,
): DamageEntry[] {
  let result = breakdown;

  if (conversions.physicalTarget) {
    result = applyPhysicalConversion(result, conversions.physicalTarget);
  }

  if (conversions.elementalTarget) {
    result = applyPrimaryElementConversion(result, conversions.elementalTarget);
  }

  return result.map((entry) => ({
    type: entry.type,
    value: Math.round(entry.value * 10) / 10,
  }));
}
