import { describe, expect, it } from 'vitest';

import { pointerToAtragraphHoloTilt } from '../atragraphHolo';

describe('atragraphHolo tilt helpers', () => {
  it('maps pointer coordinates to shader tilt space', () => {
    const tilt = pointerToAtragraphHoloTilt(0.4, 0.35);
    expect(tilt.x).toBeCloseTo(-0.2);
    expect(tilt.y).toBeCloseTo(0.3);
  });
});
