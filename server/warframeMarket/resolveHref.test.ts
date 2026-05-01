import { describe, expect, it } from 'vitest';

import { resolveMarketHref } from './resolveHref.js';

function setOf(...slugs: string[]): ReadonlySet<string> {
  return new Set(slugs);
}

describe('resolveMarketHref', () => {
  it('prefers bare slug when present', () => {
    const slugs = setOf('prisma_grakata', 'prisma_grakata_blueprint');
    const r = resolveMarketHref('Prisma Grakata', 'Primary Weapons', slugs);
    expect(r.href).toContain('/items/prisma_grakata?');
    expect(r.kind).toBe('item');
  });

  it('falls back to _set then _blueprint when bare missing', () => {
    const slugs = setOf('cedo_set', 'cedo_blueprint');
    const r = resolveMarketHref('Cedo', 'Primary Weapons', slugs);
    expect(r.href).toContain('/items/cedo_set?');
    expect(r.kind).toBe('item');
  });

  it('uses blueprint when set and bare missing', () => {
    const slugs = setOf('quellor_blueprint');
    const r = resolveMarketHref('Quellor', 'Primary Weapons', slugs);
    expect(r.href).toContain('/items/quellor_blueprint?');
    expect(r.kind).toBe('item');
  });

  it('routes Kuva weapons to lich auctions', () => {
    const r = resolveMarketHref('Kuva Ayanga', 'Melee Weapons', new Set());
    expect(r.href).toContain('type=lich');
    expect(r.href).toContain('weapon_url_name=kuva_ayanga');
    expect(r.kind).toBe('lich');
  });

  it('routes non-melee Tenet to sister auctions', () => {
    const r = resolveMarketHref('Tenet Arca Plasmor', 'Primary Weapons', new Set());
    expect(r.href).toContain('type=sister');
    expect(r.href).toContain('weapon_url_name=tenet_arca_plasmor');
    expect(r.kind).toBe('sister');
  });

  it('uses item listings for Tenet melee', () => {
    const slugs = setOf('tenet_plasma_gloves');
    const r = resolveMarketHref('Tenet Plasma Gloves', 'Melee Weapons', slugs);
    expect(r.kind).toBe('item');
    expect(r.href).toContain('/items/tenet_plasma_gloves?');
  });

  it('returns null when no catalog match for normal items', () => {
    const r = resolveMarketHref('Totally Fake Item Xyz', 'Accessories', new Set());
    expect(r.href).toBeNull();
    expect(r.kind).toBeNull();
  });
});
