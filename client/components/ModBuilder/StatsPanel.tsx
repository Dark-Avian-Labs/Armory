import { useEffect, useMemo, useState, useRef, type ReactNode } from 'react';
import { createPortal } from 'react-dom';

import type { Warframe, Weapon, EquipmentType, ModSlot, ValenceBonus } from '../../types/warframe';
import { extractArchonShardBonuses } from '../../utils/archonShardBonuses';
import { formatPercent } from '../../utils/damage';
import { calculateWeaponDps, type WeaponCalcResult } from '../../utils/damageCalc';
import { getDispositionPips, getEffectiveRivenDisposition } from '../../utils/riven';
import { calculateWarframeStats, type WarframeBonusEffects } from '../../utils/warframeCalc';
import type { ShardSlotConfig, ShardType } from './ArchonShardSlots';

interface StatsPanelProps {
  equipment: Warframe | Weapon;
  type: EquipmentType;
  abilities?: ReactNode;
  slots?: ModSlot[];
  shardSlots?: ShardSlotConfig[];
  shardTypes?: ShardType[];
  valenceBonus?: ValenceBonus | null;
}

export function StatsPanel({
  equipment,
  type,
  abilities,
  slots,
  shardSlots,
  shardTypes,
  valenceBonus,
}: StatsPanelProps) {
  return (
    <div className="glass-panel overflow-visible p-4">
      <h3 className="text-muted mb-3 text-sm font-semibold tracking-wider uppercase">Stats</h3>

      {type === 'warframe' ? (
        <WarframeStats
          warframe={equipment as Warframe}
          abilities={abilities}
          slots={slots}
          shardSlots={shardSlots}
          shardTypes={shardTypes}
        />
      ) : (
        <WeaponStats weapon={equipment as Weapon} slots={slots} valenceBonus={valenceBonus} />
      )}
    </div>
  );
}

