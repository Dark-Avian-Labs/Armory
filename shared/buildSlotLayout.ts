import {
  hasMeaningfulArtifactSlotOverrides,
  isArtifactSlotDisabled,
  isArtifactSlotVisible,
  isWarframeSecondAuraSlotActive,
  normalizeWarframeArtifactSlotsForLoad,
  warframeExilusArtifactIndex,
} from './artifactSlotState.js';
import { EQUIPMENT_SLOT_CONFIGS, type EquipmentSlotConfigKey } from './equipmentSlotConfig.js';
import { POLARITIES, type PolarityKey } from './polarities.js';
import { equipmentHasStanceSlot, weaponOmitsExilusSlot } from './specialEquipmentSlots.js';

export type ModSlotType = 'general' | 'aura' | 'stance' | 'exilus' | 'posture';

export interface BuildModSlot {
  index: number;
  type: ModSlotType;
  polarity?: string;
  mod?: Record<string, unknown>;
  rank?: number;
  setRank?: number;
  riven_config?: unknown;
  riven_art_path?: string;
}

export interface CatalogPolarityDefaults {
  aura_polarity?: string | null;
  exilus_polarity?: string | null;
  polarities?: string | null;
}

export interface BuildSlotLayoutInput {
  equipmentType: EquipmentSlotConfigKey;
  equipmentName?: string | null;
  artifactSlotsRaw: string[];
  exportDefaults?: CatalogPolarityDefaults;
  isCompanionWeaponEquipped?: boolean;
}

const COMPANION_WEAPON_EQUIPMENT_TYPES = new Set<EquipmentSlotConfigKey>([
  'primary',
  'secondary',
  'melee',
  'beast_claws',
]);

function parseExportPolaritiesJson(raw?: string | null): string[] {
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw) as unknown;
    return Array.isArray(parsed) ? parsed.filter((v): v is string => typeof v === 'string') : [];
  } catch {
    return [];
  }
}

function polarityFromArtifactAp(ap: string | undefined): string | undefined {
  if (!ap || ap === 'AP_UNIVERSAL' || isArtifactSlotDisabled(ap)) return undefined;
  return (POLARITIES as Record<string, string>)[ap as PolarityKey] ? ap : undefined;
}

function slotConfigForType(equipmentType: EquipmentSlotConfigKey) {
  return EQUIPMENT_SLOT_CONFIGS[equipmentType] ?? EQUIPMENT_SLOT_CONFIGS.warframe;
}

