import { APP_ID } from '../../app/config';
import type { AppRoleAssignment } from './types';

export function isArmoryGameAdmin(
  user: { is_admin: boolean },
  appRoles: AppRoleAssignment[] | undefined,
): boolean {
  if (user.is_admin) return true;
  const forGame = appRoles?.find((role) => role.app_id === APP_ID);
  return forGame?.role === 'admin';
}
