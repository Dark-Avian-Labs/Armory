import { useMemo } from 'react';

import {
  canonicalHelminthReplacementUniqueName,
  resolveHelminthReplacementAbility,
} from '../../shared/helminthAbilityResolve.js';
import type { Ability, BuildConfig } from '../types/warframe';
import { useApi } from './useApi';

export function useHelminthReplacement(helminthConfig: BuildConfig['helminth'] | undefined): {
  helminthAbilities: Ability[];
  selectedReplacement: Ability | null;
  canonicalReplacementUniqueName: string | undefined;
} {
  const { data: helminthData } = useApi<{ items: Ability[] }>(
    helminthConfig ? '/api/helminth-abilities' : null,
  );
  const helminthAbilities = helminthData?.items ?? [];

  const lookupUrl =
    helminthConfig?.replacement_ability_unique_name != null
      ? `/api/abilities?ability_names=${encodeURIComponent(helminthConfig.replacement_ability_unique_name)}`
      : null;
  const { data: lookupData } = useApi<{ items: Ability[] }>(lookupUrl);

  const selectedReplacement = useMemo(() => {
    if (!helminthConfig) return null;
    const pool = [...helminthAbilities, ...(lookupData?.items ?? [])];
    return (
      resolveHelminthReplacementAbility(helminthConfig.replacement_ability_unique_name, pool) ??
      null
    );
  }, [helminthConfig, helminthAbilities, lookupData?.items]);

  const canonicalReplacementUniqueName = useMemo(() => {
    if (!helminthConfig) return undefined;
    const pool = [...helminthAbilities, ...(lookupData?.items ?? [])];
    return canonicalHelminthReplacementUniqueName(
      helminthConfig.replacement_ability_unique_name,
      pool,
    );
  }, [helminthConfig, helminthAbilities, lookupData?.items]);

  return { helminthAbilities, selectedReplacement, canonicalReplacementUniqueName };
}
