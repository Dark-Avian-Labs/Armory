import { useCallback, useLayoutEffect, useRef, useState } from 'react';

import type { EquipmentType, Mod, ModSlot } from '../../types/warframe';
import { EQUIPMENT_SLOT_CONFIGS } from '../../types/warframe';
import { getMaxRank } from '../../utils/arcaneUtils';
import { isPostureMod } from '../../utils/modFiltering';
import { isRivenMod } from '../../utils/riven';
import { formatShardBuffDescription } from '../../utils/shardBuffFormat';
import {
  dbRarityToCardRarity,
  getRarityBorderColor,
  normalizeArcaneRarity,
  type ArcaneRarity,
  type Rarity,
} from '../ModCard/cardLayout';
import type { ArcaneSlot } from './ArcaneSlots';
import type { ShardSlotConfig, ShardType } from './ArchonShardSlots';

const MAIN_GRID_COLUMNS = 5;
const MAIN_GRID_CELLS = MAIN_GRID_COLUMNS * 3;
const MAX_GENERAL_SLOTS = MAIN_GRID_CELLS - (3 + 2);

const EFFECT_PREVIEW_MAX_CHARS = 14;

const SHARD_BACKGROUND_BY_FAMILY: Record<string, string> = {
  crimson: 'color-mix(in oklab, oklch(48% 0.2 25) 75%, transparent)',
  amber: 'color-mix(in oklab, oklch(68% 0.16 75) 75%, transparent)',
  azure: 'color-mix(in oklab, oklch(55% 0.14 248) 75%, transparent)',
  violet: 'color-mix(in oklab, oklch(52% 0.18 300) 75%, transparent)',
  topaz: 'color-mix(in oklab, oklch(72% 0.14 90) 75%, transparent)',
  emerald: 'color-mix(in oklab, oklch(55% 0.14 158) 75%, transparent)',
};

type CompactCellPayload =
  | { kind: 'empty' }
  | {
      kind: 'filled';
      title: string;
      borderColorVar: string;
      background: string;
      stars?: { filled: number; total: number };
    };

function arcaneUiRarity(normalized: ArcaneRarity): Rarity {
  switch (normalized) {
    case 'common':
      return 'Common';
    case 'uncommon':
      return 'Uncommon';
    case 'rare':
      return 'Rare';
    case 'legendary':
      return 'Legendary';
    case 'empty':
    default:
      return 'Common';
  }
}

function shardFamilyKey(shard: ShardType): string | null {
  const idMatch = Object.keys(SHARD_BACKGROUND_BY_FAMILY).find(
    (k) => String(shard.id).toLowerCase() === k.toLowerCase(),
  );
  if (idMatch) return idMatch;
  const prefix = shard.name.trim().split(/\s+/)[0]?.toLowerCase();
  return prefix && SHARD_BACKGROUND_BY_FAMILY[prefix] ? prefix : null;
}

function truncatePreview(text: string, maxChars: number): string {
  const t = text.trim();
  if (t.length <= maxChars) return t;
  return `${t.slice(0, Math.max(0, maxChars - 1)).trim()}…`;
}

function compactStyleForMod(mod: Mod): { borderColorVar: string; background: string } {
  const rarity: Rarity | 'Riven' =
    (mod.type || '').toUpperCase() === 'RIVEN'
      ? 'Riven'
      : dbRarityToCardRarity(mod.rarity, mod.name || mod.unique_name);
  const borderVar = getRarityBorderColor(rarity as Rarity);
  const bg = `color-mix(in oklab, ${borderVar} 16%, oklch(18% 0.02 280 / 0.55))`;
  return { borderColorVar: borderVar, background: bg };
}

function compactModTitle(mod: Mod): string {
  if ((mod.type || '').toUpperCase() === 'RIVEN' || isRivenMod(mod)) return 'Riven';
  return mod.name;
}

