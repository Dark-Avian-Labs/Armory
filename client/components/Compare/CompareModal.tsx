import { useEffect } from 'react';

import { useCompare, type CompareSnapshot } from '../../context/CompareContext';
import { formatPercent } from '../../utils/damage';
import { getElementColor } from '../../utils/elements';
import { Modal } from '../ui/Modal';

interface CompareModalProps {
  onClose: () => void;
}

function fmt(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(2)}M`;
  if (n >= 10_000) return `${(n / 1000).toFixed(1)}k`;
  if (n >= 1000) return `${(n / 1000).toFixed(2)}k`;
  if (n >= 100) return n.toFixed(1);
  return n.toFixed(2);
}

type BestDir = 'high' | 'low';

interface StatRow {
  label: string;
  getValue: (s: CompareSnapshot) => number;
  format: (n: number) => string;
  best: BestDir;
}

const STAT_ROWS: StatRow[] = [
  {
    label: 'Total Damage',
    getValue: (s) => s.calc.modded.totalDamage,
    format: (n) => n.toFixed(1),
    best: 'high',
  },
  {
    label: 'Critical Chance',
    getValue: (s) => s.calc.modded.critChance,
    format: formatPercent,
    best: 'high',
  },
  {
    label: 'Critical Multiplier',
    getValue: (s) => s.calc.modded.critMultiplier,
    format: (n) => `${n.toFixed(1)}x`,
    best: 'high',
  },
  {
    label: 'Status Chance',
    getValue: (s) => s.calc.modded.statusChance,
    format: formatPercent,
    best: 'high',
  },
  {
    label: 'Fire Rate',
    getValue: (s) => s.calc.modded.fireRate,
    format: (n) => n.toFixed(2),
    best: 'high',
  },
  {
    label: 'Multishot',
    getValue: (s) => s.calc.modded.multishot,
    format: (n) => n.toFixed(2),
    best: 'high',
  },
  {
    label: 'Magazine',
    getValue: (s) => s.calc.modded.magazineSize,
    format: (n) => String(Math.round(n)),
    best: 'high',
  },
  {
    label: 'Reload',
    getValue: (s) => s.calc.modded.reloadTime,
    format: (n) => `${n.toFixed(2)}s`,
    best: 'low',
  },
];

const DPS_ROWS: StatRow[] = [
  {
    label: 'Avg Hit',
    getValue: (s) => s.calc.averageHit,
    format: fmt,
    best: 'high',
  },
  {
    label: 'Burst DPS',
    getValue: (s) => s.calc.burstDps,
    format: fmt,
    best: 'high',
  },
  {
    label: 'Sustained DPS',
    getValue: (s) => s.calc.sustainedDps,
    format: fmt,
    best: 'high',
  },
  {
    label: 'Status/sec',
    getValue: (s) => s.calc.statusPerSec,
    format: (n) => n.toFixed(2),
    best: 'high',
  },
];

function bestIndex(values: number[], dir: BestDir): number {
  if (values.length === 0) return -1;
  let best = 0;
  for (let i = 1; i < values.length; i++) {
    if (dir === 'high' ? values[i] > values[best] : values[i] < values[best]) {
      best = i;
    }
  }
  const allEqual = values.every((v) => Math.abs(v - values[best]) < 0.001);
  return allEqual ? -1 : best;
}

export function CompareModal({ onClose }: CompareModalProps) {
  const { snapshots } = useCompare();

  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [onClose]);

  if (snapshots.length < 2) return null;
  const cols = snapshots.length;

  const allElements = new Set<string>();
  for (const snap of snapshots) {
    for (const e of snap.elementBreakdown) allElements.add(e.type);
  }
  const elementTypes = [...allElements];

  return (
    <Modal
      open
      onClose={onClose}
      ariaLabelledBy="compare-modal-title"
      className="w-full max-w-5xl"
    >
      <div className="mb-6 flex items-center justify-between">
        <div>
          <p className="panel-header__meta">Comparison</p>
          <h2
            id="compare-modal-title"
            className="text-xl font-semibold text-foreground"
          >
            Build comparison
          </h2>
        </div>
        <button
          className="icon-toggle-btn h-10 w-10"
          onClick={onClose}
          type="button"
          aria-label="Close comparison dialog"
        >
          <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
            <path
              d="M5 5L15 15M15 5L5 15"
              stroke="currentColor"
              strokeWidth="1.5"
              strokeLinecap="round"
            />
          </svg>
        </button>
      </div>

      <div
        className="mb-4 grid gap-3"
        style={{ gridTemplateColumns: `160px repeat(${cols}, 1fr)` }}
      >
        <div />
        {snapshots.map((snap) => (
          <div
            key={snap.id}
            className="rounded-2xl border border-glass-border bg-glass px-3 py-4 text-center"
          >
            {snap.weaponImage && (
              <img
                src={`/images${snap.weaponImage}`}
                alt={snap.weaponName}
                className="mx-auto mb-2 h-14 w-14 rounded-xl object-cover"
                onError={(e) => {
                  (e.target as HTMLImageElement).style.display = 'none';
                }}
              />
            )}
            <div className="text-sm font-semibold text-foreground">
              {snap.label}
            </div>
            <div className="text-xs text-muted">{snap.weaponName}</div>
          </div>
        ))}
      </div>

      <SectionLabel>Modded Stats</SectionLabel>
      <div className="space-y-0.5">
        {STAT_ROWS.map((row) => {
          const values = snapshots.map(row.getValue);
          const best = bestIndex(values, row.best);
          return (
            <StatRowView
              key={row.label}
              label={row.label}
              values={values}
              format={row.format}
              bestIdx={best}
              cols={cols}
            />
          );
        })}
      </div>

      <SectionLabel>DPS</SectionLabel>
      <div className="space-y-0.5">
        {DPS_ROWS.map((row) => {
          const values = snapshots.map(row.getValue);
          const best = bestIndex(values, row.best);
          return (
            <StatRowView
              key={row.label}
              label={row.label}
              values={values}
              format={row.format}
              bestIdx={best}
              cols={cols}
            />
          );
        })}
      </div>

      {elementTypes.length > 0 && (
        <>
          <SectionLabel>Element Breakdown</SectionLabel>
          <div className="space-y-0.5">
            {elementTypes.map((elType) => {
              const values = snapshots.map((s) => {
                const entry = s.elementBreakdown.find((e) => e.type === elType);
                return entry?.value ?? 0;
              });
              const best = bestIndex(values, 'high');
              const color = getElementColor(elType);
              return (
                <div
                  key={elType}
                  className="grid items-center gap-3 rounded-2xl px-3 py-2"
                  style={{
                    gridTemplateColumns: `160px repeat(${cols}, 1fr)`,
                  }}
                >
                  <span className="text-xs font-medium" style={{ color }}>
                    {elType}
                  </span>
                  {values.map((v, i) => (
                    <span
                      key={i}
                      className={`text-center text-xs tabular-nums ${
                        i === best
                          ? 'font-bold text-success'
                          : 'text-foreground'
                      }`}
                    >
                      {v > 0 ? fmt(v) : '-'}
                    </span>
                  ))}
                </div>
              );
            })}
            <div
              className="grid items-center gap-3 border-t border-glass-divider px-3 pt-2"
              style={{ gridTemplateColumns: `160px repeat(${cols}, 1fr)` }}
            >
              <span className="text-xs font-semibold text-muted">Total</span>
              {(() => {
                const vals = snapshots.map((ss) => ss.totalElementDamage);
                const best = bestIndex(vals, 'high');
                return snapshots.map((s, i) => (
                  <span
                    key={i}
                    className={`text-center text-xs font-semibold tabular-nums ${
                      i === best ? 'text-success' : 'text-foreground'
                    }`}
                  >
                    {fmt(s.totalElementDamage)}
                  </span>
                ));
              })()}
            </div>
          </div>
        </>
      )}
    </Modal>
  );
}

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <div className="mb-2 mt-5 text-[10px] font-semibold uppercase tracking-[0.26em] text-muted">
      {children}
    </div>
  );
}

function StatRowView({
  label,
  values,
  format,
  bestIdx,
  cols,
}: {
  label: string;
  values: number[];
  format: (n: number) => string;
  bestIdx: number;
  cols: number;
}) {
  return (
    <div
      className="grid items-center gap-3 rounded-2xl px-3 py-2 even:bg-glass/40"
      style={{ gridTemplateColumns: `160px repeat(${cols}, 1fr)` }}
    >
      <span className="text-xs text-muted">{label}</span>
      {values.map((v, i) => (
        <span
          key={i}
          className={`text-center text-xs tabular-nums ${
            i === bestIdx ? 'font-bold text-success' : 'text-foreground'
          }`}
        >
          {format(v)}
        </span>
      ))}
    </div>
  );
}
