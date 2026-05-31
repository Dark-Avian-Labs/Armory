import {
  AP_DISABLED,
  isArtifactSlotDisabled,
  isWarframeSecondAuraConfigured,
  warframeArtifactWriteIndex,
  warframeExilusArtifactIndex,
  warframeSecondAuraArtifactIndex,
  WARFRAME_COMPACT_ARTIFACT_SLOT_COUNT,
  WARFRAME_EXTENDED_ARTIFACT_SLOT_COUNT,
} from '../../shared/artifactSlotState.js';
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
  if (!ap || ap === 'AP_UNIVERSAL' || isArtifactSlotDisabled(ap)) return 'AP_UNIVERSAL';
  return isArtifactSlotPolarity(ap) ? ap : 'AP_UNIVERSAL';
}

function slotEnabledFromAp(ap: string | undefined): boolean {
  return ap != null && !isArtifactSlotDisabled(ap);
}

function warframeSecondAuraApForEditor(artifactSlots: string[], secondAuraIndex: number): string {
  if (!isWarframeSecondAuraConfigured(artifactSlots)) return AP_DISABLED;
  return artifactSlots[secondAuraIndex] ?? AP_DISABLED;
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

function editorStorageLength(equipmentType: EquipmentType, config: EquipmentSlotConfig): number {
  if (equipmentType === 'warframe') return WARFRAME_EXTENDED_ARTIFACT_SLOT_COUNT;
  return artifactSlotsStorageLength(config);
}

export function buildArtifactSlotEditorRows(
  equipmentType: EquipmentType,
  artifactSlots: string[],
  equipmentName?: string,
): ArtifactSlotEditorRow[] {
  const config = slotConfigForType(equipmentType);
  const totalSlots = editorStorageLength(equipmentType, config);
  const specialSlotIndex = config.generalSlots;
  const secondAuraIndex = warframeSecondAuraArtifactIndex(config.generalSlots);
  const exilusIndex =
    equipmentType === 'warframe'
      ? WARFRAME_EXTENDED_ARTIFACT_SLOT_COUNT - 1
      : config.generalSlots + 1;
  const exilusReadIndex =
    equipmentType === 'warframe'
      ? warframeExilusArtifactIndex(artifactSlots, config.generalSlots)
      : exilusIndex;
  const rows: ArtifactSlotEditorRow[] = [];
  const padded = [...artifactSlots];
  while (padded.length < totalSlots) padded.push('AP_UNIVERSAL');

  if (config.hasAura) {
    const ap = padded[specialSlotIndex];
    rows.push({
      id: 'aura',
      label: 'Aura',
      artifactIndex: specialSlotIndex,
      enabled: slotEnabledFromAp(ap),
      polarity: polarityFromAp(ap),
    });
  }
  if (equipmentType === 'warframe') {
    const ap = warframeSecondAuraApForEditor(artifactSlots, secondAuraIndex);
    rows.push({
      id: 'aura-2',
      label: 'Aura 2',
      artifactIndex: secondAuraIndex,
      enabled: slotEnabledFromAp(ap),
      polarity: polarityFromAp(ap),
    });
  }
  if (config.hasStance) {
    const ap = padded[specialSlotIndex];
    rows.push({
      id: 'stance',
      label: 'Stance',
      artifactIndex: specialSlotIndex,
      enabled: slotEnabledFromAp(ap),
      polarity: polarityFromAp(ap),
    });
  }
  if (config.hasPosture) {
    const ap = padded[specialSlotIndex];
    rows.push({
      id: 'posture',
      label: 'Posture',
      artifactIndex: specialSlotIndex,
      enabled: slotEnabledFromAp(ap),
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
      enabled: slotEnabledFromAp(ap),
      polarity: polarityFromAp(ap),
    });
  }

  const skipExilus = weaponOmitsExilusSlot(equipmentName, equipmentType);
  if (config.hasExilus && !skipExilus) {
    const ap = padded[exilusReadIndex];
    rows.push({
      id: 'exilus',
      label: 'Exilus',
      artifactIndex: exilusIndex,
      enabled: slotEnabledFromAp(ap),
      polarity: polarityFromAp(ap),
    });
  }

  return rows;
}

export function artifactSlotsFromEditorRows(
  equipmentType: EquipmentType,
  rows: ArtifactSlotEditorRow[],
): string[] {
  const config = slotConfigForType(equipmentType);
  const aura2Row = rows.find((row) => row.id === 'aura-2');
  const useExtendedWarframe = equipmentType === 'warframe' && (aura2Row?.enabled ?? false);
  const length =
    equipmentType === 'warframe'
      ? useExtendedWarframe
        ? WARFRAME_EXTENDED_ARTIFACT_SLOT_COUNT
        : WARFRAME_COMPACT_ARTIFACT_SLOT_COUNT
      : editorStorageLength(equipmentType, config);

  const result: string[] = Array.from({ length }, () =>
    equipmentType === 'warframe' ? AP_DISABLED : 'AP_UNIVERSAL',
  );

  for (const row of rows) {
    if (row.id === 'aura-2' && !useExtendedWarframe) continue;

    const writeIndex =
      equipmentType === 'warframe'
        ? warframeArtifactWriteIndex(
            row.id,
            row.artifactIndex,
            useExtendedWarframe,
            config.generalSlots,
          )
        : row.artifactIndex;

    if (!row.enabled) {
      result[writeIndex] = AP_DISABLED;
      continue;
    }
    result[writeIndex] = row.polarity;
  }

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
