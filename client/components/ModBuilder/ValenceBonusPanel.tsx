import type { ValenceBonus, ValenceDamageType } from '../../types/warframe';
import { VALENCE_DAMAGE_TYPES } from '../../types/warframe';
import { getElementColor } from '../../utils/elements';

const VALENCE_ICONS: Record<ValenceDamageType, string> = {
  Impact: '01_impact',
  Heat: '04_heat',
  Cold: '05_cold',
  Electricity: '06_electricity',
  Toxin: '07_toxin',
  Magnetic: '11_magnetic',
  Radiation: '09_radiation',
};

export const DEFAULT_VALENCE_BONUS: ValenceBonus = {
  element: 'Heat',
  percent: 55,
};

const DEFAULT_PERCENT = DEFAULT_VALENCE_BONUS.percent;
const MIN_P = 25;
const MAX_P = 60;

interface ValenceBonusPanelProps {
  value: ValenceBonus;
  onChange: (next: ValenceBonus) => void;
}

export function ValenceBonusPanel({ value, onChange }: ValenceBonusPanelProps) {
  const selectElement = (element: ValenceDamageType) => {
    onChange({
      element,
      percent: value.percent ?? DEFAULT_PERCENT,
    });
  };

  const setPercent = (raw: number) => {
    const percent = Math.min(MAX_P, Math.max(MIN_P, Math.round(raw)));
    onChange({ ...value, percent });
  };

  return (
    <div className="glass-panel p-4">
      <h3 className="text-muted text-sm font-semibold tracking-wider uppercase">Valence bonus</h3>
      <p className="text-muted/80 mt-1 text-[10px] leading-snug">
        Treated as weapon base damage for mod scaling.
      </p>

      <div className="mt-3 flex flex-nowrap justify-center gap-0.5 overflow-x-auto pb-0.5">
        {VALENCE_DAMAGE_TYPES.map((el) => {
          const active = value.element === el;
          const color = getElementColor(el);
          const icon = VALENCE_ICONS[el];
          return (
            <button
              key={el}
              type="button"
              title={el}
              onClick={() => selectElement(el)}
              className={`flex h-7 w-7 shrink-0 items-center justify-center rounded border transition-colors ${
                active
                  ? 'border-accent bg-accent/15 ring-accent/40 ring-1'
                  : 'border-white/10 bg-black/20 hover:border-white/25'
              }`}
            >
              {icon ? (
                <img
                  src={`/icons/elements/${icon}.png`}
                  alt=""
                  className="h-3.5 w-3.5 object-contain"
                  draggable={false}
                />
              ) : (
                <span className="text-[9px] font-bold" style={{ color }}>
                  ?
                </span>
              )}
            </button>
          );
        })}
      </div>

      <div className="mt-3 space-y-1.5">
        <div className="flex items-center justify-between text-[10px] uppercase">
          <span className="text-muted">Bonus amount</span>
          <span className="text-foreground font-semibold tabular-nums">{value.percent}%</span>
        </div>
        <input
          type="range"
          min={MIN_P}
          max={MAX_P}
          step={1}
          value={value.percent}
          onChange={(e) => setPercent(Number(e.target.value))}
          className="accent-accent h-2 w-full cursor-pointer"
          aria-label="Valence bonus percent"
        />
      </div>
    </div>
  );
}
