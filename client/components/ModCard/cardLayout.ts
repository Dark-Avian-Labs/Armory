export const RARITIES = [
  'Empty',
  'Common',
  'Uncommon',
  'Rare',
  'Legendary',
  'Amalgam',
  'Galvanized',
  'Archon',
  'Riven',
] as const;

export const SLOT_ICONS = ['', 'aura', 'stance', 'exilus'] as const;
export type SlotIcon = (typeof SLOT_ICONS)[number];
export type Rarity = (typeof RARITIES)[number];
export const ARCANE_RARITIES = [
  'common',
  'uncommon',
  'rare',
  'legendary',
  'empty',
] as const;
export type ArcaneRarity = (typeof ARCANE_RARITIES)[number];

export const DAMAGE_COLORS: Record<string, string> = {
  none: 'transparent',
  base: 'var(--color-dmg-true)',
  impact: 'var(--color-dmg-impact)',
  puncture: 'var(--color-dmg-puncture)',
  slash: 'var(--color-dmg-slash)',
  heat: 'var(--color-dmg-heat)',
  cold: 'var(--color-dmg-cold)',
  electricity: 'var(--color-dmg-electricity)',
  toxin: 'var(--color-dmg-toxin)',
  blast: 'var(--color-dmg-blast)',
  radiation: 'var(--color-dmg-radiation)',
  gas: 'var(--color-dmg-gas)',
  magnetic: 'var(--color-dmg-magnetic)',
  viral: 'var(--color-dmg-viral)',
  corrosive: 'var(--color-dmg-corrosive)',
  void: 'var(--color-dmg-void)',
};

export function getRarityBorderColor(rarity: Rarity): string {
  switch (rarity) {
    case 'Common':
      return 'var(--color-rarity-common)';
    case 'Uncommon':
      return 'var(--color-rarity-uncommon)';
    case 'Rare':
      return 'var(--color-rarity-rare)';
    case 'Legendary':
      return 'var(--color-rarity-legendary)';
    case 'Amalgam':
      return 'var(--color-rarity-peculiar)';
    case 'Galvanized':
      return 'var(--color-rarity-legendary)';
    case 'Archon':
      return 'var(--color-warning)';
    case 'Riven':
      return 'var(--color-riven)';
    case 'Empty':
      return 'var(--color-unavailable)';
    default:
      return 'var(--color-muted)';
  }
}

export function getModAsset(
  rarity: Rarity,
  part: string,
  modSet?: string,
): string {
  if (modSet && part === 'FrameTop') {
    const setFolder = modSet.split('/').pop();
    if (setFolder) return `/icons/mods/sets/${setFolder}/${rarity}FrameTop.png`;
  }
  if (
    rarity === 'Galvanized' &&
    ['Background', 'SideLight', 'LowerTab'].includes(part)
  ) {
    return `/icons/mods/Legendary${part}.png`;
  }
  return `/icons/mods/${rarity}${part}.png`;
}

export function dbRarityToCardRarity(
  dbRarity?: string,
  modName?: string,
): Rarity {
  if (modName && isArchonMod(modName)) return 'Archon';
  if (modName && isGalvanizedMod(modName)) return 'Galvanized';
  if (modName && isAmalgamMod(modName)) return 'Amalgam';
  switch (dbRarity?.toUpperCase()) {
    case 'COMMON':
      return 'Common';
    case 'UNCOMMON':
      return 'Uncommon';
    case 'RARE':
      return 'Rare';
    case 'LEGENDARY':
      return 'Legendary';
    default:
      return 'Common';
  }
}

export function isArchonMod(nameOrUniqueName: string): boolean {
  return (
    nameOrUniqueName.startsWith('Archon ') ||
    nameOrUniqueName.includes('/Archon/')
  );
}

export function isGalvanizedMod(nameOrUniqueName: string): boolean {
  return (
    nameOrUniqueName.startsWith('Galvanized ') ||
    nameOrUniqueName.includes('/Galvanized/')
  );
}

