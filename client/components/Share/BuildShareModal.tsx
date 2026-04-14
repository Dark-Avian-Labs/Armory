import { toBlob } from 'html-to-image';
import { useLayoutEffect, useMemo, useRef, useState } from 'react';
import type { CSSProperties } from 'react';

import feathers from '../../assets/feathers.png';
import orokinReactorImg from '../../assets/orokin-reactor.png';
import type {
  Ability,
  BuildConfig,
  EquipmentType,
  ModSlot,
  ValenceBonus,
  Warframe,
  Weapon,
} from '../../types/warframe';
import { getMaxRank } from '../../utils/arcaneUtils';
import { extractArchonShardBonuses } from '../../utils/archonShardBonuses';
import { calculateBuildDamage, formatDamage } from '../../utils/damage';
import { calculateWeaponDps } from '../../utils/damageCalc';
import { getElementColor } from '../../utils/elements';
import type { FormaCount } from '../../utils/formaCounter';
import { formatShardBuffDescription } from '../../utils/shardBuffFormat';
import { calculateWarframeStats } from '../../utils/warframeCalc';
import type { ArcaneSlot } from '../ModBuilder/ArcaneSlots';
import type { ShardSlotConfig, ShardType } from '../ModBuilder/ArchonShardSlots';
import { ArcaneCardPreview } from '../ModCard/ArcaneCardPreview';
import {
  DEFAULT_ARCANE_LAYOUT,
  DEFAULT_LAYOUT,
  normalizeArcaneRarity,
} from '../ModCard/cardLayout';
import { ModCard } from '../ModCard/ModCard';
import { Modal } from '../ui/Modal';
import { ShareHeroTitle } from './ShareHeroTitle';
import { ShareRadarChart } from './ShareRadarChart';
import {
  getShareAbilityDbIcon,
  type ParsedShareAbility,
  useWarframeShareAbilities,
} from './useWarframeShareAbilities';

const SHARE_CANVAS_WIDTH = 720;
const SHARE_CANVAS_HEIGHT = 1280;
/** html-to-image rasterizes the DOM to a canvas; 1× looks soft and gradients can band. 2× supersamples for sharper PNGs. */
const SHARE_EXPORT_PIXEL_RATIO = 2;

interface BuildShareModalProps {
  open: boolean;
  onClose: () => void;
  buildName: string;
  equipment: Warframe | Weapon;
  equipmentName: string;
  equipmentType: EquipmentType;
  equipmentImagePath?: string;
  slots: ModSlot[];
  arcaneSlots: ArcaneSlot[];
  shardSlots: ShardSlotConfig[];
  shardTypes: ShardType[];
  orokinReactor: boolean;
  formaCost?: FormaCount;
  helminthConfig?: BuildConfig['helminth'];
  valenceBonus?: ValenceBonus | null;
}

function formatEquipmentType(type: EquipmentType): string {
  return type.replace(/_/g, ' ').replace(/\b\w/g, (ch) => ch.toUpperCase());
}

function sanitizeDownloadSegment(value: string, fallback: string, maxLen: number): string {
  let t = value
    .trim()
    .replace(/["*/:<>?\\|]+/g, '')
    .replace(/\s+/g, ' ')
    .trim();
  if (!t) t = fallback;
  t = t.replace(/^\.+|\.+$/g, '').trim() || fallback;
  if (t.length > maxLen) t = t.slice(0, maxLen).trim();
  return t;
}

function buildShareDownloadFileName(equipmentName: string, buildName: string): string {
  const itemPart = sanitizeDownloadSegment(equipmentName, 'item', 96);
  const buildPart = sanitizeDownloadSegment(buildName, 'build', 96);
  return `parametric-${itemPart}-${buildPart}.png`;
}

function readFileAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = () => reject(reader.error ?? new Error('read failed'));
    reader.readAsDataURL(file);
  });
}

const SHARE_ELEMENT_ICONS: Record<string, string> = {
  Impact: '01_impact',
  Puncture: '02_puncture',
  Slash: '03_slash',
  Heat: '04_heat',
  Cold: '05_cold',
  Electricity: '06_electricity',
  Toxin: '07_toxin',
  Blast: '08_blast',
  Radiation: '09_radiation',
  Gas: '10_gas',
  Magnetic: '11_magnetic',
  Viral: '12_viral',
  Corrosive: '13_corrosive',
  Void: '14_void',
  Tau: '15_tau',
  True: '20_true',
};

const MOD_SHARE_GAP_PX = 3;
const MOD_COLLAPSED_H = DEFAULT_LAYOUT.collapsedHeight;
/** Warframe builds can have up to 12 mod slots; scale is computed from actual count but must not cap too low or a large empty band appears below the list. */
const MOD_SCALE_MIN = 0.28;
const MOD_SCALE_MAX = 1.02;

