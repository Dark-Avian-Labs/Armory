import { useState } from 'react';

import type { ShardType, ShardSlotConfig } from './ArchonShardSlots';

interface ShardPickerPanelProps {
  shards: ShardType[];
  currentSlot: ShardSlotConfig;
  onSelect: (shardTypeId: string, buffId: number, tauforged: boolean) => void;
  onRemove: () => void;
  onClose: () => void;
}

function formatBuffValue(buff: ShardType['buffs'][number], tauforged: boolean): string {
  const value = tauforged ? buff.tauforged_value : buff.base_value;
  if (buff.value_format === 'proc') return '';
  if (buff.value_format === '%') return ` +${value}%`;
  if (buff.value_format === '+flat') return ` +${value}`;
  if (buff.value_format === '/s') return ` +${value}/s`;
  return ` ${value}`;
}

export function ShardPickerPanel({
  shards,
  currentSlot,
  onSelect,
  onRemove,
  onClose,
}: ShardPickerPanelProps) {
  const [selectedType, setSelectedType] = useState<string>(
    currentSlot.shard_type_id != null
      ? String(currentSlot.shard_type_id)
      : shards[0]?.id != null
        ? String(shards[0].id)
        : '',
  );
  const [tauforged, setTauforged] = useState(currentSlot.tauforged);

  const activeShard = shards.find((s) => String(s.id) === selectedType);

  return (
    <div className="mod-builder-side-panel flex min-h-0 flex-col">
      <div className="mb-3 flex items-center justify-between">
        <h2 className="text-foreground text-lg font-semibold">Archon Shards</h2>
        <button
          onClick={onClose}
          className="border-glass-border text-muted hover:bg-glass-hover hover:text-foreground rounded-lg border px-2.5 py-1 text-xs transition-[color,background-color,border-color] duration-200"
        >
          Back to Mods
        </button>
      </div>

      <div className="mb-3 flex flex-wrap gap-2">
        {shards.map((shard) => {
          const icon = tauforged ? shard.tauforged_icon_path : shard.icon_path;
          const shardId = String(shard.id);
          return (
            <button
              key={shard.id}
              onClick={() => setSelectedType(shardId)}
              className={`flex items-center gap-1.5 rounded-lg border px-2 py-1.5 text-xs transition-[color,background-color,border-color] duration-200 ${
                selectedType === shardId
                  ? 'border-accent bg-accent-weak text-accent'
                  : 'border-glass-border text-muted hover:border-glass-border-hover'
              }`}
            >
              <img src={icon} alt="" className="h-5 w-5 object-contain" draggable={false} />
              {shard.name}
            </button>
          );
        })}
      </div>

      <label className="text-muted mb-3 flex items-center gap-2 text-xs">
        <input
          type="checkbox"
          checked={tauforged}
          onChange={(e) => setTauforged(e.target.checked)}
          className="accent-warning"
        />
        Tauforged (1.5x values)
      </label>

      <div className="custom-scroll max-h-[calc(100vh-500px)] overflow-y-auto">
        <div className="space-y-1">
          <button
            onClick={onRemove}
            className="border-danger/40 text-danger/70 hover:border-danger hover:bg-danger/10 flex w-full items-center justify-between rounded-lg border border-dashed px-3 py-2 text-left text-sm transition-[color,background-color,border-color] duration-200"
          >
            <span>Remove Shard</span>
            <span className="text-xs">&times;</span>
          </button>
          {activeShard &&
            activeShard.buffs.map((buff) => {
              const formattedValue = formatBuffValue(buff, tauforged);
              const buffId = typeof buff.id === 'number' ? buff.id : Number(buff.id);
              return (
                <button
                  key={buff.id}
                  onClick={() => {
                    if (!Number.isFinite(buffId)) {
                      if (import.meta.env.DEV) {
                        console.warn('[ShardPickerPanel] Invalid buff id; selection ignored', {
                          selectedType,
                          rawBuffId: buff.id,
                        });
                      }
                      return;
                    }
                    onSelect(selectedType, buffId, tauforged);
                  }}
                  className="border-glass-border text-muted hover:border-glass-border-hover hover:bg-glass-hover hover:text-foreground flex w-full items-center justify-between rounded-lg border px-3 py-2 text-left text-sm transition-[color,background-color,border-color] duration-200"
                >
                  <span>{buff.description}</span>
                  <span className="text-accent text-xs">{formattedValue}</span>
                </button>
              );
            })}
        </div>
      </div>
    </div>
  );
}
