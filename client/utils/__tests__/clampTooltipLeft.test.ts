import { describe, expect, it } from 'vitest';

import { clampTooltipLeft } from '../clampTooltipLeft';

describe('clampTooltipLeft', () => {
  it('centers the tooltip when there is room', () => {
    expect(clampTooltipLeft(200, 100, 400)).toBe(150);
  });

  it('shifts right when the centered tooltip would overflow the left edge', () => {
    expect(clampTooltipLeft(20, 100, 400)).toBe(8);
  });

  it('shifts left when the centered tooltip would overflow the right edge', () => {
    expect(clampTooltipLeft(380, 100, 400)).toBe(292);
  });
});
