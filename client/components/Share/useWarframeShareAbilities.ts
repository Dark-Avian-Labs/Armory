import { useMemo } from 'react';

import { useApi } from '../../hooks/useApi';
import type { Ability, BuildConfig, Warframe } from '../../types/warframe';

export interface ParsedShareAbility {
  name: string;
  description?: string;
  index: number;
  unique_name?: string;
}

export function useWarframeShareAbilities(
  warframe: Warframe | null,
  helminthConfig: BuildConfig['helminth'] | undefined,
): {
  ownAbilities: ParsedShareAbility[];
  dbAbilities: Ability[];
  helminthAbilities: Ability[];
  selectedReplacement: Ability | null;
} {
  const abilityUniqueNames = useMemo(() => {
    if (!warframe?.abilities) return [] as string[];
    try {
      const parsed = JSON.parse(warframe.abilities) as Array<Record<string, string>>;
      return parsed.map((a) => a.abilityUniqueName || a.uniqueName).filter(Boolean) as string[];
    } catch {
      return [];
    }
  }, [warframe?.abilities]);

  const abilityNamesParam =
    abilityUniqueNames.length > 0
      ? `&ability_names=${encodeURIComponent(abilityUniqueNames.join(','))}`
      : '';

  const abilitiesUrl =
    warframe?.unique_name != null
      ? `/api/abilities?warframe=${encodeURIComponent(warframe.unique_name)}${abilityNamesParam}`
      : null;

  const helminthUrl = warframe ? '/api/helminth-abilities' : null;

  const { data: warframeAbilities } = useApi<{ items: Ability[] }>(abilitiesUrl);
  const { data: helminthData } = useApi<{ items: Ability[] }>(helminthUrl);

  const ownAbilities = useMemo<ParsedShareAbility[]>(() => {
    if (!warframe?.abilities) {
      return Array.from({ length: 4 }, (_, i) => ({
        name: `Ability ${i + 1}`,
        index: i,
      }));
    }
    try {
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
    } catch {
      return Array.from({ length: 4 }, (_, i) => ({
        name: `Ability ${i + 1}`,
        index: i,
      }));
    }
  }, [warframe?.abilities]);

  const dbAbilities = warframeAbilities?.items ?? [];
  const helminthAbilities = helminthData?.items ?? [];

  const selectedReplacement = helminthConfig
    ? (helminthAbilities.find(
        (a) => a.unique_name === helminthConfig.replacement_ability_unique_name,
      ) ?? null)
    : null;

  return {
    ownAbilities,
    dbAbilities,
    helminthAbilities,
    selectedReplacement,
  };
}

export function getShareAbilityDbIcon(
  ability: ParsedShareAbility,
  dbAbilities: Ability[],
): string | undefined {
  if (!ability.unique_name) return undefined;
  const dbAb = dbAbilities.find((a) => a.unique_name === ability.unique_name);
  if (dbAb?.image_path) return `/images${dbAb.image_path}`;
  return undefined;
}