function ModShareColumnList({ slots, modScale }: { slots: ModSlot[]; modScale: number }) {
  if (slots.length === 0) {
    return (
      <p className="text-muted py-4 text-center text-[10px] text-[#7e8fb8]">No mods equipped.</p>
    );
  }
  return (
    <div className="flex min-h-0 flex-1 flex-col gap-1 overflow-hidden pr-0.5">
      {slots.map((slot) => (
        <div
          key={`${slot.index}-${slot.mod?.unique_name ?? 'm'}`}
          className="flex shrink-0 justify-center"
        >
          <ModCard
            mod={slot.mod!}
            rank={slot.rank ?? 0}
            setRank={slot.setRank}
            slotType={slot.type}
            slotPolarity={slot.polarity}
            collapsed
            scale={modScale}
          />
        </div>
      ))}
    </div>
  );
}

/** Scales mod cards so the column fills available height (collapsed height × scale × n + gaps). */
function ModsShareSection({ slots }: { slots: ModSlot[] }) {
  const listRef = useRef<HTMLDivElement>(null);
  const [modScale, setModScale] = useState(0.42);
  const n = slots.length;

  useLayoutEffect(() => {
    const el = listRef.current;
    if (!el || n === 0) return;
    const run = () => {
      const h = el.clientHeight;
      if (h <= 0) return;
      const nEff = Math.min(n, 12);
      const raw = (h - Math.max(0, nEff - 1) * MOD_SHARE_GAP_PX) / (nEff * MOD_COLLAPSED_H);
      setModScale(Math.min(MOD_SCALE_MAX, Math.max(MOD_SCALE_MIN, raw)));
    };
    run();
    const ro = new ResizeObserver(run);
    ro.observe(el);
    return () => ro.disconnect();
  }, [n]);

  if (n === 0) {
    return (
      <div className="flex min-h-0 min-w-0 flex-1 flex-col justify-center overflow-hidden">
        <p className="text-center text-[10px] text-[#7e8fb8]">No mods equipped.</p>
      </div>
    );
  }

  return (
    <div className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden">
      <div ref={listRef} className="min-h-0 min-w-0 flex-1">
        <ModShareColumnList slots={slots} modScale={modScale} />
      </div>
    </div>
  );
}

