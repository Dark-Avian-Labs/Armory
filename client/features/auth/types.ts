export type AuthErrorDetail = Error | string | { message: string; code?: string };

export type AuthStatus = 'loading' | 'authenticated' | 'unauthenticated' | 'error';

export type AuthState =
  | { status: 'loading'; userId: null; isAdmin: false }
  | { status: 'unauthenticated'; userId: null; isAdmin: false }
  | { status: 'authenticated'; userId: string; isAdmin: boolean }
  | { status: 'error'; userId: null; isAdmin: false; error: AuthErrorDetail };
