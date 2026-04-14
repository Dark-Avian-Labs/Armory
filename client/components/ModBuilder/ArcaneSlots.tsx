import { useRef } from 'react';

import { getMaxRank, getArcaneDescription } from '../../utils/arcaneUtils';
import { DamageTypeInlineText } from '../DamageTypeInlineText';
import { GlassTooltip } from '../GlassTooltip';
import { ArcaneCardPreview } from '../ModCard/ArcaneCardPreview';
import { DEFAULT_ARCANE_LAYOUT, normalizeArcaneRarity } from '../ModCard/cardLayout';

export interface Arcane {
  unique_name: string;
  name: string;
  rarity?: string;
  image_path?: string;
  level_stats?: string;
  compat_tags?: string[];
}

export interface ArcaneSlot {
  arcane?: Arcane;
  rank: number;
}

interface ArcaneSlotsProps {
  slotCount: number;
  slots: ArcaneSlot[];
  activeSlot?: number | null;
  onSlotClick: (slotIndex: number) => void;
  onRankChange: (slotIndex: number, rank: number) => void;
  onRemove: (slotIndex: number) => void;
  onDrop?: (slotIndex: number, arcane: Arcane) => void;
  readOnly?: boolean;
}

const SCALE = 0.6;
const SLOT_W = Math.round(DEFAULT_ARCANE_LAYOUT.cardWidth * SCALE);
const SLOT_H = Math.round(DEFAULT_ARCANE_LAYOUT.cardHeight * SCALE);
const RANK_ROW_H = 10;

export function ArcaneSlots({
  slotCount,
  slots,
  activeSlot,
  onSlotClick,
  onRankChange,
  onRemove,
  onDrop,
  readOnly = false,
}: ArcaneSlotsProps) {
  const layout = { ...DEFAULT_ARCANE_LAYOUT, scale: SCALE };

  return (
    <div className="overflow-visible">
      <h3 className="text-muted mb-2 text-xs font-semibold tracking-wider uppercase">Arcanes</h3>
      <div className="flex gap-0">
        {Array.from({ length: slotCount }, (_, i) => {
          const slot = slots[i] || { rank: 0 };
          const arcane = slot.arcane;
          const maxRank = arcane ? getMaxRank(arcane) : 0;
          const isActive = activeSlot === i;

          return (
            <ArcaneSlotCell
              key={i}
              slot={slot}
              arcane={arcane}
              maxRank={maxRank}
              isActive={isActive}
              layout={layout}
              readOnly={readOnly}
              onClick={() => onSlotClick(i)}
              onRankChange={(rank) => onRankChange(i, rank)}
              onRemove={() => onRemove(i)}
              onDrop={(dropped) => onDrop?.(i, dropped)}
            />
          );
        })}
      </div>
    </div>
  );
}

function ArcaneSlotCell({
  slot,
  arcane,
  maxRank,
  isActive,
  layout,
  readOnly,
  onClick,
  onRankChange,
  onRemove,
  onDrop,
}: {
  slot: ArcaneSlot;
  arcane?: Arcane;
  maxRank: number;
  isActive: boolean;
  layout: typeof DEFAULT_ARCANE_LAYOUT;
  readOnly: boolean;
  onClick: () => void;
  onRankChange: (rank: number) => void;
  onRemove: () => void;
  onDrop: (arcane: Arcane) => void;
}) {
  const slotRef = useRef<HTMLDivElement>(null);

  const desc = arcane ? getArcaneDescription(arcane, slot.rank) : '';

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    try {
      const raw = e.dataTransfer.getData('application/arcane');
      if (raw) {
        const parsed = JSON.parse(raw);
        if (parsed.__remove) {
          onRemove();
        } else {
          onDrop(parsed as Arcane);
        }
      }
    } catch {
      // ignore
    }
  };

  const tooltipContent =
    arcane && desc ? (
      <>
        <div className="text-foreground mb-1 text-xs font-semibold">{arcane.name}</div>
        <div className="text-muted text-[10px] leading-tight">
          <DamageTypeInlineText text={desc} iconSize={12} />
        </div>
      </>
    ) : null;

  return (
    <GlassTooltip content={tooltipContent} disabled={!tooltipContent}>
      <div
        ref={slotRef}
        style={{
          width: SLOT_W,
          height: arcane ? SLOT_H + RANK_ROW_H : SLOT_H,
          marginBottom: 4,
        }}
        className={`relative rounded-lg ${readOnly ? 'cursor-default' : 'cursor-pointer'} ${isActive ? 'ring-accent ring-1' : ''}`}
        onClick={readOnly ? undefined : onClick}
        onDragOver={readOnly ? undefined : handleDragOver}
        onDrop={readOnly ? undefined : handleDrop}
        onContextMenu={
          readOnly
            ? undefined
            : (e) => {
                if (arcane) {
                  e.preventDefault();
                  onRemove();
                }
              }
        }
      >
        {arcane ? (
          <>
            <div className="overflow-visible rounded-lg" style={{ width: SLOT_W, height: SLOT_H }}>
              <ArcaneCardPreview
                layout={layout}
                rarity={normalizeArcaneRarity(arcane.rarity)}
                arcaneArt={arcane.image_path ? `/images${arcane.image_path}` : ''}
                arcaneName={arcane.name}
                rank={slot.rank}
                maxRank={maxRank}
              />
            </div>
            {maxRank > 0 && (
              <div
                className="relative flex items-center justify-center gap-1"
                style={{ height: RANK_ROW_H }}
                onClick={readOnly ? undefined : (e) => e.stopPropagation()}
              >
                <button
                  type="button"
                  disabled={readOnly}
                  tabIndex={readOnly ? -1 : undefined}
                  onClick={() => onRankChange(Math.max(0, slot.rank - 1))}
                  className="border-muted/30 text-muted hover:border-foreground/50 hover:text-foreground flex h-3 w-6 items-center justify-center rounded-full border text-[9px] font-bold transition-colors disabled:pointer-events-none disabled:opacity-50"
                  title="Decrease rank"
                >
                  −
                </button>
                <button
                  type="button"
                  disabled={readOnly}
                  tabIndex={readOnly ? -1 : undefined}
                  onClick={() => onRankChange(Math.min(maxRank, slot.rank + 1))}
                  className="border-muted/30 text-muted hover:border-foreground/50 hover:text-foreground flex h-3 w-6 items-center justify-center rounded-full border text-[9px] font-bold transition-colors disabled:pointer-events-none disabled:opacity-50"
                  title="Increase rank"
                >
                  +
                </button>
                <button
                  type="button"
                  disabled={readOnly}
                  tabIndex={readOnly ? -1 : undefined}
                  onClick={() => onRemove()}
                  className="border-muted/30 text-muted/30 hover:border-danger/50 hover:text-danger absolute right-8 flex h-3.25 w-3.25 items-center justify-center rounded-full border text-[7px] transition-colors disabled:pointer-events-none disabled:opacity-50"
                  title="Remove"
                >
                  ✕
                </button>
              </div>
            )}
          </>
        ) : (
          <div className="overflow-hidden rounded-lg" style={{ width: SLOT_W, height: SLOT_H }}>
            <ArcaneCardPreview
              layout={layout}
              rarity="empty"
              arcaneArt=""
              arcaneName=""
              rank={0}
              maxRank={0}
            />
          </div>
        )}
      </div>
    </GlassTooltip>
  );
}