function ShareRadarAuto({
  labels,
  values,
  fill,
  stroke,
}: {
  labels: string[];
  values: number[];
  fill?: string;
  stroke?: string;
}) {
  const boxRef = useRef<HTMLDivElement>(null);
  const [size, setSize] = useState(168);

  useLayoutEffect(() => {
    const el = boxRef.current;
    if (!el) return;
    const run = () => {
      const w = el.clientWidth;
      const h = el.clientHeight;
      setSize(Math.max(72, Math.floor(Math.min(w, h) - 8)));
    };
    run();
    const ro = new ResizeObserver(run);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  return (
    <div ref={boxRef} className="flex min-h-0 w-full min-w-0 flex-1 items-center justify-center">
      <ShareRadarChart
        dense
        size={size}
        labels={labels}
        values={values}
        fill={fill}
        stroke={stroke}
      />
    </div>
  );
}

function ShareFormaCounts({ forma }: { forma?: FormaCount }) {
  if (!forma || forma.total <= 0) return null;
  return (
    <>
      {forma.regular > 0 ? (
        <div className="flex flex-col items-center gap-0.5">
          <img src="/icons/forma.png" alt="" className="h-7 w-7 object-contain" draggable={false} />
          <span className="text-[11px] font-semibold text-[#e8edff]">{forma.regular}</span>
        </div>
      ) : null}
      {forma.universal > 0 ? (
        <div className="flex flex-col items-center gap-0.5">
          <img
            src="/icons/forma-omni.png"
            alt=""
            className="h-7 w-7 object-contain"
            draggable={false}
          />
          <span className="text-[11px] font-semibold text-[#e8edff]">{forma.universal}</span>
        </div>
      ) : null}
      {forma.umbra > 0 ? (
        <div className="flex flex-col items-center gap-0.5">
          <img
            src="/icons/forma-umbra.png"
            alt=""
            className="h-7 w-7 object-contain"
            draggable={false}
          />
          <span className="text-[11px] font-semibold text-[#e8edff]">{forma.umbra}</span>
        </div>
      ) : null}
      {forma.stance > 0 ? (
        <div className="flex flex-col items-center gap-0.5">
          <img
            src="/icons/forma-stance.png"
            alt=""
            className="h-7 w-7 object-contain"
            draggable={false}
          />
          <span className="text-[11px] font-semibold text-[#e8edff]">{forma.stance}</span>
        </div>
      ) : null}
    </>
  );
}

function ShareReactorStamp({ active }: { active: boolean }) {
  return (
    <div className="flex flex-col items-center gap-0.5">
      <img src={orokinReactorImg} alt="" className="h-7 w-7 object-contain" draggable={false} />
      <span
        className={`text-[13px] leading-none font-bold ${active ? 'text-emerald-400' : 'text-red-400/90'}`}
        aria-hidden
      >
        {active ? '\u2713' : '\u2717'}
      </span>
    </div>
  );
}

function ShareShardColumn({
  slots,
  shards,
  compact = false,
  textLeftIconRight = false,
}: {
  slots: ShardSlotConfig[];
  shards: ShardType[];
  compact?: boolean;
  /** Share card: right-align rows; text on the left of the row, shard icon on the right. */
  textLeftIconRight?: boolean;
}) {
  const lines: { key: string; name: string; tau: boolean; buff: string }[] = [];
  for (let i = 0; i < 5; i++) {
    const slot = slots[i] ?? { tauforged: false };
    if (!slot.shard_type_id) continue;
    const shard = shards.find((s) => String(s.id) === String(slot.shard_type_id));
    if (!shard) continue;
    const buff = shard.buffs.find((b) => String(b.id) === String(slot.buff_id));
    const buffText = formatShardBuffDescription(buff, slot.tauforged === true);
    lines.push({
      key: `shard-${i}-${String(slot.shard_type_id)}`,
      name: shard.name,
      tau: slot.tauforged === true,
      buff: buffText,
    });
  }

  const iconSize = compact ? 'h-7 w-7' : 'h-9 w-9';
  const gapClass = compact ? 'space-y-1' : 'space-y-2';

  const shardIcon = (slot: ShardSlotConfig, shard?: ShardType) => {
    if (!slot.shard_type_id) {
      return (
        <div
          className={`relative flex shrink-0 items-center justify-center overflow-hidden rounded-md ${iconSize}`}
        >
          <img
            src="/icons/shards/emptyBackground.png"
            alt=""
            className="invert-on-light absolute inset-0 h-full w-full object-cover"
            draggable={false}
          />
        </div>
      );
    }
    if (!shard) {
      return <div className={`shrink-0 rounded-md bg-white/10 ${iconSize}`} />;
    }
    const iconPath = slot.tauforged ? shard.tauforged_icon_path : shard.icon_path;
    return (
      <div
        className={`relative flex shrink-0 items-center justify-center overflow-hidden rounded-md ${iconSize}`}
      >
        <img
          src="/icons/shards/filledBackground.png"
          alt=""
          className={`absolute inset-0 h-full w-full object-cover ${slot.tauforged ? 'archon-shard-filled-bg--tau' : 'invert-on-light'}`}
          draggable={false}
        />
        <img
          src={iconPath}
          alt=""
          className="invert-on-light absolute inset-0 h-full w-full object-cover"
          draggable={false}
        />
      </div>
    );
  };

  return (
    <ul className={`${gapClass} ${textLeftIconRight ? 'flex w-full flex-col items-end' : ''}`}>
      {Array.from({ length: 5 }, (_, i) => {
        const slot = slots[i] ?? { tauforged: false };
        if (!slot.shard_type_id) {
          return (
            <li
              key={i}
              className={`flex items-center gap-2 ${textLeftIconRight ? 'w-full max-w-full justify-end' : ''}`}
            >
              {textLeftIconRight ? (
                <>
                  <span className="text-[10px] text-[#8fa4d4]">Empty</span>
                  {shardIcon(slot, undefined)}
                </>
              ) : (
                <>
                  {shardIcon(slot, undefined)}
                  <span className="text-[10px] text-[#8fa4d4]">Empty</span>
                </>
              )}
            </li>
          );
        }
        const shard = shards.find((s) => String(s.id) === String(slot.shard_type_id));
        if (!shard) {
          return (
            <li
              key={i}
              className={`flex items-center gap-2 ${textLeftIconRight ? 'w-full max-w-full justify-end' : ''}`}
            >
              {textLeftIconRight ? (
                <>
                  <span className="text-[10px] text-[#8fa4d4]">—</span>
                  {shardIcon(slot, undefined)}
                </>
              ) : (
                <>
                  {shardIcon(slot, undefined)}
                  <span className="text-[10px] text-[#8fa4d4]">—</span>
                </>
              )}
            </li>
          );
        }
        const line = lines.find((l) => l.key.startsWith(`shard-${i}`));
        const textBlock = (
          <div className={`min-w-0 ${textLeftIconRight ? 'flex-1 text-right' : 'flex-1'}`}>
            <div className="text-[10px] font-semibold text-[#eef2ff]">
              {shard.name}
              {line?.tau ? (
                <span className="ml-1 text-[8px] tracking-wide text-cyan-200/90 uppercase">
                  Tau
                </span>
              ) : null}
            </div>
            {line?.buff ? (
              <div className="text-[9px] leading-snug text-[#a8b8e0]">{line.buff}</div>
            ) : null}
          </div>
        );
        return (
          <li
            key={i}
            className={`flex items-start gap-2 ${textLeftIconRight ? 'w-full max-w-full justify-end' : ''}`}
          >
            {textLeftIconRight ? (
              <>
                {textBlock}
                {shardIcon(slot, shard)}
              </>
            ) : (
              <>
                {shardIcon(slot, shard)}
                {textBlock}
              </>
            )}
          </li>
        );
      })}
    </ul>
  );
}

function ShareSkillsPanel({
  ownAbilities,
  dbAbilities,
  selectedReplacement,
  helminthConfig,
  iconPx,
  iconsOnly = false,
}: {
  ownAbilities: ParsedShareAbility[];
  dbAbilities: Ability[];
  selectedReplacement: Ability | null;
  helminthConfig?: BuildConfig['helminth'];
  iconPx: number;
  iconsOnly?: boolean;
}) {
  const MAX_DESCRIPTION_LENGTH = 900;
  const TRUNCATED_DESCRIPTION_LENGTH = MAX_DESCRIPTION_LENGTH - 3;
  const desc =
    helminthConfig && selectedReplacement?.description
      ? selectedReplacement.description
      : ownAbilities.find((a) => a.description)?.description;

  const displayDesc =
    desc != null && desc.length > MAX_DESCRIPTION_LENGTH
      ? `${desc.slice(0, TRUNCATED_DESCRIPTION_LENGTH).trim()}...`
      : desc;

  return (
    <div className="flex min-h-0 flex-col gap-2">
      <div className="flex justify-center gap-1.5">
        {ownAbilities.map((ability) => {
          const isReplaced = helminthConfig?.replaced_ability_index === ability.index;
          const icon =
            isReplaced && selectedReplacement?.image_path
              ? `/images${selectedReplacement.image_path}`
              : getShareAbilityDbIcon(ability, dbAbilities);
          const initial = (
            isReplaced && selectedReplacement ? selectedReplacement.name : ability.name
          )
            .charAt(0)
            .toUpperCase();
          return (
            <div
              key={ability.index}
              className={`relative flex shrink-0 items-center justify-center overflow-hidden rounded-lg border bg-black/25 ${
                isReplaced ? 'border-red-400/70 ring-1 ring-red-400/50' : 'border-white/15'
              }`}
              style={{ width: iconPx, height: iconPx }}
            >
              {icon ? (
                <img
                  src={icon}
                  alt=""
                  className="invert-on-light max-h-[88%] max-w-[88%] rounded object-cover"
                  draggable={false}
                />
              ) : (
                <span
                  className={`text-sm font-bold ${isReplaced ? 'text-red-300/90' : 'text-white/45'}`}
                >
                  {initial}
                </span>
              )}
              <span
                className={`absolute -top-0.5 -left-0.5 flex h-3.5 min-w-[14px] items-center justify-center rounded-full px-0.5 text-[8px] font-bold ${
                  isReplaced ? 'bg-red-500 text-white' : 'bg-white/20 text-[#dbe4ff]'
                }`}
              >
                {ability.index + 1}
              </span>
            </div>
          );
        })}
      </div>
      {iconsOnly ? null : displayDesc ? (
        <p className="line-clamp-[10] text-[10px] leading-snug break-words text-[#b8c8ec]">
          {displayDesc}
        </p>
      ) : (
        <p className="text-[10px] text-[#7e8fb8]">No ability description loaded.</p>
      )}
    </div>
  );
}

function ShareDamageBreakdownBars({
  weapon,
  slots,
  valenceBonus,
  hideHeader = false,
}: {
  weapon: Weapon;
  slots: ModSlot[];
  valenceBonus?: ValenceBonus | null;
  hideHeader?: boolean;
}) {
  const { totalDamage, damageBreakdown } = calculateBuildDamage(
    weapon,
    slots,
    undefined,
    valenceBonus,
  );
  if (damageBreakdown.length === 0) return null;
  const maxValue = Math.max(...damageBreakdown.map((e) => e.value));

  return (
    <div className="space-y-1">
      {hideHeader ? (
        <div className="mb-1 flex justify-end">
          <span className="text-[12px] font-bold text-[#f0f4ff]">{formatDamage(totalDamage)}</span>
        </div>
      ) : (
        <div className="mb-1 flex items-center justify-between gap-2">
          <span className="text-[10px] tracking-[0.16em] text-[#c7d5ff] uppercase">Damage</span>
          <span className="text-[12px] font-bold text-[#f0f4ff]">{formatDamage(totalDamage)}</span>
        </div>
      )}
      {damageBreakdown.map((entry) => {
        const color = getElementColor(entry.type);
        const pct = totalDamage > 0 ? (entry.value / totalDamage) * 100 : 0;
        const barWidth = maxValue > 0 ? (entry.value / maxValue) * 100 : 0;
        const iconFile = SHARE_ELEMENT_ICONS[entry.type];
        return (
          <div
            key={entry.type}
            className="relative flex items-center gap-1.5 overflow-hidden rounded py-0.5 pr-1.5 pl-0.5"
          >
            <div
              className="absolute inset-y-0 left-0 rounded"
              style={{
                width: `${barWidth}%`,
                backgroundColor: color,
                opacity: 0.14,
              }}
            />
            <div className="relative z-10 flex h-4 w-4 shrink-0 items-center justify-center">
              {iconFile ? (
                <img
                  src={`/icons/elements/${iconFile}.png`}
                  alt=""
                  className="h-3.5 w-3.5 object-contain"
                  draggable={false}
                />
              ) : (
                <div className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: color }} />
              )}
            </div>
            <span className="relative z-10 min-w-[52px] text-[9px] font-medium" style={{ color }}>
              {entry.type}
            </span>
            <div className="relative z-10 flex-1" />
            <span className="relative z-10 text-[8px] text-[#9fb0d8] tabular-nums">
              {pct.toFixed(1)}%
            </span>
            <span className="relative z-10 min-w-[40px] text-right text-[9px] font-semibold text-[#f0f4ff] tabular-nums">
              {formatDamage(entry.value)}
            </span>
          </div>
        );
      })}
    </div>
  );
}

