import { useEffect, useMemo, useRef, useState } from 'react';

import {
  AP_ATTACK,
  AP_DEFENSE,
  AP_TACTIC,
  POLARITIES,
  type RivenConfig,
  type RivenStat,
  type RivenWeaponType,
} from '../../types/warframe';
import {
  buildRivenDescription,
  clampDisposition,
  resolveRivenConfig,
  validateRivenConfig,
} from '../../utils/riven';

interface RivenBuilderProps {
  availableStats: string[];
  weaponType: RivenWeaponType;
  weaponDisposition?: number;
  config?: RivenConfig;
  onSave: (config: RivenConfig) => void;
  onClose: () => void;
}

export function RivenBuilder({
  availableStats,
  weaponType,
  weaponDisposition = 1,
  config,
  onSave,
  onClose,
}: RivenBuilderProps) {
  const initialRows = useMemo<RivenStat[]>(() => {
    const p = config?.positive ?? [];
    const n = config?.negative;
    return [
      { stat: p[0]?.stat ?? '', value: p[0]?.value ?? 0, isNegative: false },
      { stat: p[1]?.stat ?? '', value: p[1]?.value ?? 0, isNegative: false },
      { stat: p[2]?.stat ?? '', value: p[2]?.value ?? 0, isNegative: false },
      { stat: n?.stat ?? '', value: n?.value ?? 0, isNegative: true },
    ];
  }, [config]);

  const [rows, setRows] = useState<RivenStat[]>(initialRows);
  const [polarity, setPolarity] = useState<RivenConfig['polarity']>(config?.polarity ?? AP_ATTACK);
  const [assumeMaxRankStats, setAssumeMaxRankStats] = useState(true);
  const [manualModRank, setManualModRank] = useState(config?.rivenRank ?? 8);
  const [error, setError] = useState<string>('');
  const [info, setInfo] = useState<string>('');
  const isMounted = useRef(false);

  useEffect(() => {
    if (!isMounted.current) {
      isMounted.current = true;
      return;
    }
    setRows(initialRows);
    setManualModRank(config?.rivenRank ?? 8);
  }, [initialRows, config?.rivenRank]);

  const selectedStats = rows.map((r) => r.stat).filter(Boolean);

  const getFilteredStats = (currentStat: string) =>
    availableStats.filter((s) => s === currentStat || !selectedStats.includes(s));

  const updateRow = (idx: number, key: keyof RivenStat, value: string | number) => {
    const next = [...rows];
    if (key === 'stat') next[idx] = { ...next[idx], stat: value as string };
    else if (key === 'value') next[idx] = { ...next[idx], value: value as number };
    setRows(next);
  };

  const handleSave = () => {
    const configToSave: RivenConfig = {
      polarity,
      positive: rows
        .slice(0, 3)
        .filter((r) => r.stat)
        .map((r) => ({
          ...r,
          value: Math.abs(r.value),
          isNegative: false,
        })),
      negative: rows[3]?.stat
        ? { ...rows[3], value: -Math.abs(rows[3].value), isNegative: true }
        : undefined,
    };

    const validationError = validateRivenConfig(configToSave);
    if (validationError) {
      setError(validationError);
      setInfo('');
      return;
    }

    const resolved = resolveRivenConfig(configToSave, {
      weaponType,
      disposition: clampDisposition(weaponDisposition),
      assumeValuesAreMaxRank: assumeMaxRankStats,
      manualRank: assumeMaxRankStats ? 8 : manualModRank,
    });

    const warn = [...resolved.warnings];
    if (resolved.adjusted) {
      warn.push('Some values were clamped to the wiki legal min/max for this disposition.');
    }
    setInfo(warn.length ? warn.join(' ') : '');
    setError('');
    onSave(resolved.config);
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal max-w-lg" style={{ width: '90%' }} onClick={(e) => e.stopPropagation()}>
        <div className="mb-4 flex items-center justify-between">
          <h3 className="text-foreground text-sm font-semibold">Riven Builder</h3>
          <button className="text-muted hover:text-foreground text-lg" onClick={onClose}>
            &times;
          </button>
        </div>

        <div className="border-riven bg-glass mb-4 rounded-lg border p-4">
          <div className="text-riven-light mb-2 text-center text-sm font-semibold">Riven Mod</div>
          <p className="text-muted mb-2 text-center text-[10px]">
            Disposition:{' '}
            <span className="text-foreground font-semibold">
              {clampDisposition(weaponDisposition).toFixed(2)}
            </span>{' '}
            (from selected weapon; drives stat min/max per{' '}
            <a
              href="https://wiki.warframe.com/w/Riven_Mods"
              target="_blank"
              rel="noreferrer"
              className="text-accent underline"
            >
              wiki
            </a>
            )
          </p>
          <div className="mb-2 flex items-center justify-between gap-2">
            <span className="text-muted text-xs font-semibold">Polarity</span>
            <div className="flex items-center gap-1.5">
              {[
                {
                  key: AP_ATTACK,
                  icon: 'madurai',
                  label: POLARITIES.AP_ATTACK,
                },
                {
                  key: AP_TACTIC,
                  icon: 'naramon',
                  label: POLARITIES.AP_TACTIC,
                },
                {
                  key: AP_DEFENSE,
                  icon: 'vazarin',
                  label: POLARITIES.AP_DEFENSE,
                },
              ].map((p) => {
                const active = polarity === p.key;
                return (
                  <button
                    key={p.key}
                    type="button"
                    onClick={() => setPolarity(p.key)}
                    className={`flex h-8 w-8 items-center justify-center rounded-md border transition-[color,background-color,border-color] duration-200 ${
                      active
                        ? 'border-accent bg-accent-weak'
                        : 'border-glass-border bg-glass-hover hover:border-glass-border-hover'
                    }`}
                    title={p.label}
                    aria-label={p.label}
                    aria-pressed={active}
                  >
                    <img
                      src={`/icons/polarity/${p.icon}.svg`}
                      alt={p.label}
                      className="h-4 w-4"
                      style={{
                        filter: active
                          ? 'brightness(0) invert(0.5) sepia(1) saturate(5) hue-rotate(85deg)'
                          : 'brightness(0) invert(1)',
                      }}
                      draggable={false}
                    />
                  </button>
                );
              })}
            </div>
          </div>
          <div className="space-y-1 text-xs whitespace-pre-line">
            {buildRivenDescription({
              positive: rows
                .slice(0, 3)
                .filter((r) => r.stat)
                .map((r) => ({ ...r, isNegative: false })),
              negative: rows[3]?.stat ? { ...rows[3], isNegative: true } : undefined,
            }) || 'Select at least two positive stats'}
          </div>
        </div>

        <div className="mb-3 space-y-2">
          <label className="flex cursor-pointer items-center gap-2 text-[11px]">
            <input
              type="checkbox"
              checked={assumeMaxRankStats}
              onChange={(e) => setAssumeMaxRankStats(e.target.checked)}
            />
            <span>
              Values are <strong>max-rank</strong> (fully ranked) — matches in-game stats at mod
              rank 8
            </span>
          </label>
          {!assumeMaxRankStats && (
            <div className="flex items-center gap-2 text-[11px]">
              <span className="text-muted w-32 shrink-0">Mod rank (0–8)</span>
              <input
                type="number"
                min={0}
                max={8}
                value={manualModRank}
                onChange={(e) =>
                  setManualModRank(Math.min(8, Math.max(0, parseInt(e.target.value, 10) || 0)))
                }
                className="form-input w-16 text-xs"
              />
              <span className="text-muted">
                Values you entered are scaled to max-rank storage (see wiki).
              </span>
            </div>
          )}
        </div>

        <div className="mb-4">
          <div className="space-y-2">
            {rows.map((stat, i) => (
              <div key={i} className="flex items-center gap-2">
                <span
                  className={`w-16 text-xs font-semibold ${
                    stat.isNegative ? 'text-danger' : 'text-success'
                  }`}
                >
                  {stat.isNegative ? 'Negative' : `Positive ${i + 1}`}
                </span>
                <select
                  value={stat.stat}
                  onChange={(e) => updateRow(i, 'stat', e.target.value)}
                  className="form-input riven-select flex-1 text-xs"
                >
                  <option value="">None</option>
                  {getFilteredStats(stat.stat).map((s) => (
                    <option key={s} value={s}>
                      {s}
                    </option>
                  ))}
                </select>
                <input
                  type="number"
                  value={stat.value}
                  onChange={(e) => updateRow(i, 'value', parseFloat(e.target.value) || 0)}
                  className="form-input w-20 text-xs"
                  step="0.1"
                />
              </div>
            ))}
          </div>
        </div>

        <p className="text-muted mb-2 text-[11px]">
          On save, stats are clamped to legal ranges for your weapon disposition (see wiki). Mod
          rank on the slot scales the displayed bonus.
        </p>
        {info && (
          <p className="text-muted mb-2 text-[11px] whitespace-pre-wrap" data-tone="info">
            {info}
          </p>
        )}
        {error && <p className="text-danger mb-4 text-xs">{error}</p>}

        <div className="flex justify-end gap-2">
          <button className="btn btn-secondary text-xs" onClick={onClose}>
            Cancel
          </button>
          <button
            className="btn btn-accent text-xs"
            onClick={handleSave}
            disabled={rows.slice(0, 3).every((p) => !p.stat)}
          >
            Apply Riven
          </button>
        </div>
      </div>
    </div>
  );
}
