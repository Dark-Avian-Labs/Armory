import { useState, useRef, useEffect, useLayoutEffect, useCallback } from 'react';

import { useApi } from '../../hooks/useApi';
import type { EquipmentType } from '../../types/warframe';
import { getMaxRank, getArcaneDescription } from '../../utils/arcaneUtils';
import { GlassTooltip } from '../GlassTooltip';
import { ArcaneCardPreview } from '../ModCard/ArcaneCardPreview';
import { DEFAULT_ARCANE_LAYOUT, normalizeArcaneRarity } from '../ModCard/cardLayout';
import type { Arcane } from './ArcaneSlots';

interface ArcanePickerPanelProps {
  equipmentType: EquipmentType;
  currentArcaneName?: string;
  onSelect: (arcane: Arcane) => void;
  onRemove: () => void;
  onClose: () => void;
}

const COLS = 4;

export function ArcanePickerPanel({
  equipmentType,
  currentArcaneName,
  onSelect,
  onRemove,
  onClose,
}: ArcanePickerPanelProps) {
  const [search, setSearch] = useState('');
  const { data, loading } = useApi<{ items: Arcane[] }>(
    `/api/arcanes?equipment_type=${encodeURIComponent(equipmentType)}`,
  );
  const arcanes = data?.items || [];

  const filtered = arcanes.filter((a) => a.name.toLowerCase().includes(search.toLowerCase()));

  const gridRef = useRef<HTMLDivElement>(null);
  const [cardScale, setCardScale] = useState<number>(0);

  const measure = useCallback(() => {
    if (!gridRef.current) return;
    const width = gridRef.current.clientWidth;
    if (width > 0) {
      setCardScale(width / (COLS * DEFAULT_ARCANE_LAYOUT.cardWidth));
    }
  }, []);

  useLayoutEffect(() => {
    measure();
  }, [measure]);

  useEffect(() => {
    if (!gridRef.current) return undefined;
    const observer = new ResizeObserver(measure);
    observer.observe(gridRef.current);
    return () => observer.disconnect();
  }, [measure]);

  return (
    <div className="mod-builder-side-panel flex min-h-0 flex-col">
      <div className="mb-3 flex items-center justify-between">
        <div>
          <h2 className="text-foreground text-lg font-semibold">Arcanes</h2>
          {currentArcaneName && (
            <p className="text-muted text-xs">
              Current: <span className="text-accent">{currentArcaneName}</span>
            </p>
          )}
        </div>
        <button
          onClick={onClose}
          className="border-glass-border text-muted hover:bg-glass-hover hover:text-foreground rounded-lg border px-2.5 py-1 text-xs transition-[color,background-color,border-color] duration-200"
        >
          Back to Mods
        </button>
      </div>

      <input
        type="text"
        placeholder="Search arcanes..."
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        className="form-input mb-3"
        autoFocus
      />

      <div className="text-muted mb-2 text-xs">{filtered.length} arcanes available</div>

      <div className="custom-scroll max-h-[calc(100vh-420px)] overflow-y-auto">
        {loading && <p className="text-muted text-sm">Loading arcanes...</p>}
        {!loading && filtered.length === 0 && (
          <p className="text-muted text-sm">No arcanes match the search.</p>
        )}
        <div ref={gridRef} className="grid grid-cols-4">
          {cardScale > 0 && !loading && filtered.length > 0 && (
            <>
              {!search && (
                <div
                  onClick={onRemove}
                  draggable
                  onDragStart={(e) => {
                    e.dataTransfer.setData(
                      'application/arcane',
                      JSON.stringify({ __remove: true }),
                    );
                    e.dataTransfer.effectAllowed = 'move';
                    const el = e.currentTarget;
                    const clone = el.cloneNode(true) as HTMLElement;
                    clone.style.position = 'fixed';
                    clone.style.top = '-9999px';
                    clone.style.left = '-9999px';
                    clone.style.zIndex = '-1';
                    clone.style.pointerEvents = 'none';
                    document.body.appendChild(clone);
                    const rect = el.getBoundingClientRect();
                    e.dataTransfer.setDragImage(clone, rect.width / 2, rect.height / 2);
                    requestAnimationFrame(() => document.body.removeChild(clone));
                  }}
                  className="cursor-grab"
                >
                  <ArcaneCardPreview
                    layout={{ ...DEFAULT_ARCANE_LAYOUT, scale: cardScale }}
                    rarity="empty"
                    arcaneArt=""
                    arcaneName="Remove"
                    rank={0}
                    maxRank={0}
                  />
                </div>
              )}
              {filtered.map((arcane) => (
                <ArcanePickerCard
                  key={arcane.unique_name}
                  arcane={arcane}
                  scale={cardScale}
                  onClick={() => onSelect(arcane)}
                />
              ))}
            </>
          )}
        </div>
      </div>
    </div>
  );
}

function ArcanePickerCard({
  arcane,
  scale,
  onClick,
}: {
  arcane: Arcane;
  scale: number;
  onClick: () => void;
}) {
  const desc = getArcaneDescription(arcane);
  const cardRef = useRef<HTMLDivElement>(null);
  const maxRank = getMaxRank(arcane);

  const handleDragStart = (e: React.DragEvent) => {
    e.dataTransfer.setData('application/arcane', JSON.stringify(arcane));
    e.dataTransfer.effectAllowed = 'move';
    if (cardRef.current) {
      const el = cardRef.current;
      const clone = el.cloneNode(true) as HTMLElement;
      clone.style.position = 'fixed';
      clone.style.top = '-9999px';
      clone.style.left = '-9999px';
      clone.style.zIndex = '-1';
      clone.style.pointerEvents = 'none';
      document.body.appendChild(clone);
      const rect = el.getBoundingClientRect();
      e.dataTransfer.setDragImage(clone, rect.width / 2, rect.height / 2);
      requestAnimationFrame(() => document.body.removeChild(clone));
    }
  };

  const tooltipContent = desc ? (
    <>
      <div className="text-foreground mb-1 text-xs font-semibold">{arcane.name}</div>
      <div className="text-muted text-[10px] leading-tight">{desc}</div>
      {arcane.rarity && <div className="text-muted/50 mt-1 text-[9px]">{arcane.rarity}</div>}
    </>
  ) : null;

  return (
    <GlassTooltip content={tooltipContent} disabled={!desc}>
      <div
        ref={cardRef}
        onClick={onClick}
        draggable
        onDragStart={handleDragStart}
        className="cursor-grab"
      >
        <ArcaneCardPreview
          layout={{ ...DEFAULT_ARCANE_LAYOUT, scale }}
          rarity={normalizeArcaneRarity(arcane.rarity)}
          arcaneArt={arcane.image_path ? `/images${arcane.image_path}` : ''}
          arcaneName={arcane.name}
          rank={maxRank}
          maxRank={maxRank}
        />
      </div>
    </GlassTooltip>
  );
}
