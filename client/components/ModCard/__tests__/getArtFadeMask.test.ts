import { describe, expect, it } from 'vitest';

import { getArtFadeMask, getArtFadeMaskForImage } from '../cardLayout';

describe('getArtFadeMask', () => {
  it('fades the last pixels relative to the art clip container', () => {
    expect(getArtFadeMask(1.5)).toBe('linear-gradient(to bottom, black calc(100% - 15px), transparent 100%)');
  });

  it('aligns image fade with the clip bottom when art is clipped', () => {
    expect(getArtFadeMaskForImage(1.5, 212, 184)).toBe('linear-gradient(to bottom, black 79.72%, transparent 86.79%)');
  });
});
