import { useMemo } from 'react';

import type { IncarnonData, IncarnonSelection } from '../../types/incarnon';
import type { Weapon } from '../../types/warframe';
import { getSelectedPerk } from '../../utils/incarnonSelections';
import { parseIncarnonData, weaponHasIncarnon } from '../../utils/incarnonStats';

export interface ShareIncarnonTier {
  tier: number;
  unlocked: boolean;
  perkName: string | null;
  description: string | null;
  imagePath: string | null;
}

export function useWeaponShareIncarnon(
  weapon: Weapon | null,
  incarnonEnabled: boolean,
  incarnonSelections: IncarnonSelection[] | undefined,
): {
  incarnonData: IncarnonData | null;
  tiers: ShareIncarnonTier[];
  showIncarnon: boolean;
} {
  return useMemo(() => {
    if (!weapon || !weaponHasIncarnon(weapon) || !incarnonEnabled) {
      return { incarnonData: null, tiers: [], showIncarnon: false };
    }

    const incarnonData = parseIncarnonData(weapon.incarnon_data);
    if (!incarnonData) {
      return { incarnonData: null, tiers: [], showIncarnon: false };
    }

    const tiers = incarnonData.evolutions.map((evolution) => {
      const selection = incarnonSelections?.find((entry) => entry.tier === evolution.tier);
      const unlocked = selection?.unlocked ?? false;
      const perk = getSelectedPerk(incarnonData, incarnonSelections, evolution.tier);

      return {
        tier: evolution.tier,
        unlocked,
        perkName: perk?.name ?? null,
        description: perk?.description ?? null,
        imagePath: perk?.imagePath ?? null,
      };
    });

    return { incarnonData, tiers, showIncarnon: true };
  }, [weapon, incarnonEnabled, incarnonSelections]);
}