function compactStyleForArcane(rarity?: string): {
  borderColorVar: string;
  background: string;
} {
  const n = normalizeArcaneRarity(rarity);
  if (n === 'empty') {
    return {
      borderColorVar: 'var(--color-unavailable)',
      background: `color-mix(in oklab, var(--color-unavailable) 12%, oklch(18% 0.02 280 / 0.45))`,
    };
  }
  const borderVar = getRarityBorderColor(arcaneUiRarity(n));
  const bg = `color-mix(in oklab, ${borderVar} 16%, oklch(18% 0.02 280 / 0.55))`;
  return { borderColorVar: borderVar, background: bg };
}

function compactCellFromModSlot(slot?: ModSlot): CompactCellPayload {
  if (!slot?.mod) return { kind: 'empty' };
  const mod = slot.mod;
  const { borderColorVar, background } = compactStyleForMod(mod);
  const total = mod.fusion_limit ?? 0;
  const rank = slot.rank ?? 0;
  const stars = total > 0 ? { filled: Math.min(Math.max(rank, 0), total), total } : undefined;
  return {
    kind: 'filled',
    title: compactModTitle(mod),
    borderColorVar,
    background,
    ...(stars ? { stars } : {}),
  };
}

function compactCellFromArcaneSlot(slot?: ArcaneSlot): CompactCellPayload {
  const arcane = slot?.arcane;
  if (!arcane) return { kind: 'empty' };
  const { borderColorVar, background } = compactStyleForArcane(arcane.rarity);
  const total = getMaxRank(arcane);
  const rank = slot.rank ?? 0;
  const stars = total > 0 ? { filled: Math.min(Math.max(rank, 0), total), total } : undefined;
  return {
    kind: 'filled',
    title: arcane.name,
    borderColorVar,
    background,
    ...(stars ? { stars } : {}),
  };
}

function CompactRankStars({ filled, total }: { filled: number; total: number }) {
  if (total <= 0) return null;
  const safeTotal = Math.min(total, 24);
  const safeFilled = Math.min(Math.max(0, filled), safeTotal);

  return (
    <div
      className="text-muted mt-auto flex shrink-0 flex-wrap justify-center gap-px pt-1"
      role="presentation"
      aria-hidden
    >
      {Array.from({ length: safeTotal }, (_, i) => (
        <span
          key={i}
          className="text-[clamp(7px,1.85vw,9px)] leading-none"
          style={{ opacity: i < safeFilled ? 0.88 : 0.22 }}
        >
          {'\u2605'}
        </span>
      ))}
    </div>
  );
}

function buildMainCompactGrid(payload: {
  equipmentType: EquipmentType;
  slots: ModSlot[];
  arcaneSlots: ArcaneSlot[];
}): CompactCellPayload[] {
  const { equipmentType, slots, arcaneSlots } = payload;
  const sorted = [...slots].sort((a, b) => a.index - b.index);
  const config = EQUIPMENT_SLOT_CONFIGS[equipmentType] || EQUIPMENT_SLOT_CONFIGS.warframe;

  const aura = sorted.find((s) => s.type === 'aura');
  const stance = sorted.find((s) => s.type === 'stance');
  const posture = sorted.find((s) => s.type === 'posture');
  const exilus = sorted.find((s) => s.type === 'exilus');

  let cell0: CompactCellPayload = { kind: 'empty' };
  let cell1: CompactCellPayload;
  let cell2: CompactCellPayload = { kind: 'empty' };

  if (config.hasAura) {
    cell0 = compactCellFromModSlot(aura);
  } else if (config.hasStance) {
    cell0 = stance ? compactCellFromModSlot(stance) : { kind: 'empty' };
  } else if (config.hasPosture && posture?.mod && isPostureMod(posture.mod)) {
    cell0 = compactCellFromModSlot(posture);
  }

  cell1 = { kind: 'empty' };

  if (config.hasExilus) {
    cell2 = compactCellFromModSlot(exilus);
  }

  const arcSlot0 = arcaneSlots[0];
  const arcSlot1 = arcaneSlots[1];

  const generalsEquipped = sorted
    .filter((s) => s.type === 'general' && s.mod)
    .sort((a, b) => a.index - b.index);

  const generalCells = generalsEquipped
    .map((s) => compactCellFromModSlot(s))
    .slice(0, MAX_GENERAL_SLOTS);

  while (generalCells.length < MAX_GENERAL_SLOTS) {
    generalCells.push({ kind: 'empty' });
  }

  const grid: CompactCellPayload[] = [
    cell0,
    cell1,
    cell2,
    compactCellFromArcaneSlot(arcSlot0),
    compactCellFromArcaneSlot(arcSlot1),
    ...generalCells,
  ];

  return grid.slice(0, MAIN_GRID_CELLS);
}

