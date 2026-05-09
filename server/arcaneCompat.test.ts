import { describe, expect, it } from 'vitest';

import { classifyArcaneCompatTags } from './arcaneCompat.js';

describe('classifyArcaneCompatTags', () => {
  it('tags Longbow Sharpshoot as primary (not generic warframe-only)', () => {
    const tags = classifyArcaneCompatTags(
      '/Lotus/Upgrades/EternalOnes/TheFragmented/TestLongbowSharpshoot',
      'Longbow Sharpshoot',
    );
    expect(tags).toContain('primary');
    expect(tags).not.toContain('warframe');
  });

  it('still tags ordinary Primary prefixed arcanes', () => {
    const tags = classifyArcaneCompatTags('/Lotus/Test', 'Primary Deadhead');
    expect(tags).toContain('primary');
  });
});
