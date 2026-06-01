import { describe, expect, it } from 'vitest';

import { buildAbilityKey } from './abilitySlugRegistry.js';
import { buildArchonShardKey } from './archonShardRegistry.js';
import { resolveHelminthFromConfig, resolveArchonShardKey } from './buildReference.js';

const TITANIA_ABILITIES = [
  { abilityName: 'Spellbind', abilityUniqueName: '/Lotus/Powersuits/Fairy/FairySoulAbility' },
  { abilityName: 'Tribute', abilityUniqueName: '/Lotus/Powersuits/Fairy/FairyDustAbility' },
  { abilityName: 'Lantern', abilityUniqueName: '/Lotus/Powersuits/Fairy/FairyLightAbility' },
  { abilityName: 'Razorwing', abilityUniqueName: '/Lotus/Powersuits/Fairy/FairyFlightAbility' },
];

describe('buildReference', () => {
  describe('resolveHelminthFromConfig', () => {
    it('resolves Titania AoE v1 helminth to stable Armory keys', () => {
      const resolved = resolveHelminthFromConfig(
        {
          replaced_ability_index: 2,
          replacement_ability_unique_name: '/Lotus/Powersuits/PowersuitAbilities/BrokenRotAbility',
        },
        TITANIA_ABILITIES,
      );
      expect(resolved).not.toBeNull();
      expect(resolved?.replacement_ability_key).toBe('/Armory/Helminth/XatasWhisper');
      expect(resolved?.replaced_ability_key).toBe(buildAbilityKey('Lantern'));
    });

    it('passes through v2 helminth keys', () => {
      const resolved = resolveHelminthFromConfig(
        {
          replaced_ability_key: buildAbilityKey('Lantern'),
          replacement_ability_key: '/Armory/Helminth/XatasWhisper',
        },
        TITANIA_ABILITIES,
      );
      expect(resolved?.replaced_ability_key).toBe(buildAbilityKey('Lantern'));
      expect(resolved?.replacement_ability_key).toBe('/Armory/Helminth/XatasWhisper');
    });
  });

  describe('resolveArchonShardKey', () => {
    it('returns null for unknown archon color names', () => {
      const key = resolveArchonShardKey(
        { tauforged: false },
        { shardTypeName: 'NotAColor', buffSortOrder: 1, tauforged: false },
      );
      expect(key).toBeNull();
    });

    it('resolves v1 shard slot via catalog lookup', () => {
      const key = resolveArchonShardKey(
        { tauforged: true },
        { shardTypeName: 'Crimson', buffSortOrder: 4, tauforged: true },
      );
      expect(key).toBe(buildArchonShardKey('Crimson', 'Tauforged', 'AbilityStrength'));
    });

    it('accepts v2 armory_shard_key', () => {
      const armoryKey = buildArchonShardKey('Violet', 'Common', 'Equilibrium');
      const key = resolveArchonShardKey({ armory_shard_key: armoryKey });
      expect(key).toBe(armoryKey);
    });
  });
});
