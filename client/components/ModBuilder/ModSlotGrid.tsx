import { useState, useEffect, useRef, useMemo } from 'react';

import {
  AP_ANY,
  AP_UMBRA,
  POLARITIES,
  REGULAR_POLARITIES,
  type EquipmentType,
  type Mod,
  type ModSlot,
  type SlotType,
} from '../../types/warframe';
import { polarityMatchForUi } from '../../utils/drain';
import { isRivenMod } from '../../utils/riven';
import { countEquippedUmbraSetMods, isUmbraSelfScalingSetMod } from '../../utils/umbraSet';
import { ModCard, CardPreview, DEFAULT_LAYOUT } from '../ModCard';

const POLARITY_CYCLE_FULL: (string | undefined)[] = [
  undefined,
  ...REGULAR_POLARITIES,
  AP_UMBRA,
  AP_ANY,
];

const POLARITY_CYCLE_NO_UMBRA: (string | undefined)[] = POLARITY_CYCLE_FULL.filter(
  (p) => p !== AP_UMBRA,
);

function getPolarityCycle(
  slotType: SlotType,
  equipmentType: EquipmentType,
): (string | undefined)[] {
  if (equipmentType !== 'warframe') return POLARITY_CYCLE_NO_UMBRA;
  if (slotType === 'aura' || slotType === 'exilus') return POLARITY_CYCLE_NO_UMBRA;
  return POLARITY_CYCLE_FULL;
}

const POLARITY_LABELS: Record<string, string> = {
  ...POLARITIES,
  AP_ANY: 'Universal',
};

const POLARITY_ICONS: Record<string, string> = {
  AP_ATTACK: 'madurai',
  AP_DEFENSE: 'vazarin',
  AP_TACTIC: 'naramon',
  AP_WARD: 'unairu',
  AP_POWER: 'zenurik',
  AP_PRECEPT: 'penjaga',
  AP_UMBRA: 'umbra',
  AP_ANY: 'universal',
};

const CARD_HOVER_TILT_MAX_DEG = 15;

function applyCardTiltFromMouse(target: HTMLElement, event: React.MouseEvent<HTMLElement>): void {
  const rect = target.getBoundingClientRect();
  if (rect.width <= 0 || rect.height <= 0) return;
  const px = (event.clientX - rect.left) / rect.width;
  const py = (event.clientY - rect.top) / rect.height;
  const rotateY = (px - 0.5) * 2 * CARD_HOVER_TILT_MAX_DEG;
  const rotateX = (0.5 - py) * 2 * CARD_HOVER_TILT_MAX_DEG;
  target.style.setProperty('--tilt-rotate-x', `${rotateX.toFixed(2)}deg`);
  target.style.setProperty('--tilt-rotate-y', `${rotateY.toFixed(2)}deg`);
}

function resetCardTilt(target: HTMLElement): void {
  target.style.setProperty('--tilt-rotate-x', '0deg');
  target.style.setProperty('--tilt-rotate-y', '0deg');
}

interface ModSlotGridProps {
  slots: ModSlot[];
  onDrop: (slotIndex: number, mod: Mod) => void;
  onRemove: (slotIndex: number) => void;
  onRankChange: (slotIndex: number, rank: number) => void;
  onSetRankChange: (slotIndex: number, setRank: number) => void;
  onEditRiven?: (slotIndex: number) => void;
  onSlotClick?: (slotIndex: number, slotType: ModSlot['type']) => void;
  onSwap?: (sourceSlotIndex: number, targetSlotIndex: number) => void;
  activeSlotIndex?: number;
  formaMode?: boolean;
  onPolarityChange?: (slotIndex: number, polarity: string | undefined) => void;
  equipmentType?: EquipmentType;
}

