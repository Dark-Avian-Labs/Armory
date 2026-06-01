import { applyArchonSlugToBonuses, parseArchonShardKey } from '../../shared/archonShardRegistry.js';
import { isShardSlotV2, resolveArchonShardKey } from '../../shared/buildReference.js';
import type { ShardSlotConfig, ShardType } from '../components/ModBuilder/ArchonShardSlots';
import type { WarframeBonusEffects } from './warframeCalc';

function applyBuffToBonuses(
  buff: { description: string; base_value: number; tauforged_value: number; value_format: string },
  tauforged: boolean,
  bonuses: WarframeBonusEffects,
  buffSlug?: string,
): void {
  const value = tauforged ? buff.tauforged_value : buff.base_value;
  if (buffSlug) {
    applyArchonSlugToBonuses(buffSlug, value, buff.value_format, bonuses);
    return;
  }

  const pct = buff.value_format === '%' ? value / 100 : 0;
  const flat = buff.value_format === '%' ? 0 : value;
  const desc = buff.description.toLowerCase();

  if (desc.includes('ability strength')) {
    bonuses.abilityStrengthPct = (bonuses.abilityStrengthPct ?? 0) + pct;
    return;
  }
  if (desc.includes('ability duration')) {
    bonuses.abilityDurationPct = (bonuses.abilityDurationPct ?? 0) + pct;
    return;
  }
  if (desc.includes('ability efficiency')) {
    bonuses.abilityEfficiencyPct = (bonuses.abilityEfficiencyPct ?? 0) + pct;
    return;
  }
  if (desc.includes('ability range')) {
    bonuses.abilityRangePct = (bonuses.abilityRangePct ?? 0) + pct;
    return;
  }
  if (desc.includes('sprint speed')) {
    bonuses.sprintSpeedPct = (bonuses.sprintSpeedPct ?? 0) + pct;
    bonuses.sprintSpeedFlat = (bonuses.sprintSpeedFlat ?? 0) + flat;
    return;
  }
  if (desc.includes('armor')) {
    bonuses.armorPct = (bonuses.armorPct ?? 0) + pct;
    bonuses.armorFlat = (bonuses.armorFlat ?? 0) + flat;
    return;
  }
  if (desc.includes('shield')) {
    bonuses.shieldPct = (bonuses.shieldPct ?? 0) + pct;
    bonuses.shieldFlat = (bonuses.shieldFlat ?? 0) + flat;
    return;
  }
  if (desc.includes('energy')) {
    bonuses.energyPct = (bonuses.energyPct ?? 0) + pct;
    bonuses.energyFlat = (bonuses.energyFlat ?? 0) + flat;
    return;
  }
  if (desc.includes('health') && !desc.includes('health orb') && !desc.includes('health regen')) {
    bonuses.healthPct = (bonuses.healthPct ?? 0) + pct;
    bonuses.healthFlat = (bonuses.healthFlat ?? 0) + flat;
  }
}

export function extractArchonShardBonuses(
  shardSlots?: ShardSlotConfig[],
  shardTypes?: ShardType[],
): WarframeBonusEffects {
  const bonuses: WarframeBonusEffects = {};
  if (!shardSlots?.length || !shardTypes?.length) return bonuses;

  for (const slot of shardSlots) {
    if (isShardSlotV2(slot)) {
      const parsed = parseArchonShardKey(slot.armory_shard_key);
      if (!parsed) continue;
      const tauforged = parsed.variant === 'Tauforged';
      for (const shard of shardTypes) {
        if (shard.name !== parsed.color) continue;
        const buff = shard.buffs.find(
          (b) =>
            b.armory_key != null && parseArchonShardKey(b.armory_key)?.buffSlug === parsed.buffSlug,
        );
        if (buff) {
          applyBuffToBonuses(buff, tauforged, bonuses, parsed.buffSlug);
        }
        break;
      }
      continue;
    }

    if (!slot?.shard_type_id || slot.buff_id == null) continue;
    const shard = shardTypes.find((s) => String(s.id) === String(slot.shard_type_id));
    if (!shard) continue;
    const buff = shard.buffs.find((b) => String(b.id) === String(slot.buff_id));
    if (!buff) continue;

    const buffSortOrder =
      typeof buff.sort_order === 'number' && buff.sort_order > 0
        ? buff.sort_order
        : shard.buffs.findIndex((b) => String(b.id) === String(slot.buff_id)) + 1;
    const key = resolveArchonShardKey(slot, {
      shardTypeName: shard.name,
      buffSortOrder,
      tauforged: slot.tauforged === true,
    });
    const slug = key ? parseArchonShardKey(key)?.buffSlug : undefined;
    applyBuffToBonuses(buff, slot.tauforged === true, bonuses, slug);
  }

  return bonuses;
}
