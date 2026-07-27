import { describe, it, expect } from 'vitest';

import { isAvatarStatsEquipmentType } from '../equipmentKind';

describe('isAvatarStatsEquipmentType', () => {
  it('treats warframe and companion as avatar stats equipment', () => {
    expect(isAvatarStatsEquipmentType('warframe')).toBe(true);
    expect(isAvatarStatsEquipmentType('companion')).toBe(true);
  });

  it('does not treat weapons or companion weapons as avatar stats', () => {
    expect(isAvatarStatsEquipmentType('primary')).toBe(false);
    expect(isAvatarStatsEquipmentType('secondary')).toBe(false);
    expect(isAvatarStatsEquipmentType('melee')).toBe(false);
    expect(isAvatarStatsEquipmentType('beast_claws')).toBe(false);
    expect(isAvatarStatsEquipmentType('archgun')).toBe(false);
  });
});
