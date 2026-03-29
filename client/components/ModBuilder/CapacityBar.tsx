import type { FormaCount } from '../../utils/formaCounter';
import { GlassTooltip } from '../GlassTooltip';

interface CapacityBarProps {
  capacity: {
    baseCapacity: number;
    capacityBonus: number;
    totalDrain: number;
    remaining: number;
  };
  formaCost?: FormaCount;
  formaMode?: boolean;
  onFormaToggle?: () => void;
}

export function CapacityBar({ capacity, formaCost, formaMode, onFormaToggle }: CapacityBarProps) {
  const totalAvailable = capacity.baseCapacity + capacity.capacityBonus;
  const used = capacity.totalDrain;
  const percentage = totalAvailable > 0 ? Math.min((used / totalAvailable) * 100, 100) : 0;
  const isOverCapacity = capacity.remaining < 0;

  return (
    <div className="glass-panel p-3">
      <div className="mb-2 flex items-center justify-between text-xs">
        <div className="flex items-center gap-3">
          <span className="text-muted">Capacity</span>
          <span className={`font-semibold ${isOverCapacity ? 'text-danger' : 'text-foreground'}`}>
            {used} / {totalAvailable}
          </span>
          {capacity.capacityBonus > 0 && (
            <span className="text-success">(+{capacity.capacityBonus} from aura/stance)</span>
          )}
        </div>

        <div className="flex items-center gap-3">
          {formaCost && formaCost.total > 0 && (
            <div className="flex items-center gap-2">
              {formaCost.regular > 0 && (
                <GlassTooltip
                  width="w-72"
                  content={
                    <>
                      <div className="text-foreground text-xs font-semibold">Forma</div>
                      <div className="text-muted mt-0.5 text-[10px]">
                        Standard Forma used for polarity changes.
                      </div>
                    </>
                  }
                >
                  <span className="flex items-center gap-0.5">
                    <img src="/icons/forma.png" alt="Forma" className="h-4 w-4 object-contain" />
                    <span className="text-foreground text-xs font-medium">{formaCost.regular}</span>
                  </span>
                </GlassTooltip>
              )}
              {formaCost.universal > 0 && (
                <GlassTooltip
                  width="w-72"
                  content={
                    <>
                      <div className="text-foreground text-xs font-semibold">Omni Forma</div>
                      <div className="text-muted mt-0.5 text-[10px]">Universal polarity Forma.</div>
                    </>
                  }
                >
                  <span className="flex items-center gap-0.5">
                    <img
                      src="/icons/forma-omni.png"
                      alt="Omni Forma"
                      className="h-4 w-4 object-contain"
                    />
                    <span className="text-foreground text-xs font-medium">
                      {formaCost.universal}
                    </span>
                  </span>
                </GlassTooltip>
              )}
              {formaCost.umbra > 0 && (
                <GlassTooltip
                  width="w-72"
                  content={
                    <>
                      <div className="text-foreground text-xs font-semibold">Umbral Forma</div>
                      <div className="text-muted mt-0.5 text-[10px]">
                        Required for Umbral polarity slots.
                      </div>
                    </>
                  }
                >
                  <span className="flex items-center gap-0.5">
                    <img
                      src="/icons/forma-umbra.png"
                      alt="Umbra Forma"
                      className="h-4 w-4 object-contain"
                    />
                    <span className="text-foreground text-xs font-medium">{formaCost.umbra}</span>
                  </span>
                </GlassTooltip>
              )}
              {formaCost.stance > 0 && (
                <GlassTooltip
                  width="w-72"
                  content={
                    <>
                      <div className="text-foreground text-xs font-semibold">
                        Stance / Aura Forma
                      </div>
                      <div className="text-muted mt-0.5 text-[10px]">
                        Used for universal capacity-slot polarity.
                      </div>
                    </>
                  }
                >
                  <span className="flex items-center gap-0.5">
                    <img
                      src="/icons/forma-stance.png"
                      alt="Stance Forma"
                      className="h-4 w-4 object-contain"
                    />
                    <span className="text-foreground text-xs font-medium">{formaCost.stance}</span>
                  </span>
                </GlassTooltip>
              )}
            </div>
          )}

          {onFormaToggle && (
            <button
              onClick={onFormaToggle}
              className={`flex items-center gap-1 rounded-lg border px-2 py-0.5 text-[10px] transition-[color,background-color,border-color] duration-200 ${
                formaMode
                  ? 'border-warning bg-warning/10 text-warning'
                  : 'border-glass-border text-muted hover:border-glass-border-hover hover:text-foreground'
              }`}
            >
              <img src="/icons/forma.png" alt="" className="h-3.5 w-3.5 object-contain" />
              Forma
            </button>
          )}

          <span className={`font-semibold ${isOverCapacity ? 'text-danger' : 'text-success'}`}>
            {capacity.remaining} remaining
          </span>
        </div>
      </div>

      <div className="bg-glass-active h-2 overflow-hidden rounded-full">
        <div
          className={`h-full rounded-full transition-[width,background-color] duration-300 ${
            isOverCapacity ? 'bg-danger' : percentage > 80 ? 'bg-warning' : 'bg-accent'
          }`}
          style={{ width: `${Math.min(percentage, 100)}%` }}
        />
      </div>
    </div>
  );
}
