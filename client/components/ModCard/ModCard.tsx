import { useState, useRef, useEffect } from 'react';
import { createPortal } from 'react-dom';

import type { Mod, SlotType } from '../../types/warframe';
import { sanitizeDisplayTextKeepDamageTokens } from '../../utils/damageTypeTokens';
import { calculateEffectiveDrain, polarityMatchForUi } from '../../utils/drain';
import { isPostureMod } from '../../utils/modFiltering';
import { isRivenMod } from '../../utils/riven';
import { DEFAULT_LAYOUT, dbRarityToCardRarity, dbPolarityToIconName } from './cardLayout';
import { CardPreview } from './CardPreview';

const WINDOW_REPOSITION_LISTENERS: AddEventListenerOptions = { capture: true, passive: true };

interface ModCardProps {
  mod: Mod;
  rank?: number;
  setRank?: number;
  slotType?: SlotType;
  slotPolarity?: string;
  onRemove?: () => void;
  onRankChange?: (rank: number) => void;
  onSetRankChange?: (setRank: number) => void;
  draggable?: boolean;
  lockedOut?: boolean;
  collapsed?: boolean;
  scale?: number;
}

export function ModCard({
  mod,
  rank = 0,
  setRank,
  slotType = 'general',
  slotPolarity,
  onRemove,
  onRankChange,
  onSetRankChange,
  draggable = false,
  lockedOut = false,
  collapsed = false,
  scale,
}: ModCardProps) {
  const [hovered, setHovered] = useState(false);
  const cardRef = useRef<HTMLDivElement>(null);

  const maxRank = mod.fusion_limit ?? 0;
  const baseDrain = mod.base_drain ?? 0;
  const effectiveDrain = calculateEffectiveDrain(
    baseDrain,
    rank,
    maxRank,
    slotPolarity,
    mod.polarity,
    slotType,
    isRivenMod(mod),
  );

  const rarity =
    (mod.type || '').toUpperCase() === 'RIVEN'
      ? 'Riven'
      : dbRarityToCardRarity(mod.rarity, mod.name || mod.unique_name);
  const polarity = dbPolarityToIconName(mod.polarity);
  const modArt = mod.image_path ? `/images${mod.image_path}` : '';

  let description = '';
  try {
    if (mod.description) {
      const descriptions: string[] = JSON.parse(mod.description);
      const raw = descriptions[Math.min(rank, descriptions.length - 1)] ?? '';
      description = sanitizeDisplayTextKeepDamageTokens(raw);
    }
  } catch {
    description = sanitizeDisplayTextKeepDamageTokens(mod.description ?? '');
  }

  let setDescription = '';
  const maxSetRank = mod.set_num_in_set ?? 0;
  const effectiveSetRank = setRank ?? (maxSetRank > 0 ? 1 : 0);
  if (mod.set_stats && maxSetRank > 0) {
    try {
      const setStats: string[] = JSON.parse(mod.set_stats);
      const idx = Math.min(Math.max(effectiveSetRank - 1, 0), setStats.length - 1);
      setDescription = sanitizeDisplayTextKeepDamageTokens(setStats[idx] ?? '');
    } catch {
      // ignore
    }
  }

  const modType = mod.compat_name?.toUpperCase() ?? '';

  const modTypeUpper = (mod.type || '').toUpperCase();
  const slotIcon =
    modTypeUpper === 'AURA'
      ? 'aura'
      : modTypeUpper === 'STANCE'
        ? isPostureMod(mod)
          ? 'posture'
          : 'stance'
        : mod.is_utility === 1
          ? 'exilus'
          : '';

  const displayDrain = Math.abs(effectiveDrain);

  const polarityMatch = polarityMatchForUi(slotPolarity, mod.polarity);

  const layout = {
    ...DEFAULT_LAYOUT,
    ...(scale != null ? { scale } : {}),
  };

  const handleDragStart = (e: React.DragEvent) => {
    e.dataTransfer.setData('application/json', JSON.stringify(mod));
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

      requestAnimationFrame(() => {
        document.body.removeChild(clone);
      });
    }
  };

  return (
    <div
      ref={cardRef}
      className={`relative inline-block ${lockedOut ? 'opacity-40' : ''}`}
      draggable={(draggable && !lockedOut) || undefined}
      onDragStart={draggable && !lockedOut ? handleDragStart : undefined}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        cursor: lockedOut ? 'not-allowed' : draggable ? 'grab' : 'default',
      }}
    >
      <CardPreview
        layout={layout}
        rarity={rarity}
        polarity={polarity}
        modArt={modArt}
        modName={mod.name}
        modType={modType}
        modDescription={description}
        setDescription={setDescription}
        setActive={effectiveSetRank}
        setTotal={maxSetRank}
        modSet={mod.mod_set}
        drain={displayDrain}
        rank={rank}
        maxRank={maxRank}
        slotIcon={slotIcon}
        polarityMatch={polarityMatch}
        collapsed={collapsed}
      />

      {collapsed && hovered && !onRemove && (
        <CollapsedHoverExpand
          cardRef={cardRef}
          layout={layout}
          rarity={rarity}
          polarity={polarity}
          modArt={modArt}
          modName={mod.name}
          modType={modType}
          modDescription={description}
          setDescription={setDescription}
          setActive={effectiveSetRank}
          setTotal={maxSetRank}
          modSet={mod.mod_set}
          drain={displayDrain}
          rank={rank}
          maxRank={maxRank}
          slotIcon={slotIcon}
          polarityMatch={polarityMatch}
        />
      )}

      {hovered && !collapsed && (
        <>
          {onRemove && (
            <button
              onClick={onRemove}
              className="border-glass-border bg-glass-active text-danger hover:bg-glass-hover absolute top-0.5 right-0.5 z-50 flex h-4 w-4 items-center justify-center rounded-full border text-[10px] font-bold shadow-lg transition-opacity"
            >
              X
            </button>
          )}
          {onRankChange && maxRank > 0 && (
            <RankStars rank={rank} maxRank={maxRank} onChange={onRankChange} />
          )}
          {onSetRankChange && maxSetRank > 0 && (
            <SetRankDots
              setRank={setRank ?? 1}
              maxSetRank={maxSetRank}
              onChange={onSetRankChange}
              hasRankStars={!!onRankChange && maxRank > 0}
            />
          )}
        </>
      )}
    </div>
  );
}

