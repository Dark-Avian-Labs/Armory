import { useMemo } from 'react';

import { useApi } from '../../hooks/useApi';
import type { Warframe, Ability, BuildConfig } from '../../types/warframe';
import {
  getDamageTypeIconPath,
  sanitizeDisplayTextKeepDamageTokens,
  splitDisplayTextByDamageTokens,
} from '../../utils/damageTypeTokens';
import { GlassTooltip } from '../GlassTooltip';

export interface ParsedAbility {
  name: string;
  description?: string;
  index: number;
  unique_name?: string;
}

interface AbilityBarProps {
  warframe: Warframe;
  helminthConfig?: BuildConfig['helminth'];
  onHelminthChange: (config: BuildConfig['helminth'] | undefined) => void;
  activeAbilityIndex?: number | null;
  onAbilityClick: (index: number) => void;
}

export function AbilityBar({
  warframe,
  helminthConfig,
  onHelminthChange,
  activeAbilityIndex,
  onAbilityClick,
}: AbilityBarProps) {
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

  const { data: helminthData } = useApi<{ items: Ability[] }>(
    '/api/helminth-abilities',
  );
  const helminthAbilities = helminthData?.items || [];

  const abilityUniqueNames = useMemo(() => {
    try {
      if (warframe.abilities) {
        const parsed = JSON.parse(warframe.abilities) as Array<
          Record<string, string>
        >;
        return parsed
          .map((a) => a.abilityUniqueName || a.uniqueName)
          .filter(Boolean);
      }
    } catch {
      // ignore
    }
    return [] as string[];
  }, [warframe.abilities]);

  const abilityNamesParam =
    abilityUniqueNames.length > 0
      ? `&ability_names=${encodeURIComponent(abilityUniqueNames.join(','))}`
      : '';

  const { data: warframeAbilities } = useApi<{ items: Ability[] }>(
    `/api/abilities?warframe=${encodeURIComponent(warframe.unique_name)}${abilityNamesParam}`,
  );

  const ownAbilities = useMemo<ParsedAbility[]>(() => {
    try {
      if (warframe.abilities) {
        const parsed = JSON.parse(warframe.abilities) as Array<{
          abilityName?: string;
          name?: string;
          abilityUniqueName?: string;
          uniqueName?: string;
          description?: string;
        }>;
        return parsed.map((a, i) => ({
          name: a.abilityName || a.name || `Ability ${i + 1}`,
          description: a.description,
          index: i,
          unique_name: a.abilityUniqueName || a.uniqueName,
        }));
      }
    } catch {
      // ignore
    }
    return Array.from({ length: 4 }, (_, i) => ({
      name: `Ability ${i + 1}`,
      index: i,
    }));
  }, [warframe.abilities]);

  const dbAbilities = warframeAbilities?.items || [];

  const getDbAbility = (ability: ParsedAbility): Ability | undefined => {
    return dbAbilities.find(
      (a) => a.unique_name === ability.unique_name || a.name === ability.name,
    );
  };

  const getAbilityIcon = (ability: ParsedAbility): string | undefined => {
    const dbAb = getDbAbility(ability);
    if (dbAb?.image_path) return `/images${dbAb.image_path}`;
    return undefined;
  };

  const selectedReplacement = helminthConfig
    ? helminthAbilities.find(
        (a) => a.unique_name === helminthConfig.replacement_ability_unique_name,
      )
    : null;

  const handleRemoveHelminth = () => {
    onHelminthChange(undefined);
  };

  return (
    <div>
      <div className="mb-2 text-[10px] font-semibold uppercase text-muted">
        Abilities
      </div>
      <div className="flex flex-wrap items-center justify-center gap-2">
        {ownAbilities.map((ability) => {
          const isReplaced =
            helminthConfig?.replaced_ability_index === ability.index;
          const isActive = activeAbilityIndex === ability.index;
          const displayName =
            isReplaced && selectedReplacement
              ? selectedReplacement.name
              : ability.name;
          const icon = getAbilityIcon(ability);
          const initial = displayName.charAt(0).toUpperCase();
          const dbAb = getDbAbility(ability);
          const energyCost = isReplaced
            ? helminthAbilities.find(
                (a) =>
                  a.unique_name ===
                  helminthConfig?.replacement_ability_unique_name,
              )?.energy_cost
            : dbAb?.energy_cost;

          return (
            <GlassTooltip
              key={ability.index}
              width="w-80"
              content={
                <>
                  <div className="flex items-center justify-between">
                    <div className="text-xs font-semibold text-foreground">
                      {displayName}
                    </div>
                    {energyCost != null && energyCost > 0 && (
                      <div className="text-[10px] font-medium text-accent">
                        {energyCost} Energy
                      </div>
                    )}
                  </div>
                  {isReplaced && (
                    <div className="mt-0.5 text-[10px] text-danger">
                      Replaced (was: {ability.name})
                    </div>
                  )}
                  {ability.description && !isReplaced && (
                    <div className="mt-0.5 whitespace-normal break-words text-[10px] leading-relaxed text-muted">
                      {renderDamageSnippet(ability.description)}
                    </div>
                  )}
                  {isReplaced && selectedReplacement?.description && (
                    <div className="mt-0.5 whitespace-normal break-words text-[10px] leading-relaxed text-muted">
                      {renderDamageSnippet(selectedReplacement.description)}
                    </div>
                  )}
                </>
              }
            >
              <button
                onClick={() => onAbilityClick(ability.index)}
                className={`relative flex h-12 w-12 items-center justify-center rounded-lg border transition-all ${
                  isActive
                    ? 'border-accent bg-accent-weak/20 ring-1 ring-accent'
                    : isReplaced
                      ? 'border-danger/50 bg-danger/10'
                      : 'border-glass-border bg-glass hover:border-glass-border-hover hover:bg-glass-hover'
                }`}
              >
                {icon ? (
                  <img
                    src={icon}
                    alt=""
                    className="invert-on-light h-10 w-10 rounded object-cover"
                    draggable={false}
                  />
                ) : (
                  <span
                    className={`text-lg font-bold ${isReplaced ? 'text-danger' : 'text-muted/50'}`}
                  >
                    {initial}
                  </span>
                )}
                <span
                  className={`absolute -left-1 -top-1 flex h-4 w-4 items-center justify-center rounded-full text-[10px] font-bold ${
                    isReplaced
                      ? 'bg-danger text-white'
                      : 'bg-glass-active text-muted'
                  }`}
                >
                  {ability.index + 1}
                </span>
              </button>
            </GlassTooltip>
          );
        })}

        {helminthConfig && (
          <button
            onClick={handleRemoveHelminth}
            className="ml-2 rounded-lg border border-danger/30 px-2 py-1 text-[10px] text-danger transition-all hover:bg-danger/10"
          >
            Reset
          </button>
        )}
      </div>
    </div>
  );
}
