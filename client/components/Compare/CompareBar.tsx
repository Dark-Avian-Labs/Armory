import { useState } from 'react';

import { CompareModal } from './CompareModal';
import { useCompare } from '../../context/CompareContext';

function formatDps(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1000) return `${(n / 1000).toFixed(1)}k`;
  return n.toFixed(0);
}

export function CompareBar() {
  const { snapshots, removeSnapshot, clearAll } = useCompare();
  const [showModal, setShowModal] = useState(false);

  if (snapshots.length === 0) return null;

  return (
    <>
      <div className="animate-slide-up fixed inset-x-0 bottom-0 z-[200] px-4 pb-4 sm:px-6 sm:pb-6">
        <div className="glass-shell mx-auto flex max-w-[2000px] flex-col gap-4 px-5 py-4 lg:flex-row lg:items-center">
          <span className="shrink-0 text-xs font-semibold uppercase tracking-[0.24em] text-muted">
            Compare
          </span>

          <div className="flex flex-1 flex-wrap items-center gap-3">
            {snapshots.map((snap) => (
              <div
                key={snap.id}
                className="flex items-center gap-3 rounded-2xl border border-glass-border bg-glass px-3 py-3"
              >
                {snap.weaponImage && (
                  <img
                    src={`/images${snap.weaponImage}`}
                    alt={snap.weaponName}
                    className="h-10 w-10 rounded-xl object-cover"
                    onError={(e) => {
                      (e.target as HTMLImageElement).style.display = 'none';
                    }}
                  />
                )}
                <div className="min-w-0">
                  <div className="truncate text-sm font-medium text-foreground">
                    {snap.label}
                  </div>
                  <div className="text-[11px] text-muted">
                    {snap.weaponName} ·{' '}
                    <span className="text-accent">
                      {formatDps(snap.calc.burstDps)} DPS
                    </span>
                  </div>
                </div>
                <button
                  className="ml-1 shrink-0 rounded-full p-1 text-muted transition-colors hover:text-danger"
                  onClick={() => removeSnapshot(snap.id)}
                  title="Remove from comparison"
                  type="button"
                >
                  <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
                    <path
                      d="M3.5 3.5L10.5 10.5M10.5 3.5L3.5 10.5"
                      stroke="currentColor"
                      strokeWidth="1.5"
                      strokeLinecap="round"
                    />
                  </svg>
                </button>
              </div>
            ))}

            {Array.from({ length: 3 - snapshots.length }).map((_, i) => (
              <div
                key={`empty-${i}`}
                className="flex h-[58px] w-36 items-center justify-center rounded-2xl border border-dashed border-glass-border/60 bg-glass/40"
              >
                <span className="text-[10px] uppercase tracking-[0.18em] text-muted/40">
                  Empty slot
                </span>
              </div>
            ))}
          </div>

          <div className="flex shrink-0 items-center gap-2 self-end lg:self-auto">
            {snapshots.length >= 2 && (
              <button
                className="btn btn-accent text-sm"
                onClick={() => setShowModal(true)}
                type="button"
              >
                Compare {snapshots.length}
              </button>
            )}
            <button
              className="btn btn-secondary btn-sm"
              onClick={clearAll}
              type="button"
            >
              Clear all
            </button>
          </div>
        </div>
      </div>

      {showModal && <CompareModal onClose={() => setShowModal(false)} />}
    </>
  );
}
