import { describe, expect, it, vi } from 'vitest';

import { getSiblingAppLinks } from './siblingApps';

describe('getSiblingAppLinks', () => {
  it('returns the default Codex link for Armory', () => {
    vi.stubEnv('VITE_SIBLING_APPS', '');
    expect(getSiblingAppLinks('armory')).toEqual([
      { id: 'codex', label: 'Codex', href: 'https://codex.darkavianlabs.com' },
    ]);
  });

  it('parses configured sibling apps from env', () => {
    vi.stubEnv('VITE_SIBLING_APPS', 'codex|Codex|https://codex.example.test,armory|Armory|https://armory.example.test');
    expect(getSiblingAppLinks('armory')).toEqual([{ id: 'codex', label: 'Codex', href: 'https://codex.example.test' }]);
  });

  it('ignores invalid env entries', () => {
    vi.stubEnv('VITE_SIBLING_APPS', 'bad-entry,codex|Codex|javascript:alert(1)');
    expect(getSiblingAppLinks('armory')).toEqual([
      { id: 'codex', label: 'Codex', href: 'https://codex.darkavianlabs.com' },
    ]);
  });
});
