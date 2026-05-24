export type {
  IncarnonData,
  IncarnonEvolutionTier,
  IncarnonPerkOption,
  IncarnonStatModifier,
  IncarnonStatName,
} from '../../shared/incarnonTypes';

export interface IncarnonSelection {
  tier: number;
  perkName: string | null;
  unlocked: boolean;
}

export interface IncarnonBuildConfig {
  incarnonEnabled?: boolean;
  incarnonSelections?: IncarnonSelection[];
}
