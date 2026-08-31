import 'express-session';

declare module 'express-session' {
  interface SessionData {
    csrfToken?: string;
    clerk_user_id?: string | null;
  }
}
