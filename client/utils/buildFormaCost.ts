import {
  EQUIPMENT_SLOT_CONFIGS,
  POLARITIES,
  type EquipmentType,
  type PolarityKey,
  type StoredBuild,
} from '../types/warframe';
import { calculateFormaCount, type FormaCount, type SlotPolarity } from './formaCounter';
import type { EquipmentPolaritySource } from './loadEquipmentLookup';
import { weaponOmitsExilusSlot } from './specialItems';

function getPolarizedSlotCount(build: StoredBuild): number {
  const slots = Array.isArray(build.slots) ? build.slots : [];
  return slots.reduce((count, slot) => count + (typeof slot.polarity === 'string' ? 1 : 0), 0);
}

function buildDefaultPolarities(
  equipmentType: EquipmentType,
  equipment: EquipmentPolaritySource,
  equipmentName?: string,
): SlotPolarity[] {
  const config = EQUIPMENT_SLOT_CONFIGS[equipmentType] || EQUIPMENT_SLOT_CONFIGS.warframe;
  const defaults: SlotPolarity[] = [];

  const artifactSlots: string[] = (() => {
    try {
      return equipment.artifact_slots ? JSON.parse(equipment.artifact_slots) : [];
    } catch {
      return [];
    }
  })();

  const polarityFromAP = (ap: string | undefined): string | undefined => {
    if (!ap || ap === 'AP_UNIVERSAL') return undefined;
    return (POLARITIES as Record<string, string>)[ap as PolarityKey] ? ap : undefined;
  };

  const hasArtifactSlots = artifactSlots.length > 0;

  if (config.hasAura) {
    const polarity = hasArtifactSlots
      ? polarityFromAP(artifactSlots[8])
      : equipment.aura_polarity || undefined;
    defaults.push({ type: 'aura', polarity });
  }
  if (config.hasStance) {
    const polarity = hasArtifactSlots ? polarityFromAP(artifactSlots[8]) : undefined;
    defaults.push({ type: 'stance', polarity });
  }
  if (config.hasPosture) {
    const polarity = hasArtifactSlots ? polarityFromAP(artifactSlots[8]) : undefined;
    defaults.push({ type: 'posture', polarity });
  }

  const generalPolarities: (string | undefined)[] = (() => {
    if (hasArtifactSlots) {
      return artifactSlots.slice(0, config.generalSlots).reverse().map(polarityFromAP);
    }
    try {
      const parsed = equipment.polarities ? JSON.parse(equipment.polarities) : [];
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  })();

  for (let i = 0; i < config.generalSlots; i += 1) {
    defaults.push({ type: 'general', polarity: generalPolarities[i] });
  }

  const skipExilus = weaponOmitsExilusSlot(equipmentName, equipmentType);

  if (config.hasExilus && !skipExilus) {
    const polarity = hasArtifactSlots
      ? polarityFromAP(artifactSlots[9])
      : equipment.exilus_polarity || undefined;
    defaults.push({ type: 'exilus', polarity });
  }

  return defaults;
}

export function getUsedFormaCost(
  build: StoredBuild,
  equipmentLookup: Record<string, EquipmentPolaritySource>,
): FormaCount {
  const equipment = equipmentLookup[build.equipment_unique_name];
  if (!equipment) {
    const fallback = getPolarizedSlotCount(build);
    return {
      regular: fallback,
      universal: 0,
      umbra: 0,
      stance: 0,
      total: fallback,
    };
  }

  const defaults = buildDefaultPolarities(build.equipment_type, equipment, build.equipment_name);
  const desired: SlotPolarity[] = (Array.isArray(build.slots) ? build.slots : []).map((slot) => ({
    type: slot.type,
    polarity: slot.polarity,
  }));

  return calculateFormaCount(defaults, desired);
}
