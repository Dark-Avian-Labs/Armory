import {
  artifactSlotsStorageLength,
  EQUIPMENT_SLOT_CONFIGS,
  type EquipmentSlotConfig,
} from '../../shared/equipmentSlotConfig.js';
import { POLARITIES, type PolarityKey } from '../../shared/polarities.js';
import type { EquipmentType } from '../types/warframe';
import { weaponOmitsExilusSlot } from './specialItems';

export type ArtifactSlotPolarity = keyof typeof POLARITIES | 'AP_UNIVERSAL';

export interface ArtifactSlotEditorRow {
  id: string;
  label: string;
  artifactIndex: number;
  enabled: boolean;
  polarity: ArtifactSlotPolarity;
}

const VALID_AP = new Set<string>([...Object.keys(POLARITIES), 'AP_UNIVERSAL']);

export function isArtifactSlotPolarity(value: string): value is ArtifactSlotPolarity {
  return VALID_AP.has(value);
}

function polarityFromAp(ap: string | undefined): ArtifactSlotPolarity {
  if (!ap || ap === 'AP_UNIVERSAL') return 'AP_UNIVERSAL';
  return isArtifactSlotPolarity(ap) ? ap : 'AP_UNIVERSAL';
}

export function parseArtifactSlotsJson(raw: string | undefined | null): string[] {
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw) as unknown;
    return Array.isArray(parsed) ? parsed.filter((v): v is string => typeof v === 'string') : [];
  } catch {
    return [];
  }
}

function slotConfigForType(equipmentType: EquipmentType): EquipmentSlotConfig {
  return EQUIPMENT_SLOT_CONFIGS[equipmentType] ?? EQUIPMENT_SLOT_CONFIGS.warframe;
}

export function buildArtifactSlotEditorRows(
  equipmentType: EquipmentType,
  artifactSlots: string[],
  equipmentName?: string,
): ArtifactSlotEditorRow[] {
  const config = slotConfigForType(equipmentType);
  const totalSlots = artifactSlotsStorageLength(config);
  const specialSlotIndex = config.generalSlots;
  const exilusIndex = config.generalSlots + 1;
  const rows: ArtifactSlotEditorRow[] = [];
  const padded = [...artifactSlots];
  while (padded.length < totalSlots) padded.push('AP_UNIVERSAL');

  if (config.hasAura) {
    const ap = padded[specialSlotIndex];
    rows.push({
      id: 'aura',
      label: 'Aura',
      artifactIndex: specialSlotIndex,
      enabled: ap !== 'AP_UNIVERSAL',
      polarity: polarityFromAp(ap),
    });
  }
  if (config.hasStance) {
    const ap = padded[specialSlotIndex];
    rows.push({
      id: 'stance',
      label: 'Stance',
      artifactIndex: specialSlotIndex,
      enabled: ap !== 'AP_UNIVERSAL',
      polarity: polarityFromAp(ap),
    });
  }
  if (config.hasPosture) {
    const ap = padded[specialSlotIndex];
    rows.push({
      id: 'posture',
      label: 'Posture',
      artifactIndex: specialSlotIndex,
      enabled: ap !== 'AP_UNIVERSAL',
      polarity: polarityFromAp(ap),
    });
  }

  const generalAps = padded.slice(0, config.generalSlots).reverse();
  for (let i = 0; i < config.generalSlots; i++) {
    const ap = generalAps[i] ?? 'AP_UNIVERSAL';
    rows.push({
      id: `general-${i}`,
      label: `Slot ${i + 1}`,
      artifactIndex: config.generalSlots - 1 - i,
      enabled: ap !== 'AP_UNIVERSAL',
      polarity: polarityFromAp(ap),
    });
  }

  const skipExilus = weaponOmitsExilusSlot(equipmentName, equipmentType);
  if (config.hasExilus && !skipExilus) {
    const ap = padded[exilusIndex];
    rows.push({
      id: 'exilus',
      label: 'Exilus',
      artifactIndex: exilusIndex,
      enabled: ap !== 'AP_UNIVERSAL',
      polarity: polarityFromAp(ap),
    });
  }

  return rows;
}

export function artifactSlotsFromEditorRows(
  equipmentType: EquipmentType,
  rows: ArtifactSlotEditorRow[],
  equipmentName?: string,
): string[] {
  const config = slotConfigForType(equipmentType);
  const result = Array.from({ length: artifactSlotsStorageLength(config) }, () => 'AP_UNIVERSAL');
  for (const row of rows) {
    result[row.artifactIndex] = row.enabled ? row.polarity : 'AP_UNIVERSAL';
  }
  void equipmentName;
  return result;
}

export const ARTIFACT_POLARITY_CYCLE: ArtifactSlotPolarity[] = [
  'AP_UNIVERSAL',
  ...(Object.keys(POLARITIES) as PolarityKey[]),
];

export function cycleArtifactPolarity(current: ArtifactSlotPolarity): ArtifactSlotPolarity {
  const idx = ARTIFACT_POLARITY_CYCLE.indexOf(current);
  const next = idx < 0 ? 0 : (idx + 1) % ARTIFACT_POLARITY_CYCLE.length;
  return ARTIFACT_POLARITY_CYCLE[next] ?? 'AP_UNIVERSAL';
}
