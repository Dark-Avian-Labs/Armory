import { clerkMiddleware as clerkExpressMiddleware, getAuth } from '@clerk/express';
import type { Request, Response, NextFunction } from 'express';

import { GAME_ID } from '../gameId.js';
import { isAppAdmin, metadataFromSessionClaims } from './clerk.js';
import { getClerkAuthorizedParties } from './clerkAuthorizedParties.js';

export { getAuth };

export function clerkMiddleware() {
  return clerkExpressMiddleware({ authorizedParties: getClerkAuthorizedParties() });
}

export type ClerkAuthState = {
  authenticated: boolean;
  userId: string | null;
  isArmoryAdmin: boolean;
};

export function getClerkAuthState(req: Request): ClerkAuthState {
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
