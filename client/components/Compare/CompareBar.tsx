import { lazy, Suspense, useState } from 'react';

import { useCompare } from '../../context/CompareContext';
import { LazySuspenseFallback } from '../ui/LazySuspenseFallback';

const CompareModal = lazy(() =>
  import('./CompareModal').then((m) => ({ default: m.CompareModal })),
);

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
      <div className="border-glass-border bg-surface/95 animate-slide-up fixed inset-x-0 bottom-0 z-[200] border-t backdrop-blur-md">
        <div className="mx-auto flex max-w-[2000px] items-center gap-4 px-6 py-3">
          <span className="text-muted shrink-0 text-xs font-semibold tracking-wider uppercase">
            Compare
          </span>

          <div className="flex flex-1 items-center gap-3">
            {snapshots.map((snap) => (
              <div
                key={snap.id}
                className="border-glass-border bg-surface-modal flex items-center gap-2 rounded-lg border px-3 py-2"
              >
                {snap.weaponImage && (
                  <img
                    src={`/images${snap.weaponImage}`}
                    alt={snap.weaponName}
                    className="h-8 w-8 rounded object-cover"
                    onError={(e) => {
                      (e.target as HTMLImageElement).style.display = 'none';
                    }}
                  />
                )}
                <div className="min-w-0">
                  <div className="text-foreground max-w-[140px] truncate text-xs font-medium">
                    {snap.label}
                  </div>
                  <div className="text-muted text-[10px]">
                    {snap.weaponName} ·{' '}
                    <span className="text-accent">{formatDps(snap.calc.burstDps)} DPS</span>
                  </div>
                </div>
                <button
                  className="text-muted ml-1 shrink-0 rounded p-0.5 transition-colors hover:text-red-400"
                  onClick={() => removeSnapshot(snap.id)}
                  title="Remove from comparison"
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
                className="border-glass-border/50 flex h-[52px] w-32 items-center justify-center rounded-lg border border-dashed"
              >
                <span className="text-muted/40 text-[10px]">Empty</span>
              </div>
            ))}
          </div>

          <div className="flex shrink-0 items-center gap-2">
            {snapshots.length >= 2 && (
              <button className="btn btn-accent text-sm" onClick={() => setShowModal(true)}>
                Compare {snapshots.length}
              </button>
            )}
            <button
              className="text-muted text-xs transition-colors hover:text-red-400"
              onClick={clearAll}
            >
              Clear all
            </button>
          </div>
        </div>
      </div>

      {showModal ? (
        <Suspense fallback={<LazySuspenseFallback />}>
          <CompareModal onClose={() => setShowModal(false)} />
        </Suspense>
      ) : null}
    </>
  );
}