function WarframeStats({
  warframe,
  abilities,
  slots,
  shardSlots,
  shardTypes,
}: {
  warframe: Warframe;
  abilities?: ReactNode;
  slots?: ModSlot[];
  shardSlots?: ShardSlotConfig[];
  shardTypes?: ShardType[];
}) {
  const shardBonuses = useMemo<WarframeBonusEffects>(() => {
    return extractArchonShardBonuses(shardSlots, shardTypes);
  }, [shardSlots, shardTypes]);

  const calc = useMemo(() => {
    if (!slots) return null;
    return calculateWarframeStats(warframe, slots, shardBonuses);
  }, [warframe, slots, shardBonuses]);

  const baseStats: Array<{
    label: string;
    baseDisplay: string | undefined;
    moddedDisplay?: string;
    color?: StatColor;
  }> = [
    (() => {
      const base = warframe.health;
      const m = calc?.health.modded;
      return {
        label: 'Health',
        baseDisplay: base?.toFixed(0),
        moddedDisplay: m != null ? m.toFixed(0) : undefined,
        color: base != null && m != null ? statColor(base, m) : undefined,
      };
    })(),
    (() => {
      const base = warframe.shield;
      const m = calc?.shield.modded;
      return {
        label: 'Shield',
        baseDisplay: base?.toFixed(0),
        moddedDisplay: m != null ? m.toFixed(0) : undefined,
        color: base != null && m != null ? statColor(base, m) : undefined,
      };
    })(),
    (() => {
      const base = warframe.armor;
      const m = calc?.armor.modded;
      return {
        label: 'Armor',
        baseDisplay: base?.toFixed(0),
        moddedDisplay: m != null ? m.toFixed(0) : undefined,
        color: base != null && m != null ? statColor(base, m) : undefined,
      };
    })(),
    (() => {
      const base = warframe.power;
      const m = calc?.energy.modded;
      return {
        label: 'Energy',
        baseDisplay: base?.toFixed(0),
        moddedDisplay: m != null ? m.toFixed(0) : undefined,
        color: base != null && m != null ? statColor(base, m) : undefined,
      };
    })(),
    (() => {
      const base = warframe.sprint_speed;
      const m = calc?.sprintSpeed.modded;
      return {
        label: 'Sprint Speed',
        baseDisplay: base?.toFixed(2),
        moddedDisplay: m != null ? m.toFixed(2) : undefined,
        color: base != null && m != null ? statColor(base, m) : undefined,
      };
    })(),
  ];

  const abilityStats: Array<{
    label: string;
    baseDisplay: string;
    moddedDisplay?: string;
    color?: StatColor;
  }> = calc
    ? [
        {
          label: 'Strength',
          baseDisplay: '100%',
          moddedDisplay: `${calc.abilityStrength.modded.toFixed(0)}%`,
          color: statColor(100, calc.abilityStrength.modded),
        },
        {
          label: 'Duration',
          baseDisplay: '100%',
          moddedDisplay: `${calc.abilityDuration.modded.toFixed(0)}%`,
          color: statColor(100, calc.abilityDuration.modded),
        },
        {
          label: 'Efficiency',
          baseDisplay: '100%',
          moddedDisplay: `${calc.abilityEfficiency.modded.toFixed(0)}%`,
          color: statColor(100, calc.abilityEfficiency.modded),
        },
        {
          label: 'Range',
          baseDisplay: '100%',
          moddedDisplay: `${calc.abilityRange.modded.toFixed(0)}%`,
          color: statColor(100, calc.abilityRange.modded),
        },
      ]
    : [];

  const passiveText = useMemo(() => {
    const wiki = warframe.passive_description_wiki?.trim() ?? '';
    const base = warframe.passive_description?.trim() ?? '';
    if (wiki && base) {
      const wikiWordCount = wiki.split(/\s+/).filter(Boolean).length;
      const baseWordCount = base.split(/\s+/).filter(Boolean).length;
      const looksTruncated = wikiWordCount <= 3 || wiki.length < Math.max(20, base.length * 0.6);
      if (looksTruncated && baseWordCount > wikiWordCount) {
        return base;
      }
      return wiki;
    }
    return wiki || base;
  }, [warframe.passive_description, warframe.passive_description_wiki]);

  return (
    <div className="space-y-2">
      {warframe.image_path && (
        <img
          src={`/images${warframe.image_path}`}
          alt={warframe.name}
          className="mx-auto mb-3 h-24 w-24 rounded-lg object-cover"
          onError={(e) => {
            (e.target as HTMLImageElement).style.display = 'none';
          }}
        />
      )}
      <div className="text-foreground text-center text-sm font-semibold">{warframe.name}</div>
      <div className="text-muted text-center text-xs">MR {warframe.mastery_req}</div>

      <div className="mt-3 space-y-1.5">
        {baseStats.map(
          (stat) =>
            stat.baseDisplay != null && (
              <div key={stat.label} className="flex justify-between text-xs">
                <span className="text-muted">{stat.label}</span>
                <span
                  className={`font-medium ${stat.moddedDisplay != null && stat.color !== 'text-foreground' ? stat.color : 'text-foreground'}`}
                >
                  {stat.moddedDisplay ?? stat.baseDisplay}
                </span>
              </div>
            ),
        )}
      </div>

      {abilityStats.length > 0 && (
        <div className="border-glass-divider mt-3 border-t pt-2">
          <div className="text-muted text-[10px] font-semibold uppercase">Ability Stats</div>
          <div className="mt-1 space-y-1.5">
            {abilityStats.map((stat) => (
              <div key={stat.label} className="flex justify-between text-xs">
                <span className="text-muted">{stat.label}</span>
                <span
                  className={`font-medium ${stat.moddedDisplay != null && stat.color !== 'text-foreground' ? stat.color : 'text-foreground'}`}
                >
                  {stat.moddedDisplay ?? stat.baseDisplay}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {passiveText && (
        <div className="border-glass-divider mt-3 border-t pt-2">
          <div className="text-muted text-[10px] font-semibold uppercase">Passive</div>
          <div className="text-muted mt-1 text-xs leading-relaxed">
            <PassiveText text={passiveText} />
          </div>
        </div>
      )}

      {abilities && <div className="border-glass-divider mt-3 border-t pt-2">{abilities}</div>}
    </div>
  );
}

const DT_ICON_MAP: Record<string, string> = {
  DT_IMPACT: '01_impact',
  DT_IMPACT_COLOR: '01_impact',
  DT_PUNCTURE: '02_puncture',
  DT_PUNCTURE_COLOR: '02_puncture',
  DT_SLASH: '03_slash',
  DT_SLASH_COLOR: '03_slash',
  DT_FIRE: '04_heat',
  DT_FIRE_COLOR: '04_heat',
  DT_FREEZE: '05_cold',
  DT_FREEZE_COLOR: '05_cold',
  DT_ELECTRICITY: '06_electricity',
  DT_ELECTRICITY_COLOR: '06_electricity',
  DT_TOXIN: '07_toxin',
  DT_TOXIN_COLOR: '07_toxin',
  DT_BLAST: '08_blast',
  DT_BLAST_COLOR: '08_blast',
  DT_RADIATION: '09_radiation',
  DT_RADIATION_COLOR: '09_radiation',
  DT_GAS: '10_gas',
  DT_GAS_COLOR: '10_gas',
  DT_MAGNETIC: '11_magnetic',
  DT_MAGNETIC_COLOR: '11_magnetic',
  DT_VIRAL: '12_viral',
  DT_VIRAL_COLOR: '12_viral',
  DT_CORROSIVE: '13_corrosive',
  DT_CORROSIVE_COLOR: '13_corrosive',
  DT_VOID: '14_void',
  DT_VOID_COLOR: '14_void',
  DT_TAU: '15_tau',
  DT_TAU_COLOR: '15_tau',
  DT_TRUE: '20_true',
  DT_TRUE_COLOR: '20_true',
};

function PassiveText({ text }: { text: string }) {
  const parts = text.split(/(<[^>]+>|\|[A-Z_]+\|)/g);

  return (
    <span className="inline">
      {parts.map((part, i) => {
        const tagMatch = part.match(/^<([^>]+)>$/);
        if (tagMatch) {
          const tag = tagMatch[1];
          const iconFile = DT_ICON_MAP[tag];
          if (iconFile) {
            return (
              <img
                key={i}
                src={`/icons/elements/${iconFile}.png`}
                alt={tag}
                className="mb-px inline-block"
                style={{ height: 12, width: 12 }}
                draggable={false}
              />
            );
          }
          return null;
        }

        const varMatch = part.match(/^\|([A-Z_]+)\|$/);
        if (varMatch) {
          return (
            <span key={i} className="text-accent font-semibold" title={varMatch[1]}>
              ?
            </span>
          );
        }

        return <span key={i}>{part}</span>;
      })}
    </span>
  );
}

interface FireBehavior {
  name?: string;
  projectileSpeed?: number;
  [key: string]: unknown;
}

function readProjectileSpeed(fb: Record<string, unknown>): number | undefined {
  const candidates = [fb.projectileSpeed, fb.ProjectileSpeed, fb.projectile_speed];
  for (const c of candidates) {
    if (typeof c === 'number' && Number.isFinite(c)) {
      return c;
    }
  }
  return undefined;
}

function readFireBehaviorName(fb: Record<string, unknown>, index: number): string {
  const n = fb.name ?? fb.Name ?? fb.modeName ?? fb.ModeName;
  if (typeof n === 'string' && n.trim()) {
    return n.trim();
  }
  return `Mode ${index + 1}`;
}

function normalizeFireBehaviorsJson(raw: string | undefined): FireBehavior[] {
  if (!raw) return [];
  try {
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.map((entry, index) => {
      const o =
        entry && typeof entry === 'object' && !Array.isArray(entry)
          ? (entry as Record<string, unknown>)
          : {};
      const projectileSpeed = readProjectileSpeed(o);
      const name = readFireBehaviorName(o, index);
      return { ...o, name, projectileSpeed };
    });
  } catch {
    return [];
  }
}

type StatColor = 'text-foreground' | 'text-green-400' | 'text-red-400';

function statColor(base: number, modded: number, lowerIsBetter = false): StatColor {
  const diff = modded - base;
  if (Math.abs(diff) < 0.0001) return 'text-foreground';
  const positive = lowerIsBetter ? diff < 0 : diff > 0;
  return positive ? 'text-green-400' : 'text-red-400';
}

function formatBigNumber(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(2)}M`;
  if (n >= 10_000) return `${(n / 1000).toFixed(1)}k`;
  if (n >= 1000) return `${(n / 1000).toFixed(2)}k`;
  if (n >= 100) return n.toFixed(1);
  return n.toFixed(2);
}

function WeaponStats({
  weapon,
  slots,
  valenceBonus,
}: {
  weapon: Weapon;
  slots?: ModSlot[];
  valenceBonus?: ValenceBonus | null;
}) {
  const calc: WeaponCalcResult | null = useMemo(() => {
    if (!slots) return null;
    return calculateWeaponDps(weapon, slots, valenceBonus);
  }, [weapon, slots, valenceBonus]);

  const fireBehaviors = useMemo(
    () => normalizeFireBehaviorsJson(weapon.fire_behaviors),
    [weapon.fire_behaviors],
  );

  const isMelee = weapon.range != null;
  const rivenDisposition = getEffectiveRivenDisposition(weapon);
  const dispositionPips = rivenDisposition != null ? getDispositionPips(rivenDisposition) : null;

  const moddedStats: Array<{
    label: string;
    baseDisplay: string | number | undefined;
    moddedDisplay?: string;
    color?: StatColor;
  }> = [
    (() => {
      const base = weapon.total_damage;
      const m = calc?.modded.totalDamage;
      return {
        label: 'Total Damage',
        baseDisplay: base?.toFixed(1),
        moddedDisplay: m != null ? m.toFixed(1) : undefined,
        color: base != null && m != null ? statColor(base, m) : undefined,
      };
    })(),
    (() => {
      const base = weapon.critical_chance;
      const m = calc?.modded.critChance;
      return {
        label: 'Critical Chance',
        baseDisplay: base ? formatPercent(base) : undefined,
        moddedDisplay: m != null ? formatPercent(m) : undefined,
        color: base != null && m != null ? statColor(base, m) : undefined,
      };
    })(),
    (() => {
      const base = weapon.critical_multiplier;
      const m = calc?.modded.critMultiplier;
      return {
        label: 'Critical Multiplier',
        baseDisplay: base ? `${base.toFixed(1)}x` : undefined,
        moddedDisplay: m != null ? `${m.toFixed(1)}x` : undefined,
        color: base != null && m != null ? statColor(base, m) : undefined,
      };
    })(),
    (() => {
      const base = weapon.proc_chance;
      const m = calc?.modded.statusChance;
      return {
        label: 'Status Chance',
        baseDisplay: base ? formatPercent(base) : undefined,
        moddedDisplay: m != null ? formatPercent(m) : undefined,
        color: base != null && m != null ? statColor(base, m) : undefined,
      };
    })(),
    (() => {
      const base = weapon.fire_rate;
      const m = calc?.modded.fireRate;
      return {
        label: isMelee ? 'Attack Speed' : 'Fire Rate',
        baseDisplay: base?.toFixed(2),
        moddedDisplay: m != null ? m.toFixed(2) : undefined,
        color: base != null && m != null ? statColor(base, m) : undefined,
      };
    })(),
    ...(!isMelee
      ? [
          (() => {
            const base = weapon.multishot ?? 1;
            const m = calc?.modded.multishot;
            return {
              label: 'Multishot',
              baseDisplay: base.toFixed(2),
              moddedDisplay: m != null ? m.toFixed(2) : undefined,
              color: m != null ? statColor(base, m) : undefined,
            };
          })(),
        ]
      : []),
    ...(!isMelee
      ? [
          (() => {
            const base = weapon.magazine_size;
            const m = calc?.modded.magazineSize;
            return {
              label: 'Magazine',
              baseDisplay: base,
              moddedDisplay: m != null ? String(m) : undefined,
              color: base != null && m != null ? statColor(base, m) : undefined,
            };
          })(),
          (() => {
            const base = weapon.reload_time;
            const m = calc?.modded.reloadTime;
            return {
              label: 'Reload',
              baseDisplay: base ? `${base.toFixed(1)}s` : undefined,
              moddedDisplay: m != null ? `${m.toFixed(2)}s` : undefined,
              color: base != null && m != null ? statColor(base, m, true) : undefined,
            };
          })(),
        ]
      : []),
  ];

  const staticStats: Array<{
    label: string;
    value: string | number | undefined;
  }> = [
    { label: 'Accuracy', value: weapon.accuracy?.toFixed(1) },
    { label: 'Noise', value: weapon.noise },
    { label: 'Trigger', value: weapon.trigger_type },
  ];

  if (isMelee) {
    staticStats.push(
      { label: 'Range', value: weapon.range?.toFixed(1) },
      { label: 'Follow Through', value: weapon.follow_through?.toFixed(2) },
      { label: 'Heavy Attack', value: weapon.heavy_attack_damage?.toFixed(1) },
    );
  }

  return (
    <div className="space-y-2">
      {weapon.image_path && (
        <img
          src={`/images${weapon.image_path}`}
          alt={weapon.name}
          className="mx-auto mb-3 h-24 w-24 rounded-lg object-cover"
          onError={(e) => {
            (e.target as HTMLImageElement).style.display = 'none';
          }}
        />
      )}
      <div className="text-foreground text-center text-sm font-semibold">{weapon.name}</div>
      <div className="text-muted text-center text-xs">
        MR {weapon.mastery_req}
        {weapon.product_category && ` · ${weapon.product_category}`}
      </div>

      <div className="mt-3 space-y-1.5">
        {moddedStats.map(
          (stat) =>
            stat.baseDisplay != null && (
              <div key={stat.label} className="flex justify-between text-xs">
                <span className="text-muted">{stat.label}</span>
                <span
                  className={`font-medium ${stat.moddedDisplay != null && stat.color !== 'text-foreground' ? stat.color : 'text-foreground'}`}
                >
                  {stat.moddedDisplay ?? stat.baseDisplay}
                </span>
              </div>
            ),
        )}
      </div>

      <div className="space-y-1.5">
        {rivenDisposition != null && dispositionPips != null && (
          <div className="flex justify-between text-xs">
            <span className="text-muted">Riven Dispo</span>
            <span className="text-foreground flex items-center gap-1 font-medium">
              <span
                style={{
                  fontFamily: 'Roboto, sans-serif',
                  fontSize: '1.5em',
                  lineHeight: 1,
                }}
              >
                {'●'.repeat(dispositionPips)}
                {'○'.repeat(5 - dispositionPips)}
              </span>
              <span>{rivenDisposition.toFixed(3)}</span>
            </span>
          </div>
        )}
        {staticStats.map(
          (stat) =>
            stat.value != null && (
              <div key={stat.label} className="flex justify-between text-xs">
                <span className="text-muted">{stat.label}</span>
                <span className="text-foreground font-medium">{stat.value}</span>
              </div>
            ),
        )}
      </div>

      {calc && (
        <div className="border-glass-divider mt-3 border-t pt-2">
          <div className="flex items-center justify-between">
            <span className="text-muted text-[10px] font-semibold uppercase">DPS</span>
            <DpsInfoTip isMelee={isMelee} />
          </div>
          <div className="mt-1 space-y-1">
            <div className="flex justify-between text-xs">
              <span className="text-muted">Avg Hit</span>
              <span className="text-foreground font-semibold">
                {formatBigNumber(calc.averageHit)}
              </span>
            </div>
            <div className="flex justify-between text-xs">
              <span className="text-muted">Burst DPS</span>
              <span className="text-accent font-semibold">{formatBigNumber(calc.burstDps)}</span>
            </div>
            {!isMelee && (
              <div className="flex justify-between text-xs">
                <span className="text-muted">Sustained DPS</span>
                <span className="text-accent font-semibold">
                  {formatBigNumber(calc.sustainedDps)}
                </span>
              </div>
            )}
            <div className="flex justify-between text-xs">
              <span className="text-muted">Status/sec</span>
              <span className="text-foreground font-medium">{calc.statusPerSec.toFixed(2)}</span>
            </div>
          </div>
        </div>
      )}

      {fireBehaviors.some((fb) => fb.projectileSpeed != null) && (
        <div className="border-glass-divider mt-3 border-t pt-2">
          <div className="text-muted text-[10px] font-semibold uppercase">Projectile Speed</div>
          <div className="mt-1 space-y-0.5">
            {fireBehaviors.map((fb, i) =>
              fb.projectileSpeed != null ? (
                <div key={i} className="flex justify-between text-xs">
                  <span className="text-muted">{fb.name}</span>
                  <span className="text-foreground font-medium">{fb.projectileSpeed} m/s</span>
                </div>
              ) : null,
            )}
          </div>
        </div>
      )}
    </div>
  );
}

function DpsInfoTip({ isMelee }: { isMelee: boolean }) {
  const [open, setOpen] = useState(false);
  const btnRef = useRef<HTMLButtonElement>(null);
  const tooltipRef = useRef<HTMLDivElement>(null);
  const [pos, setPos] = useState<{ top: number; left: number } | null>(null);

  useEffect(() => {
    if (!open) return undefined;

    const handleOutside = (event: MouseEvent | TouchEvent) => {
      const target = event.target as Node | null;
      if (!target) return;
      if (btnRef.current?.contains(target)) return;
      if (tooltipRef.current?.contains(target)) return;
      setOpen(false);
    };

    document.addEventListener('mousedown', handleOutside);
    document.addEventListener('touchstart', handleOutside);
    return () => {
      document.removeEventListener('mousedown', handleOutside);
      document.removeEventListener('touchstart', handleOutside);
    };
  }, [open]);

  const toggle = () => {
    setOpen((prev) => {
      if (!prev && btnRef.current) {
        const r = btnRef.current.getBoundingClientRect();
        setPos({ top: r.bottom + 4, left: r.right });
      }
      return !prev;
    });
  };

  return (
    <>
      <button
        ref={btnRef}
        className="text-muted/60 hover:bg-glass-hover hover:text-muted flex h-4 w-4 items-center justify-center rounded-full text-[9px] leading-none font-bold transition-colors"
        onClick={toggle}
        title="What do these numbers mean?"
      >
        i
      </button>
      {open &&
        pos &&
        createPortal(
          <div
            ref={tooltipRef}
            className="border-glass-border text-muted fixed z-[9999] w-52 rounded-lg border bg-black/40 p-2.5 text-[10px] leading-snug shadow-2xl backdrop-blur-xl"
            style={{
              top: pos.top,
              left: pos.left,
              transform: 'translateX(-100%)',
            }}
          >
            <p>
              <strong className="text-foreground">Avg Hit</strong>: damage per single hit, averaged
              over crits.
            </p>
            <p className="mt-1">
              <strong className="text-foreground">Burst DPS</strong>: max damage/sec while firing
              (ignores reload).
            </p>
            {!isMelee && (
              <p className="mt-1">
                <strong className="text-foreground">Sustained DPS</strong>: damage/sec including
                reload downtime.
              </p>
            )}
            <p className="mt-1">
              <strong className="text-foreground">Status/sec</strong>: status procs applied per
              second.
            </p>
          </div>,
          document.body,
        )}
    </>
  );
}
