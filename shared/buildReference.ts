import {
  abilitySlugFromDisplayName,
  buildAbilityKey,
  buildAbilityKeyFromDePath,
} from './abilitySlugRegistry.js';
import {
  ARCHON_COLORS,
  type ArchonColor,
  archonSlugForSortOrder,
  archonVariantFromTauforged,
  buildArchonShardKey,
  parseArchonShardKey,
} from './archonShardRegistry.js';
import { resolveHelminthArmoryKey, resolveHelminthDePath } from './helminthRegistry.js';

export interface HelminthConfigV1 {
  replaced_ability_index: number;
  replacement_ability_unique_name: string;
}

export interface HelminthConfigV2 {
  replaced_ability_key: string;
  replacement_ability_key: string;
}

export type HelminthConfigInput = HelminthConfigV1 | HelminthConfigV2;

export function isHelminthConfigV2(config: HelminthConfigInput): config is HelminthConfigV2 {
  return (
    'replacement_ability_key' in config &&
    typeof (config as HelminthConfigV2).replacement_ability_key === 'string'
  );
}

export interface ResolvedHelminthConfig {
  replaced_ability_key: string;
  replacement_ability_key: string;
  replacement_de_path?: string;
}

export interface WarframeAbilityRef {
  abilityName?: string;
  name?: string;
  abilityUniqueName?: string;
  uniqueName?: string;
}

export function resolveHelminthFromConfig(
  config: HelminthConfigInput | undefined,
  warframeAbilities: WarframeAbilityRef[],
  helminthDbCandidates?: readonly { unique_name: string; name?: string }[],
): ResolvedHelminthConfig | null {
  if (!config) return null;

  if (isHelminthConfigV2(config)) {
    const replacementKey =
      resolveHelminthArmoryKey(config.replacement_ability_key) ?? config.replacement_ability_key;
    const dePath = resolveHelminthDePath(replacementKey, helminthDbCandidates);
    return {
      replaced_ability_key: config.replaced_ability_key,
      replacement_ability_key: replacementKey,
      replacement_de_path: dePath,
    };
  }

  const replacementKey = resolveHelminthArmoryKey(config.replacement_ability_unique_name);
  if (!replacementKey) return null;

  const replaced = warframeAbilities[config.replaced_ability_index];
  const replacedName = replaced?.abilityName ?? replaced?.name;
  const replacedUnique = replaced?.abilityUniqueName ?? replaced?.uniqueName;
  const replacedKey = replacedUnique
    ? buildAbilityKeyFromDePath(replacedUnique, replacedName)
    : replacedName
      ? buildAbilityKey(abilitySlugFromDisplayName(replacedName))
      : buildAbilityKey(`Ability${config.replaced_ability_index + 1}`);

  return {
    replaced_ability_key: replacedKey,
    replacement_ability_key: replacementKey,
    replacement_de_path: resolveHelminthDePath(replacementKey, helminthDbCandidates),
  };
}

export interface ShardSlotV1 {
  shard_type_id?: string | number;
  buff_id?: string | number;
  tauforged?: boolean;
}

export interface ShardSlotV2 {
  armory_shard_key: string;
}

export function isShardSlotV2(slot: ShardSlotV1 | ShardSlotV2): slot is ShardSlotV2 {
  return typeof (slot as ShardSlotV2).armory_shard_key === 'string';
}

export function resolveArchonShardKey(
  slot: ShardSlotV1 | ShardSlotV2,
  catalogLookup?: {
    shardTypeName: string;
    buffSortOrder: number;
    tauforged: boolean;
  },
): string | null {
  if (isShardSlotV2(slot)) {
    return parseArchonShardKey(slot.armory_shard_key) ? slot.armory_shard_key : null;
  }

  if (!catalogLookup) return null;
  if (!ARCHON_COLORS.includes(catalogLookup.shardTypeName as ArchonColor)) return null;
  const color = catalogLookup.shardTypeName as ArchonColor;
  const slug = archonSlugForSortOrder(color, catalogLookup.buffSortOrder);
  if (!slug) return null;
  const variant = archonVariantFromTauforged(catalogLookup.tauforged);
  return buildArchonShardKey(color, variant, slug);
}

export function abilityKeyForWarframeRef(ref: WarframeAbilityRef): string {
  const name = ref.abilityName ?? ref.name;
  const unique = ref.abilityUniqueName ?? ref.uniqueName;
  if (unique) return buildAbilityKeyFromDePath(unique, name);
  if (name) return buildAbilityKey(abilitySlugFromDisplayName(name));
  return buildAbilityKey('Unknown');
}

export function helminthReplacedAbilityIndex(
  config: HelminthConfigInput | undefined,
  warframeAbilities: WarframeAbilityRef[],
): number | undefined {
  if (!config) return undefined;
  if (!isHelminthConfigV2(config)) return config.replaced_ability_index;
  for (let i = 0; i < warframeAbilities.length; i++) {
    if (abilityKeyForWarframeRef(warframeAbilities[i]!) === config.replaced_ability_key) {
      return i;
    }
  }
  return undefined;
}

export function helminthReplacementLookupRef(config: HelminthConfigInput): string {
  if (isHelminthConfigV2(config)) return config.replacement_ability_key;
  return config.replacement_ability_unique_name;
}
