import type { IncarnonData, IncarnonEvolutionTier, IncarnonPerkOption } from '../../types/incarnon';
import type { IncarnonSelection } from '../../types/incarnon';
import {
  getDamageTypeIconPath,
  sanitizeDisplayTextKeepDamageTokens,
  splitDisplayTextByDamageTokens,
} from '../../utils/damageTypeTokens';
import { getSelectedPerk } from '../../utils/incarnonSelections';
import { GlassTooltip } from '../GlassTooltip';
import { MaterialSymbol } from '../ui/MaterialSymbol';

interface IncarnonUpgradeBarProps {
  incarnonData: IncarnonData;
  selections: IncarnonSelection[];
  incarnonEnabled: boolean;
  activeTier: number | null;
  onTierClick: (tier: number) => void;
  readOnly?: boolean;
}

function renderDamageSnippet(raw: string): React.ReactNode {
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
}

function perkImageUrl(option: IncarnonPerkOption | null): string | undefined {
  if (!option?.imagePath) return undefined;
  return `/images${option.imagePath}`;
}

export function IncarnonUpgradeBar({
  incarnonData,
  selections,
  incarnonEnabled,
  activeTier,
  onTierClick,
  readOnly = false,
}: IncarnonUpgradeBarProps) {
  if (!incarnonEnabled) return null;

  return (
    <div>
      <div className="text-muted mb-2 text-[10px] font-semibold uppercase">Incarnon Upgrade</div>
      <div className="flex flex-wrap items-center justify-center gap-2">
        {incarnonData.evolutions.map((tier: IncarnonEvolutionTier) => {
          const selection = selections.find((s) => s.tier === tier.tier);
          const unlocked = selection?.unlocked ?? false;
          const selectedPerk = getSelectedPerk(incarnonData, selections, tier.tier);
          const isActive = activeTier === tier.tier;

          const slotClass = isActive
            ? 'border-accent bg-accent-weak/20 ring-accent ring-1'
            : 'border-glass-border bg-glass hover:border-glass-border-hover hover:bg-glass-hover';

          const button = (
            <button
              key={tier.tier}
              type="button"
              disabled={readOnly}
              onClick={() => onTierClick(tier.tier)}
              className={`relative flex h-12 w-12 items-center justify-center rounded-lg border transition-[color,background-color,border-color] duration-200 ${slotClass} ${!unlocked ? 'opacity-50' : ''}`}
            >
              {!unlocked ? (
                <MaterialSymbol
                  name="hide_source"
                  className="text-foreground"
                  style={{ fontSize: 24 }}
                />
              ) : selectedPerk?.imagePath ? (
                <img
                  src={perkImageUrl(selectedPerk)}
                  alt=""
                  className="invert-on-light h-10 w-10 object-contain"
                  draggable={false}
                />
              ) : (
                <span className="text-foreground text-[10px] font-semibold">EVO{tier.tier}</span>
              )}
              <span className="bg-glass text-muted absolute -top-1 -left-1 flex h-4 w-4 items-center justify-center rounded-full text-[9px] font-bold">
                {tier.tier}
              </span>
            </button>
          );

          return (
            <GlassTooltip
              key={tier.tier}
              width="w-80"
              content={
                !unlocked ? (
                  <div className="text-foreground text-sm font-medium">Upgrade not unlocked</div>
                ) : (
                  <>
                    <div className="text-foreground text-sm font-semibold">
                      {selectedPerk?.name ?? `Evolution ${tier.tier}`}
                    </div>
                    {selectedPerk?.description && (
                      <div className="text-muted mt-1 text-xs leading-relaxed">
                        {renderDamageSnippet(selectedPerk.description)}
                      </div>
                    )}
                  </>
                )
              }
            >
              {button}
            </GlassTooltip>
          );
        })}
      </div>
    </div>
  );
}
