export type AuthStatus =
  | 'loading'
  | 'unauthenticated'
  | 'forbidden'
  | 'error'
  | 'rate_limited'
  | 'ok';

export interface RemoteAuthUser {
  id: number;
  username: string;
  is_admin: boolean;
  display_name?: string;
  email?: string;
}

export type AppRoleAssignment = { app_id: string; role: 'user' | 'admin' };

export interface RemoteAuthState {
  authenticated: boolean;
  has_game_access?: boolean;
  user?: RemoteAuthUser;
  app_roles?: AppRoleAssignment[];
  auth_service_error?: boolean;
  auth_rate_limited?: boolean;
  auth_retry_after_sec?: number;
}

export interface AppAccountProfile {
  userId: number;
  username: string;
  isAdmin: boolean;
  displayName: string;
  email: string;
}

export interface AppAccountState {
  isAuthenticated: boolean;
  profile: AppAccountProfile | null;
}
