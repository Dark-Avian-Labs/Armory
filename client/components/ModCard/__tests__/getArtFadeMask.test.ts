import { describe, expect, it } from 'vitest';

import { getArtFadeMask } from '../cardLayout';

describe('getArtFadeMask', () => {
  it('fades the last pixels relative to the art clip container', () => {
    expect(getArtFadeMask(1.5)).toBe('linear-gradient(to bottom, black calc(100% - 15px), transparent 100%)');
  });
});
