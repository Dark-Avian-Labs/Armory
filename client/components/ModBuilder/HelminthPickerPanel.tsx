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
  const { data, loading } = useApi<{ items: Ability[] }>('/api/helminth-abilities');
  const helminthAbilities = data?.items || [];

  const filtered = helminthAbilities.filter((a) =>
    a.name.toLowerCase().includes(search.toLowerCase()),
  );

  const renderDamageSnippet = (raw: string): React.ReactNode => {
    const cleaned = sanitizeDisplayTextKeepDamageTokens(raw);
    return splitDisplayTextByDamageTokens(cleaned).map((segment, segmentIndex) => {
      if (segment.kind === 'text') {
        return <span key={`t-${segmentIndex}`}>{segment.value}</span>;
      }
      const iconPath = getDamageTypeIconPath(segment.value);
      if (!iconPath) return <span key={`u-${segmentIndex}`}>{segment.value}</span>;
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
    });
  };

  return (
    <div className="mod-builder-side-panel flex min-h-0 flex-col">
      <div className="mb-3 flex items-center justify-between">
        <div>
          <h2 className="text-foreground text-lg font-semibold">Helminth</h2>
          <p className="text-muted text-xs">
            Replacing: <span className="text-danger">{replacingAbilityName}</span>
          </p>
        </div>
        <button
          onClick={onClose}
          className="border-glass-border text-muted hover:bg-glass-hover hover:text-foreground rounded-lg border px-2.5 py-1 text-xs transition-[color,background-color,border-color] duration-200"
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

      <div className="text-muted mb-2 text-xs">{filtered.length} abilities available</div>

      <div className="custom-scroll max-h-[calc(100vh-420px)] overflow-y-auto">
        {loading ? (
          <p className="text-muted text-sm">Loading abilities...</p>
        ) : filtered.length === 0 ? (
          <p className="text-muted text-sm">No abilities match the search.</p>
        ) : (
          <div className="space-y-1.5">
            <button
              onClick={onRestore}
              className="border-danger/40 hover:border-danger hover:bg-danger/10 flex w-full items-start gap-3 rounded-lg border border-dashed p-3 text-left transition-[color,background-color,border-color] duration-200"
            >
              <div className="bg-danger/10 text-danger/60 flex h-10 w-10 shrink-0 items-center justify-center rounded-lg text-lg">
                &times;
              </div>
              <div className="min-w-0 pt-0.5">
                <div className="text-danger/80 text-sm font-medium">Restore Original</div>
                <div className="text-muted/50 mt-0.5 text-[11px] leading-tight">
                  Remove Helminth replacement
                </div>
              </div>
            </button>
            {filtered.map((ability) => (
              <button
                key={ability.unique_name}
                onClick={() => onSelect(ability)}
                className="border-glass-border hover:border-glass-border-hover hover:bg-glass-hover flex w-full items-start gap-3 rounded-lg border p-3 text-left transition-[color,background-color,border-color] duration-200"
              >
                {ability.image_path ? (
                  <img
                    src={`/images${ability.image_path}`}
                    alt=""
                    className="invert-on-light h-10 w-10 shrink-0 rounded-lg object-cover"
                    draggable={false}
                  />
                ) : (
                  <div className="bg-glass text-muted/40 flex h-10 w-10 shrink-0 items-center justify-center rounded-lg text-sm font-bold">
                    {ability.name.charAt(0)}
                  </div>
                )}
                <div className="min-w-0 pt-0.5">
                  <div className="text-foreground text-sm font-medium">{ability.name}</div>
                  {ability.description && (
                    <div className="text-muted/60 mt-0.5 text-[11px] leading-relaxed break-words whitespace-normal">
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
