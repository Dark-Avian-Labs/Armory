import { useRef } from 'react';

import { getMaxRank, getArcaneDescription } from '../../utils/arcaneUtils';
import {
  getDamageTypeIconPath,
  splitDisplayTextByDamageTokens,
} from '../../utils/damageTypeTokens';
import { GlassTooltip } from '../GlassTooltip';
import { ArcaneCardPreview } from '../ModCard/ArcaneCardPreview';
import {
  DEFAULT_ARCANE_LAYOUT,
  normalizeArcaneRarity,
} from '../ModCard/cardLayout';

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
}: ArcaneSlotsProps) {
  const layout = { ...DEFAULT_ARCANE_LAYOUT, scale: SCALE };

  return (
    <div className="overflow-visible">
      <h3 className="mb-2 text-xs font-semibold uppercase tracking-wider text-muted">
        Arcanes
      </h3>
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
  onClick: () => void;
  onRankChange: (rank: number) => void;
  onRemove: () => void;
  onDrop: (arcane: Arcane) => void;
}) {
  const slotRef = useRef<HTMLDivElement>(null);

  const desc = arcane ? getArcaneDescription(arcane, slot.rank) : '';
  const renderDamageText = (text: string): React.ReactNode =>
    splitDisplayTextByDamageTokens(text).map((segment, segmentIndex) => {
      if (segment.kind === 'text') {
        return <span key={`t-${segmentIndex}`}>{segment.value}</span>;
      }
      const iconPath = getDamageTypeIconPath(segment.value);
      if (!iconPath)
        return <span key={`u-${segmentIndex}`}>{segment.value}</span>;
      return (
        <img
          key={`i-${segmentIndex}`}
          src={iconPath}
          alt={segment.value}
          className="mx-[0.08em] inline-block"
          style={{
            width: 12,
            height: 12,
            verticalAlign: '-0.12em',
            filter: 'drop-shadow(0 1px 2px rgba(0,0,0,0.7))',
          }}
          draggable={false}
        />
      );
    });

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
        <div className="mb-1 text-xs font-semibold text-foreground">
          {arcane.name}
        </div>
        <div className="text-[10px] leading-tight text-muted">
          {renderDamageText(desc)}
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
        className={`relative cursor-pointer rounded-lg ${isActive ? 'ring-1 ring-accent' : ''}`}
        onClick={onClick}
        onDragOver={handleDragOver}
        onDrop={handleDrop}
        onContextMenu={(e) => {
          if (arcane) {
            e.preventDefault();
            onRemove();
          }
        }}
      >
        {arcane ? (
          <>
            <div
              className="overflow-visible rounded-lg"
              style={{ width: SLOT_W, height: SLOT_H }}
            >
              <ArcaneCardPreview
                layout={layout}
                rarity={normalizeArcaneRarity(arcane.rarity)}
                arcaneArt={
                  arcane.image_path ? `/images${arcane.image_path}` : ''
                }
                arcaneName={arcane.name}
                rank={slot.rank}
                maxRank={maxRank}
              />
            </div>
            {maxRank > 0 && (
              <div
                className="relative flex items-center justify-center gap-1"
                style={{ height: RANK_ROW_H }}
                onClick={(e) => e.stopPropagation()}
              >
                <button
                  onClick={() => onRankChange(Math.max(0, slot.rank - 1))}
                  className="flex h-3 w-6 items-center justify-center rounded-full border border-muted/30 text-[9px] font-bold text-muted transition-colors hover:border-foreground/50 hover:text-foreground"
                  title="Decrease rank"
                >
                  −
                </button>
                <button
                  onClick={() => onRankChange(Math.min(maxRank, slot.rank + 1))}
                  className="flex h-3 w-6 items-center justify-center rounded-full border border-muted/30 text-[9px] font-bold text-muted transition-colors hover:border-foreground/50 hover:text-foreground"
                  title="Increase rank"
                >
                  +
                </button>
                <button
                  onClick={() => onRemove()}
                  className="absolute right-8 flex h-3.25 w-3.25 items-center justify-center rounded-full border border-muted/30 text-[7px] text-muted/30 transition-colors hover:border-danger/50 hover:text-danger"
                  title="Remove"
                >
                  ✕
                </button>
              </div>
            )}
          </>
        ) : (
          <div
            className="overflow-hidden rounded-lg"
            style={{ width: SLOT_W, height: SLOT_H }}
          >
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
