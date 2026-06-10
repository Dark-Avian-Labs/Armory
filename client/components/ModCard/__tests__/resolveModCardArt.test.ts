import { describe, expect, it } from 'vitest';

import { getModCardFoilClass, resolveModCardArt } from '../cardLayout';

describe('resolveModCardArt', () => {
  const mod = {
    image_path: '/Lotus/Upgrades/Mods/example.png',
    atragraph_card_path: '/ArmoryWiki/Atragraph/AnimalInstinct/Card.png',
    foil_overlay_path: '/ArmoryWiki/Atragraph/AnimalInstinct/Overlay.png',
  };

  it('uses atragraph art when enabled and paths exist', () => {
    const resolved = resolveModCardArt(mod, true);
    expect(resolved).toEqual({
      modArt: '/images/ArmoryWiki/Atragraph/AnimalInstinct/Card.png',
      modArtOverlay: '/images/ArmoryWiki/Atragraph/AnimalInstinct/Overlay.png',
      holoFoil: true,
    });
  });

  it('uses the holo foil layer for atragraph cards', () => {
    expect(getModCardFoilClass('/images/ArmoryWiki/Atragraph/AnimalInstinct/Overlay.png')).toBe(
      'mod-card-foil mod-card-foil--holo',
    );
    expect(getModCardFoilClass(undefined)).toBe('mod-card-foil');
  });

  it('falls back to default art when atragraph mods are disabled', () => {
    const resolved = resolveModCardArt(mod, false);
    expect(resolved).toEqual({
      modArt: '/images/Lotus/Upgrades/Mods/example.png',
      modArtOverlay: undefined,
      holoFoil: false,
    });
  });
});
