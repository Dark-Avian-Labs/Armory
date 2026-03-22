import { toPng } from 'html-to-image';
import { useMemo, useRef, useState } from 'react';

import feathers from '../../assets/feathers.png';
import type {
  Ability,
  BuildConfig,
  EquipmentType,
  ModSlot,
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
import { DEFAULT_ARCANE_LAYOUT, normalizeArcaneRarity } from '../ModCard/cardLayout';
import { ModCard } from '../ModCard/ModCard';
import { Modal } from '../ui/Modal';
import { ShareRadarChart } from './ShareRadarChart';
import {
  getShareAbilityDbIcon,
  type ParsedShareAbility,
  useWarframeShareAbilities,
} from './useWarframeShareAbilities';

type ShareAspect = 'wide' | 'portrait';

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
}

function formatEquipmentType(type: EquipmentType): string {
  return type.replace(/_/g, ' ').replace(/\b\w/g, (ch) => ch.toUpperCase());
}

/** Readable download name: keeps spaces; strips characters illegal on Windows file names. */
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

function chunkEquippedModsForLayout(slots: ModSlot[]): ModSlot[][] {
  const n = slots.length;
  if (n === 0) return [];
  if (n <= 2) return [slots];
  if (n <= 6) return [slots.slice(0, 2), slots.slice(2)];
  if (n <= 10) return [slots.slice(0, 2), slots.slice(2, 6), slots.slice(6, 10)];
  const rows: ModSlot[][] = [slots.slice(0, 2)];
  let i = 2;
  while (i < n) {
    rows.push(slots.slice(i, i + 4));
    i += 4;
  }
  return rows;
}

function ModShareGrid({ slots, modScale }: { slots: ModSlot[]; modScale: number }) {
  const rows = chunkEquippedModsForLayout(slots);
  return (
    <div className="flex flex-col gap-2">
      {rows.map((row, ri) => (
        <div
          key={ri}
          className={`flex flex-wrap gap-x-2 gap-y-2 ${ri === 0 ? 'justify-center' : 'justify-start'}`}
        >
          {row.map((slot) => (
            <ModCard
              key={`${slot.index}-${slot.mod?.unique_name ?? 'm'}`}
              mod={slot.mod!}
              rank={slot.rank ?? 0}
              setRank={slot.setRank}
              slotType={slot.type}
              slotPolarity={slot.polarity}
              collapsed
              scale={modScale}
            />
          ))}
        </div>
      ))}
    </div>
  );
}

