import type { Weapon, ModSlot } from '../../types/warframe';
import { calculateBuildDamage, formatDamage } from '../../utils/damage';
import { getElementColor } from '../../utils/elements';

const ELEMENT_ICON_MAP: Record<string, string> = {
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

interface ElementOutputProps {
  weapon: Weapon;
  slots: ModSlot[];
}

export function ElementOutput({ weapon, slots }: ElementOutputProps) {
  const { totalDamage, damageBreakdown } = calculateBuildDamage(weapon, slots);

  if (damageBreakdown.length === 0) {
    return null;
  }

  const maxValue = Math.max(...damageBreakdown.map((e) => e.value));

  return (
    <div className="glass-panel p-4">
      <div className="mb-3 flex items-center justify-between">
        <h3 className="text-muted text-sm font-semibold tracking-wider uppercase">Damage Output</h3>
        <span className="text-foreground text-sm font-bold">{formatDamage(totalDamage)}</span>
      </div>

      <div className="space-y-1">
        {damageBreakdown.map((entry) => {
          const color = getElementColor(entry.type);
          const pct = totalDamage > 0 ? (entry.value / totalDamage) * 100 : 0;
          const barWidth = maxValue > 0 ? (entry.value / maxValue) * 100 : 0;
          const iconFile = ELEMENT_ICON_MAP[entry.type];

          return (
            <div
              key={entry.type}
              className="relative flex items-center gap-2 overflow-hidden rounded py-1 pr-2 pl-1"
            >
              <div
                className="absolute inset-y-0 left-0 rounded transition-[width,opacity] duration-300"
                style={{
                  width: `${barWidth}%`,
                  backgroundColor: color,
                  opacity: 0.12,
                }}
              />

              <div className="relative z-10 flex h-5 w-5 shrink-0 items-center justify-center">
                {iconFile ? (
                  <img
                    src={`/icons/elements/${iconFile}.png`}
                    alt={entry.type}
                    className="h-4 w-4 object-contain"
                    draggable={false}
                  />
                ) : (
                  <div className="h-3 w-3 rounded-full" style={{ backgroundColor: color }} />
                )}
              </div>

              <span className="relative z-10 min-w-[70px] text-xs font-medium" style={{ color }}>
                {entry.type}
              </span>

              <div className="relative z-10 flex-1" />

              <span className="text-muted relative z-10 text-[10px] tabular-nums">
                {pct.toFixed(1)}%
              </span>

              <span className="text-foreground relative z-10 min-w-[48px] text-right text-xs font-semibold tabular-nums">
                {formatDamage(entry.value)}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