export function ModSlotGrid({
  slots,
  onDrop,
  onRemove,
  onRankChange,
  onSetRankChange,
  onEditRiven,
  onSlotClick,
  onSwap,
  activeSlotIndex,
  formaMode = false,
  onPolarityChange,
  equipmentType = 'warframe',
}: ModSlotGridProps) {
  const specialSlots = slots.filter(
    (s) => s.type === 'aura' || s.type === 'stance' || s.type === 'posture',
  );
  const generalSlots = slots.filter((s) => s.type === 'general');
  const exilusSlot = slots.find((s) => s.type === 'exilus');

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
  };

  const handleDrop = (slotIndex: number, e: React.DragEvent) => {
    e.preventDefault();
    const rawData = e.dataTransfer.getData('application/json');
    try {
      if (rawData) {
        const parsed = JSON.parse(rawData);
        if (parsed.__remove) {
          onRemove(slotIndex);
        } else if (parsed.__sourceSlotIndex !== undefined) {
          onSwap?.(parsed.__sourceSlotIndex, slotIndex);
        } else {
          onDrop(slotIndex, parsed as Mod);
        }
      }
    } catch (error) {
      console.warn(
        '[ModSlotGrid.handleDrop] Failed to parse drag payload',
        { slotIndex, rawData },
        error,
      );
    }
  };

  const handleFormaClick = (
    slotIndex: number,
    currentPolarity: string | undefined,
    slotType: SlotType,
    reverse = false,
  ) => {
    if (!formaMode || !onPolarityChange) return;
    const cycle = getPolarityCycle(slotType, equipmentType);
    const currentIdx = cycle.indexOf(currentPolarity);
    const len = cycle.length;
    const nextIdx = reverse ? (currentIdx - 1 + len) % len : (currentIdx + 1) % len;
    onPolarityChange(slotIndex, cycle[nextIdx]);
  };

  const rows: ModSlot[][] = [];
  for (let i = 0; i < generalSlots.length; i += 4) {
    rows.push(generalSlots.slice(i, i + 4));
  }

  const umbraSetEquippedCount = useMemo(() => countEquippedUmbraSetMods(slots), [slots]);

  return (
    <div className="glass-panel relative z-10 space-y-1 overflow-visible p-3">
      {(specialSlots.length > 0 || exilusSlot) && (
        <div className="grid grid-cols-4 gap-1">
          <div />
          {specialSlots[0] ? (
            <SlotCell
              slot={specialSlots[0]}
              umbraSetEquippedCount={umbraSetEquippedCount}
              active={activeSlotIndex === specialSlots[0].index}
              formaMode={formaMode}
              onDragOver={handleDragOver}
              onDrop={(e) => handleDrop(specialSlots[0].index, e)}
              onRemove={() => onRemove(specialSlots[0].index)}
              onRankChange={(rank) => onRankChange(specialSlots[0].index, rank)}
              onSetRankChange={(sr) => onSetRankChange(specialSlots[0].index, sr)}
              onEditRiven={onEditRiven ? () => onEditRiven(specialSlots[0].index) : undefined}
              onClick={() =>
                formaMode
                  ? handleFormaClick(
                      specialSlots[0].index,
                      specialSlots[0].polarity,
                      specialSlots[0].type,
                    )
                  : onSlotClick?.(specialSlots[0].index, specialSlots[0].type)
              }
              onRightClick={() =>
                handleFormaClick(
                  specialSlots[0].index,
                  specialSlots[0].polarity,
                  specialSlots[0].type,
                  true,
                )
              }
              label={specialSlots[0].type.charAt(0).toUpperCase() + specialSlots[0].type.slice(1)}
            />
          ) : (
            <div />
          )}
          {exilusSlot ? (
            <SlotCell
              slot={exilusSlot}
              umbraSetEquippedCount={umbraSetEquippedCount}
              active={activeSlotIndex === exilusSlot.index}
              formaMode={formaMode}
              onDragOver={handleDragOver}
              onDrop={(e) => handleDrop(exilusSlot.index, e)}
              onRemove={() => onRemove(exilusSlot.index)}
              onRankChange={(rank) => onRankChange(exilusSlot.index, rank)}
              onSetRankChange={(sr) => onSetRankChange(exilusSlot.index, sr)}
              onEditRiven={onEditRiven ? () => onEditRiven(exilusSlot.index) : undefined}
              onClick={() =>
                formaMode
                  ? handleFormaClick(exilusSlot.index, exilusSlot.polarity, exilusSlot.type)
                  : onSlotClick?.(exilusSlot.index, exilusSlot.type)
              }
              onRightClick={() =>
                handleFormaClick(exilusSlot.index, exilusSlot.polarity, exilusSlot.type, true)
              }
              label="Exilus"
            />
          ) : (
            <div />
          )}
          <div />
        </div>
      )}

      <div className="space-y-1">
        {rows.map((row, rowIndex) => (
          <div key={rowIndex} className="grid grid-cols-4 gap-1">
            {row.map((slot) => (
              <SlotCell
                key={slot.index}
                slot={slot}
                umbraSetEquippedCount={umbraSetEquippedCount}
                active={activeSlotIndex === slot.index}
                formaMode={formaMode}
                onDragOver={handleDragOver}
                onDrop={(e) => handleDrop(slot.index, e)}
                onRemove={() => onRemove(slot.index)}
                onRankChange={(rank) => onRankChange(slot.index, rank)}
                onSetRankChange={(sr) => onSetRankChange(slot.index, sr)}
                onEditRiven={onEditRiven ? () => onEditRiven(slot.index) : undefined}
                onClick={() =>
                  formaMode
                    ? handleFormaClick(slot.index, slot.polarity, slot.type)
                    : onSlotClick?.(slot.index, slot.type)
                }
                onRightClick={() => handleFormaClick(slot.index, slot.polarity, slot.type, true)}
              />
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}

function PolarityIcon({
  polarity,
  mod,
  size = 14,
}: {
  polarity?: string;
  mod?: Mod;
  size?: number;
}) {
  if (!polarity) return null;

  const iconName = POLARITY_ICONS[polarity];
  if (!iconName) return null;

  let filterStyle = 'brightness(0) invert(1) opacity(0.7)';
  if (mod?.polarity) {
    const match = polarityMatchForUi(polarity, mod.polarity);
    if (match === 'match') {
      filterStyle = 'brightness(0) invert(0.5) sepia(1) saturate(5) hue-rotate(85deg)';
    } else if (match === 'mismatch') {
      filterStyle = 'brightness(0) invert(0.5) sepia(1) saturate(5) hue-rotate(-10deg)';
    }
  }

  return (
    <img
      src={`/icons/polarity/${iconName}.svg`}
      alt={POLARITY_LABELS[polarity] || polarity}
      style={{
        width: size,
        height: size,
        filter: `${filterStyle} drop-shadow(0 0 1.5px rgba(0,0,0,1)) drop-shadow(0 0 1.5px rgba(0,0,0,1))`,
      }}
      draggable={false}
    />
  );
}

interface SlotCellProps {
  slot: ModSlot;
  umbraSetEquippedCount: number;
  active?: boolean;
  formaMode?: boolean;
  onDragOver: (e: React.DragEvent) => void;
  onDrop: (e: React.DragEvent) => void;
  onRemove: () => void;
  onRankChange: (rank: number) => void;
  onSetRankChange: (rank: number) => void;
  onEditRiven?: () => void;
  onClick?: () => void;
  onRightClick?: () => void;
  label?: string;
}

const SLOT_SCALE = 0.75;
const SLOT_W = Math.round(DEFAULT_LAYOUT.cardWidth * SLOT_SCALE);
const SLOT_H = Math.round(DEFAULT_LAYOUT.collapsedHeight * SLOT_SCALE);

function SlotCell({
  slot,
  umbraSetEquippedCount,
  active,
  formaMode,
  onDragOver,
  onDrop,
  onRemove,
  onRankChange,
  onSetRankChange,
  onEditRiven,
  onClick,
  onRightClick,
  label,
}: SlotCellProps) {
  const [isDragging, setIsDragging] = useState(false);
  const [isDragOver, setIsDragOver] = useState(false);
  const slotRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setIsDragging(false);
  }, [slot.mod?.unique_name]);

  const slotModIsUmbra = slot.mod ? isUmbraSelfScalingSetMod(slot.mod) : false;

  const polarityLabel = slot.polarity ? POLARITY_LABELS[slot.polarity] || slot.polarity : 'None';
  const slotIconName =
    slot.type === 'aura'
      ? 'aura'
      : slot.type === 'stance'
        ? 'stance'
        : slot.type === 'posture'
          ? 'posture'
          : slot.type === 'exilus'
            ? 'exilus'
            : '';

  const canDrag = !!slot.mod && !formaMode;

  const handleSlotDragStart = (e: React.DragEvent) => {
    if (!slot.mod || formaMode) return;
    e.dataTransfer.setData(
      'application/json',
      JSON.stringify({
        ...slot.mod,
        __sourceSlotIndex: slot.index,
        __sourceRank: slot.rank,
      }),
    );
    e.dataTransfer.effectAllowed = 'move';
    setIsDragging(true);
  };

  const handleSlotDragEnd = () => {
    setIsDragging(false);
  };

  const handleLocalDragOver = (e: React.DragEvent) => {
    onDragOver(e);
    setIsDragOver(true);
  };

  const handleLocalDragLeave = () => {
    setIsDragOver(false);
  };

  const handleLocalDrop = (e: React.DragEvent) => {
    setIsDragOver(false);
    onDrop(e);
  };

  return (
    <div
      ref={slotRef}
      style={{ width: SLOT_W, height: SLOT_H, marginBottom: 4 }}
      className={`relative overflow-visible rounded-lg transition-opacity select-none ${
        active && !formaMode ? 'ring-accent ring-1' : ''
      } ${isDragging ? 'opacity-40' : ''} ${isDragOver ? 'ring-accent/60 ring-2' : ''}`}
      onDragOver={!formaMode ? handleLocalDragOver : undefined}
      onDragLeave={!formaMode ? handleLocalDragLeave : undefined}
      onDrop={!formaMode ? handleLocalDrop : undefined}
      onClick={onClick}
      onContextMenu={(e) => {
        e.preventDefault();
        if (formaMode && onRightClick) {
          onRightClick();
        } else if (slot.mod && !formaMode) {
          onRemove();
        }
      }}
    >
      {slot.mod ? (
        <>
          <div
            className={`absolute left-0 select-none ${!formaMode ? 'mod-slot-card' : ''}`}
            style={{
              width: SLOT_W,
              bottom: 0,
              cursor: canDrag ? 'grab' : undefined,
            }}
            draggable={canDrag || undefined}
            onDragStart={canDrag ? handleSlotDragStart : undefined}
            onDragEnd={canDrag ? handleSlotDragEnd : undefined}
          >
            <div className="pointer-events-none">
              <ModCard
                mod={slot.mod}
                rank={slot.rank ?? 0}
                setRank={slot.setRank}
                slotType={slot.type}
                slotPolarity={slot.polarity}
                umbraSetEquippedCount={umbraSetEquippedCount}
                collapsed
                scale={SLOT_SCALE}
              />
            </div>
            {!formaMode && (
              <div
                className="mod-slot-expanded relative"
                style={{ width: SLOT_W }}
                onMouseMove={(event) => applyCardTiltFromMouse(event.currentTarget, event)}
                onMouseLeave={(event) => resetCardTilt(event.currentTarget)}
              >
                <ModCard
                  mod={slot.mod}
                  rank={slot.rank ?? 0}
                  setRank={slot.setRank}
                  slotType={slot.type}
                  slotPolarity={slot.polarity}
                  umbraSetEquippedCount={umbraSetEquippedCount}
                  collapsed={false}
                  scale={SLOT_SCALE}
                />
                <div
                  className="absolute left-0 flex w-full items-center justify-center"
                  style={{
                    top:
                      Math.round(
                        (DEFAULT_LAYOUT.rankOffsetY + DEFAULT_LAYOUT.cardOffsetY) * SLOT_SCALE,
                      ) - 5,
                    height: 16,
                  }}
                  onClick={(e) => e.stopPropagation()}
                >
                  {(slot.mod.fusion_limit ?? 0) > 0 && (
                    <button
                      onClick={() => onRankChange(Math.max(0, (slot.rank ?? 0) - 1))}
                      className="border-glass-border bg-glass-active text-foreground hover:bg-glass-hover absolute left-[32px] flex h-[14px] w-[22px] items-center justify-center rounded-full border text-[9px] font-bold backdrop-blur-md transition-colors"
                      title="Decrease rank"
                    >
                      −
                    </button>
                  )}
                  {(slot.mod.fusion_limit ?? 0) > 0 && (
                    <button
                      onClick={() =>
                        onRankChange(Math.min(slot.mod!.fusion_limit ?? 0, (slot.rank ?? 0) + 1))
                      }
                      className="border-glass-border bg-glass-active text-foreground hover:bg-glass-hover absolute right-[32px] flex h-[14px] w-[22px] items-center justify-center rounded-full border text-[9px] font-bold backdrop-blur-md transition-colors"
                      title="Increase rank"
                    >
                      +
                    </button>
                  )}
                  {slot.mod!.set_stats &&
                    (slot.mod!.set_num_in_set ?? 0) > 0 &&
                    !slotModIsUmbra && (
                      <>
                        <button
                          onClick={() => onSetRankChange(Math.max(1, (slot.setRank ?? 1) - 1))}
                          className="border-warning/30 bg-glass-active text-warning hover:bg-glass-hover absolute left-[52px] flex h-[14px] w-[16px] items-center justify-center rounded-full border text-[9px] font-bold backdrop-blur-md transition-colors"
                          title="Decrease set rank"
                        >
                          −
                        </button>
                        <button
                          onClick={() =>
                            onSetRankChange(
                              Math.min(slot.mod!.set_num_in_set ?? 0, (slot.setRank ?? 1) + 1),
                            )
                          }
                          className="border-warning/30 bg-glass-active text-warning hover:bg-glass-hover absolute right-[52px] flex h-[14px] w-[16px] items-center justify-center rounded-full border text-[9px] font-bold backdrop-blur-md transition-colors"
                          title="Increase set rank"
                        >
                          +
                        </button>
                      </>
                    )}
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      onEditRiven?.();
                    }}
                    className={`border-glass-border bg-glass-active text-foreground hover:text-accent absolute left-[12px] flex h-[15px] w-[15px] items-center justify-center rounded-full border text-[7px] font-bold backdrop-blur-md transition-colors ${
                      isRivenMod(slot.mod) ? '' : 'hidden'
                    }`}
                    title="Edit Riven"
                  >
                    E
                  </button>
                  <button
                    onClick={onRemove}
                    className="border-glass-border bg-glass-active text-foreground hover:text-danger absolute right-[12px] flex h-[15px] w-[15px] items-center justify-center rounded-full border text-[7px] font-bold backdrop-blur-md transition-colors"
                    title="Remove"
                  >
                    ✕
                  </button>
                </div>
              </div>
            )}
          </div>
          {slot.polarity && (
            <div className="absolute top-1 right-1 z-10">
              <PolarityIcon polarity={slot.polarity} mod={slot.mod} size={12} />
            </div>
          )}
          {formaMode && (
            <div className="border-warning/60 bg-warning/15 hover:bg-warning/25 absolute inset-0 z-20 flex cursor-pointer flex-col items-center justify-center rounded-lg border-2 border-dashed transition-[background-color,border-color] duration-200">
              {slot.polarity ? (
                <PolarityIcon polarity={slot.polarity} size={20} />
              ) : (
                <span className="text-muted/40 text-sm">-</span>
              )}
              <span className="text-warning/80 mt-0.5 text-[9px] font-medium">{polarityLabel}</span>
            </div>
          )}
        </>
      ) : (
        <>
          <CardPreview
            layout={{ ...DEFAULT_LAYOUT, scale: SLOT_SCALE }}
            rarity="Empty"
            polarity=""
            modArt=""
            modName=""
            modType=""
            modDescription=""
            drain={0}
            rank={0}
            maxRank={0}
            damageValue=""
            damageType="none"
            collapsed
          />

          {formaMode ? (
            <>
              <div className="border-warning/50 bg-warning/10 hover:bg-warning/20 absolute inset-0 z-20 flex cursor-pointer flex-col items-center justify-center rounded-lg border-2 border-dashed transition-[background-color,border-color] duration-200">
                {slot.polarity ? (
                  <PolarityIcon polarity={slot.polarity} size={24} />
                ) : (
                  <span className="text-muted/30 text-lg">-</span>
                )}
                <span className="text-warning/70 mt-0.5 text-[9px]">{polarityLabel}</span>
                {label && <span className="text-muted/40 text-[8px]">{label}</span>}
              </div>
              {slotIconName && !slot.polarity && (
                <img
                  src={`/icons/icon-${slotIconName}.png`}
                  alt={slotIconName}
                  className="invert-on-light pointer-events-none absolute top-1/3 left-1/2 z-10 -translate-x-1/2 -translate-y-1/2"
                  style={{ height: 20, width: 'auto', opacity: 0.3 }}
                  draggable={false}
                />
              )}
            </>
          ) : (
            <>
              {slotIconName && (
                <img
                  src={`/icons/icon-${slotIconName}.png`}
                  alt={slotIconName}
                  className="invert-on-light pointer-events-none absolute top-1/2 left-1/2 z-10 -translate-x-1/2 -translate-y-1/2"
                  style={{ height: 28, width: 'auto', opacity: 0.5 }}
                  draggable={false}
                />
              )}
              {slot.polarity && (
                <div className="pointer-events-none absolute top-1 right-1 z-10">
                  <PolarityIcon polarity={slot.polarity} size={12} />
                </div>
              )}
              {label && (
                <span className="text-muted/40 pointer-events-none absolute bottom-2 left-1/2 z-10 -translate-x-1/2 text-[10px] font-medium tracking-wider uppercase">
                  {label}
                </span>
              )}
            </>
          )}
        </>
      )}
    </div>
  );
}