function ShareFormaHeader({ forma }: { forma?: FormaCount }) {
  if (!forma || forma.total <= 0) return null;
  return (
    <div className="flex items-end gap-3 pr-1">
      {forma.regular > 0 ? (
        <div className="flex flex-col items-center gap-0.5">
          <img
            src="/icons/forma.png"
            alt=""
            className="h-7 w-7 object-contain"
            draggable={false}
          />
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
    </div>
  );
}

function ShareShardColumn({ slots, shards }: { slots: ShardSlotConfig[]; shards: ShardType[] }) {
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

  return (
    <ul className="space-y-2">
      {Array.from({ length: 5 }, (_, i) => {
        const slot = slots[i] ?? { tauforged: false };
        if (!slot.shard_type_id) {
          return (
            <li key={i} className="flex items-center gap-2">
              <div className="relative flex h-9 w-9 shrink-0 items-center justify-center overflow-hidden rounded-md">
                <img
                  src="/icons/shards/emptyBackground.png"
                  alt=""
                  className="invert-on-light absolute inset-0 h-full w-full object-cover"
                  draggable={false}
                />
              </div>
              <span className="text-[10px] text-[#8fa4d4]">Empty</span>
            </li>
          );
        }
        const shard = shards.find((s) => String(s.id) === String(slot.shard_type_id));
        if (!shard) {
          return (
            <li key={i} className="flex items-center gap-2">
              <div className="h-9 w-9 shrink-0 rounded-md bg-white/10" />
              <span className="text-[10px] text-[#8fa4d4]">—</span>
            </li>
          );
        }
        const iconPath = slot.tauforged ? shard.tauforged_icon_path : shard.icon_path;
        const line = lines.find((l) => l.key.startsWith(`shard-${i}`));
        return (
          <li key={i} className="flex items-start gap-2">
            <div className="relative flex h-9 w-9 shrink-0 items-center justify-center overflow-hidden rounded-md">
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
            <div className="min-w-0 flex-1">
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
}: {
  ownAbilities: ParsedShareAbility[];
  dbAbilities: Ability[];
  selectedReplacement: Ability | null;
  helminthConfig?: BuildConfig['helminth'];
  iconPx: number;
}) {
  const desc =
    helminthConfig && selectedReplacement?.description
      ? selectedReplacement.description
      : ownAbilities.find((a) => a.description)?.description;

  const shortDesc = desc
    ? desc.length > 220
      ? `${desc.slice(0, 217)}…`
      : desc
    : null;

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
      {shortDesc ? (
        <p className="text-[9px] leading-relaxed text-[#b8c8ec]">{shortDesc}</p>
      ) : (
        <p className="text-[9px] text-[#7e8fb8]">No ability description loaded.</p>
      )}
    </div>
  );
}

function ShareDamageBreakdownBars({
  weapon,
  slots,
}: {
  weapon: Weapon;
  slots: ModSlot[];
}) {
  const { totalDamage, damageBreakdown } = calculateBuildDamage(weapon, slots);
  if (damageBreakdown.length === 0) return null;
  const maxValue = Math.max(...damageBreakdown.map((e) => e.value));

  return (
    <div className="space-y-1">
      <div className="mb-1 flex items-center justify-between gap-2">
        <span className="text-[10px] tracking-[0.16em] text-[#c7d5ff] uppercase">Damage</span>
        <span className="text-[12px] font-bold text-[#f0f4ff]">{formatDamage(totalDamage)}</span>
      </div>
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
            <span className="relative z-10 text-[8px] tabular-nums text-[#9fb0d8]">
              {pct.toFixed(1)}%
            </span>
            <span className="relative z-10 min-w-[40px] text-right text-[9px] font-semibold tabular-nums text-[#f0f4ff]">
              {formatDamage(entry.value)}
            </span>
          </div>
        );
      })}
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
}: BuildShareModalProps) {
  const exportRef = useRef<HTMLDivElement | null>(null);
  const [bgDataUrl, setBgDataUrl] = useState<string | null>(null);
  const [uploadName, setUploadName] = useState<string>('');
  const [bgOpacity, setBgOpacity] = useState(36);
  const [bgScale, setBgScale] = useState(1);
  const [aspect, setAspect] = useState<ShareAspect>('wide');
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
      return calculateWeaponDps(equipment as Weapon, slots);
    } catch {
      return null;
    }
  }, [equipment, isWarframe, slots]);

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
    try {
      const dataUrl = await toPng(exportRef.current, {
        cacheBust: true,
        pixelRatio: 1,
        canvasWidth,
        canvasHeight,
        backgroundColor: '#090d18',
      });
      const a = document.createElement('a');
      a.href = dataUrl;
      a.download = buildShareDownloadFileName(equipmentName, buildName || 'build');
      a.click();
    } catch (renderError) {
      console.error('[BuildShareModal] Failed to render share image', renderError);
      setError('Failed to export image. If this persists, try removing the background image.');
    } finally {
      setIsRendering(false);
    }
  }

  if (!open) return null;

  const isWide = aspect === 'wide';
  const canvasWidth = isWide ? 1280 : 720;
  const canvasHeight = isWide ? 720 : 1280;
  const modScale = isWide ? 0.27 : 0.21;
  const arcaneScale = isWide ? 0.36 : 0.32;
  const radarMain = isWide ? 188 : 148;
  const radarSecondary = isWide ? 168 : 132;
  const skillIconPx = isWide ? 40 : 36;

  const shardSummary = {
    filled: shardSlots.filter((s) => s.shard_type_id != null).length,
    tau: shardSlots.filter((s) => s.shard_type_id != null && s.tauforged).length,
  };

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
            <p className="text-muted text-xs tracking-[0.16em] uppercase">Frame Preset</p>
            <div className="flex gap-2">
              <button
                type="button"
                className={`btn ${aspect === 'wide' ? 'btn-accent' : 'btn-secondary'} flex-1`}
                onClick={() => setAspect('wide')}
              >
                Wide
              </button>
              <button
                type="button"
                className={`btn ${aspect === 'portrait' ? 'btn-accent' : 'btn-secondary'} flex-1`}
                onClick={() => setAspect('portrait')}
              >
                Portrait
              </button>
            </div>
          </div>

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

        <section className="space-y-3">
          <div className="text-muted text-xs tracking-[0.16em] uppercase">
            Preview ({canvasWidth} × {canvasHeight}) — scroll if clipped
          </div>
          <div className="max-h-[min(720px,82vh)] w-full overflow-auto rounded-xl border border-white/10 bg-black/20 p-2">
            <div
              ref={exportRef}
              style={{ width: canvasWidth, height: canvasHeight }}
              className="relative flex shrink-0 flex-col overflow-hidden rounded-[28px] border border-white/15 bg-[#090d18] text-[#edf2ff]"
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

              <div className="relative z-10 flex min-h-0 flex-1 flex-col px-5 pt-4 pb-2.5">
                <div className="flex shrink-0 items-start justify-between gap-3">
                  <div className="flex min-w-0 flex-1 items-start gap-3">
                    <img
                      src={feathers}
                      alt=""
                      width={40}
                      height={40}
                      className="mt-0.5 h-10 w-10 shrink-0 object-contain opacity-95 drop-shadow-[0_1px_8px_rgba(0,0,0,0.45)]"
                      draggable={false}
                    />
                    <div className="min-w-0 flex-1">
                      <p className="text-[9px] tracking-[0.2em] text-[#9fb2e8]/95 uppercase">
                        Parametric
                      </p>
                      <h4 className="mt-0.5 text-[26px] font-semibold leading-[1.08] tracking-tight text-[#f6f8ff]">
                        {buildName}
                      </h4>
                      <p className="mt-1 text-[13px] font-medium text-[#d0ddf8]">{equipmentName}</p>
                      <p className="mt-0.5 text-[10px] text-[#7d92c0]">
                        {formatEquipmentType(equipmentType)}
                      </p>
                    </div>
                  </div>
                  <div className="flex shrink-0 items-start gap-2">
                    <ShareFormaHeader forma={formaCost} />
                    <div className="glass-panel shrink-0 overflow-hidden rounded-2xl p-1">
                      <div
                        className={`flex items-center justify-center overflow-hidden rounded-xl bg-black/35 ${
                          isWide ? 'h-[100px] w-[100px]' : 'h-[92px] w-[92px]'
                        }`}
                      >
                        {equipmentImagePath ? (
                          <img
                            src={equipmentImagePath}
                            alt=""
                            className="max-h-full max-w-full object-contain"
                            draggable={false}
                          />
                        ) : (
                          <div className="flex h-full w-full items-center justify-center px-2 text-center text-[10px] text-white/55">
                            No Art
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                </div>

                {isWide ? (
                  <div className="mt-3 grid min-h-0 flex-1 grid-cols-12 gap-2.5">
                    <div className="col-span-8 flex min-h-0 flex-col gap-2.5">
                      <div className="glass-panel flex min-h-0 flex-1 flex-col rounded-2xl p-3">
                        <p className="mb-2 shrink-0 text-[10px] tracking-[0.18em] text-[#c7d5ff] uppercase">
                          Mods ({equippedSlots.length})
                        </p>
                        <div className="min-h-0 overflow-hidden">
                          <ModShareGrid slots={equippedSlots} modScale={modScale} />
                        </div>
                      </div>
                      {isWarframe ? (
                        <div className="grid shrink-0 grid-cols-12 gap-2">
                          <div className="glass-panel col-span-3 rounded-xl p-2">
                            <p className="mb-1.5 text-[9px] tracking-[0.14em] text-[#c7d5ff] uppercase">
                              Arcane
                            </p>
                            <div className="flex flex-col gap-2">
                              {filledArcanes.length === 0 ? (
                                <span className="text-[9px] text-[#7e8fb8]">None</span>
                              ) : (
                                filledArcanes.map((slot, i) => {
                                  const a = slot.arcane!;
                                  const maxRank = getMaxRank(a);
                                  const art = a.image_path ? `/images${a.image_path}` : '';
                                  return (
                                    <ArcaneCardPreview
                                      key={`${a.unique_name}-${i}`}
                                      layout={{ ...DEFAULT_ARCANE_LAYOUT, scale: arcaneScale * 0.85 }}
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
                          <div className="glass-panel col-span-4 rounded-xl p-2">
                            <p className="mb-1.5 text-[9px] tracking-[0.14em] text-[#c7d5ff] uppercase">
                              Shards
                            </p>
                            <ShareShardColumn slots={shardSlots} shards={shardTypes} />
                          </div>
                          <div className="glass-panel col-span-5 rounded-xl p-2">
                            <p className="mb-1.5 text-[9px] tracking-[0.14em] text-[#c7d5ff] uppercase">
                              Skills
                            </p>
                            <ShareSkillsPanel
                              ownAbilities={shareAbilities.ownAbilities}
                              dbAbilities={shareAbilities.dbAbilities}
                              selectedReplacement={shareAbilities.selectedReplacement}
                              helminthConfig={helminthConfig}
                              iconPx={skillIconPx}
                            />
                          </div>
                        </div>
                      ) : (
                        <div className="glass-panel shrink-0 rounded-xl p-2">
                          <p className="mb-1.5 text-[9px] tracking-[0.14em] text-[#c7d5ff] uppercase">
                            Arcane
                          </p>
                          {filledArcanes.length === 0 ? (
                            <span className="text-[9px] text-[#7e8fb8]">None</span>
                          ) : (
                            <div className="flex flex-wrap gap-2">
                              {filledArcanes.map((slot, i) => {
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
                              })}
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                    <div className="col-span-4 flex min-h-0 flex-col gap-2.5">
                      {isWarframe && warframeCalc ? (
                        <>
                          <div className="glass-panel flex flex-col items-center rounded-2xl p-2.5">
                            <p className="mb-0.5 w-full text-left text-[10px] tracking-[0.18em] text-[#c7d5ff] uppercase">
                              Stats
                            </p>
                            <ShareRadarChart
                              size={radarMain}
                              labels={['Health', 'Shield', 'Armor', 'Energy', 'Speed']}
                              values={[
                                warframeCalc.health.modded,
                                warframeCalc.shield.modded,
                                warframeCalc.armor.modded,
                                warframeCalc.energy.modded,
                                warframeCalc.sprintSpeed.modded,
                              ]}
                            />
                          </div>
                          <div className="glass-panel flex flex-col items-center rounded-2xl p-2.5">
                            <p className="mb-0.5 w-full text-left text-[10px] tracking-[0.18em] text-[#c7d5ff] uppercase">
                              Abilities
                            </p>
                            <ShareRadarChart
                              size={radarSecondary}
                              labels={['Str', 'Dur', 'Eff', 'Range']}
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
                        </>
                      ) : null}
                      {!isWarframe && weaponCalc && weaponRadarValues ? (
                        <>
                          <div className="glass-panel flex flex-col items-center rounded-2xl p-2.5">
                            <p className="mb-0.5 w-full text-left text-[10px] tracking-[0.18em] text-[#c7d5ff] uppercase">
                              Stats
                            </p>
                            <ShareRadarChart
                              size={radarMain}
                              labels={['Crit', 'Mult', 'Status', 'Rate', 'Multi', 'Reload']}
                              values={weaponRadarValues}
                            />
                          </div>
                          <div className="glass-panel min-h-0 flex-1 rounded-2xl p-2.5">
                            <ShareDamageBreakdownBars weapon={equipment as Weapon} slots={slots} />
                          </div>
                        </>
                      ) : null}
                      {!isWarframe && !weaponCalc ? (
                        <div className="glass-panel rounded-2xl p-3 text-[11px] text-[#b6c5ed]">
                          Stats unavailable.
                        </div>
                      ) : null}
                      <div className="glass-panel rounded-2xl p-2.5">
                        <p className="mb-1.5 text-[9px] tracking-[0.16em] text-[#c7d5ff] uppercase">
                          Build
                        </p>
                        <div className="space-y-1 text-[10px]">
                          <div className="flex justify-between gap-2">
                            <span className="text-[#9fb0d8]">Reactor</span>
                            <span className="font-medium">{orokinReactor ? 'Yes' : 'No'}</span>
                          </div>
                          <div className="flex justify-between gap-2">
                            <span className="text-[#9fb0d8]">Arcanes</span>
                            <span className="font-medium">{filledArcanes.length}</span>
                          </div>
                          {isWarframe ? (
                            <div className="flex justify-between gap-2">
                              <span className="text-[#9fb0d8]">Shards</span>
                              <span className="font-medium">
                                {shardSummary.filled}
                                {shardSummary.tau > 0 ? ` (${shardSummary.tau} τ)` : ''}
                              </span>
                            </div>
                          ) : null}
                          {formaCost && formaCost.total > 0 ? (
                            <div className="flex justify-between gap-2">
                              <span className="text-[#9fb0d8]">Forma</span>
                              <span className="font-medium">{formaCost.total}</span>
                            </div>
                          ) : null}
                        </div>
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="mt-3 flex min-h-0 flex-1 flex-col gap-2.5">
                    <div className="glass-panel min-h-0 flex-1 rounded-2xl p-3">
                      <p className="mb-2 text-[10px] tracking-[0.18em] text-[#c7d5ff] uppercase">
                        Mods ({equippedSlots.length})
                      </p>
                      <ModShareGrid slots={equippedSlots} modScale={modScale} />
                    </div>
                    {isWarframe && warframeCalc ? (
                      <div className="grid grid-cols-2 gap-2">
                        <div className="glass-panel flex flex-col items-center rounded-xl p-2">
                          <p className="mb-0.5 w-full text-left text-[9px] uppercase tracking-wide text-[#c7d5ff]">
                            Stats
                          </p>
                          <ShareRadarChart
                            size={radarMain}
                            labels={['HP', 'Shd', 'Arm', 'En', 'Spd']}
                            values={[
                              warframeCalc.health.modded,
                              warframeCalc.shield.modded,
                              warframeCalc.armor.modded,
                              warframeCalc.energy.modded,
                              warframeCalc.sprintSpeed.modded,
                            ]}
                          />
                        </div>
                        <div className="glass-panel flex flex-col items-center rounded-xl p-2">
                          <p className="mb-0.5 w-full text-left text-[9px] uppercase tracking-wide text-[#c7d5ff]">
                            Abilities
                          </p>
                          <ShareRadarChart
                            size={radarSecondary}
                            labels={['Str', 'Dur', 'Eff', 'Rg']}
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
                    ) : null}
                    {!isWarframe && weaponCalc && weaponRadarValues ? (
                      <>
                        <div className="glass-panel flex flex-col items-center rounded-xl p-2">
                          <p className="mb-0.5 w-full text-left text-[9px] uppercase tracking-wide text-[#c7d5ff]">
                            Stats
                          </p>
                          <ShareRadarChart
                            size={radarMain + 8}
                            labels={['Crit', 'Mult', 'Stat', 'Rate', 'Multi', 'Rld']}
                            values={weaponRadarValues}
                          />
                        </div>
                        <div className="glass-panel rounded-xl p-2.5">
                          <ShareDamageBreakdownBars weapon={equipment as Weapon} slots={slots} />
                        </div>
                      </>
                    ) : null}
                    {isWarframe ? (
                      <div className="grid grid-cols-2 gap-2">
                        <div className="glass-panel rounded-xl p-2">
                          <p className="mb-1 text-[9px] uppercase tracking-wide text-[#c7d5ff]">
                            Arcane
                          </p>
                          {filledArcanes.length === 0 ? (
                            <span className="text-[9px] text-[#7e8fb8]">None</span>
                          ) : (
                            <div className="flex flex-col gap-1.5">
                              {filledArcanes.map((slot, i) => {
                                const a = slot.arcane!;
                                const maxRank = getMaxRank(a);
                                const art = a.image_path ? `/images${a.image_path}` : '';
                                return (
                                  <ArcaneCardPreview
                                    key={`${a.unique_name}-${i}`}
                                    layout={{ ...DEFAULT_ARCANE_LAYOUT, scale: arcaneScale * 0.82 }}
                                    rarity={normalizeArcaneRarity(a.rarity)}
                                    arcaneArt={art}
                                    arcaneName={a.name}
                                    rank={slot.rank}
                                    maxRank={maxRank}
                                  />
                                );
                              })}
                            </div>
                          )}
                        </div>
                        <div className="glass-panel rounded-xl p-2">
                          <p className="mb-1 text-[9px] uppercase tracking-wide text-[#c7d5ff]">
                            Shards
                          </p>
                          <ShareShardColumn slots={shardSlots} shards={shardTypes} />
                        </div>
                      </div>
                    ) : filledArcanes.length > 0 ? (
                      <div className="glass-panel rounded-xl p-2">
                        <p className="mb-1 text-[9px] uppercase tracking-wide text-[#c7d5ff]">
                          Arcane
                        </p>
                        <div className="flex flex-wrap gap-2">
                          {filledArcanes.map((slot, i) => {
                            const a = slot.arcane!;
                            const maxRank = getMaxRank(a);
                            const art = a.image_path ? `/images${a.image_path}` : '';
                            return (
                              <ArcaneCardPreview
                                key={`${a.unique_name}-${i}`}
                                layout={{ ...DEFAULT_ARCANE_LAYOUT, scale: arcaneScale * 0.9 }}
                                rarity={normalizeArcaneRarity(a.rarity)}
                                arcaneArt={art}
                                arcaneName={a.name}
                                rank={slot.rank}
                                maxRank={maxRank}
                              />
                            );
                          })}
                        </div>
                      </div>
                    ) : null}
                    {isWarframe ? (
                      <div className="glass-panel rounded-xl p-2">
                        <p className="mb-1 text-[9px] uppercase tracking-wide text-[#c7d5ff]">
                          Skills
                        </p>
                        <ShareSkillsPanel
                          ownAbilities={shareAbilities.ownAbilities}
                          dbAbilities={shareAbilities.dbAbilities}
                          selectedReplacement={shareAbilities.selectedReplacement}
                          helminthConfig={helminthConfig}
                          iconPx={skillIconPx}
                        />
                      </div>
                    ) : null}
                    <div className="glass-panel rounded-xl p-2">
                      <p className="mb-1 text-[9px] uppercase tracking-wide text-[#c7d5ff]">Build</p>
                      <div className="space-y-0.5 text-[9px]">
                        <div className="flex justify-between">
                          <span className="text-[#9fb0d8]">Reactor</span>
                          <span>{orokinReactor ? 'Yes' : 'No'}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-[#9fb0d8]">Arcanes</span>
                          <span>{filledArcanes.length}</span>
                        </div>
                        {isWarframe ? (
                          <div className="flex justify-between">
                            <span className="text-[#9fb0d8]">Shards</span>
                            <span>{shardSummary.filled}</span>
                          </div>
                        ) : null}
                      </div>
                    </div>
                  </div>
                )}
                <div className="mt-auto flex shrink-0 items-center justify-between border-t border-white/10 pt-3 text-[11px] text-[#c4d2f8]">
                  <span>darkavianlabs.com/parametric</span>
                  <span>Generated in Parametric</span>
                </div>
              </div>
            </div>
          </div>
        </section>
      </div>
    </Modal>
  );
}