function RankStars({
  rank,
  maxRank,
  onChange,
}: {
  rank: number;
  maxRank: number;
  onChange: (rank: number) => void;
}) {
  const [hoverIndex, setHoverIndex] = useState<number | null>(null);

  const targetRank = hoverIndex !== null ? hoverIndex + 1 : null;

  return (
    <div
      className="border-glass-border bg-glass-active absolute bottom-1 left-1/2 z-50 flex -translate-x-1/2 items-center gap-0.5 rounded border px-1.5 py-1 backdrop-blur-md"
      onMouseLeave={() => setHoverIndex(null)}
    >
      <button
        onMouseEnter={() => setHoverIndex(-1)}
        onClick={() => onChange(0)}
        className={`mr-0.5 flex h-2.5 w-2.5 items-center justify-center rounded-sm text-[8px] leading-none font-bold transition-colors ${
          hoverIndex === -1
            ? 'bg-danger text-white'
            : rank === 0
              ? 'bg-accent text-white'
              : 'bg-glass-active/50 text-muted/50'
        }`}
        title="Rank 0"
      >
        0
      </button>
      {Array.from({ length: maxRank }, (_, i) => {
        const starRank = i + 1;
        let colorClass: string;

        if (hoverIndex === null) {
          colorClass = i < rank ? 'bg-accent' : 'bg-glass-active/50';
        } else if (hoverIndex === -1) {
          colorClass = i < rank ? 'bg-danger' : 'bg-glass-active/50';
        } else if (
          targetRank !== null &&
          targetRank < rank &&
          starRank > targetRank &&
          starRank <= rank
        ) {
          colorClass = 'bg-danger';
        } else if (starRank <= (targetRank ?? 0)) {
          colorClass = 'bg-accent';
        } else {
          colorClass = 'bg-glass-active/50';
        }

        return (
          <button
            key={i}
            onMouseEnter={() => setHoverIndex(i)}
            onClick={() => onChange(starRank)}
            className={`h-2.5 w-2.5 rounded-full transition-colors ${colorClass}`}
            title={`Rank ${starRank}`}
          />
        );
      })}
    </div>
  );
}