/**
 * Fades hero art to transparency at left, right, and bottom; top stays fully opaque.
 * Intersection of: horizontal feather + vertical feather (opaque on top half of column).
 */
const HERO_MASK_HORIZONTAL =
  'linear-gradient(to right, transparent 0%, black 12%, black 88%, transparent 100%)';
const HERO_MASK_VERTICAL = 'linear-gradient(to bottom, black 0%, black 56%, transparent 100%)';
const HERO_MASK_IMAGE = `${HERO_MASK_HORIZONTAL}, ${HERO_MASK_VERTICAL}`;

function ShareHeroImage({
  equipmentImagePath,
  equipmentName,
}: {
  equipmentImagePath?: string;
  equipmentName: string;
}) {
  const heroMaskStyle: CSSProperties = {
    WebkitMaskImage: HERO_MASK_IMAGE,
    WebkitMaskRepeat: 'no-repeat',
    WebkitMaskSize: '100% 100%',
    maskImage: HERO_MASK_IMAGE,
    maskRepeat: 'no-repeat',
    maskSize: '100% 100%',
    // Intersect: keep pixels only where both feather bands are opaque (sides + bottom fade).
    maskComposite: 'intersect',
  };

  return (
    <div className="relative h-[340px] w-full shrink-0 overflow-hidden bg-transparent">
      {equipmentImagePath ? (
        <img
          src={equipmentImagePath}
          alt=""
          className="h-full w-full object-contain object-top"
          draggable={false}
          style={heroMaskStyle}
        />
      ) : (
        <div className="flex h-full w-full items-center justify-center px-2 text-center text-[11px] text-white/45">
          No Art
        </div>
      )}
      <div className="absolute right-0 bottom-0 left-0 z-10 pb-3">
        <ShareHeroTitle text={equipmentName} />
      </div>
    </div>
  );
}

