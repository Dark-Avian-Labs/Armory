import { useState } from 'react';

import { useApi } from '../../hooks/useApi';
import type { Ability } from '../../types/warframe';
import {
  getDamageTypeIconPath,
  sanitizeDisplayTextKeepDamageTokens,
  splitDisplayTextByDamageTokens,
} from '../../utils/damageTypeTokens';

interface HelminthPickerPanelProps {
  replacingAbilityName: string;
  onSelect: (ability: Ability) => void;
  onRestore: () => void;
  onClose: () => void;
}

export function HelminthPickerPanel({
  replacingAbilityName,
  onSelect,
  onRestore,
  onClose,
}: HelminthPickerPanelProps) {
  const [search, setSearch] = useState('');
  const { data, loading } = useApi<{ items: Ability[] }>(
    '/api/helminth-abilities',
  );
  const helminthAbilities = data?.items || [];

  const filtered = helminthAbilities.filter((a) =>
    a.name.toLowerCase().includes(search.toLowerCase()),
  );

  const renderDamageSnippet = (raw: string): React.ReactNode => {
    const cleaned = sanitizeDisplayTextKeepDamageTokens(raw);
    return splitDisplayTextByDamageTokens(cleaned).map(
      (segment, segmentIndex) => {
        if (segment.kind === 'text') {
          return <span key={`t-${segmentIndex}`}>{segment.value}</span>;
        }
        const iconPath = getDamageTypeIconPath(segment.value);
        if (!iconPath)
          return <span key={`u-${segmentIndex}`}>{segment.value}</span>;
        return (
          <img
            key={`i-${segmentIndex}`}
            src={iconPath}
            alt={segment.value}
            className="mx-[0.08em] inline-block"
            style={{
              width: 12,
              height: 12,
              verticalAlign: '-0.12em',
              filter: 'drop-shadow(0 1px 2px rgba(0,0,0,0.7))',
            }}
            draggable={false}
          />
        );
      },
    );
  };

  return (
    <div className="glass-panel p-4">
      <div className="mb-3 flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold text-foreground">Helminth</h2>
          <p className="text-xs text-muted">
            Replacing:{' '}
            <span className="text-danger">{replacingAbilityName}</span>
          </p>
        </div>
        <button
          onClick={onClose}
          className="rounded-lg border border-glass-border px-2.5 py-1 text-xs text-muted transition-all hover:bg-glass-hover hover:text-foreground"
        >
          Back to Mods
        </button>
      </div>

      <input
        type="text"
        placeholder="Search helminth abilities..."
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        className="form-input mb-3"
        autoFocus
      />

      <div className="mb-2 text-xs text-muted">
        {filtered.length} abilities available
      </div>

      <div className="max-h-[calc(100vh-420px)] overflow-y-auto custom-scroll">
        {loading ? (
          <p className="text-sm text-muted">Loading abilities...</p>
        ) : filtered.length === 0 ? (
          <p className="text-sm text-muted">No abilities match the search.</p>
        ) : (
          <div className="space-y-1.5">
            <button
              onClick={onRestore}
              className="flex w-full items-start gap-3 rounded-lg border border-dashed border-danger/40 p-3 text-left transition-all hover:border-danger hover:bg-danger/10"
            >
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-danger/10 text-lg text-danger/60">
                &times;
              </div>
              <div className="min-w-0 pt-0.5">
                <div className="text-sm font-medium text-danger/80">
                  Restore Original
                </div>
                <div className="mt-0.5 text-[11px] leading-tight text-muted/50">
                  Remove Helminth replacement
                </div>
              </div>
            </button>
            {filtered.map((ability) => (
              <button
                key={ability.unique_name}
                onClick={() => onSelect(ability)}
                className="flex w-full items-start gap-3 rounded-lg border border-glass-border p-3 text-left transition-all hover:border-glass-border-hover hover:bg-glass-hover"
              >
                {ability.image_path ? (
                  <img
                    src={`/images${ability.image_path}`}
                    alt=""
                    className="invert-on-light h-10 w-10 shrink-0 rounded-lg object-cover"
                    draggable={false}
                  />
                ) : (
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-glass text-sm font-bold text-muted/40">
                    {ability.name.charAt(0)}
                  </div>
                )}
                <div className="min-w-0 pt-0.5">
                  <div className="text-sm font-medium text-foreground">
                    {ability.name}
                  </div>
                  {ability.description && (
                    <div className="mt-0.5 whitespace-normal break-words text-[11px] leading-relaxed text-muted/60">
                      {renderDamageSnippet(ability.description)}
                    </div>
                  )}
                </div>
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
