import { buildArchonShardKey, parseArchonShardKey } from '../../shared/archonShardRegistry.js';
import {
  type WarframeAbilityRef,
  isHelminthConfigV2,
  isShardSlotV2,
  resolveArchonShardKey,
  resolveHelminthFromConfig,
} from '../../shared/buildReference.js';
import type { ShardSlotConfig, ShardType } from '../components/ModBuilder/ArchonShardSlots';
import type { BuildConfig, Warframe } from '../types/warframe';

export function parseWarframeAbilityRefs(warframe: Warframe | null): WarframeAbilityRef[] {
  if (!warframe?.abilities) return [];
  try {
    return JSON.parse(warframe.abilities) as WarframeAbilityRef[];
  } catch {
    return [];
  }
}

export function persistHelminthForSave(
  helminth: BuildConfig['helminth'] | undefined,
  warframe: Warframe | null,
): BuildConfig['helminth'] | undefined {
  if (!helminth) return undefined;
  if (isHelminthConfigV2(helminth)) return helminth;

  const resolved = resolveHelminthFromConfig(helminth, parseWarframeAbilityRefs(warframe));
  if (!resolved) return helminth;

  return {
    replaced_ability_key: resolved.replaced_ability_key,
    replacement_ability_key: resolved.replacement_ability_key,
  };
}

export function persistShardSlotsForSave(
  shardSlots: ShardSlotConfig[] | undefined,
  shardTypes: ShardType[],
): BuildConfig['shardSlots'] | undefined {
  if (!shardSlots?.length) return shardSlots;

  return shardSlots.map((slot) => {
    if (isShardSlotV2(slot)) {
      return { armory_shard_key: slot.armory_shard_key };
    }

    if (!slot.shard_type_id || slot.buff_id == null) {
      return { tauforged: slot.tauforged ?? false };
    }

    const shard = shardTypes.find((s) => String(s.id) === String(slot.shard_type_id));
    const buff = shard?.buffs.find((b) => String(b.id) === String(slot.buff_id));
    const buffSortOrder =
      buff && typeof buff.sort_order === 'number' && buff.sort_order > 0
        ? buff.sort_order
        : shard
          ? shard.buffs.findIndex((b) => String(b.id) === String(slot.buff_id)) + 1
          : 0;
    const catalogLookup =
      shard && buff && buffSortOrder > 0
        ? {
            shardTypeName: shard.name,
            buffSortOrder,
            tauforged: slot.tauforged === true,
          }
        : undefined;

    const key = resolveArchonShardKey(slot, catalogLookup);
    if (key) return { armory_shard_key: key };
    return {
      shard_type_id: slot.shard_type_id,
      buff_id: slot.buff_id,
      tauforged: slot.tauforged ?? false,
    };
  });
}

export function shardSlotTauforged(slot: ShardSlotConfig | undefined): boolean {
  if (!slot) return false;
  if (isShardSlotV2(slot)) {
    const parsed = parseArchonShardKey(slot.armory_shard_key);
    return parsed?.variant === 'Tauforged';
  }
  return slot.tauforged === true;
}

export function buildArmoryShardKeyFromPicker(
  buffArmoryKey: string | undefined,
  tauforged: boolean,
): string | null {
  if (!buffArmoryKey) return null;
  const parsed = parseArchonShardKey(buffArmoryKey);
  if (!parsed) return null;
  return buildArchonShardKey(parsed.color, tauforged ? 'Tauforged' : 'Common', parsed.buffSlug);
}

export function resolveShardSlotForDisplay(
  slot: ShardSlotConfig | undefined,
  shards: ShardType[],
): { shard: ShardType; buff: ShardType['buffs'][number]; tauforged: boolean } | null {
  if (!slot) return null;

  if (isShardSlotV2(slot)) {
    const parsed = parseArchonShardKey(slot.armory_shard_key);
    if (!parsed) return null;
    const shard = shards.find((s) => s.name === parsed.color);
    if (!shard) return null;
    const buff = shard.buffs.find(
      (b) =>
        b.armory_key != null && parseArchonShardKey(b.armory_key)?.buffSlug === parsed.buffSlug,
    );
    if (!buff) return null;
    return { shard, buff, tauforged: parsed.variant === 'Tauforged' };
  }

  if (!slot.shard_type_id) return null;
  const shard = shards.find((s) => String(s.id) === String(slot.shard_type_id));
  if (!shard) return null;
  const buff = shard.buffs.find((b) => String(b.id) === String(slot.buff_id));
  if (!buff) return null;
  return { shard, buff, tauforged: slot.tauforged === true };
}
