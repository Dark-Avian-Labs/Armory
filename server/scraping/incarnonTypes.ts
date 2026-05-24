import type { IncarnonEvolutionTier } from '../../shared/incarnonTypes.js';

export type {
  IncarnonData,
  IncarnonEvolutionTier,
  IncarnonPerkOption,
  IncarnonStatModifier,
  IncarnonStatName,
} from '../../shared/incarnonTypes.js';

export interface ParsedGenesisPage {
  compatibleWeaponNames: string[];
  weaponColumnNames: string[];
  overview?: string;
  tiers: IncarnonEvolutionTier[];
}

export interface ParsedIntrinsicPage {
  weaponName: string;
  overview?: string;
  tiers: IncarnonEvolutionTier[];
}
