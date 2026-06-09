import {
  AP_ANY,
  AP_UMBRA,
  REGULAR_POLARITIES,
  type EquipmentType,
  type SlotType,
} from '../types/warframe';
import { supportsUmbraForma } from './formaPolarityRules';

export interface FormaCount {
  regular: number;
  universal: number;
  umbra: number;
  stance: number;
  total: number;
}

export interface SlotPolarity {
  polarity: string | undefined;
  type: SlotType;
}

export interface FormaCountOptions {
  equipmentType?: EquipmentType;
  equipmentName?: string | null;
}

function countMultiset(polarities: (string | undefined)[]): Map<string, number> {
  const counts = new Map<string, number>();
  for (const p of polarities) {
    if (p) {
      counts.set(p, (counts.get(p) || 0) + 1);
    }
  }
  return counts;
}

function polarityForFormaCount(
  slot: SlotPolarity,
  equipmentType: EquipmentType | undefined,
  equipmentName: string | null | undefined,
): string | undefined {
  if (!slot.polarity) return undefined;
  if (
    slot.polarity === AP_UMBRA &&
    (slot.type !== 'general' || !equipmentType || !supportsUmbraForma(equipmentType, equipmentName))
  ) {
    return undefined;
  }
  return slot.polarity;
}

function stanceSlotFormaCost(
  defaultPolarity: string | undefined,
  desiredPolarity: string | undefined,
): Pick<FormaCount, 'regular' | 'stance'> {
  if (defaultPolarity === desiredPolarity) {
    return { regular: 0, stance: 0 };
  }
  if (!desiredPolarity) {
    return { regular: 0, stance: 0 };
  }
  if (desiredPolarity === AP_ANY) {
    return { regular: 0, stance: 1 };
  }
  return { regular: 1, stance: 0 };
}

function calculateNormalSlotFormaCount(
  defaults: SlotPolarity[],
  desired: SlotPolarity[],
  equipmentType: EquipmentType | undefined,
  equipmentName: string | null | undefined,
): Pick<FormaCount, 'regular' | 'universal' | 'umbra'> {
  const defaultPolarities = defaults.map((slot) =>
    polarityForFormaCount(slot, equipmentType, equipmentName),
  );
  const desiredPolarities = desired.map((slot) =>
    polarityForFormaCount(slot, equipmentType, equipmentName),
  );

  const defaultCounts = countMultiset(defaultPolarities);
  const desiredCounts = countMultiset(desiredPolarities);

  let totalReused = 0;
  const allKeys = new Set([...defaultCounts.keys(), ...desiredCounts.keys()]);

  for (const key of allKeys) {
    const def = defaultCounts.get(key) || 0;
    const des = desiredCounts.get(key) || 0;
    totalReused += Math.min(def, des);
  }

  let totalDefaults = 0;
  for (const v of defaultCounts.values()) totalDefaults += v;

  const unmatchedDefaults = totalDefaults - totalReused;

  let unmatchedRegular = 0;
  for (const pol of REGULAR_POLARITIES) {
    const def = defaultCounts.get(pol) || 0;
    const des = desiredCounts.get(pol) || 0;
    unmatchedRegular += Math.max(0, des - def);
  }

  const unmatchedUmbra = Math.max(
    0,
    (desiredCounts.get(AP_UMBRA) || 0) - (defaultCounts.get(AP_UMBRA) || 0),
  );

  const totalNewUniversal = Math.max(
    0,
    (desiredCounts.get(AP_ANY) || 0) - (defaultCounts.get(AP_ANY) || 0),
  );

  const excessClears = Math.max(
    0,
    unmatchedDefaults - unmatchedRegular - totalNewUniversal - unmatchedUmbra,
  );

  return {
    regular: unmatchedRegular + excessClears,
    universal: totalNewUniversal,
    umbra: unmatchedUmbra,
  };
}

export function calculateFormaCount(
  defaults: SlotPolarity[],
  desired: SlotPolarity[],
  options: FormaCountOptions = {},
): FormaCount {
  const equipmentType = options.equipmentType;
  const equipmentName = options.equipmentName;
  let regular = 0;
  let universal = 0;
  let umbra = 0;
  let stance = 0;

  const normalDefaults: SlotPolarity[] = [];
  const normalDesired: SlotPolarity[] = [];

  const slotCount = Math.max(defaults.length, desired.length);
  for (let i = 0; i < slotCount; i += 1) {
    const defaultSlot = defaults[i];
    const desiredSlot = desired[i];
    if (!defaultSlot || !desiredSlot) continue;

    if (defaultSlot.type === 'posture') {
      continue;
    }

    if (defaultSlot.type === 'stance') {
      const slotCost = stanceSlotFormaCost(defaultSlot.polarity, desiredSlot.polarity);
      regular += slotCost.regular;
      stance += slotCost.stance;
      continue;
    }

    normalDefaults.push(defaultSlot);
    normalDesired.push(desiredSlot);
  }

  const normalCost = calculateNormalSlotFormaCount(
    normalDefaults,
    normalDesired,
    equipmentType,
    equipmentName,
  );
  regular += normalCost.regular;
  universal += normalCost.universal;
  umbra += normalCost.umbra;

  return {
    regular,
    universal,
    umbra,
    stance,
    total: regular + universal + umbra + stance,
  };
}