export function isAmalgamMod(nameOrUniqueName: string): boolean {
  return (
    nameOrUniqueName.startsWith('Amalgam ') ||
    nameOrUniqueName.includes('/Amalgam/')
  );
}

export function dbPolarityToIconName(dbPolarity?: string): string {
  switch (dbPolarity) {
    case 'AP_ATTACK':
      return 'madurai';
    case 'AP_DEFENSE':
      return 'vazarin';
    case 'AP_TACTIC':
      return 'naramon';
    case 'AP_WARD':
      return 'unairu';
    case 'AP_POWER':
      return 'zenurik';
    case 'AP_PRECEPT':
      return 'penjaga';
    case 'AP_UMBRA':
      return 'umbra';
    case 'AP_ANY':
      return 'universal';
    default:
      return '';
  }
}

export interface CardLayout {
  cardWidth: number;
  cardHeight: number;
  collapsedHeight: number;
  cardOffsetY: number;

  bgOffsetX: number;
  bgOffsetY: number;
  bgWidth: number;
  bgHeight: number;

  artOffsetX: number;
  artOffsetY: number;
  artWidth: number;
  artHeight: number;

  frameTopOffsetX: number;
  frameTopOffsetY: number;
  frameTopWidth: number;
  frameTopHeight: number;

  frameBotOffsetX: number;
  frameBotOffsetY: number;
  frameBotWidth: number;
  frameBotHeight: number;

  sideLeftOffsetX: number;
  sideLeftOffsetY: number;
  sideLeftWidth: number;
  sideLeftHeight: number;

  lowerTabOffsetX: number;
  lowerTabOffsetY: number;
  lowerTabWidth: number;
  lowerTabHeight: number;

  polarityOffsetX: number;
  polarityOffsetY: number;
  polaritySize: number;

  slotIconOffsetY: number;
  slotIconSize: number;

  contentAreaY: number;

  textPaddingX: number;
  nameOffsetY: number;
  nameFontSize: number;

  descOffsetY: number;
  descFontSize: number;

  typeFontSize: number;

  rankOffsetY: number;
  rankStarSize: number;
  rankStarGap: number;

  drainOffsetX: number;
  drainOffsetY: number;
  drainBadgeWidth: number;
  drainBadgeHeight: number;

  drainTextOffsetX: number;
  drainTextOffsetY: number;
  drainFontSize: number;

  damageBadgeOffsetX: number;
  damageBadgeOffsetY: number;
  damageBadgeWidth: number;
  damageBadgeHeight: number;
  damageBadgeFontSize: number;

  collapsedArtHeight: number;
  collapsedFrameBotOffsetY: number;
  collapsedFrameBotHeight: number;
  collapsedNameOffsetY: number;
  collapsedNameFontSize: number;
  collapsedRankOffsetY: number;
  collapsedRankStarSize: number;

  scale: number;
}

export interface ArcaneCardLayout {
  cardWidth: number;
  cardHeight: number;
  collapsedHeight: number;
  cardOffsetY: number;

  bgOffsetX: number;
  bgOffsetY: number;
  bgWidth: number;
  bgHeight: number;

  artOffsetX: number;
  artOffsetY: number;
  artWidth: number;
  artHeight: number;

  textPaddingX: number;
  nameOffsetY: number;
  nameFontSize: number;

  diamondOffsetY: number;
  diamondSize: number;
  diamondGap: number;

  collapsedArtHeight: number;
  collapsedNameOffsetY: number;
  collapsedNameFontSize: number;
  collapsedDiamondOffsetY: number;
  collapsedDiamondSize: number;

  scale: number;
}

