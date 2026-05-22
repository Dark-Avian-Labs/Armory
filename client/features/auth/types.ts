export type AuthErrorDetail = Error | string | { message: string; code?: string };

export type AuthState =
  | { status: 'loading'; userId: null; isArmoryAdmin: false }
  | { status: 'unauthenticated'; userId: null; isArmoryAdmin: false }
  | { status: 'ok'; userId: string; isArmoryAdmin: boolean }
  | { status: 'error'; userId: null; isArmoryAdmin: false; error: AuthErrorDetail };
