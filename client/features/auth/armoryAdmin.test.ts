import { describe, expect, it } from 'vitest';

import { APP_ID } from '../../app/config';
import { isArmoryGameAdmin } from './armoryAdmin';

describe('isArmoryGameAdmin', () => {
  it('returns true for platform admins', () => {
    expect(isArmoryGameAdmin({ is_admin: true }, [])).toBe(true);
    expect(isArmoryGameAdmin({ is_admin: true }, undefined)).toBe(true);
  });

  it('returns false when appRoles is undefined and user is not platform admin', () => {
    expect(isArmoryGameAdmin({ is_admin: false }, undefined)).toBe(false);
  });

  it('returns true for app role admin', () => {
    expect(isArmoryGameAdmin({ is_admin: false }, [{ app_id: APP_ID, role: 'admin' }])).toBe(true);
  });

  it('returns false for non-admin users', () => {
    expect(isArmoryGameAdmin({ is_admin: false }, [{ app_id: APP_ID, role: 'user' }])).toBe(false);
  });
});
