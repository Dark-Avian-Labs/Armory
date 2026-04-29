import { describe, expect, it } from 'vitest';

import type { Mod, ModSlot, RivenConfig } from '../../types/warframe';
import { calculateWeaponDps } from '../damageCalc';
import { mergeModWithCatalog, hydrateSlotsWithModCatalog } from '../modCatalogHydration';
import { parseModEffects, aggregateAllMods } from '../modStatParser';
import { RIVEN_MOD_UNIQUE, getEffectiveRivenDisposition, validateRivenConfig, resolveRivenConfig } from '../riven';
import { parseSetStatsTiers, resolveModRankDescriptionText } from '../umbraSet';

describe('import boundaries & malformed game data', () => {
  describe('parseSetStatsTiers', () => {
    it('returns null for invalid JSON (corrupted DB/import)', () => {
      expect(parseSetStatsTiers('{')).toBeNull();
      expect(parseSetStatsTiers('not json')).toBeNull();
    });

    it('returns null for JSON that is not an array or tier object', () => {
      expect(parseSetStatsTiers(JSON.stringify('oops'))).toBeNull();
      expect(parseSetStatsTiers(JSON.stringify(123))).toBeNull();
    });

    it('filters non-string entries from mixed arrays (partially corrupted import)', () => {
      const raw = JSON.stringify(['+100 Health', 42, null, '+200 Health']);
      const tiers = parseSetStatsTiers(raw);
      expect(tiers).toEqual(['+100 Health', '+200 Health']);
    });
  });

  describe('resolveModRankDescriptionText', () => {
    it('returns empty for empty JSON array (bad export)', () => {
      const mod: Mod = {
        unique_name: '/x',
        name: 'X',
        description: JSON.stringify([]),
        fusion_limit: 5,
      };
      expect(resolveModRankDescriptionText(mod, 0)).toBe('');
    });

    it('falls back to stripping raw text when description is not JSON (legacy / broken row)', () => {
      const mod: Mod = {
        unique_name: '/x',
        name: 'X',
        description: '+55% Damage',
        fusion_limit: 5,
      };
      expect(resolveModRankDescriptionText(mod, 0)).toContain('+55%');
    });
  });

  describe('parseModEffects / aggregateAllMods', () => {
    it('does not throw when description is empty or fusion_limit is inconsistent', () => {
      const emptyDesc: Mod = {
        unique_name: '/x',
        name: 'X',
        description: '',
        fusion_limit: 5,
      };
      expect(() => parseModEffects(emptyDesc, 0)).not.toThrow();
      expect(parseModEffects(emptyDesc, 0).baseDamage).toBe(0);

      const badRank: Mod = {
        unique_name: '/x',
        name: 'X',
        description: JSON.stringify(['+10% Damage']),
        fusion_limit: 0,
      };
      expect(() => parseModEffects(badRank, 99)).not.toThrow();
    });

    it('aggregates without throwing when slots omit rank', () => {
      const slots: ModSlot[] = [
        {
          index: 0,
          type: 'general',
          mod: {
            unique_name: '/m',
            name: 'M',
            description: JSON.stringify(['+100% Health']),
            fusion_limit: 2,
          },
        },
      ];
      expect(() => aggregateAllMods(slots)).not.toThrow();
    });
  });

  describe('calculateWeaponDps', () => {
    it('treats malformed fire_behaviors as default ammo cost (import glitch)', () => {
      const weapon = {
        unique_name: '/w',
        name: 'W',
        mastery_req: 0,
        total_damage: 100,
        critical_chance: 0,
        critical_multiplier: 1,
        proc_chance: 0,
        fire_rate: 1,
        multishot: 1,
        magazine_size: 10,
        reload_time: 0,
        fire_behaviors: '{broken',
      };
      const r = calculateWeaponDps(weapon, []);
      expect(r).toBeDefined();
      expect(r.ammoCost).toBe(1);
    });

    it('handles non-array fire_behaviors JSON without throwing', () => {
      const weapon = {
        unique_name: '/w',
        name: 'W',
        mastery_req: 0,
        total_damage: 50,
        critical_chance: 0,
        critical_multiplier: 1,
        proc_chance: 0,
        fire_rate: 1,
        multishot: 1,
        magazine_size: 10,
        reload_time: 0,
        fire_behaviors: JSON.stringify({ notAnArray: true }),
      };
      expect(() => calculateWeaponDps(weapon, [])).not.toThrow();
    });
  });

  describe('mergeModWithCatalog', () => {
    it('does not merge catalog into a stored Riven mod (user-owned riven wins)', () => {
      const stored: Mod = {
        unique_name: RIVEN_MOD_UNIQUE,
        name: 'Riven Mod',
        description: JSON.stringify(['custom']),
        fusion_limit: 8,
      };
      const catalog: Mod = {
        unique_name: '/lotus/riven',
        name: 'Should not apply',
        description: JSON.stringify(['from catalog']),
        fusion_limit: 8,
      };
      expect(mergeModWithCatalog(stored, catalog)).toBe(stored);
    });

    it('hydrateSlots leaves riven slot unchanged when catalog would overwrite', () => {
      const riven: Mod = {
        unique_name: RIVEN_MOD_UNIQUE,
        name: 'Riven Mod',
        fusion_limit: 8,
      };
      const catalog = new Map<string, Mod>([['/other', { unique_name: '/other', name: 'Other', fusion_limit: 8 }]]);
      const slots = [{ index: 0, type: 'general' as const, mod: riven }];
      const out = hydrateSlotsWithModCatalog(slots, catalog);
      expect(out[0].mod).toBe(riven);
    });
  });

  describe('riven disposition & validation (user / API input)', () => {
    it('getEffectiveRivenDisposition returns null for non-finite engine values', () => {
      expect(getEffectiveRivenDisposition({ omega_attenuation: Number.NaN })).toBeNull();
      expect(getEffectiveRivenDisposition({ riven_disposition: Number.POSITIVE_INFINITY })).toBeNull();
    });

    it('resolveRivenConfig substitutes finite default when disposition is NaN', () => {
      const { config } = resolveRivenConfig(
        {
          polarity: 'AP_ATTACK',
          positive: [
            { stat: 'Damage', value: 50, isNegative: false },
            { stat: 'Multishot', value: 40, isNegative: false },
          ],
        },
        {
          weaponType: 'primary',
          disposition: Number.NaN,
          assumeValuesAreMaxRank: true,
          manualRank: 8,
        },
      );
      expect(config.positive.length).toBe(2);
      for (const s of config.positive) {
        expect(Number.isFinite(s.value)).toBe(true);
      }
    });

    it('clamps out-of-range manual rank when scaling non–max-rank input', () => {
      const { rank } = resolveRivenConfig(
        {
          polarity: 'AP_ATTACK',
          positive: [
            { stat: 'Damage', value: 20, isNegative: false },
            { stat: 'Multishot', value: 15, isNegative: false },
          ],
        },
        {
          weaponType: 'primary',
          disposition: 1,
          assumeValuesAreMaxRank: false,
          manualRank: 900,
        },
      );
      expect(rank).toBe(8);
    });

    it('validateRivenConfig rejects invalid polarity and duplicate stats', () => {
      const badPolarity = {
        polarity: 'AP_FAKE',
        positive: [
          { stat: 'Damage', value: 1, isNegative: false },
          { stat: 'Multishot', value: 1, isNegative: false },
        ],
      } as unknown as RivenConfig;
      expect(validateRivenConfig(badPolarity)).toMatch(/polarity/i);

      expect(
        validateRivenConfig({
          polarity: 'AP_ATTACK',
          positive: [
            { stat: 'Damage', value: 1, isNegative: false },
            { stat: 'Damage', value: 2, isNegative: false },
          ],
        }),
      ).toMatch(/unique/i);
    });
  });
});
