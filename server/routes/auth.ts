import { Router, type NextFunction } from 'express';

import { hasActiveArmoryUser, syncArmoryUserFromClerk } from '../auth/armoryUsers.js';
import { getClerkAuthState, requireAuthApi } from '../auth/middleware.js';

export const authRouter = Router();

authRouter.get('/csrf', (_req, res) => {
  res.json({
    csrfToken: (res.locals as { csrfToken?: string }).csrfToken || '',
  });
});

authRouter.get('/me', requireAuthApi, async (req, res, next: NextFunction) => {
  try {
    const state = getClerkAuthState(req);
    if (!state.authenticated || !state.userId) {
      res.json({
        authenticated: false,
        userId: null,
        isArmoryAdmin: false,
      });
      return;
    }
    if (!hasActiveArmoryUser(state.userId)) {
      await syncArmoryUserFromClerk(state.userId);
    }
    res.json({
      authenticated: true,
      userId: state.userId,
      isArmoryAdmin: state.isArmoryAdmin,
    });
  } catch (err) {
    next(err);
  }
});
