import {
  isArtifactSlotDisabled,
  isArtifactSlotVisible,
  isWarframeSecondAuraSlotActive,
  hasMeaningfulArtifactSlotOverrides,
  normalizeWarframeArtifactSlotsForLoad,
  warframeExilusArtifactIndex,
} from '../../shared/artifactSlotState.js';
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

  const artifactSlotsRaw: string[] = (() => {
    try {
      return equipment.artifact_slots ? JSON.parse(equipment.artifact_slots) : [];
    } catch {
      return [];
    }
  })();
  const artifactSlots =
    equipmentType === 'warframe'
      ? normalizeWarframeArtifactSlotsForLoad(artifactSlotsRaw, config.generalSlots)
      : artifactSlotsRaw;

  const polarityFromAP = (ap: string | undefined): string | undefined => {
    if (!ap || ap === 'AP_UNIVERSAL' || isArtifactSlotDisabled(ap)) return undefined;
    return (POLARITIES as Record<string, string>)[ap as PolarityKey] ? ap : undefined;
  };

  const hasArtifactSlotOverrides = hasMeaningfulArtifactSlotOverrides(artifactSlotsRaw);
  const specialSlotIndex = config.generalSlots;

  if (
    config.hasAura &&
    isArtifactSlotVisible(artifactSlots, specialSlotIndex, hasArtifactSlotOverrides)
  ) {
    const polarity = hasArtifactSlotOverrides
      ? polarityFromAP(artifactSlots[specialSlotIndex])
      : equipment.aura_polarity || undefined;
    defaults.push({ type: 'aura', polarity });
  }
  if (
    equipmentType === 'warframe' &&
    isWarframeSecondAuraSlotActive(artifactSlotsRaw, config.generalSlots)
  ) {
    const polarity = polarityFromAP(artifactSlots[specialSlotIndex + 1]);
    defaults.push({ type: 'aura', polarity });
  }
  if (
    config.hasStance &&
    isArtifactSlotVisible(artifactSlots, specialSlotIndex, hasArtifactSlotOverrides)
  ) {
    const polarity = hasArtifactSlotOverrides
      ? polarityFromAP(artifactSlots[specialSlotIndex])
      : undefined;
    defaults.push({ type: 'stance', polarity });
  }
  if (
    config.hasPosture &&
    isArtifactSlotVisible(artifactSlots, specialSlotIndex, hasArtifactSlotOverrides)
  ) {
    const polarity = hasArtifactSlotOverrides
      ? polarityFromAP(artifactSlots[specialSlotIndex])
      : undefined;
    defaults.push({ type: 'posture', polarity });
  }

  const legacyGeneralPolarities: (string | undefined)[] = (() => {
    if (hasArtifactSlotOverrides) return [];
    try {
      const parsed = equipment.polarities ? JSON.parse(equipment.polarities) : [];
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  })();

  for (let i = 0; i < config.generalSlots; i += 1) {
    const artifactIndex = config.generalSlots - 1 - i;
    if (hasArtifactSlotOverrides && !isArtifactSlotVisible(artifactSlots, artifactIndex, true)) {
      continue;
    }
    const polarity = hasArtifactSlotOverrides
      ? polarityFromAP(artifactSlots[artifactIndex])
      : legacyGeneralPolarities[i];
    defaults.push({ type: 'general', polarity });
  }

  const skipExilus = weaponOmitsExilusSlot(equipmentName, equipmentType);
  const exilusArtifactIndex =
    equipmentType === 'warframe'
      ? warframeExilusArtifactIndex(artifactSlotsRaw, config.generalSlots)
      : config.generalSlots + 1;

  if (
    config.hasExilus &&
    !skipExilus &&
    isArtifactSlotVisible(artifactSlots, exilusArtifactIndex, hasArtifactSlotOverrides)
  ) {
    const polarity = hasArtifactSlotOverrides
      ? polarityFromAP(artifactSlots[exilusArtifactIndex])
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
