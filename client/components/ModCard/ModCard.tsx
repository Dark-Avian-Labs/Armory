import { useState, useRef, useEffect } from 'react';
import { createPortal } from 'react-dom';

import { useTheme } from '../../context/ThemeContext';
import type { Mod, SlotType } from '../../types/warframe';
import { calculateEffectiveDrain, polarityMatchForUi } from '../../utils/drain';
import { getModCardDisplayTexts } from '../../utils/modDisplayText';
import { isPostureMod } from '../../utils/modFiltering';
import { isRivenMod } from '../../utils/riven';
import {
  CARD_HOVER_TILT_MAX_DEG,
  DEFAULT_LAYOUT,
  dbRarityToCardRarity,
  dbPolarityToIconName,
  getCardFoilStyle,
  getModCardFoilClass,
  resolveModCardArt,
} from './cardLayout';
import { CardPreview } from './CardPreview';

const WINDOW_REPOSITION_LISTENERS: AddEventListenerOptions = { capture: true, passive: true };

export type ModPreviewDisplay = {
  layout: typeof DEFAULT_LAYOUT;
  rarity: ReturnType<typeof dbRarityToCardRarity>;
  polarity: ReturnType<typeof dbPolarityToIconName>;
  modArt: string;
  modArtOverlay?: string;
  modName: string;
  modType: string;
  modDescription: string;
  setDescription: string | undefined;
  setActive: number;
  setTotal: number;
  modSet: string | undefined;
  drain: number;
  rank: number;
  maxRank: number;
  slotIcon: string;
  polarityMatch: ReturnType<typeof polarityMatchForUi>;
};

export function getModPreviewDisplay(
  mod: Mod,
  options?: {
    rank?: number;
    setRank?: number;
    slotType?: SlotType;
    slotPolarity?: string;
    umbraSetEquippedCount?: number;
    scale?: number;
    atragraphModsEnabled?: boolean;
  },
): ModPreviewDisplay {
  const rank = options?.rank ?? 0;
  const setRank = options?.setRank;
  const slotType = options?.slotType ?? 'general';
  const slotPolarity = options?.slotPolarity;
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
  const atragraphModsEnabled = options?.atragraphModsEnabled ?? true;
  const { modArt, modArtOverlay } = resolveModCardArt(mod, atragraphModsEnabled);
  const maxSetRank = mod.set_num_in_set ?? 0;
  const {
    mainDescription: description,
    setBonusDescription: setDescription,
    effectiveSetRank,
  } = getModCardDisplayTexts(mod, rank, {
    umbraSetEquippedCount: options?.umbraSetEquippedCount,
    setRank,
  });
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

  return {
    layout: {
      ...DEFAULT_LAYOUT,
      ...(options?.scale != null ? { scale: options.scale } : {}),
    },
    rarity,
    polarity,
    modArt,
    modArtOverlay: modArtOverlay || undefined,
    modName: mod.name,
    modType,
    modDescription: description,
    setDescription,
    setActive: effectiveSetRank,
    setTotal: maxSetRank,
    modSet: mod.mod_set ?? undefined,
    drain: Math.abs(effectiveDrain),
    rank,
    maxRank,
    slotIcon,
    polarityMatch: polarityMatchForUi(slotPolarity, mod.polarity),
  };
}

export function ModHoverPreview({
  mod,
  anchorRef,
  active,
}: {
  mod: Mod;
  anchorRef: React.RefObject<HTMLElement | null>;
  active: boolean;
}) {
  if (!active) return null;
  const display = getModPreviewDisplay(mod, { scale: DEFAULT_LAYOUT.scale * 0.5 });
  return <CollapsedHoverExpand cardRef={anchorRef} {...display} />;
}

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
  umbraSetEquippedCount?: number;
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
  umbraSetEquippedCount,
}: ModCardProps) {
  const [hovered, setHovered] = useState(false);
  const cardRef = useRef<HTMLDivElement>(null);
  const { atragraphModsEnabled } = useTheme();

  const {
    layout,
    rarity,
    polarity,
    modArt,
    modArtOverlay,
    modName,
    modType,
    modDescription: description,
    setDescription,
    setActive: effectiveSetRank,
    setTotal: maxSetRank,
    modSet,
    drain: displayDrain,
    rank: displayRank,
    maxRank,
    slotIcon,
    polarityMatch,
  } = getModPreviewDisplay(mod, {
    rank,
    setRank,
    slotType,
    slotPolarity,
    umbraSetEquippedCount,
    scale,
    atragraphModsEnabled,
  });

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
        modArtOverlay={modArtOverlay}
        modName={modName}
        modType={modType}
        modDescription={description}
        setDescription={setDescription}
        setActive={effectiveSetRank}
        setTotal={maxSetRank}
        modSet={modSet}
        drain={displayDrain}
        rank={displayRank}
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
          modArtOverlay={modArtOverlay}
          modName={modName}
          modType={modType}
          modDescription={description}
          setDescription={setDescription}
          setActive={effectiveSetRank}
          setTotal={maxSetRank}
          modSet={modSet}
          drain={displayDrain}
          rank={displayRank}
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
  cardRef: React.RefObject<HTMLElement | null>;
} & ModPreviewDisplay) {
  const [pos, setPos] = useState<{ x: number; y: number } | null>(null);
  const [tilt, setTilt] = useState<{ rx: number; ry: number; px: number; py: number }>({
    rx: 0,
    ry: 0,
    px: 0.5,
    py: 0.5,
  });

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
      const ry = (px - 0.5) * 2 * CARD_HOVER_TILT_MAX_DEG;
      const rx = (0.5 - py) * 2 * CARD_HOVER_TILT_MAX_DEG;
      setTilt({ rx, ry, px, py });
    };

    const onLeave = (): void => {
      setTilt({ rx: 0, ry: 0, px: 0.5, py: 0.5 });
    };

    node.addEventListener('mousemove', onMove);
    node.addEventListener('mouseleave', onLeave);

    return () => {
      node.removeEventListener('mousemove', onMove);
      node.removeEventListener('mouseleave', onLeave);
    };
  }, [cardRef]);

  if (!pos) return null;

  const stripFade = Math.max(
    0,
    1 - Math.max(Math.abs(tilt.rx), Math.abs(tilt.ry)) / (CARD_HOVER_TILT_MAX_DEG / 2),
  );
  return createPortal(
    <div
      className="mod-selector-expand pointer-events-none fixed z-[9999]"
      style={{ left: pos.x, top: pos.y, transform: 'translate(-50%, -50%)' }}
    >
      <div
        className="mod-selector-tilt"
        style={
          {
            transform: `rotateX(${tilt.rx.toFixed(2)}deg) rotateY(${tilt.ry.toFixed(2)}deg)`,
            '--tilt-rotate-x': `${tilt.rx.toFixed(2)}deg`,
            '--tilt-rotate-y': `${tilt.ry.toFixed(2)}deg`,
            '--tilt-x': `${(tilt.px * 100).toFixed(1)}%`,
            '--tilt-y': `${(tilt.py * 100).toFixed(1)}%`,
            '--strip-fade': stripFade.toFixed(3),
            ...(previewProps.modArtOverlay ? {} : getCardFoilStyle(previewProps.rarity, layout)),
          } as React.CSSProperties
        }
      >
        <CardPreview layout={layout} {...previewProps} />
        {!previewProps.modArtOverlay ? <div className={getModCardFoilClass()} aria-hidden /> : null}
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
