import type { FormaCount } from '../../utils/formaCounter';

export const BUILD_LIST_METRIC_CHIP_CLASS =
  'bg-glass flex h-20 min-w-28 items-center justify-center gap-2 rounded-lg px-3';

export function FormaMetricChips({ usedFormaCost }: { usedFormaCost: FormaCount }) {
  const formaEntries = [
    { key: 'regular', count: usedFormaCost.regular, icon: '/icons/forma.png' },
    {
      key: 'universal',
      count: usedFormaCost.universal,
      icon: '/icons/forma-omni.png',
    },
    {
      key: 'umbra',
      count: usedFormaCost.umbra,
      icon: '/icons/forma-umbra.png',
    },
    {
      key: 'stance',
      count: usedFormaCost.stance,
      icon: '/icons/forma-stance.png',
    },
  ].filter((entry) => entry.count > 0);

  const visibleFormaEntries =
    formaEntries.length > 0
      ? formaEntries
      : [{ key: 'regular', count: 0, icon: '/icons/forma.png' }];

  return (
    <>
      {visibleFormaEntries.map((entry) => (
        <div key={entry.key} className={BUILD_LIST_METRIC_CHIP_CLASS}>
          <img
            src={entry.icon}
            alt={`${entry.key} forma used`}
            className="h-12 w-12 object-contain"
            draggable={false}
          />
          <span className="text-foreground text-base font-semibold">{entry.count}</span>
        </div>
      ))}
    </>
  );
}
