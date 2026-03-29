import { formatShardBuffDescription } from '../../utils/shardBuffFormat';
import { GlassTooltip } from '../GlassTooltip';

export interface ShardSlotConfig {
  shard_type_id?: string | number;
  buff_id?: number | string;
  tauforged: boolean;
}

export interface ShardBuff {
  id: number | string;
  description: string;
  base_value: number;
  tauforged_value: number;
  value_format: string;
}

export interface ShardType {
  id: string | number;
  name: string;
  icon_path: string;
  tauforged_icon_path: string;
  buffs: ShardBuff[];
}

interface ArchonShardSlotsProps {
  slots: ShardSlotConfig[];
  shards: ShardType[];
  activeSlot?: number | null;
  onSlotClick: (slotIndex: number) => void;
  onRemove: (slotIndex: number) => void;
}

const V_OFFSETS = [0, 14, 28, 14, 0];

export function ArchonShardSlots({
  slots,
  shards,
  activeSlot,
  onSlotClick,
  onRemove,
}: ArchonShardSlotsProps) {
  const getShardInfo = (slot: ShardSlotConfig) => {
    if (!slot.shard_type_id) return null;
    const shard = shards.find((s) => String(s.id) === String(slot.shard_type_id));
    if (!shard) return null;
    const buff = shard.buffs.find((b) => String(b.id) === String(slot.buff_id));
    return { shard, buff };
  };

  return (
    <div className="overflow-visible">
      <h3 className="text-muted mb-2 text-right text-xs font-semibold tracking-wider uppercase">
        Archon Shards
      </h3>
      <div className="flex items-start justify-end gap-0.5">
        {Array.from({ length: 5 }, (_, i) => {
          const slot = slots[i] || { tauforged: false };
          const info = getShardInfo(slot);
          const isActive = activeSlot === i;
          const vOffset = V_OFFSETS[i];

          if (info) {
            const iconPath = slot.tauforged ? info.shard.tauforged_icon_path : info.shard.icon_path;
            const shardLabel = slot.tauforged ? `${info.shard.name} (Tauforged)` : info.shard.name;
            const buffText = formatShardBuffDescription(info.buff, slot.tauforged);

            return (
              <div
                key={i}
                className="relative flex flex-col items-center"
                style={{ marginTop: vOffset }}
              >
                <GlassTooltip
                  width="w-48"
                  content={
                    <>
                      <div className="text-foreground text-xs font-semibold">{shardLabel}</div>
                      {buffText && <div className="text-muted mt-0.5 text-[10px]">{buffText}</div>}
                    </>
                  }
                >
                  <button
                    onClick={() => onSlotClick(i)}
                    onContextMenu={(e) => {
                      e.preventDefault();
                      onRemove(i);
                    }}
                    className={`relative flex h-12 w-12 items-center justify-center overflow-hidden rounded-lg transition-[color,background-color,border-color,box-shadow] duration-200 ${
                      isActive ? 'ring-accent ring-1' : ''
                    }`}
                  >
                    <img
                      src="/icons/shards/filledBackground.png"
                      alt=""
                      className={`absolute inset-0 h-full w-full object-cover ${slot.tauforged ? 'archon-shard-filled-bg--tau' : 'invert-on-light'}`}
                      draggable={false}
                    />
                    <img
                      src={iconPath}
                      alt={info.shard.name}
                      className="invert-on-light absolute inset-0 h-full w-full object-cover"
                      draggable={false}
                    />
                  </button>
                </GlassTooltip>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    onRemove(i);
                  }}
                  className="border-muted/30 text-muted/30 hover:border-danger/50 hover:text-danger absolute -right-1 -bottom-1 flex h-3.25 w-3.25 items-center justify-center rounded-full border text-[7px] transition-colors"
                  title="Remove"
                >
                  ✕
                </button>
              </div>
            );
          }

          return (
            <button
              key={i}
              onClick={() => onSlotClick(i)}
              className={`relative flex h-12 w-12 items-center justify-center overflow-hidden rounded-lg transition-[color,background-color,border-color,box-shadow] duration-200 ${
                isActive ? 'ring-accent ring-1' : ''
              }`}
              style={{ marginTop: vOffset }}
            >
              <img
                src="/icons/shards/emptyBackground.png"
                alt=""
                className="invert-on-light absolute inset-0 h-full w-full object-cover"
                draggable={false}
              />
            </button>
          );
        })}
      </div>
    </div>
  );
}
