import { describe, expect, it } from 'vitest';

import {
  getRequiredExaltedStanceName,
  getSpecialItemSelectionType,
  matchesSpecialItemType,
  weaponOmitsExilusSlot,
  weaponOmitsRivenMod,
} from '../specialItems';

describe('specialItems selection mapping', () => {
  it('keeps Artemis Bow variants as primary special items', () => {
    expect(getSpecialItemSelectionType('Artemis Bow', 'primary')).toBe('primary');
    expect(getSpecialItemSelectionType('Artemis Bow Prime', 'primary')).toBe('primary');
    expect(matchesSpecialItemType('Artemis Bow', 'primary')).toBe(true);
  });

  it('keeps exalted pistols as secondary special items', () => {
    expect(getSpecialItemSelectionType('Dex Pixia', 'secondary')).toBe('secondary');
    expect(getSpecialItemSelectionType('Regulators Prime', 'secondary')).toBe('secondary');
  });

  it('keeps exalted melee as melee special items', () => {
    expect(getSpecialItemSelectionType('Exalted Blade', 'melee')).toBe('melee');
    expect(getSpecialItemSelectionType('Iron Staff Prime', 'melee')).toBe('melee');
  });

  it('maps necramech exalted weapons to arch categories', () => {
    expect(getSpecialItemSelectionType('Arquebex', 'necramech')).toBe('archgun');
    expect(getSpecialItemSelectionType('Ironbride', 'necramech')).toBe('archmelee');
  });
});

describe('specialItems slot/riven omissions', () => {
  it('still omits rivens on known special exalted weapons', () => {
    expect(weaponOmitsRivenMod('Artemis Bow', 'primary')).toBe(true);
    expect(weaponOmitsRivenMod('Regulators', 'secondary')).toBe(true);
    expect(weaponOmitsRivenMod('Exalted Blade', 'melee')).toBe(true);
  });

  it('does not omit rivens for regular non-special weapons', () => {
    expect(weaponOmitsRivenMod('Paris', 'primary')).toBe(false);
    expect(weaponOmitsRivenMod('Lex', 'secondary')).toBe(false);
    expect(weaponOmitsRivenMod('Skana', 'melee')).toBe(false);
  });

  it('keeps melee exilus omission rules for specific special items', () => {
    expect(weaponOmitsExilusSlot('Shadow Clones', 'melee')).toBe(true);
    expect(weaponOmitsExilusSlot('Whipclaw', 'melee')).toBe(true);
    expect(weaponOmitsExilusSlot('Exalted Blade', 'melee')).toBe(false);
  });
});

describe('exalted stance requirements', () => {
  it('resolves required stance names for exalted melee', () => {
    expect(getRequiredExaltedStanceName('Exalted Blade')).toBe('Exalted Blade');
    expect(getRequiredExaltedStanceName('Valkyr Prime Talons')).toBe('Hysteria');
    expect(getRequiredExaltedStanceName('Artemis Bow')).toBeNull();
  });
});
