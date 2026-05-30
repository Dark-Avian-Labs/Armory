import { describe, expect, it } from 'vitest';

import { canReadBuild } from './buildAccess.js';
import { canReadLoadout } from './loadoutAccess.js';

describe('canReadBuild', () => {
  it('allows owners regardless of visibility', () => {
    expect(canReadBuild({ clerk_user_id: 'user_a', visibility: 'private' }, 'user_a', false)).toBe(true);
  });

  it('allows public builds for other users', () => {
    expect(canReadBuild({ clerk_user_id: 'user_b', visibility: 'public' }, 'user_a', false)).toBe(true);
  });

  it('denies unlisted builds without a valid share token', () => {
    expect(
      canReadBuild({ clerk_user_id: 'user_b', visibility: 'unlisted', share_token: 'secret-token' }, 'user_a', false),
    ).toBe(false);
    expect(
      canReadBuild(
        { clerk_user_id: 'user_b', visibility: 'unlisted', share_token: 'secret-token' },
        'user_a',
        false,
        'wrong-token',
      ),
    ).toBe(false);
  });

  it('allows unlisted builds with a matching share token', () => {
    expect(
      canReadBuild(
        { clerk_user_id: 'user_b', visibility: 'unlisted', share_token: 'secret-token' },
        'user_a',
        false,
        'secret-token',
      ),
    ).toBe(true);
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

describe('canReadLoadout', () => {
  it('mirrors unlisted token semantics for loadouts', () => {
    const row = {
      clerk_user_id: 'user_b',
      visibility: 'unlisted',
      share_token: 'loadout-token',
    };
    expect(canReadLoadout(row, { sessionUserId: 'user_a', isGameAdmin: false })).toBe(false);
    expect(
      canReadLoadout(row, {
        sessionUserId: 'user_a',
        isGameAdmin: false,
        shareToken: 'loadout-token',
      }),
    ).toBe(true);
  });
});
