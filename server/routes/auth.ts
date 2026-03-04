import { Router, type Request, type Response } from 'express';
import { rateLimit } from 'express-rate-limit';

import {
  authLoginRedirect,
  authStatus,
  redirectIfAuthenticated,
} from '../auth/middleware.js';
import { proxyAuthJson, proxyAuthLogout } from '../auth/remoteAuth.js';

export const authRouter = Router();

authRouter.use(
  rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 100,
    standardHeaders: true,
    legacyHeaders: false,
  }),
);

authRouter.get('/csrf', (req: Request, res: Response) => {
  const token =
    (res.locals as { csrfToken?: string }).csrfToken ?? req.session.csrfToken;
  req.session.save((err) => {
    if (err) {
      res.status(500).json({ error: 'Failed to establish CSRF session' });
      return;
    }
    res.json({ csrfToken: token ?? '' });
  });
});

authRouter.get(
  '/login',
  redirectIfAuthenticated,
  (req: Request, res: Response) => {
    authLoginRedirect(req, res);
  },
);

authRouter.post('/login', async (req: Request, res: Response) => {
  await proxyAuthJson(req, res, '/api/auth/login');
});

authRouter.post('/logout', async (req: Request, res: Response) => {
  await proxyAuthLogout(req, res);
});

authRouter.get('/me', authStatus);

authRouter.post('/change-password', async (req: Request, res: Response) => {
  await proxyAuthJson(req, res, '/api/auth/change-password');
});
