import type { Request, Response, NextFunction } from 'express';

import { buildAuthLoginUrl, fetchRemoteAuthState, syncSessionFromAuth } from './remoteAuth.js';

function wantsJson(req: Request): boolean {
  const accept = req.get('accept');
  if (!accept) return false;
  if (!accept.toLowerCase().includes('json')) return false;
  return req.accepts(['json', 'html']) === 'json';
}

function authServiceFailureStatus(state: { auth_rate_limited?: boolean }): number {
  return state.auth_rate_limited ? 429 : 503;
}

function applyAuthServiceRetryHeaders(
  res: Response,
  state: { auth_retry_after_sec?: number },
): void {
  if (
    typeof state.auth_retry_after_sec === 'number' &&
    Number.isFinite(state.auth_retry_after_sec) &&
    state.auth_retry_after_sec > 0
  ) {
    res.setHeader('Retry-After', String(Math.ceil(state.auth_retry_after_sec)));
  }
}

function touchSessionFromState(
  req: Request,
  state: { user: { id: number; username: string; is_admin: boolean } | null },
): void {
  if (!state.user) return;
  req.session.user_id = state.user.id;
  req.session.username = state.user.username;
  req.session.is_admin = state.user.is_admin;
  if (
    typeof req.session.login_time !== 'number' ||
    Date.now() - req.session.login_time > 5 * 60 * 1000
  ) {
    req.session.login_time = Date.now();
  }
}

export async function requireAuth(req: Request, res: Response, next: NextFunction): Promise<void> {
  const state = await syncSessionFromAuth(req);
  if (state.auth_service_error) {
    if (wantsJson(req)) {
      applyAuthServiceRetryHeaders(res, state);
      res.status(authServiceFailureStatus(state)).json({ error: 'Auth service unavailable' });
      return;
    }
    res.status(503).send('Authentication service unavailable');
    return;
  }
  if (state.authenticated) {
    next();
    return;
  }
  if (wantsJson(req)) {
    res.status(401).json({ error: 'Authentication required' });
    return;
  }
  res.redirect(buildAuthLoginUrl(req));
}

export async function requireAdmin(req: Request, res: Response, next: NextFunction): Promise<void> {
  const state = await syncSessionFromAuth(req);
  if (!state.authenticated || !state.user) {
    res.status(401).json({ error: 'Authentication required' });
    return;
  }
  if (!state.user.is_admin) {
    res.status(403).json({ error: 'Admin access required' });
    return;
  }
  next();
}

export function requireGameAccess(gameId: string) {
  return async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    const state = await fetchRemoteAuthState(req, gameId);
    if (state.auth_service_error) {
      applyAuthServiceRetryHeaders(res, state);
      res.status(authServiceFailureStatus(state)).json({ error: 'Auth service unavailable' });
      return;
    }
    if (!state.authenticated || !state.user) {
      res.status(401).json({ error: 'Authentication required' });
      return;
    }
    touchSessionFromState(req, state);
    if (!state.has_game_access) {
      res.status(403).json({ error: 'Access to this application is not granted.' });
      return;
    }
    next();
  };
}

export async function requirePageGameAccess(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  const state = await fetchRemoteAuthState(req);
  if (state.auth_service_error) {
    res.status(503).send('Authentication service unavailable');
    return;
  }
  if (!state.authenticated || !state.user) {
    res.redirect(buildAuthLoginUrl(req));
    return;
  }
  touchSessionFromState(req, state);
  if (!state.has_game_access) {
    res.redirect(buildAuthLoginUrl(req, '/'));
    return;
  }
  next();
}

export async function redirectIfAuthenticated(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  const state = await fetchRemoteAuthState(req);
  if (state.authenticated && state.has_game_access) {
    res.redirect('/builder/builds');
    return;
  }
  next();
}

export function authLoginRedirect(req: Request, res: Response): void {
  res.redirect(buildAuthLoginUrl(req));
}

export async function authStatus(req: Request, res: Response): Promise<void> {
  const state = await fetchRemoteAuthState(req);
  if (state.auth_service_error) {
    const statusCode = authServiceFailureStatus(state);
    const payload = {
      authenticated: false,
      has_game_access: false,
      auth_service_error: true,
      auth_rate_limited: state.auth_rate_limited === true,
      auth_retry_after_sec: state.auth_retry_after_sec,
    };
    applyAuthServiceRetryHeaders(res, state);
    res.status(statusCode).json(payload);
    return;
  }
  if (!state.authenticated || !state.user) {
    res.json({ authenticated: false, has_game_access: false });
    return;
  }
  res.json({
    authenticated: true,
    has_game_access: state.has_game_access,
    user: state.user,
    permissions: state.permissions,
  });
}

export async function requireAuthApiJson(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  const state = await syncSessionFromAuth(req);
  if (state.auth_service_error) {
    applyAuthServiceRetryHeaders(res, state);
    res.status(authServiceFailureStatus(state)).json({ error: 'Auth service unavailable' });
    return;
  }
  if (state.authenticated) {
    next();
    return;
  }
  res.status(401).json({ error: 'Unauthorized' });
}