function CompactCellDisplay({ payload }: { payload: CompactCellPayload }) {
  if (payload.kind === 'empty') {
    return (
      <div
        className="min-h-[48px] rounded-sm"
        style={{
          borderWidth: 3,
          borderStyle: 'dashed',
          borderColor: 'var(--color-surface-200)',
          background: 'color-mix(in oklab, var(--color-surface-400) 40%, transparent)',
        }}
        aria-hidden
      />
    );
  }

  return (
    <div
      className="flex min-h-[52px] flex-col rounded-sm px-1.5 py-2 text-center text-[length:clamp(10px,2.4vw,12px)] leading-snug font-semibold tracking-tight break-words"
      style={{
        borderWidth: 3,
        borderStyle: 'solid',
        borderColor: payload.borderColorVar,
        background: payload.background,
        color: `color-mix(in oklab, ${payload.borderColorVar} 72%, oklch(92% 0.01 264))`,
      }}
    >
      <div className="flex min-h-0 flex-1 flex-col justify-center px-px">
        <span title={payload.title}>{payload.title}</span>
      </div>
      {payload.stars ? (
        <CompactRankStars filled={payload.stars.filled} total={payload.stars.total} />
      ) : null}
    </div>
  );
}

function ShardStrip({
  shardSlots,
  shardTypes,
}: {
  shardSlots: ShardSlotConfig[];
  shardTypes: ShardType[];
}) {
  return (
    <div className="grid grid-cols-5 gap-2">
      {Array.from({ length: 5 }, (_, i) => {
        const slot = shardSlots[i] ?? { tauforged: false };
        const shard =
          slot.shard_type_id != null
            ? shardTypes.find((s) => String(s.id) === String(slot.shard_type_id))
            : undefined;
        const buff =
          shard && slot.buff_id != null
            ? shard.buffs.find((b) => String(b.id) === String(slot.buff_id))
            : undefined;

        if (!shard) {
          return (
            <div
              key={`shard-${i}`}
              className="min-h-[44px] rounded-sm"
              style={{
                borderWidth: 3,
                borderStyle: 'dashed',
                borderColor: 'var(--color-surface-200)',
                background: 'color-mix(in oklab, var(--color-surface-400) 38%, transparent)',
              }}
              aria-hidden
            />
          );
        }

        const familyKey = shardFamilyKey(shard);
        const bgFamily = familyKey
          ? SHARD_BACKGROUND_BY_FAMILY[familyKey]
          : 'color-mix(in oklab, var(--color-surface-400) 55%, transparent)';
        const effectRaw = formatShardBuffDescription(buff, slot.tauforged === true);
        const preview = truncatePreview(effectRaw || '—', EFFECT_PREVIEW_MAX_CHARS);
        const borderColor = slot.tauforged ? 'oklch(96% 0 0 / 0.55)' : 'oklch(55% 0.02 260 / 0.55)';

        return (
          <div
            key={`shard-${i}`}
            className="flex min-h-[44px] flex-col justify-center rounded-sm px-1 py-1.5 text-center"
            style={{
              borderWidth: 3,
              borderStyle: 'solid',
              borderColor,
              background: bgFamily,
            }}
          >
            <span className="text-[length:clamp(9px,2.1vw,11px)] leading-tight font-semibold tracking-tight text-[var(--color-foreground)]">
              {preview}
            </span>
          </div>
        );
      })}
    </div>
  );
}

function formatEquipmentTypeLabel(type: EquipmentType): string {
  return type.replace(/_/g, ' ').replace(/\b\w/g, (ch) => ch.toUpperCase());
}

export interface CompactBuildOverviewProps {
  buildName: string;
  equipmentName: string;
  equipmentType: EquipmentType;
  slots: ModSlot[];
  arcaneSlots: ArcaneSlot[];
  shardSlots: ShardSlotConfig[];
  shardTypes: ShardType[];
  pipEmbed?: boolean;
}

