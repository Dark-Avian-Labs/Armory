import { useMemo, useState, useRef, type ReactNode } from 'react';
import { createPortal } from 'react-dom';

import type {
  Warframe,
  Weapon,
  EquipmentType,
  ModSlot,
} from '../../types/warframe';
import { formatPercent } from '../../utils/damage';
import {
  calculateWeaponDps,
  type WeaponCalcResult,
} from '../../utils/damageCalc';
import { calculateWarframeStats } from '../../utils/warframeCalc';

interface StatsPanelProps {
  equipment: Warframe | Weapon;
  type: EquipmentType;
  abilities?: ReactNode;
  slots?: ModSlot[];
}

export function StatsPanel({
  equipment,
  type,
  abilities,
  slots,
}: StatsPanelProps) {
  return (
    <div className="glass-panel overflow-visible p-4">
      <h3 className="mb-3 text-sm font-semibold uppercase tracking-wider text-muted">
        Stats
      </h3>

      {type === 'warframe' ? (
        <WarframeStats
          warframe={equipment as Warframe}
          abilities={abilities}
          slots={slots}
        />
      ) : (
        <WeaponStats weapon={equipment as Weapon} slots={slots} />
      )}
    </div>
  );
}

function WarframeStats({
  warframe,
  abilities,
  slots,
}: {
  warframe: Warframe;
  abilities?: ReactNode;
  slots?: ModSlot[];
}) {
  const calc = useMemo(() => {
    if (!slots) return null;
    return calculateWarframeStats(warframe, slots);
  }, [warframe, slots]);

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
      const looksTruncated =
        wikiWordCount <= 3 || wiki.length < Math.max(20, base.length * 0.6);
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
      <div className="text-center text-sm font-semibold text-foreground">
        {warframe.name}
      </div>
      <div className="text-center text-xs text-muted">
        MR {warframe.mastery_req}
      </div>

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
        <div className="mt-3 border-t border-glass-divider pt-2">
          <div className="text-[10px] font-semibold uppercase text-muted">
            Ability Stats
          </div>
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
        <div className="mt-3 border-t border-glass-divider pt-2">
          <div className="text-[10px] font-semibold uppercase text-muted">
            Passive
          </div>
          <div className="mt-1 text-xs leading-relaxed text-muted">
            <PassiveText text={passiveText} />
          </div>
        </div>
      )}

      {abilities && (
        <div className="mt-3 border-t border-glass-divider pt-2">
          {abilities}
        </div>
      )}
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
            <span
              key={i}
              className="font-semibold text-accent"
              title={varMatch[1]}
            >
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

type StatColor = 'text-foreground' | 'text-green-400' | 'text-red-400';

function statColor(
  base: number,
  modded: number,
  lowerIsBetter = false,
): StatColor {
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

function WeaponStats({ weapon, slots }: { weapon: Weapon; slots?: ModSlot[] }) {
  const calc: WeaponCalcResult | null = useMemo(() => {
    if (!slots) return null;
    return calculateWeaponDps(weapon, slots);
  }, [weapon, slots]);

  const fireBehaviors: FireBehavior[] = (() => {
    try {
      return weapon.fire_behaviors ? JSON.parse(weapon.fire_behaviors) : [];
    } catch {
      return [];
    }
  })();

  const isMelee = weapon.range != null;
  const rivenDisposition = weapon.riven_disposition ?? weapon.omega_attenuation;
  const dispositionPips =
    rivenDisposition != null ? getDispositionPips(rivenDisposition) : null;

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
              color:
                base != null && m != null
                  ? statColor(base, m, true)
                  : undefined,
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
      <div className="text-center text-sm font-semibold text-foreground">
        {weapon.name}
      </div>
      <div className="text-center text-xs text-muted">
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
            <span className="flex items-center gap-1 font-medium text-foreground">
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
                <span className="font-medium text-foreground">
                  {stat.value}
                </span>
              </div>
            ),
        )}
      </div>

      {calc && (
        <div className="mt-3 border-t border-glass-divider pt-2">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-semibold uppercase text-muted">
              DPS
            </span>
            <DpsInfoTip isMelee={isMelee} />
          </div>
          <div className="mt-1 space-y-1">
            <div className="flex justify-between text-xs">
              <span className="text-muted">Avg Hit</span>
              <span className="font-semibold text-foreground">
                {formatBigNumber(calc.averageHit)}
              </span>
            </div>
            <div className="flex justify-between text-xs">
              <span className="text-muted">Burst DPS</span>
              <span className="font-semibold text-accent">
                {formatBigNumber(calc.burstDps)}
              </span>
            </div>
            {!isMelee && (
              <div className="flex justify-between text-xs">
                <span className="text-muted">Sustained DPS</span>
                <span className="font-semibold text-accent">
                  {formatBigNumber(calc.sustainedDps)}
                </span>
              </div>
            )}
            <div className="flex justify-between text-xs">
              <span className="text-muted">Status/sec</span>
              <span className="font-medium text-foreground">
                {calc.statusPerSec.toFixed(2)}
              </span>
            </div>
          </div>
        </div>
      )}

      {fireBehaviors.length > 0 &&
        fireBehaviors.some((fb) => fb.projectileSpeed != null) && (
          <div className="mt-3 border-t border-glass-divider pt-2">
            <div className="text-[10px] font-semibold uppercase text-muted">
              Projectile Speed
            </div>
            <div className="mt-1 space-y-0.5">
              {fireBehaviors.map((fb, i) =>
                fb.projectileSpeed != null ? (
                  <div key={i} className="flex justify-between text-xs">
                    <span className="text-muted">
                      {fb.name || `Mode ${i + 1}`}
                    </span>
                    <span className="font-medium text-foreground">
                      {fb.projectileSpeed} m/s
                    </span>
                  </div>
                ) : null,
              )}
            </div>
          </div>
        )}
    </div>
  );
}

function getDispositionPips(value: number): number {
  if (value <= 0.7) return 1;
  if (value <= 0.9) return 2;
  if (value <= 1.1) return 3;
  if (value <= 1.3) return 4;
  return 5;
}

function DpsInfoTip({ isMelee }: { isMelee: boolean }) {
  const [open, setOpen] = useState(false);
  const btnRef = useRef<HTMLButtonElement>(null);
  const [pos, setPos] = useState<{ top: number; left: number } | null>(null);

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
        className="flex h-4 w-4 items-center justify-center rounded-full text-[9px] font-bold leading-none text-muted/60 transition-colors hover:bg-glass-hover hover:text-muted"
        onClick={toggle}
        onBlur={() => setOpen(false)}
        title="What do these numbers mean?"
      >
        i
      </button>
      {open &&
        pos &&
        createPortal(
          <div
            className="fixed z-[9999] w-52 rounded-lg border border-glass-border bg-black/40 p-2.5 text-[10px] leading-snug text-muted shadow-2xl backdrop-blur-xl"
            style={{
              top: pos.top,
              left: pos.left,
              transform: 'translateX(-100%)',
            }}
          >
            <p>
              <strong className="text-foreground">Avg Hit</strong>: damage per
              single hit, averaged over crits.
            </p>
            <p className="mt-1">
              <strong className="text-foreground">Burst DPS</strong>: max
              damage/sec while firing (ignores reload).
            </p>
            {!isMelee && (
              <p className="mt-1">
                <strong className="text-foreground">Sustained DPS</strong>:
                damage/sec including reload downtime.
              </p>
            )}
            <p className="mt-1">
              <strong className="text-foreground">Status/sec</strong>: status
              procs applied per second.
            </p>
          </div>,
          document.body,
        )}
    </>
  );
}
