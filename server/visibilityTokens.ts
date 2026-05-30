import { generateShareToken } from './shareToken.js';

export type VisibilityValue = 'public' | 'private' | 'unlisted';

export function parseVisibility(
  raw: unknown,
  fallback: VisibilityValue = 'private',
): VisibilityValue {
  if (raw === 'public' || raw === 'private' || raw === 'unlisted') return raw;
  return fallback;
}

export function resolveShareTokenForVisibility(
  previousVisibility: string | null | undefined,
  nextVisibility: VisibilityValue,
  existingToken: string | null | undefined,
): string | null {
  if (nextVisibility === 'unlisted') {
    const trimmed = typeof existingToken === 'string' ? existingToken.trim() : '';
    return trimmed.length > 0 ? trimmed : generateShareToken();
  }
  if (previousVisibility === 'unlisted') {
    return null;
  }
  return null;
}

export function buildReadAccessContext(
  req: { query: Record<string, unknown> },
  sessionUserId: string | null,
  isGameAdmin: boolean,
): { sessionUserId: string | null; isGameAdmin: boolean; shareToken: string | null } {
  const raw = req.query.token ?? req.query.share_token;
  const value = Array.isArray(raw) ? raw[0] : raw;
  const shareToken = typeof value === 'string' && value.trim().length > 0 ? value.trim() : null;
  return { sessionUserId, isGameAdmin, shareToken };
}
