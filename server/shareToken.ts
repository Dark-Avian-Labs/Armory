import { randomBytes } from 'node:crypto';

export function generateShareToken(): string {
  return randomBytes(24).toString('base64url');
}
