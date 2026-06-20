import { describe, expect, it } from 'vitest';

import { getEquipmentModCapacityBase } from '../equipmentCapacity';

describe('getEquipmentModCapacityBase', () => {
  it('uses 40 for necramechs (item rank cap)', () => {
    expect(getEquipmentModCapacityBase('necramech', { name: 'Bonewidow' })).toBe(40);
  });

  it('uses 30 for warframes and archwing', () => {
    expect(getEquipmentModCapacityBase('warframe', { name: 'Excalibur' })).toBe(30);
    expect(getEquipmentModCapacityBase('archwing', { name: 'Itzal' })).toBe(30);
  });

  it('uses weapon rules for guns', () => {
    expect(getEquipmentModCapacityBase('primary', { name: 'Braton' })).toBe(30);
    expect(getEquipmentModCapacityBase('primary', { name: 'Kuva Bramma' })).toBe(40);
  });
});