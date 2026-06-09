import { describe, expect, it } from 'vitest';

import { AP_ANY, AP_ATTACK, AP_DEFENSE, AP_UMBRA } from '../../types/warframe';
import { calculateFormaCount, type SlotPolarity } from '../formaCounter';

function slots(...entries: SlotPolarity[]): SlotPolarity[] {
  return entries;
}

describe('calculateFormaCount', () => {
  it('counts stance AP_ATTACK -> AP_DEFENSE as regular +1', () => {
    const defaults = slots({ type: 'stance', polarity: AP_ATTACK });
    const desired = slots({ type: 'stance', polarity: AP_DEFENSE });

    expect(calculateFormaCount(defaults, desired)).toEqual({
      regular: 1,
      universal: 0,
      umbra: 0,
      stance: 0,
      total: 1,
    });
  });

  it('counts stance -> AP_ANY as stance +1', () => {
    const defaults = slots({ type: 'stance', polarity: undefined });
    const desired = slots({ type: 'stance', polarity: AP_ANY });

    expect(calculateFormaCount(defaults, desired)).toEqual({
      regular: 0,
      universal: 0,
      umbra: 0,
      stance: 1,
      total: 1,
    });
  });

  it('does not let other slots reuse a polarity freed from an intrinsic stance slot', () => {
    const defaults = slots({ type: 'stance', polarity: AP_ATTACK }, { type: 'general', polarity: undefined });
    const desired = slots({ type: 'stance', polarity: AP_DEFENSE }, { type: 'general', polarity: AP_ATTACK });

    expect(calculateFormaCount(defaults, desired)).toEqual({
      regular: 2,
      universal: 0,
      umbra: 0,
      stance: 0,
      total: 2,
    });
  });

  it('lets normal slots reuse a polarity freed from another normal slot, but not stance', () => {
    const defaults = slots(
      { type: 'general', polarity: AP_ATTACK },
      { type: 'general', polarity: undefined },
      { type: 'stance', polarity: undefined },
    );
    const desired = slots(
      { type: 'general', polarity: AP_DEFENSE },
      { type: 'general', polarity: AP_ATTACK },
      { type: 'stance', polarity: AP_ATTACK },
    );

    expect(calculateFormaCount(defaults, desired)).toEqual({
      regular: 2,
      universal: 0,
      umbra: 0,
      stance: 0,
      total: 2,
    });
  });

  it('counts normal slot -> AP_ANY as universal +1', () => {
    const defaults = slots({ type: 'general', polarity: undefined });
    const desired = slots({ type: 'general', polarity: AP_ANY });

    expect(calculateFormaCount(defaults, desired)).toEqual({
      regular: 0,
      universal: 1,
      umbra: 0,
      stance: 0,
      total: 1,
    });
  });

  it('counts stance AP_ATTACK -> AP_ANY as stance +1', () => {
    const defaults = slots({ type: 'stance', polarity: AP_ATTACK });
    const desired = slots({ type: 'stance', polarity: AP_ANY });

    expect(calculateFormaCount(defaults, desired)).toEqual({
      regular: 0,
      universal: 0,
      umbra: 0,
      stance: 1,
      total: 1,
    });
  });

  it('lets aura slots reuse polarities like other normal slots', () => {
    const defaults = slots({ type: 'aura', polarity: AP_ATTACK }, { type: 'general', polarity: undefined });
    const desired = slots({ type: 'aura', polarity: AP_DEFENSE }, { type: 'general', polarity: AP_ATTACK });

    expect(calculateFormaCount(defaults, desired)).toEqual({
      regular: 1,
      universal: 0,
      umbra: 0,
      stance: 0,
      total: 1,
    });
  });

  it('counts aura -> AP_ANY as universal +1', () => {
    const defaults = slots({ type: 'aura', polarity: undefined });
    const desired = slots({ type: 'aura', polarity: AP_ANY });

    expect(calculateFormaCount(defaults, desired)).toEqual({
      regular: 0,
      universal: 1,
      umbra: 0,
      stance: 0,
      total: 1,
    });
  });

  it('ignores posture slot polarity changes', () => {
    const defaults = slots({ type: 'posture', polarity: AP_ATTACK });
    const desired = slots({ type: 'posture', polarity: AP_DEFENSE });

    expect(calculateFormaCount(defaults, desired)).toEqual({
      regular: 0,
      universal: 0,
      umbra: 0,
      stance: 0,
      total: 0,
    });
  });

  it('counts umbra only on warframe general slots', () => {
    const defaults = slots({ type: 'general', polarity: undefined });
    const desired = slots({ type: 'general', polarity: AP_UMBRA });

    expect(calculateFormaCount(defaults, desired, { equipmentType: 'warframe' })).toEqual({
      regular: 0,
      universal: 0,
      umbra: 1,
      stance: 0,
      total: 1,
    });
  });

  it('counts umbra on melee general slots when the weapon has a stance slot', () => {
    const defaults = slots({ type: 'general', polarity: undefined });
    const desired = slots({ type: 'general', polarity: AP_UMBRA });

    expect(calculateFormaCount(defaults, desired, { equipmentType: 'melee' })).toEqual({
      regular: 0,
      universal: 0,
      umbra: 1,
      stance: 0,
      total: 1,
    });
  });

  it('counts umbra on exalted melee general slots by equipment name', () => {
    const defaults = slots({ type: 'general', polarity: undefined });
    const desired = slots({ type: 'general', polarity: AP_UMBRA });

    expect(
      calculateFormaCount(defaults, desired, {
        equipmentType: 'melee',
        equipmentName: 'Exalted Umbra Blade',
      }),
    ).toEqual({
      regular: 0,
      universal: 0,
      umbra: 1,
      stance: 0,
      total: 1,
    });
  });

  it('does not count umbra on exalted ranged weapons', () => {
    const defaults = slots({ type: 'general', polarity: undefined });
    const desired = slots({ type: 'general', polarity: AP_UMBRA });

    expect(
      calculateFormaCount(defaults, desired, {
        equipmentType: 'primary',
        equipmentName: 'Artemis Bow',
      }),
    ).toEqual({
      regular: 0,
      universal: 0,
      umbra: 0,
      stance: 0,
      total: 0,
    });
  });

  it('does not count umbra on primary weapons without a stance slot', () => {
    const defaults = slots({ type: 'general', polarity: undefined });
    const desired = slots({ type: 'general', polarity: AP_UMBRA });

    expect(calculateFormaCount(defaults, desired, { equipmentType: 'primary' })).toEqual({
      regular: 0,
      universal: 0,
      umbra: 0,
      stance: 0,
      total: 0,
    });
  });

  it('lets umbra swap between eligible general slots', () => {
    const defaults = slots({ type: 'general', polarity: AP_UMBRA }, { type: 'general', polarity: undefined });
    const desired = slots({ type: 'general', polarity: undefined }, { type: 'general', polarity: AP_UMBRA });

    expect(calculateFormaCount(defaults, desired, { equipmentType: 'warframe' })).toEqual({
      regular: 0,
      universal: 0,
      umbra: 0,
      stance: 0,
      total: 0,
    });
  });
});