function CollapsedHoverExpand({
  cardRef,
  layout,
  ...previewProps
}: {
  cardRef: React.RefObject<HTMLDivElement | null>;
  layout: typeof DEFAULT_LAYOUT;
} & Omit<
  React.ComponentProps<typeof CardPreview>,
  'layout' | 'collapsed' | 'showGuides' | 'showOutlines'
>) {
  const [pos, setPos] = useState<{ x: number; y: number } | null>(null);
  const [tilt, setTilt] = useState<{ rx: number; ry: number }>({
    rx: 0,
    ry: 0,
  });
  const TILT_MAX_DEG = 15;

  useEffect(() => {
    const node = cardRef.current;
    if (!node) {
      setPos(null);
      return () => undefined;
    }

    const updatePos = (): void => {
      const rect = node.getBoundingClientRect();
      setPos({ x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 });
    };

    updatePos();
    window.addEventListener('scroll', updatePos, WINDOW_REPOSITION_LISTENERS);
    window.addEventListener('resize', updatePos, { passive: true });

    let resizeObserver: ResizeObserver | null = null;
    if (typeof ResizeObserver !== 'undefined') {
      resizeObserver = new ResizeObserver(() => {
        updatePos();
      });
      resizeObserver.observe(node);
    }

    return () => {
      window.removeEventListener('scroll', updatePos, WINDOW_REPOSITION_LISTENERS);
      window.removeEventListener('resize', updatePos);
      resizeObserver?.disconnect();
    };
  }, [cardRef]);

  useEffect(() => {
    const node = cardRef.current;
    if (!node) return undefined;

    const onMove = (event: MouseEvent): void => {
      const rect = node.getBoundingClientRect();
      if (rect.width <= 0 || rect.height <= 0) return;
      const px = (event.clientX - rect.left) / rect.width;
      const py = (event.clientY - rect.top) / rect.height;
      const ry = (px - 0.5) * 2 * TILT_MAX_DEG;
      const rx = (0.5 - py) * 2 * TILT_MAX_DEG;
      setTilt({ rx, ry });
    };

    const onLeave = (): void => {
      setTilt({ rx: 0, ry: 0 });
    };

    node.addEventListener('mousemove', onMove);
    node.addEventListener('mouseleave', onLeave);

    return () => {
      node.removeEventListener('mousemove', onMove);
      node.removeEventListener('mouseleave', onLeave);
    };
  }, [cardRef]);

  if (!pos) return null;

  return createPortal(
    <div
      className="mod-selector-expand pointer-events-none fixed z-[9999]"
      style={{ left: pos.x, top: pos.y, transform: 'translate(-50%, -50%)' }}
    >
      <div
        className="mod-selector-tilt"
        style={{
          transform: `rotateX(${tilt.rx.toFixed(2)}deg) rotateY(${tilt.ry.toFixed(2)}deg)`,
        }}
      >
        <CardPreview layout={layout} {...previewProps} />
      </div>
    </div>,
    document.body,
  );
}

function SetRankDots({
  setRank,
  maxSetRank,
  onChange,
  hasRankStars,
}: {
  setRank: number;
  maxSetRank: number;
  onChange: (rank: number) => void;
  hasRankStars: boolean;
}) {
  const [hoverIndex, setHoverIndex] = useState<number | null>(null);
  const targetRank = hoverIndex !== null ? hoverIndex + 1 : null;

  return (
    <div
      className="border-glass-border bg-glass-active absolute left-1/2 z-50 flex -translate-x-1/2 items-center gap-0.5 rounded border px-1.5 py-1 backdrop-blur-md"
      style={{ bottom: hasRankStars ? 24 : 4 }}
      onMouseLeave={() => setHoverIndex(null)}
    >
      <span
        className="mr-0.5 text-[7px] leading-none font-semibold uppercase"
        style={{ color: 'rgba(200,170,100,0.6)' }}
      >
        Set
      </span>
      {Array.from({ length: maxSetRank }, (_, i) => {
        const dotRank = i + 1;
        let bg: string;

        if (hoverIndex === null) {
          bg = dotRank <= setRank ? 'rgb(200,170,100)' : 'rgba(200,170,100,0.2)';
        } else if (
          targetRank !== null &&
          targetRank < setRank &&
          dotRank > targetRank &&
          dotRank <= setRank
        ) {
          bg = 'rgb(220,80,80)';
        } else if (dotRank <= (targetRank ?? 0)) {
          bg = 'rgb(200,170,100)';
        } else {
          bg = 'rgba(200,170,100,0.2)';
        }

        return (
          <button
            key={i}
            onMouseEnter={() => setHoverIndex(i)}
            onClick={() => onChange(dotRank)}
            className="h-2.5 w-2.5 rounded-full transition-colors"
            style={{ backgroundColor: bg }}
            title={`Set pieces: ${dotRank}`}
          />
        );
      })}
    </div>
  );
}
