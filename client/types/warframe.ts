export interface Warframe {
  unique_name: string;
  name: string;
  description?: string;
  health?: number;
  shield?: number;
  armor?: number;
  power?: number;
  sprint_speed?: number;
  passive_description?: string;
  passive_description_wiki?: string;
  product_category?: string;
  abilities?: string;
  aura_polarity?: string;
  exilus_polarity?: string;
  polarities?: string;
  mastery_req: number;
  image_path?: string;
  artifact_slots?: string;
}

export interface Weapon {
  unique_name: string;
  name: string;
  description?: string;
  product_category?: string;
  slot?: number;
  mastery_req: number;
  total_damage?: number;
  damage_per_shot?: string;
  critical_chance?: number;
  critical_multiplier?: number;
  proc_chance?: number;
  fire_rate?: number;
  accuracy?: number;
  magazine_size?: number;
  reload_time?: number;
  multishot?: number;
  noise?: string;
  trigger_type?: string;
  omega_attenuation?: number;
  riven_disposition?: number;
  sentinel?: number;
  blocking_angle?: number;
  combo_duration?: number;
  follow_through?: number;
  range?: number;
  slam_attack?: number;
  heavy_attack_damage?: number;
  wind_up?: number;
  image_path?: string;
  artifact_slots?: string;
  fire_behaviors?: string;
}

export interface Companion {
  unique_name: string;
  name: string;
  description?: string;
  health?: number;
  shield?: number;
  armor?: number;
  power?: number;
  product_category?: string;
  mastery_req: number;
  image_path?: string;
  artifact_slots?: string;
}

export type ModRarity = 'COMMON' | 'UNCOMMON' | 'RARE' | 'LEGENDARY';

export interface Mod {
  unique_name: string;
  name: string;
  polarity?: string;
  rarity?: ModRarity;
  type?: string;
  compat_name?: string;
  base_drain?: number;
  fusion_limit?: number;
  is_utility?: number;
  is_augment?: number;
  subtype?: string;
  description?: string;
  image_path?: string;
  mod_set?: string;
  set_num_in_set?: number;
  set_stats?: string;
}

export type RivenWeaponType = 'primary' | 'secondary' | 'melee' | 'archgun';

export interface RivenStat {
  stat: string;
  value: number;
  isNegative: boolean;
}

export interface RivenConfig {
  polarity?: 'AP_ATTACK' | 'AP_TACTIC' | 'AP_DEFENSE';
  positive: RivenStat[];
  negative?: RivenStat;
}

export interface ModLevelStat {
  mod_unique_name: string;
  rank: number;
  stats: string;
}

export interface ModSet {
  unique_name: string;
  num_in_set?: number;
  stats?: string;
}

export interface Ability {
  unique_name: string;
  name: string;
  description?: string;
  warframe_unique_name?: string;
  is_helminth_extractable?: number;
  image_path?: string;
  wiki_stats?: string;
  energy_cost?: number;
}

export type EquipmentType =
  | 'warframe'
  | 'primary'
  | 'secondary'
  | 'melee'
  | 'archgun'
  | 'archmelee'
  | 'companion'
  | 'beast_claws'
  | 'archwing'
  | 'necramech'
  | 'kdrive'
  | 'tektolyst';

export type SlotType = 'general' | 'aura' | 'stance' | 'exilus' | 'posture';

export interface ModSlot {
  index: number;
  type: SlotType;
  polarity?: string;
  mod?: Mod;
  rank?: number;
  setRank?: number;
  riven_config?: RivenConfig;
  riven_art_path?: string;
}

export interface BuildConfig {
  id?: string;
  name: string;
  equipment_type: EquipmentType;
  equipment_unique_name: string;
  slots: ModSlot[];
  helminth?: {
    replaced_ability_index: number;
    replacement_ability_unique_name: string;
  };
  arcaneSlots?: {
    arcane?: {
      unique_name: string;
      name: string;
      rarity?: string;
      image_path?: string;
      level_stats?: string;
    };
    rank: number;
  }[];
  shardSlots?: {
    shard_type_id?: string | number;
    buff_id?: string | number;
    tauforged: boolean;
  }[];
  orokinReactor?: boolean;
}

export interface StoredBuild extends BuildConfig {
  id: string;
  equipment_name: string;
  equipment_image?: string;
  created_at: string;
  updated_at: string;
}

export const EQUIPMENT_TYPE_LABELS: Record<EquipmentType, string> = {
  warframe: 'Warframes',
  primary: 'Primary',
  secondary: 'Secondary',
  melee: 'Melee',
  archgun: 'Arch-Gun',
  archmelee: 'Arch-Melee',
  companion: 'Companion',
  beast_claws: 'Beast Claws',
  archwing: 'Archwing',
  necramech: 'Necramech',
  kdrive: 'K-Drive',
  tektolyst: 'Tektolyst',
};

export const EQUIPMENT_TYPE_ORDER: EquipmentType[] = [
  'warframe',
  'primary',
  'secondary',
  'melee',
  'companion',
  'beast_claws',
  'archwing',
  'archgun',
  'archmelee',
  'necramech',
  'kdrive',
  'tektolyst',
];

