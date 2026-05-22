import { describe, expect, it } from 'vitest';

import { canReadBuild } from './buildAccess.js';

describe('canReadBuild', () => {
  it('allows owners regardless of visibility', () => {
    expect(canReadBuild({ clerk_user_id: 'user_a', visibility: 'private' }, 'user_a', false)).toBe(true);
  });

  it('allows public and unlisted for other users', () => {
    expect(canReadBuild({ clerk_user_id: 'user_b', visibility: 'public' }, 'user_a', false)).toBe(true);
    expect(canReadBuild({ clerk_user_id: 'user_b', visibility: 'unlisted' }, 'user_a', false)).toBe(true);
  });

  it('denies private builds for non-owners', () => {
    expect(canReadBuild({ clerk_user_id: 'user_b', visibility: 'private' }, 'user_a', false)).toBe(false);
  });

  it('allows game admins to read private builds', () => {
    expect(canReadBuild({ clerk_user_id: 'user_b', visibility: 'private' }, 'user_a', true)).toBe(true);
  });

  it('treats null and undefined visibility as private', () => {
    expect(canReadBuild({ clerk_user_id: 'user_b', visibility: null }, 'user_a', false)).toBe(false);
    expect(canReadBuild({ clerk_user_id: 'user_b', visibility: undefined }, 'user_a', false)).toBe(false);
    expect(canReadBuild({ clerk_user_id: 'user_b', visibility: null }, 'user_b', false)).toBe(true);
    expect(canReadBuild({ clerk_user_id: 'user_b', visibility: undefined }, 'user_b', false)).toBe(true);
  });

  it('denies unknown visibility for non-owners but allows owners and game admins', () => {
    expect(canReadBuild({ clerk_user_id: 'user_b', visibility: 'bogus' }, 'user_a', false)).toBe(false);
    expect(canReadBuild({ clerk_user_id: 'user_b', visibility: 'bogus' }, 'user_b', false)).toBe(true);
    expect(canReadBuild({ clerk_user_id: 'user_b', visibility: 'bogus' }, 'user_a', true)).toBe(true);
  });
});
