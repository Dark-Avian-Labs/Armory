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

export const ARTIFACT_SLOT_POLARITIES = new Set<string>([
  'AP_UNIVERSAL',
  'AP_DISABLED',
  ...Object.keys(POLARITIES),
]);