export function CompactBuildOverview({
  buildName,
  equipmentName,
  equipmentType,
  slots,
  arcaneSlots,
  shardSlots,
  shardTypes,
  pipEmbed = false,
}: CompactBuildOverviewProps) {
  const gridCells = buildMainCompactGrid({
    equipmentType,
    slots,
    arcaneSlots,
  });

  const showShards = equipmentType === 'warframe';
  const measureRef = useRef<HTMLDivElement>(null);
  const [pipScale, setPipScale] = useState(1);

  const updatePipScale = useCallback(() => {
    if (!pipEmbed || typeof window === 'undefined' || window.parent === window) {
      setPipScale(1);
      return;
    }
    const node = measureRef.current;
    if (!node) return;
    try {
      const parentWin = window.parent;
      const pad = 12;
      const pw = parentWin.innerWidth;
      const ph = parentWin.innerHeight;
      const cw = node.offsetWidth;
      const ch = node.offsetHeight;
      if (cw < 1 || ch < 1) return;
      const factor = Math.min((pw - pad * 2) / cw, (ph - pad * 2) / ch);
      setPipScale(Math.min(Math.max(factor, 0.12), 4));
    } catch {
      setPipScale(1);
    }
  }, [pipEmbed]);

  useLayoutEffect(() => {
    if (!pipEmbed || typeof window === 'undefined' || window.parent === window) {
      return undefined;
    }
    let parentWin: Window;
    try {
      parentWin = window.parent;
      void parentWin.innerWidth;
    } catch {
      return undefined;
    }
    const onResize = () => updatePipScale();
    parentWin.addEventListener('resize', onResize);
    let roDoc: ResizeObserver | null = null;
    try {
      roDoc = new ResizeObserver(onResize);
      roDoc.observe(parentWin.document.documentElement);
    } catch {
      roDoc = null;
    }
    const node = measureRef.current;
    const roNode = node ? new ResizeObserver(onResize) : null;
    if (node && roNode) {
      roNode.observe(node);
    }
    const id = requestAnimationFrame(() => updatePipScale());
    return () => {
      cancelAnimationFrame(id);
      parentWin.removeEventListener('resize', onResize);
      roDoc?.disconnect();
      roNode?.disconnect();
    };
  }, [pipEmbed, updatePipScale]);

  const inner = (
    <div
      ref={measureRef}
      className="compact-build-overview mx-auto w-full max-w-[720px] space-y-3 px-3 py-4"
      style={
        pipEmbed
          ? {
              transform: `scale(${pipScale})`,
              transformOrigin: 'center center',
            }
          : undefined
      }
    >
      <div className="space-y-0.5 border-b border-[var(--color-glass-border)] pb-3">
        <h1 className="text-[length:clamp(13px,3vw,16px)] font-semibold text-[var(--color-foreground)]">
          {buildName}
        </h1>
        <p className="text-muted text-[length:clamp(11px,2.8vw,13px)]">
          {equipmentName}
          {' · '}
          {formatEquipmentTypeLabel(equipmentType)}
        </p>
      </div>

      <section aria-label="Mods and arcanes">
        <div
          className="grid gap-2"
          style={{
            gridTemplateColumns: `repeat(${MAIN_GRID_COLUMNS}, minmax(0, 1fr))`,
          }}
        >
          {gridCells.map((cell, idx) => (
            <CompactCellDisplay key={`cell-${idx}`} payload={cell} />
          ))}
        </div>
      </section>

      {showShards ? (
        <section aria-label="Archon shards">
          <h2 className="text-muted mb-2 text-[10px] font-semibold tracking-[0.2em] uppercase">
            Archon shards
          </h2>
          <ShardStrip shardSlots={shardSlots} shardTypes={shardTypes} />
        </section>
      ) : null}
    </div>
  );

  if (!pipEmbed) {
    return inner;
  }

  return (
    <div className="box-border flex h-full min-h-0 w-full flex-1 flex-col items-center justify-center overflow-hidden">
      {inner}
    </div>
  );
}
