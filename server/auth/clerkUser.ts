import { getAuth } from '@clerk/express';
import type { Request } from 'express';

export function getClerkUserId(req: Request): string | null {
  return getAuth(req).userId ?? null;
}