export const DEFAULT_ARCANE_LAYOUT: ArcaneCardLayout = {
  cardWidth: 256,
  cardHeight: 120,
  collapsedHeight: 110,
  cardOffsetY: -72,

  bgOffsetX: 0,
  bgOffsetY: 0,
  bgWidth: 256,
  bgHeight: 256,

  artOffsetX: 90,
  artOffsetY: 90,
  artWidth: 76,
  artHeight: 76,

  textPaddingX: 20,
  nameOffsetY: 135,
  nameFontSize: 14,

  diamondOffsetY: 170,
  diamondSize: 14,
  diamondGap: 4,

  collapsedArtHeight: 60,
  collapsedNameOffsetY: 70,
  collapsedNameFontSize: 14,
  collapsedDiamondOffsetY: 92,
  collapsedDiamondSize: 10,

  scale: 1.5,
};

export function normalizeArcaneRarity(rarity?: string): ArcaneRarity {
  const map: Record<string, ArcaneRarity> = {
    COMMON: 'common',
    UNCOMMON: 'uncommon',
    RARE: 'rare',
    LEGENDARY: 'legendary',
    EMPTY: 'empty',
  };
  return map[(rarity || '').toUpperCase()] ?? 'empty';
}

export function mapRarityToArcaneRarity(rarity: Rarity): ArcaneRarity {
  const map: Record<Rarity, ArcaneRarity> = {
    Empty: 'empty',
    Common: 'common',
    Uncommon: 'uncommon',
    Rare: 'rare',
    Legendary: 'legendary',
    Amalgam: 'legendary',
    Galvanized: 'legendary',
    Archon: 'legendary',
    Riven: 'legendary',
  };
  const _exhaustiveCheck: Record<Rarity, ArcaneRarity> = map;
  return _exhaustiveCheck[rarity];
}

export function getArcaneAsset(rarity?: string | ArcaneRarity): string {
  const key = normalizeArcaneRarity(rarity);
  return `/icons/arcane/${key}.png`;
}

export const DEFAULT_LAYOUT: CardLayout = {
  cardWidth: 256,
  cardHeight: 346,
  collapsedHeight: 116,
  cardOffsetY: -58,

  bgOffsetX: 0,
  bgOffsetY: 0,
  bgWidth: 228,
  bgHeight: 460,

  artOffsetX: 22,
  artOffsetY: 78,
  artWidth: 212,
  artHeight: 212,

  frameTopOffsetX: 0,
  frameTopOffsetY: 54,
  frameTopWidth: 256,
  frameTopHeight: 116,

  frameBotOffsetX: 0,
  frameBotOffsetY: 290,
  frameBotWidth: 256,
  frameBotHeight: 116,

  sideLeftOffsetX: 16,
  sideLeftOffsetY: 90,
  sideLeftWidth: 16,
  sideLeftHeight: 256,

  lowerTabOffsetX: 0,
  lowerTabOffsetY: 345,
  lowerTabWidth: 180,
  lowerTabHeight: 20,

  polarityOffsetX: 217,
  polarityOffsetY: 87,
  polaritySize: 14,

  slotIconOffsetY: 80,
  slotIconSize: 32,

  contentAreaY: 262,

  textPaddingX: 30,
  nameOffsetY: 286,
  nameFontSize: 18,

  descOffsetY: 340,
  descFontSize: 14,

  typeFontSize: 12,

  rankOffsetY: 386,
  rankStarSize: 8,
  rankStarGap: 1,

  drainOffsetX: 176,
  drainOffsetY: 82,
  drainBadgeWidth: 70,
  drainBadgeHeight: 24,

  drainTextOffsetX: 197,
  drainTextOffsetY: 86,
  drainFontSize: 14,

  damageBadgeOffsetX: 26,
  damageBadgeOffsetY: 82,
  damageBadgeWidth: 60,
  damageBadgeHeight: 24,
  damageBadgeFontSize: 12,

  collapsedArtHeight: 78,
  collapsedFrameBotOffsetY: 96,
  collapsedFrameBotHeight: 80,
  collapsedNameOffsetY: 107,
  collapsedNameFontSize: 20,
  collapsedRankOffsetY: 160,
  collapsedRankStarSize: 8,

  scale: 1.5,
};
