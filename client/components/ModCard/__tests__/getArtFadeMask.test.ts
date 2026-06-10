import { describe, expect, it } from 'vitest';

import { getArtFadeMask } from '../cardLayout';

describe('getArtFadeMask', () => {
  it('fades the last pixels when art is not clipped', () => {
    expect(getArtFadeMask(1.5)).toBe('linear-gradient(to bottom, black calc(100% - 15px), transparent 100%)');
  });

  it('fades at the clipped viewport bottom when art is shorter than the image', () => {
    const mask = getArtFadeMask(1.5, 212, 184);
    expect(mask).toBe('linear-gradient(to bottom, black 79.72%, transparent 86.79%)');
  });
});