export const POLARITIES = {
  AP_ATTACK: 'Madurai',
  AP_DEFENSE: 'Vazarin',
  AP_TACTIC: 'Naramon',
  AP_WARD: 'Unairu',
  AP_POWER: 'Zenurik',
  AP_PRECEPT: 'Penjaga',
  AP_UMBRA: 'Umbra',
  AP_ANY: 'Aura',
} as const;

export type PolarityKey = keyof typeof POLARITIES;

export const AP_ATTACK = 'AP_ATTACK' as const;
export const AP_DEFENSE = 'AP_DEFENSE' as const;
export const AP_TACTIC = 'AP_TACTIC' as const;
export const AP_WARD = 'AP_WARD' as const;
export const AP_POWER = 'AP_POWER' as const;
export const AP_PRECEPT = 'AP_PRECEPT' as const;
export const AP_UMBRA = 'AP_UMBRA' as const;
export const AP_ANY = 'AP_ANY' as const;

export const REGULAR_POLARITIES: readonly string[] = [
  AP_ATTACK,
  AP_DEFENSE,
  AP_TACTIC,
  AP_WARD,
  AP_POWER,
  AP_PRECEPT,
];

export const DAMAGE_TYPES = [
  'Impact',
  'Puncture',
  'Slash',
  'Heat',
  'Cold',
  'Electricity',
  'Toxin',
  'Blast',
  'Radiation',
  'Gas',
  'Magnetic',
  'Viral',
  'Corrosive',
  'Void',
  'Tau',
  'Cinematic',
  'ShieldDrain',
  'HealthDrain',
  'EnergyDrain',
  'True',
] as const;

export type DamageType = (typeof DAMAGE_TYPES)[number];

export const PRIMARY_ELEMENTS = [
  'Heat',
  'Cold',
  'Electricity',
  'Toxin',
] as const;
export type PrimaryElement = (typeof PRIMARY_ELEMENTS)[number];

export const ELEMENT_COMBINATIONS: Record<
  string,
  { a: PrimaryElement; b: PrimaryElement }
> = {
  Blast: { a: 'Heat', b: 'Cold' },
  Corrosive: { a: 'Electricity', b: 'Toxin' },
  Gas: { a: 'Heat', b: 'Toxin' },
  Magnetic: { a: 'Cold', b: 'Electricity' },
  Radiation: { a: 'Electricity', b: 'Heat' },
  Viral: { a: 'Cold', b: 'Toxin' },
};

export const ELEMENT_PRIORITY: PrimaryElement[] = [
  'Heat',
  'Cold',
  'Electricity',
  'Toxin',
];

export interface EquipmentSlotConfig {
  generalSlots: number;
  hasAura: boolean;
  hasStance: boolean;
  hasExilus: boolean;
  hasPosture: boolean;
  hasSecondAura: boolean;
}

export const EQUIPMENT_SLOT_CONFIGS: Record<
  EquipmentType,
  EquipmentSlotConfig
> = {
  warframe: {
    generalSlots: 8,
    hasAura: true,
    hasStance: false,
    hasExilus: true,
    hasPosture: false,
    hasSecondAura: false,
  },
  primary: {
    generalSlots: 8,
    hasAura: false,
    hasStance: false,
    hasExilus: true,
    hasPosture: false,
    hasSecondAura: false,
  },
  secondary: {
    generalSlots: 8,
    hasAura: false,
    hasStance: false,
    hasExilus: true,
    hasPosture: false,
    hasSecondAura: false,
  },
  melee: {
    generalSlots: 8,
    hasAura: false,
    hasStance: true,
    hasExilus: true,
    hasPosture: false,
    hasSecondAura: false,
  },
  archgun: {
    generalSlots: 8,
    hasAura: false,
    hasStance: false,
    hasExilus: false,
    hasPosture: false,
    hasSecondAura: false,
  },
  archmelee: {
    generalSlots: 8,
    hasAura: false,
    hasStance: false,
    hasExilus: false,
    hasPosture: false,
    hasSecondAura: false,
  },
  companion: {
    generalSlots: 10,
    hasAura: false,
    hasStance: false,
    hasExilus: false,
    hasPosture: false,
    hasSecondAura: false,
  },
  beast_claws: {
    generalSlots: 8,
    hasAura: false,
    hasStance: false,
    hasExilus: false,
    hasPosture: true,
    hasSecondAura: false,
  },
  archwing: {
    generalSlots: 8,
    hasAura: false,
    hasStance: false,
    hasExilus: false,
    hasPosture: false,
    hasSecondAura: false,
  },
  necramech: {
    generalSlots: 12,
    hasAura: false,
    hasStance: false,
    hasExilus: false,
    hasPosture: false,
    hasSecondAura: false,
  },
  kdrive: {
    generalSlots: 8,
    hasAura: false,
    hasStance: false,
    hasExilus: false,
    hasPosture: false,
    hasSecondAura: false,
  },
  tektolyst: {
    generalSlots: 5,
    hasAura: false,
    hasStance: false,
    hasExilus: false,
    hasPosture: false,
    hasSecondAura: false,
  },
};