export function buildModSlotsFromArtifactSlots(input: BuildSlotLayoutInput): BuildModSlot[] {
  const config = slotConfigForType(input.equipmentType);
  const equipmentType = input.equipmentType;
  const isSelectedCompanionWeapon =
    COMPANION_WEAPON_EQUIPMENT_TYPES.has(equipmentType) && input.isCompanionWeaponEquipped === true;

  const artifactSlotsRaw = input.artifactSlotsRaw;
  const artifactSlots =
    equipmentType === 'warframe'
      ? normalizeWarframeArtifactSlotsForLoad(artifactSlotsRaw, config.generalSlots)
      : artifactSlotsRaw;

  const hasArtifactSlotOverrides = hasMeaningfulArtifactSlotOverrides(artifactSlotsRaw);
  const specialSlotIndex = config.generalSlots;
  const exportDefaults = input.exportDefaults;
  const legacyGeneralPolarities = hasArtifactSlotOverrides
    ? []
    : parseExportPolaritiesJson(exportDefaults?.polarities);

  const slots: BuildModSlot[] = [];
  let idx = 0;

  if (
    config.hasAura &&
    isArtifactSlotVisible(artifactSlots, specialSlotIndex, hasArtifactSlotOverrides)
  ) {
    const pol = hasArtifactSlotOverrides
      ? polarityFromArtifactAp(artifactSlots[specialSlotIndex])
      : exportDefaults?.aura_polarity || undefined;
    slots.push({ index: idx++, type: 'aura', polarity: pol ?? undefined });
  }

  if (
    equipmentType === 'warframe' &&
    isWarframeSecondAuraSlotActive(artifactSlotsRaw, config.generalSlots)
  ) {
    const pol = polarityFromArtifactAp(artifactSlots[specialSlotIndex + 1]);
    slots.push({ index: idx++, type: 'aura', polarity: pol });
  }

  if (
    equipmentHasStanceSlot(equipmentType, input.equipmentName) &&
    isArtifactSlotVisible(artifactSlots, specialSlotIndex, hasArtifactSlotOverrides)
  ) {
    const pol = hasArtifactSlotOverrides
      ? polarityFromArtifactAp(artifactSlots[specialSlotIndex])
      : undefined;
    slots.push({ index: idx++, type: 'stance', polarity: pol });
  }

  if (
    config.hasPosture &&
    isArtifactSlotVisible(artifactSlots, specialSlotIndex, hasArtifactSlotOverrides)
  ) {
    const pol = hasArtifactSlotOverrides
      ? polarityFromArtifactAp(artifactSlots[specialSlotIndex])
      : undefined;
    slots.push({ index: idx++, type: 'posture', polarity: pol });
  }

  // General slots are emitted in display order (left-to-right), while artifact
  // overrides are stored in reverse index order for general slots.
  for (let i = 0; i < config.generalSlots; i++) {
    const displayIndex = i;
    const artifactIndex = config.generalSlots - 1 - displayIndex;
    if (hasArtifactSlotOverrides && !isArtifactSlotVisible(artifactSlots, artifactIndex, true)) {
      continue;
    }
    const polarity = hasArtifactSlotOverrides
      ? polarityFromArtifactAp(artifactSlots[artifactIndex])
      : legacyGeneralPolarities[displayIndex] || undefined;
    slots.push({ index: idx++, type: 'general', polarity });
  }

  const omitExilus = weaponOmitsExilusSlot(input.equipmentName, equipmentType);
  const exilusArtifactIndex =
    equipmentType === 'warframe'
      ? warframeExilusArtifactIndex(artifactSlotsRaw, config.generalSlots)
      : config.generalSlots + 1;

  if (
    config.hasExilus &&
    !isSelectedCompanionWeapon &&
    !omitExilus &&
    isArtifactSlotVisible(artifactSlots, exilusArtifactIndex, hasArtifactSlotOverrides)
  ) {
    const pol = hasArtifactSlotOverrides
      ? polarityFromArtifactAp(artifactSlots[exilusArtifactIndex])
      : exportDefaults?.exilus_polarity || undefined;
    slots.push({ index: idx++, type: 'exilus', polarity: pol ?? undefined });
  }

  return slots;
}

function modSlotContentKey(slot: BuildModSlot): string {
  const mod = slot.mod;
  const modKey =
    mod && typeof mod.unique_name === 'string'
      ? mod.unique_name
      : mod && typeof mod.name === 'string'
        ? mod.name
        : '';
  return [
    slot.type,
    modKey,
    slot.rank ?? '',
    slot.setRank ?? '',
    slot.riven_art_path ?? '',
    JSON.stringify(slot.riven_config ?? null),
  ].join('\t');
}

export function buildModSlotsAreEquivalent(a: BuildModSlot[], b: BuildModSlot[]): boolean {
  if (a.length !== b.length) return false;
  return a.every((slot, index) => {
    const other = b[index];
    if (!other) return false;
    if (slot.type !== other.type) return false;
    if ((slot.polarity ?? '') !== (other.polarity ?? '')) return false;
    return modSlotContentKey(slot) === modSlotContentKey(other);
  });
}

export function reconcileBuildModSlots(
  existingSlots: BuildModSlot[],
  targetSlots: BuildModSlot[],
): BuildModSlot[] {
  const byType = new Map<ModSlotType, BuildModSlot[]>();
  for (const slot of existingSlots) {
    const list = byType.get(slot.type) ?? [];
    list.push(slot);
    byType.set(slot.type, list);
  }

  const cursors = new Map<ModSlotType, number>();

  return targetSlots.map((target, index) => {
    const cursor = cursors.get(target.type) ?? 0;
    const sources = byType.get(target.type) ?? [];
    const source = sources[cursor];
    cursors.set(target.type, cursor + 1);

    if (source) {
      return {
        ...source,
        index,
        type: target.type,
        polarity: source.polarity ?? target.polarity,
      };
    }

    return {
      index,
      type: target.type,
      polarity: target.polarity,
    };
  });
}

export function reconcileStoredBuildModSlots(
  existingSlots: BuildModSlot[],
  layoutInput: BuildSlotLayoutInput,
): BuildModSlot[] {
  const targetSlots = buildModSlotsFromArtifactSlots(layoutInput);
  return reconcileBuildModSlots(existingSlots, targetSlots);
}
