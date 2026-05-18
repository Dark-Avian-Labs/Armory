import { describe, expect, it } from 'vitest';

import { canReadBuild } from './buildAccess.js';

describe('canReadBuild', () => {
  it('allows owners regardless of visibility', () => {
    expect(canReadBuild({ user_id: 1, visibility: 'private' }, 1, false)).toBe(true);
  });

  it('allows public and unlisted for other users', () => {
    expect(canReadBuild({ user_id: 2, visibility: 'public' }, 1, false)).toBe(true);
    expect(canReadBuild({ user_id: 2, visibility: 'unlisted' }, 1, false)).toBe(true);
  });

  it('denies private builds for non-owners', () => {
    expect(canReadBuild({ user_id: 2, visibility: 'private' }, 1, false)).toBe(false);
  });

  it('allows game admins to read private builds', () => {
    expect(canReadBuild({ user_id: 2, visibility: 'private' }, 1, true)).toBe(true);
  });

  it('treats null and undefined visibility as private', () => {
    expect(canReadBuild({ user_id: 2, visibility: null }, 1, false)).toBe(false);
    expect(canReadBuild({ user_id: 2, visibility: undefined }, 1, false)).toBe(false);
    expect(canReadBuild({ user_id: 2, visibility: null }, 2, false)).toBe(true);
    expect(canReadBuild({ user_id: 2, visibility: undefined }, 2, false)).toBe(true);
  });

  it('denies unknown visibility for non-owners but allows owners and game admins', () => {
    expect(canReadBuild({ user_id: 2, visibility: 'bogus' }, 1, false)).toBe(false);
    expect(canReadBuild({ user_id: 2, visibility: 'bogus' }, 2, false)).toBe(true);
    expect(canReadBuild({ user_id: 2, visibility: 'bogus' }, 1, true)).toBe(true);
  });
});
