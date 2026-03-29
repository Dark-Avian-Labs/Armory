import { memo, useState, useMemo, useRef, useEffect, useLayoutEffect, useCallback } from 'react';

import { useApi } from '../../hooks/useApi';
import type { Mod, ModRarity, EquipmentType } from '../../types/warframe';
import { filterCompatibleMods, isModLockedOut, isPostureMod } from '../../utils/modFiltering';
import { createRivenPlaceholderMod, getRivenWeaponType } from '../../utils/riven';
import { getRequiredExaltedStanceName } from '../../utils/specialItems';
import { ModCard, CardPreview, DEFAULT_LAYOUT } from '../ModCard';

interface FilterPanelProps {
  equipmentType: EquipmentType;
  equipment?: { unique_name: string; name: string; product_category?: string };
  equippedMods: Mod[];
  onModSelect: (mod: Mod) => void;
  onModRemove?: () => void;
  targetSlotType?: 'general' | 'aura' | 'stance' | 'exilus' | 'posture';
  active?: boolean;
  searchResetKey?: number;
}

function getSyntheticSpecialItemStanceMods(
  equipmentType: EquipmentType,
  equipment: FilterPanelProps['equipment'],
  mods: Mod[],
): Mod[] {
  if (equipmentType !== 'melee' || !equipment?.name) {
    return [];
  }

  const normalizedEquipmentName = equipment.name.trim().toLowerCase();
  const stanceName = getRequiredExaltedStanceName(equipment.name);
  if (!stanceName) {
    return [];
  }

  const hasExistingStance = mods.some((mod) => {
    return (
      (mod.type || '').toUpperCase() === 'STANCE' &&
      mod.name.trim().toLowerCase() === stanceName.toLowerCase()
    );
  });
  if (hasExistingStance) {
    return [];
  }

  const syntheticUniqueName = `/Synthetic/SpecialItems/Stances/${normalizedEquipmentName.replace(/\s+/g, '-')}`;
  return [
    {
      unique_name: syntheticUniqueName,
      name: stanceName,
      type: 'STANCE',
      compat_name: equipment.name,
      rarity: 'COMMON',
      base_drain: 0,
      fusion_limit: 5,
    },
  ];
}

function getModTypes(eqType: EquipmentType): string {
  switch (eqType) {
    case 'warframe':
      return 'WARFRAME,AURA';
    case 'primary':
      return 'PRIMARY';
    case 'secondary':
      return 'SECONDARY';
    case 'melee':
      return 'MELEE,STANCE';
    case 'beast_claws':
      return 'MELEE,STANCE';
    case 'companion':
      return 'SENTINEL,KAVAT,KUBROW,HELMINTH CHARGER';
    case 'archgun':
      return 'ARCH-GUN';
    case 'archmelee':
      return 'ARCH-MELEE';
    case 'archwing':
      return 'ARCHWING';
    case 'necramech':
      return '---';
    case 'kdrive':
      return '---';
    default:
      return 'WARFRAME';
  }
}

const RARITIES: { value: ModRarity | 'ALL'; label: string }[] = [
  { value: 'ALL', label: 'All' },
  { value: 'COMMON', label: 'Common' },
  { value: 'UNCOMMON', label: 'Uncommon' },
  { value: 'RARE', label: 'Rare' },
  { value: 'LEGENDARY', label: 'Legendary' },
];

function isImportedRivenPlaceholder(mod: Mod): boolean {
  return /\bRiven Mod$/i.test(mod.name) && (mod.type || '').toUpperCase() !== 'RIVEN';
}

function getRivenArtNameForType(equipmentType: EquipmentType): string | null {
  switch (equipmentType) {
    case 'primary':
      return 'Rifle Riven Mod';
    case 'secondary':
      return 'Pistol Riven Mod';
    case 'melee':
      return 'Melee Riven Mod';
    case 'archgun':
      return 'Archgun Riven Mod';
    default:
      return null;
  }
}

function cleanupDragCloneOnEnd(sourceEl: HTMLElement, clone: HTMLElement): void {
  let cleaned = false;

  const cleanup = () => {
    if (cleaned) return;
    cleaned = true;

    if (clone.parentNode) {
      clone.parentNode.removeChild(clone);
    }
  };

  sourceEl.addEventListener('dragend', cleanup, { once: true });
}

