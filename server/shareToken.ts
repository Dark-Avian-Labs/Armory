import { randomBytes } from 'node:crypto';

export function generateShareToken(): string {
  return randomBytes(24).toString('base64url');
}

export function readShareTokenFromQuery(req: { query: Record<string, unknown> }): string | null {
  const raw = req.query.token ?? req.query.share_token;
  const value = Array.isArray(raw) ? raw[0] : raw;
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}
