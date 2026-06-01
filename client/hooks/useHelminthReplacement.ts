import { useMemo } from 'react';

import {
  helminthReplacementLookupRef,
  isHelminthConfigV2,
  resolveHelminthFromConfig,
} from '../../shared/buildReference.js';
import type { WarframeAbilityRef } from '../../shared/buildReference.js';
import {
  canonicalHelminthReplacementUniqueName,
  resolveHelminthReplacementAbility,
} from '../../shared/helminthAbilityResolve.js';
import { resolveHelminthDePath } from '../../shared/helminthRegistry.js';
import type { Ability, BuildConfig } from '../types/warframe';
import { useApi } from './useApi';

export function useHelminthReplacement(
  helminthConfig: BuildConfig['helminth'] | undefined,
  warframeAbilityRefs: WarframeAbilityRef[] = [],
): {
  helminthAbilities: Ability[];
  selectedReplacement: Ability | null;
  canonicalReplacementUniqueName: string | undefined;
} {
  const { data: helminthData } = useApi<{ items: Ability[] }>(
    helminthConfig ? '/api/helminth-abilities' : null,
  );
  const helminthAbilities = helminthData?.items ?? [];

  const lookupRef = helminthConfig ? helminthReplacementLookupRef(helminthConfig) : null;

  const lookupUrl = useMemo(() => {
    if (!helminthConfig || !lookupRef) return null;
    if (isHelminthConfigV2(helminthConfig)) {
      const dePath = resolveHelminthDePath(lookupRef, helminthAbilities);
      if (dePath) {
        return `/api/abilities?ability_names=${encodeURIComponent(dePath)}`;
      }
      return null;
    }
    return `/api/abilities?ability_names=${encodeURIComponent(lookupRef)}`;
  }, [helminthConfig, lookupRef, helminthAbilities]);

  const { data: lookupData } = useApi<{ items: Ability[] }>(lookupUrl);

  const selectedReplacement = useMemo(() => {
    if (!helminthConfig) return null;
    const pool = [...helminthAbilities, ...(lookupData?.items ?? [])];
    const resolved = resolveHelminthFromConfig(helminthConfig, warframeAbilityRefs, pool);
    const dePath = resolved?.replacement_de_path;
    if (dePath) {
      return resolveHelminthReplacementAbility(dePath, pool) ?? null;
    }
    if (!isHelminthConfigV2(helminthConfig)) {
      return (
        resolveHelminthReplacementAbility(helminthConfig.replacement_ability_unique_name, pool) ??
        null
      );
    }
    return null;
  }, [helminthConfig, helminthAbilities, lookupData?.items, warframeAbilityRefs]);

  const canonicalReplacementUniqueName = useMemo(() => {
    if (!helminthConfig) return undefined;
    const pool = [...helminthAbilities, ...(lookupData?.items ?? [])];
    const resolved = resolveHelminthFromConfig(helminthConfig, warframeAbilityRefs, pool);
    if (resolved?.replacement_de_path) return resolved.replacement_de_path;
    if (!isHelminthConfigV2(helminthConfig)) {
      return canonicalHelminthReplacementUniqueName(
        helminthConfig.replacement_ability_unique_name,
        pool,
      );
    }
    return undefined;
  }, [helminthConfig, helminthAbilities, lookupData?.items, warframeAbilityRefs]);

  return { helminthAbilities, selectedReplacement, canonicalReplacementUniqueName };
}
