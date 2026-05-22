const CLERK_USER_ID_RE = /^user_[A-Za-z0-9]{27}$/;

export function isClerkUserId(value: string): boolean {
  return CLERK_USER_ID_RE.test(value.trim());
}
