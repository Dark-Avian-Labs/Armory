import { Router, type NextFunction, type Request, type Response } from 'express';

import { hasActiveArmoryUser, syncArmoryUserFromClerk } from '../auth/armoryUsers.js';
import { getClerkAuthState, requireAuthApi } from '../auth/middleware.js';

export const authRouter = Router();

export function issueCsrfToken(req: Request, res: Response): void {
  const generate = req.app.locals.generateCsrfToken as ((request: Request) => string) | undefined;
  const token = generate ? generate(req) : (req.session.csrfToken ?? '');
  res.setHeader('Cache-Control', 'no-store');
  res.json({
    csrfToken: token,
  });
}

authRouter.get('/csrf', issueCsrfToken);

authRouter.get('/me', requireAuthApi, async (req, res, next: NextFunction) => {
  try {
    const state = getClerkAuthState(req);
    if (!state.authenticated || !state.userId) {
      res.json({
        authenticated: false,
        userId: null,
        isAdmin: false,
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
      isAdmin: state.isArmoryAdmin,
      isArmoryAdmin: state.isArmoryAdmin,
    });
  } catch (err) {
    next(err);
  }
});
