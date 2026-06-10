import { describe, expect, it } from 'vitest';

import type { Mod, ModSlot } from '../../types/warframe';
import { canPlaceModInSlot, findEmptySlotForMod } from '../modPlacement';

const exilusMod = {
  unique_name: '/Lotus/Upgrades/Mods/Warframe/Utility/EnemyRadar',
  name: 'Enemy Radar',
  is_utility: 1,
  type: 'WARFRAME',
} as Mod;

const auraMod = {
  unique_name: '/Lotus/Upgrades/Mods/Warframe/Aura/SteelCharge',
  name: 'Steel Charge',
  type: 'AURA',
} as Mod;

const slots: ModSlot[] = [
  { index: 0, type: 'aura' },
  { index: 1, type: 'exilus' },
  { index: 2, type: 'general' },
  { index: 3, type: 'general' },
];

describe('canPlaceModInSlot', () => {
  it('allows exilus mods in general slots', () => {
    expect(canPlaceModInSlot(exilusMod, 'general')).toBe(true);
  });

  it('still restricts exilus mods to utility mods in the exilus slot', () => {
    expect(canPlaceModInSlot(exilusMod, 'exilus')).toBe(true);
    expect(canPlaceModInSlot(auraMod, 'exilus')).toBe(false);
  });
});

describe('findEmptySlotForMod', () => {
  it('places exilus mods in the active general slot when selected', () => {
    const target = findEmptySlotForMod(slots, exilusMod, { activeSlotType: 'general' });
    expect(target?.index).toBe(2);
  });

  it('prefers the exilus slot but falls back to general when exilus is occupied', () => {
    const occupied = slots.map((slot) => (slot.type === 'exilus' ? { ...slot, mod: exilusMod } : slot));
    const target = findEmptySlotForMod(occupied, exilusMod);
    expect(target?.type).toBe('general');
  });
});
