import { clerkMiddleware as clerkExpressMiddleware, getAuth } from '@clerk/express';
import type { NextFunction, Request, RequestHandler, Response } from 'express';

import { GAME_ID } from '../gameId.js';
import { isAppAdmin, metadataFromSessionClaims } from './clerk.js';
import { getClerkAuthorizedParties } from './clerkAuthorizedParties.js';

export { getAuth };

function isPlaceholderClerkKey(value: string): boolean {
  const lower = value.toLowerCase();
  return lower.includes('placeholder') || lower.includes('changeme') || lower.includes('your_key');
}

function hasClerkKeyPrefix(value: string, kind: 'pk' | 'sk'): boolean {
  const prefixes = [`${kind}_test_`, `${kind}_live_`] as const;
  return prefixes.some((prefix) => value.startsWith(prefix) && value.length > prefix.length);
}

export function isClerkConfigured(): boolean {
  const publishable = process.env.CLERK_PUBLISHABLE_KEY?.trim() ?? '';
  const secret = process.env.CLERK_SECRET_KEY?.trim() ?? '';
  if (!publishable && !secret) return false;
  if (
    isPlaceholderClerkKey(publishable) ||
    isPlaceholderClerkKey(secret) ||
    !hasClerkKeyPrefix(publishable, 'pk') ||
    !hasClerkKeyPrefix(secret, 'sk')
  ) {
    throw new Error(
      '[FATAL] Clerk keys look invalid or like placeholders. Use real pk_test_/pk_live_ and sk_test_/sk_live_ values, or leave both empty for unauthenticated local dev.',
    );
  }
  return true;
}

export function clerkMiddleware(): RequestHandler {
  if (!isClerkConfigured()) {
    return (_req, _res, next) => next();
  }
  return clerkExpressMiddleware({ authorizedParties: getClerkAuthorizedParties() });
}

export type ClerkAuthState = {
  authenticated: boolean;
  userId: string | null;
  isArmoryAdmin: boolean;
};

export function getClerkAuthState(req: Request): ClerkAuthState {
  if (!isClerkConfigured()) {
    return { authenticated: false, userId: null, isArmoryAdmin: false };
  }
  const auth = getAuth(req);
  const userId = auth.userId ?? null;
  const metadata = metadataFromSessionClaims(auth.sessionClaims);
  return {
    authenticated: Boolean(userId),
    userId,
    isArmoryAdmin: isAppAdmin(metadata, GAME_ID),
  };
}

export function requireAuthApi(req: Request, res: Response, next: NextFunction): void {
  const state = getClerkAuthState(req);
  if (state.authenticated && state.userId) {
    next();
    return;
  }
  res.status(401).json({ error: 'Unauthorized' });
}

export function requireArmoryAdmin(req: Request, res: Response, next: NextFunction): void {
  const state = getClerkAuthState(req);
  if (!state.authenticated || !state.userId) {
    res.status(401).json({ error: 'Unauthorized' });
    return;
  }
  if (!state.isArmoryAdmin) {
    res.status(403).json({ error: 'Game admin access required' });
    return;
  }
  next();
}
