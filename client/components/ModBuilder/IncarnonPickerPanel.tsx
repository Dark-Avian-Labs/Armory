import type { IncarnonData, IncarnonPerkOption } from '../../types/incarnon';
import { DamageTypeInlineText } from '../DamageTypeInlineText';
import { MaterialSymbol } from '../ui/MaterialSymbol';

interface IncarnonPickerPanelProps {
  tier: number;
  incarnonData: IncarnonData;
  onSelectPerk: (perkName: string) => void;
  onTurnOff: () => void;
  onClose: () => void;
}

function PerkRow({ option, onClick }: { option: IncarnonPerkOption; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="border-glass-border hover:border-glass-border-hover hover:bg-glass-hover flex w-full items-start gap-3 rounded-lg border p-3 text-left transition-[color,background-color,border-color] duration-200"
    >
      {option.imagePath ? (
        <img
          src={`/images${option.imagePath}`}
          alt=""
          className="invert-on-light h-10 w-10 shrink-0 rounded-lg object-contain"
          draggable={false}
        />
      ) : (
        <div className="bg-glass text-muted/40 flex h-10 w-10 shrink-0 items-center justify-center rounded-lg text-sm font-bold">
          {option.name.charAt(0)}
        </div>
      )}
      <div className="min-w-0 pt-0.5">
        <div className="text-foreground text-sm font-medium">{option.name}</div>
        <div className="text-muted/60 mt-0.5 text-[11px] leading-relaxed break-words whitespace-normal">
          <DamageTypeInlineText text={option.description} />
        </div>
      </div>
    </button>
  );
}

export function IncarnonPickerPanel({
  tier,
  incarnonData,
  onSelectPerk,
  onTurnOff,
  onClose,
}: IncarnonPickerPanelProps) {
  const evolution = incarnonData.evolutions.find((e) => e.tier === tier);
  const options = evolution?.options ?? [];

  return (
    <div className="mod-builder-side-panel flex min-h-0 flex-col">
      <div className="mb-3 flex items-center justify-between">
        <div>
          <h2 className="text-foreground text-lg font-semibold">Incarnon Upgrade</h2>
          <p className="text-muted text-xs">Select Evolution {tier} perk</p>
        </div>
        <button
          type="button"
          onClick={onClose}
          className="border-glass-border text-muted hover:bg-glass-hover hover:text-foreground rounded-lg border px-2.5 py-1 text-xs transition-[color,background-color,border-color] duration-200"
        >
          Back to Mods
        </button>
      </div>

      {evolution?.challenge && (
        <p className="text-muted mb-3 text-[11px] leading-relaxed">{evolution.challenge}</p>
      )}

      <div className="custom-scroll max-h-[calc(100vh-420px)] overflow-y-auto">
        <div className="space-y-1.5">
          <button
            type="button"
            onClick={onTurnOff}
            className="border-glass-border hover:border-glass-border-hover hover:bg-glass-hover flex w-full items-start gap-3 rounded-lg border border-dashed p-3 text-left transition-[color,background-color,border-color] duration-200"
          >
            <div className="text-muted flex h-10 w-10 shrink-0 items-center justify-center rounded-lg">
              <MaterialSymbol name="hide_source" style={{ fontSize: 24 }} />
            </div>
            <div className="min-w-0 pt-0.5">
              <div className="text-foreground text-sm font-medium">Not unlocked</div>
              <div className="text-muted/50 mt-0.5 text-[11px] leading-tight">
                Exclude this evolution and higher tiers from stats
              </div>
            </div>
          </button>

          {options.map((option) => (
            <PerkRow key={option.name} option={option} onClick={() => onSelectPerk(option.name)} />
          ))}
        </div>
      </div>
    </div>
  );
}