export function BuildShareModal({
  open,
  onClose,
  buildName,
  equipment,
  equipmentName,
  equipmentType,
  equipmentImagePath,
  slots,
  arcaneSlots,
  shardSlots,
  shardTypes,
  orokinReactor,
  formaCost,
  helminthConfig,
  valenceBonus,
}: BuildShareModalProps) {
  const exportRef = useRef<HTMLDivElement | null>(null);
  const previewBoxRef = useRef<HTMLDivElement | null>(null);
  const [bgDataUrl, setBgDataUrl] = useState<string | null>(null);
  const [uploadName, setUploadName] = useState<string>('');
  const [bgOpacity, setBgOpacity] = useState(36);
  const [bgScale, setBgScale] = useState(1);
  const [previewScale, setPreviewScale] = useState(1);
  const [isRendering, setIsRendering] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const isWarframe = equipmentType === 'warframe';
  const shareAbilities = useWarframeShareAbilities(
    isWarframe ? (equipment as Warframe) : null,
    helminthConfig,
  );
  const warframeCalc = useMemo(() => {
    if (!isWarframe) return null;
    try {
      const bonuses = extractArchonShardBonuses(shardSlots, shardTypes);
      return calculateWarframeStats(equipment as Warframe, slots, bonuses);
    } catch (err) {
      console.error('[BuildShareModal] calculateWarframeStats failed', err);
      return null;
    }
  }, [equipment, isWarframe, shardSlots, shardTypes, slots]);

  const weaponCalc = useMemo(() => {
    if (isWarframe) return null;
    try {
      return calculateWeaponDps(equipment as Weapon, slots, valenceBonus);
    } catch {
      return null;
    }
  }, [equipment, isWarframe, slots, valenceBonus]);

  const equippedSlots = useMemo(() => slots.filter((s) => s.mod), [slots]);
  const filledArcanes = useMemo(() => arcaneSlots.filter((s) => s.arcane), [arcaneSlots]);

  const weaponRadarValues = useMemo(() => {
    if (!weaponCalc) return null;
    const b = weaponCalc.base;
    const m = weaponCalc.modded;
    const reloadScore =
      b.reloadTime > 0.05
        ? b.reloadTime / Math.max(m.reloadTime, 0.001)
        : m.fireRate / Math.max(b.fireRate, 0.001);
    return [m.critChance, m.critMultiplier, m.statusChance, m.fireRate, m.multishot, reloadScore];
  }, [weaponCalc]);

  useLayoutEffect(() => {
    if (!open) return;
    const el = previewBoxRef.current;
    if (!el) return;
    const run = () => {
      const w = el.clientWidth;
      const h = el.clientHeight;
      if (w <= 0 || h <= 0) return;
      setPreviewScale(Math.min(w / SHARE_CANVAS_WIDTH, h / SHARE_CANVAS_HEIGHT, 1));
    };
    run();
    const ro = new ResizeObserver(run);
    ro.observe(el);
    return () => ro.disconnect();
  }, [open]);

  const arcaneScale = 0.5;
  const skillIconPx = 34;

  async function handleUploadChange(file: File | null): Promise<void> {
    if (!file) return;
    if (!file.type.startsWith('image/')) {
      setError('Please choose an image file.');
      return;
    }
    setError(null);
    try {
      const dataUrl = await readFileAsDataUrl(file);
      setBgDataUrl(dataUrl);
      setUploadName(file.name);
    } catch {
      setError('Could not read that image file.');
    }
  }

  async function handleExport(): Promise<void> {
    if (!exportRef.current) return;
    setIsRendering(true);
    setError(null);
    let objectUrl: string | null = null;
    try {
      const blob = await toBlob(exportRef.current, {
        cacheBust: true,
        pixelRatio: SHARE_EXPORT_PIXEL_RATIO,
        canvasWidth: SHARE_CANVAS_WIDTH,
        canvasHeight: SHARE_CANVAS_HEIGHT,
        backgroundColor: '#090d18',
      });
      if (!blob) {
        throw new Error('Export produced an empty image');
      }
      objectUrl = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = objectUrl;
      a.download = buildShareDownloadFileName(equipmentName, buildName || 'build');
      a.click();
    } catch (renderError) {
      console.error('[BuildShareModal] Failed to render share image', renderError);
      setError('Failed to export image. If this persists, try removing the background image.');
    } finally {
      setIsRendering(false);
      if (objectUrl) {
        const u = objectUrl;
        window.setTimeout(() => URL.revokeObjectURL(u), 500);
      }
    }
  }

  if (!open) return null;

  const weaponStatLabels = weaponCalc?.isMelee
    ? [
        'Critical Chance',
        'Critical Multiplier',
        'Status Chance',
        'Attack Speed',
        'Multishot',
        'Reload Speed',
      ]
    : [
        'Critical Chance',
        'Critical Multiplier',
        'Status Chance',
        'Fire Rate',
        'Multishot',
        'Reload Speed',
      ];

  const leftColumn = (
    <div className="flex min-h-0 w-[46%] max-w-[46%] min-w-0 flex-[0_0_46%] flex-col gap-2 pr-1">
      <div className="flex shrink-0 items-start gap-2.5">
        <img
          src={feathers}
          alt=""
          width={36}
          height={36}
          className="mt-0.5 h-9 w-9 shrink-0 object-contain opacity-95 drop-shadow-[0_1px_8px_rgba(0,0,0,0.45)]"
          draggable={false}
        />
        <div className="min-w-0 flex-1">
          <p className="text-[9px] tracking-[0.2em] text-[#9fb2e8]/95 uppercase">Parametric</p>
          <h4 className="mt-0.5 text-[28px] leading-[1.06] font-semibold tracking-tight text-[#f6f8ff]">
            {buildName}
          </h4>
          <p className="mt-1 text-[10px] text-[#7d92c0]">{formatEquipmentType(equipmentType)}</p>
        </div>
      </div>
      <div className="flex shrink-0 flex-wrap items-end gap-4">
        <ShareFormaCounts forma={formaCost} />
        <ShareReactorStamp active={orokinReactor} />
      </div>
      <ModsShareSection slots={equippedSlots} />
      <div className="flex shrink-0 flex-wrap items-center justify-center gap-3 py-1">
        {filledArcanes.length === 0 ? (
          <span className="text-[9px] text-[#7e8fb8]">No arcanes</span>
        ) : (
          filledArcanes.map((slot, i) => {
            const a = slot.arcane!;
            const maxRank = getMaxRank(a);
            const art = a.image_path ? `/images${a.image_path}` : '';
            return (
              <ArcaneCardPreview
                key={`${a.unique_name}-${i}`}
                layout={{ ...DEFAULT_ARCANE_LAYOUT, scale: arcaneScale }}
                rarity={normalizeArcaneRarity(a.rarity)}
                arcaneArt={art}
                arcaneName={a.name}
                rank={slot.rank}
                maxRank={maxRank}
              />
            );
          })
        )}
      </div>
    </div>
  );

  const warframeRightColumn =
    isWarframe && warframeCalc ? (
      <div className="flex min-h-0 min-w-0 flex-1 flex-col gap-2 pl-1">
        <ShareHeroImage equipmentImagePath={equipmentImagePath} equipmentName={equipmentName} />
        <div className="shrink-0 px-0.5 py-1">
          <ShareSkillsPanel
            ownAbilities={shareAbilities.ownAbilities}
            dbAbilities={shareAbilities.dbAbilities}
            selectedReplacement={shareAbilities.selectedReplacement}
            helminthConfig={helminthConfig}
            iconPx={skillIconPx}
            iconsOnly
          />
        </div>
        <div className="min-h-0 shrink-0 px-0.5">
          <ShareShardColumn compact textLeftIconRight slots={shardSlots} shards={shardTypes} />
        </div>
        <div className="flex min-h-0 min-w-0 flex-1 flex-col gap-2 overflow-hidden">
          <div className="flex min-h-0 min-w-0 flex-1 flex-col">
            <ShareRadarAuto
              labels={['Health', 'Shield', 'Armor', 'Energy', 'Sprint Speed']}
              values={[
                warframeCalc.health.modded,
                warframeCalc.shield.modded,
                warframeCalc.armor.modded,
                warframeCalc.energy.modded,
                warframeCalc.sprintSpeed.modded,
              ]}
            />
          </div>
          <div className="flex min-h-0 min-w-0 flex-1 flex-col">
            <ShareRadarAuto
              labels={[
                'Ability Strength',
                'Ability Duration',
                'Ability Efficiency',
                'Ability Range',
              ]}
              values={[
                warframeCalc.abilityStrength.modded,
                warframeCalc.abilityDuration.modded,
                warframeCalc.abilityEfficiency.modded,
                warframeCalc.abilityRange.modded,
              ]}
              fill="rgba(70, 214, 190, 0.28)"
              stroke="rgba(120, 230, 210, 0.95)"
            />
          </div>
        </div>
      </div>
    ) : isWarframe ? (
      <div className="flex min-h-0 min-w-0 flex-1 flex-col gap-2 pl-1">
        <ShareHeroImage equipmentImagePath={equipmentImagePath} equipmentName={equipmentName} />
        <p className="text-[11px] text-[#b6c5ed]">Stats unavailable for this build.</p>
      </div>
    ) : null;

  const weaponRightColumn =
    !isWarframe && weaponCalc && weaponRadarValues ? (
      <div className="flex min-h-0 min-w-0 flex-1 flex-col gap-2 pl-1">
        <ShareHeroImage equipmentImagePath={equipmentImagePath} equipmentName={equipmentName} />
        <div className="flex min-h-0 min-w-0 flex-1 flex-col">
          <ShareRadarAuto labels={weaponStatLabels} values={weaponRadarValues} />
        </div>
        <div className="min-h-0 flex-1 overflow-hidden">
          <ShareDamageBreakdownBars
            hideHeader
            weapon={equipment as Weapon}
            slots={slots}
            valenceBonus={valenceBonus}
          />
        </div>
      </div>
    ) : !isWarframe ? (
      <div className="flex min-h-0 min-w-0 flex-1 flex-col gap-2 pl-1">
        <ShareHeroImage equipmentImagePath={equipmentImagePath} equipmentName={equipmentName} />
        <p className="text-[11px] text-[#b6c5ed]">Stats unavailable.</p>
      </div>
    ) : null;

  return (
    <Modal open onClose={onClose} ariaLabelledBy="share-build-title" className="max-w-[1120px]">
      <div className="grid gap-5 lg:grid-cols-[300px_1fr]">
        <section className="space-y-4">
          <h3 id="share-build-title" className="text-foreground text-lg font-semibold">
            Export Share Image
          </h3>
          <p className="text-muted text-sm">
            Your uploaded image stays local in the browser and is only used for this rendered
            export.
          </p>

          <div className="glass-panel space-y-3 p-3">
            <p className="text-muted text-xs tracking-[0.16em] uppercase">Partial Background</p>
            <input
              type="file"
              accept="image/*"
              className="form-input"
              onChange={(event) => {
                const file = event.currentTarget.files?.[0] ?? null;
                void handleUploadChange(file);
              }}
            />
            {uploadName ? (
              <p className="text-muted text-xs">Using: {uploadName}</p>
            ) : (
              <p className="text-muted text-xs">Optional image behind build details.</p>
            )}
            <label className="text-muted block text-xs">
              Opacity: {bgOpacity}%
              <input
                type="range"
                min={10}
                max={85}
                value={bgOpacity}
                onChange={(event) => setBgOpacity(Number(event.target.value))}
                className="mt-1 w-full"
              />
            </label>
            <label className="text-muted block text-xs">
              Scale: {bgScale.toFixed(2)}x
              <input
                type="range"
                min={0.7}
                max={1.6}
                step={0.01}
                value={bgScale}
                onChange={(event) => setBgScale(Number(event.target.value))}
                className="mt-1 w-full"
              />
            </label>
            {bgDataUrl ? (
              <button
                type="button"
                className="btn btn-secondary w-full"
                onClick={() => {
                  setBgDataUrl(null);
                  setUploadName('');
                }}
              >
                Remove Background Image
              </button>
            ) : null}
          </div>

          {error ? <p className="error-msg">{error}</p> : null}

          <div className="flex gap-2">
            <button type="button" className="btn btn-secondary flex-1" onClick={onClose}>
              Close
            </button>
            <button
              type="button"
              className="btn btn-accent flex-1"
              onClick={() => {
                void handleExport();
              }}
              disabled={isRendering}
            >
              {isRendering ? 'Rendering...' : 'Export PNG'}
            </button>
          </div>
        </section>

        <section className="flex min-h-0 min-w-0 flex-col space-y-3">
          <div className="text-muted text-xs tracking-[0.16em] uppercase">
            Preview ({SHARE_CANVAS_WIDTH} × {SHARE_CANVAS_HEIGHT}) — scaled to fit; PNG exports at{' '}
            {SHARE_CANVAS_WIDTH * SHARE_EXPORT_PIXEL_RATIO} ×{' '}
            {SHARE_CANVAS_HEIGHT * SHARE_EXPORT_PIXEL_RATIO} for sharper output
          </div>
          <div
            ref={previewBoxRef}
            className="flex h-[min(720px,82vh)] min-h-0 w-full min-w-0 items-center justify-center overflow-hidden rounded-xl border border-white/10 bg-black/20 p-2"
          >
            <div
              className="overflow-hidden rounded-[20px]"
              style={{
                width: SHARE_CANVAS_WIDTH * previewScale,
                height: SHARE_CANVAS_HEIGHT * previewScale,
              }}
            >
              <div
                style={{
                  width: SHARE_CANVAS_WIDTH,
                  height: SHARE_CANVAS_HEIGHT,
                  transform: `scale(${previewScale})`,
                  transformOrigin: 'top left',
                }}
              >
                <div
                  ref={exportRef}
                  style={{ width: SHARE_CANVAS_WIDTH, height: SHARE_CANVAS_HEIGHT }}
                  className="share-export-root share-export-glass-frame relative flex shrink-0 flex-col overflow-hidden text-[#edf2ff]"
                >
                  <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_18%_22%,rgba(120,154,255,0.35),transparent_38%),radial-gradient(circle_at_85%_78%,rgba(70,214,190,0.24),transparent_45%),linear-gradient(130deg,#0a1020_0%,#12172d_45%,#090d18_100%)]" />
                  {bgDataUrl ? (
                    <div
                      className="pointer-events-none absolute inset-0 overflow-hidden"
                      style={{ opacity: bgOpacity / 100 }}
                    >
                      <img
                        src={bgDataUrl}
                        alt=""
                        className="h-full w-full object-cover"
                        style={{ transform: `scale(${bgScale})` }}
                        draggable={false}
                      />
                      <div className="absolute inset-0 bg-[linear-gradient(115deg,rgba(9,13,24,0.82),rgba(9,13,24,0.35),rgba(9,13,24,0.55))]" />
                    </div>
                  ) : null}
                  <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(180deg,rgba(255,255,255,0.06)_0%,transparent_25%,transparent_70%,rgba(0,0,0,0.44)_100%)]" />

                  <div className="relative z-10 flex min-h-0 flex-1 flex-col px-4 pt-4 pb-3">
                    <div className="flex min-h-0 min-w-0 flex-1 flex-row gap-0">
                      {leftColumn}
                      {isWarframe ? warframeRightColumn : weaponRightColumn}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>
      </div>
    </Modal>
  );
}
