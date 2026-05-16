import type { Rarity, SlotIcon } from '../components/ModCard/cardLayout';

export type SlotTypeName = Exclude<SlotIcon, ''>;

const SLOT_TYPE_NAMES = new Set<string>(['aura', 'stance', 'posture', 'exilus']);

export function isSlotTypeName(value: string): value is SlotTypeName {
  return SLOT_TYPE_NAMES.has(value);
}

export function getSlotIconPath(slotType: SlotTypeName): string {
  return `/icons/slots/${slotType}.svg`;
}

export function getSlotIconRarityColor(rarity: Rarity): string {
  switch (rarity) {
    case 'Common':
      return 'var(--color-rarity-common)';
    case 'Uncommon':
      return 'var(--color-rarity-uncommon)';
    case 'Rare':
      return 'var(--color-rarity-rare)';
    default:
      return 'var(--color-rarity-uncommon)';
  }
}