export function FilterPanel({
  equipmentType,
  equipment,
  equippedMods,
  onModSelect,
  onModRemove,
  targetSlotType,
  active = true,
  searchResetKey = 0,
}: FilterPanelProps) {
  const [search, setSearch] = useState('');

  useEffect(() => {
    if (searchResetKey > 0) setSearch('');
  }, [searchResetKey]);
  const [rarity, setRarity] = useState<ModRarity | 'ALL'>('ALL');
  const [expandMods, setExpandMods] = useState(false);
  const [showLockedOut, setShowLockedOut] = useState(false);

  const gridRef = useRef<HTMLDivElement>(null);
  const [cardScale, setCardScale] = useState<number>(0);

  const measure = useCallback(() => {
    if (!gridRef.current) return;
    const width = gridRef.current.clientWidth;
    if (width > 0) {
      setCardScale(width / (4 * DEFAULT_LAYOUT.cardWidth));
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

  useEffect(() => {
    if (active) {
      requestAnimationFrame(measure);
    }
  }, [active, measure]);

  const modTypes = getModTypes(equipmentType);
  const { data, loading } = useApi<{ items: Mod[] }>(
    `/api/mods?types=${encodeURIComponent(modTypes)}`,
  );
  const rawMods = data?.items || [];
  const importedRivenMods = useMemo(() => rawMods.filter(isImportedRivenPlaceholder), [rawMods]);
  const baseMods = useMemo(
    () => rawMods.filter((mod) => !isImportedRivenPlaceholder(mod)),
    [rawMods],
  );
  const allMods = useMemo(() => {
    const syntheticStanceMods = getSyntheticSpecialItemStanceMods(
      equipmentType,
      equipment,
      baseMods,
    );
    if (syntheticStanceMods.length === 0) {
      return baseMods;
    }
    return [...baseMods, ...syntheticStanceMods];
  }, [baseMods, equipmentType, equipment]);

  const { compatible, lockedOut } = useMemo(() => {
    const compatMods = filterCompatibleMods(allMods, equipmentType, equipment);

    let slotFiltered = compatMods;
    if (targetSlotType === 'aura') {
      slotFiltered = compatMods.filter((m) => (m.type || '').toUpperCase() === 'AURA');
    } else if (targetSlotType === 'stance') {
      slotFiltered = compatMods.filter(
        (m) => (m.type || '').toUpperCase() === 'STANCE' && !isPostureMod(m),
      );
    } else if (targetSlotType === 'posture') {
      slotFiltered = compatMods.filter(
        (m) => (m.type || '').toUpperCase() === 'STANCE' && isPostureMod(m),
      );
    } else if (targetSlotType === 'exilus') {
      slotFiltered = compatMods.filter(
        (m) => m.is_utility === 1 || (m.type || '').toUpperCase() === 'AURA',
      );
    } else if (targetSlotType) {
      slotFiltered = compatMods.filter((m) => {
        const t = (m.type || '').toUpperCase();
        return t !== 'AURA' && t !== 'STANCE';
      });
    }

    const textFiltered = slotFiltered.filter((mod) => {
      if (rarity !== 'ALL' && mod.rarity !== rarity) return false;
      if (search && !mod.name.toLowerCase().includes(search.toLowerCase())) return false;
      return true;
    });

    const available: Mod[] = [];
    const locked: Mod[] = [];
    for (const mod of textFiltered) {
      if (isModLockedOut(mod, equippedMods)) {
        locked.push(mod);
      } else {
        available.push(mod);
      }
    }

    return { compatible: available, lockedOut: locked };
  }, [allMods, equipmentType, equipment, equippedMods, targetSlotType, rarity, search]);

  const displayMods = showLockedOut ? [...compatible, ...lockedOut] : compatible;
  const handleModPick = useCallback(
    (mod: Mod, locked: boolean) => {
      if (!locked) {
        onModSelect(mod);
        setSearch('');
      }
    },
    [onModSelect],
  );
  const rivenWeaponType = getRivenWeaponType(equipmentType);
  const rivenArt = useMemo(() => {
    const preferredName = getRivenArtNameForType(equipmentType);
    if (preferredName) {
      const preferred = importedRivenMods.find(
        (mod) => mod.name === preferredName && !!mod.image_path,
      );
      if (preferred?.image_path) return preferred.image_path;
    }
    return importedRivenMods.find((mod) => !!mod.image_path)?.image_path;
  }, [equipmentType, importedRivenMods]);
  const rivenPlaceholderMod = useMemo(() => createRivenPlaceholderMod(rivenArt), [rivenArt]);

  return (
    <div className="mod-builder-side-panel flex min-h-0 flex-col">
      <div className="mb-3 flex items-center justify-between">
        <h2 className="text-foreground text-lg font-semibold">Mods</h2>
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={() => setShowLockedOut((v) => !v)}
            aria-pressed={showLockedOut}
            className="border-glass-border text-muted hover:border-glass-border-hover hover:bg-glass-hover hover:text-foreground inline-flex items-center gap-1.5 rounded-lg border px-2 py-1 text-xs transition-[color,background-color,border-color] duration-200"
            title="Toggle showing locked mods"
          >
            <span
              className={`inline-flex h-4 w-4 items-center justify-center rounded text-[10px] font-bold transition-colors ${
                showLockedOut
                  ? 'bg-success/20 text-success hover:bg-success/30'
                  : 'bg-muted/10 text-muted/40 hover:bg-muted/20'
              }`}
              aria-hidden="true"
            >
              {showLockedOut ? '\u2713' : '\u2715'}
            </span>
            Show locked
          </button>
          <button
            type="button"
            onClick={() => setExpandMods((v) => !v)}
            aria-pressed={expandMods}
            className="border-glass-border text-muted hover:border-glass-border-hover hover:bg-glass-hover hover:text-foreground inline-flex items-center gap-1.5 rounded-lg border px-2 py-1 text-xs transition-[color,background-color,border-color] duration-200"
            title="Toggle expanded mod cards"
          >
            <span
              className={`inline-flex h-4 w-4 items-center justify-center rounded text-[10px] font-bold transition-colors ${
                expandMods
                  ? 'bg-success/20 text-success hover:bg-success/30'
                  : 'bg-muted/10 text-muted/40 hover:bg-muted/20'
              }`}
              aria-hidden="true"
            >
              {expandMods ? '\u2713' : '\u2715'}
            </span>
            Expand
          </button>
        </div>
      </div>

      <div className="relative mb-3">
        <input
          type="text"
          placeholder="Search mods..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="form-input w-full pr-8"
        />
        {search && (
          <button
            type="button"
            onClick={() => setSearch('')}
            className="text-muted hover:bg-glass-hover hover:text-foreground absolute top-1/2 right-2 flex h-5 w-5 -translate-y-1/2 items-center justify-center rounded-full text-xs transition-colors"
          >
            ✕
          </button>
        )}
      </div>

      <div className="mb-3 flex flex-wrap gap-1">
        {RARITIES.map((r) => (
          <button
            key={r.value}
            onClick={() => setRarity(r.value)}
            type="button"
            className={`rounded-lg px-2 py-1 text-xs transition-[color,background-color,border-color] duration-200 ${
              rarity === r.value
                ? 'bg-accent-weak text-accent'
                : 'text-muted hover:bg-glass-hover hover:text-foreground'
            }`}
          >
            {r.label}
          </button>
        ))}
      </div>

      <div className="text-muted mb-2 space-y-1.5 text-xs">
        <div>
          {compatible.length} available
          {lockedOut.length > 0 && (
            <span className="text-warning ml-1">({lockedOut.length} locked out)</span>
          )}
          {(search || rarity !== 'ALL') && ' (filtered)'}
        </div>
        {targetSlotType && targetSlotType !== 'general' ? (
          <div className="bg-accent-weak/20 text-accent rounded-md px-2 py-1">
            Showing {targetSlotType} mods
          </div>
        ) : null}
      </div>

      <div className="custom-scroll max-h-[calc(100vh-420px)] overflow-y-auto">
        {loading && <p className="text-muted text-sm">Loading mods...</p>}
        {!loading && displayMods.length === 0 && (
          <p className="text-muted text-sm">
            {allMods.length === 0
              ? 'No mods in database. Import and process data first.'
              : 'No mods match the current filters.'}
          </p>
        )}
        <div ref={gridRef} className="grid grid-cols-4">
          {cardScale > 0 && !loading && (displayMods.length > 0 || !!rivenWeaponType) && (
            <>
              {!search && (
                <div
                  onClick={onModRemove}
                  draggable
                  onDragStart={(e) => {
                    e.dataTransfer.setData('application/json', JSON.stringify({ __remove: true }));
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
                    cleanupDragCloneOnEnd(el, clone);
                  }}
                  className="cursor-grab"
                >
                  <CardPreview
                    layout={{ ...DEFAULT_LAYOUT, scale: cardScale }}
                    rarity="Empty"
                    polarity=""
                    modArt=""
                    modName="Remove"
                    modType=""
                    modDescription=""
                    drain={0}
                    rank={0}
                    maxRank={0}
                    collapsed={!expandMods}
                  />
                </div>
              )}
              {rivenWeaponType && !search && (
                <div
                  onClick={() => onModSelect(rivenPlaceholderMod)}
                  draggable
                  onDragStart={(e) => {
                    e.dataTransfer.setData('application/json', JSON.stringify(rivenPlaceholderMod));
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
                    cleanupDragCloneOnEnd(el, clone);
                  }}
                  className="cursor-grab"
                >
                  <ModCard
                    mod={rivenPlaceholderMod}
                    rank={0}
                    draggable
                    scale={cardScale}
                    collapsed={!expandMods}
                  />
                </div>
              )}
              {displayMods.map((mod) => {
                const locked = lockedOut.includes(mod);
                return (
                  <ModPickerCard
                    key={mod.unique_name}
                    mod={mod}
                    locked={locked}
                    expanded={expandMods}
                    scale={cardScale}
                    onPick={handleModPick}
                  />
                );
              })}
            </>
          )}
        </div>
      </div>
    </div>
  );
}

const ModPickerCard = memo(function ModPickerCard({
  mod,
  locked,
  expanded,
  scale,
  onPick,
}: {
  mod: Mod;
  locked: boolean;
  expanded: boolean;
  scale: number;
  onPick: (mod: Mod, locked: boolean) => void;
}) {
  return (
    <div
      onClick={() => onPick(mod, locked)}
      className={`${locked ? 'cursor-not-allowed' : 'cursor-pointer'}`}
    >
      <ModCard
        mod={mod}
        rank={mod.fusion_limit ?? 0}
        draggable={!locked}
        lockedOut={locked}
        scale={scale}
        collapsed={!expanded}
      />
    </div>
  );
});
