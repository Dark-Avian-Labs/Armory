import '../config.js';

import type { Request, Response } from 'express';

import { GAME_ID } from '../gameId.js';

function parseBaseUrl(rawValue: string | undefined, envName: string): string | null {
  const trimmed = rawValue
    ?.trim()
    .replace(/^\uFEFF/, '')
    .trim();
  if (!trimmed) return null;
  try {
    const parsed = new URL(trimmed);
    if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
      console.warn(`[auth.remoteAuth] Ignoring ${envName}: URL must use http/https protocol.`);
      return null;
    }
    return parsed.toString().replace(/\/+$/, '');
  } catch {
    console.warn(`[auth.remoteAuth] Ignoring ${envName}: invalid base URL.`);
    return null;
  }
}

const parsedPrimaryAuthServiceUrl = parseBaseUrl(process.env.AUTH_SERVICE_URL, 'AUTH_SERVICE_URL');

if (!parsedPrimaryAuthServiceUrl && process.env.NODE_ENV === 'production') {
  throw new Error('[auth.remoteAuth] AUTH_SERVICE_URL must be set to a valid http/https URL.');
}

const AUTH_SERVICE_URL = parsedPrimaryAuthServiceUrl ?? 'http://auth.invalid';
const parsedAuthFetchTimeoutMs = Number.parseInt(process.env.AUTH_FETCH_TIMEOUT_MS ?? '5000', 10);
const AUTH_FETCH_TIMEOUT_MS =
  Number.isFinite(parsedAuthFetchTimeoutMs) &&
  Number.isInteger(parsedAuthFetchTimeoutMs) &&
  parsedAuthFetchTimeoutMs > 0
    ? parsedAuthFetchTimeoutMs
    : 5000;
const SESSION_TOUCH_INTERVAL_MS = 5 * 60 * 1000;
const AUTH_STATE_CACHE_KEY = Symbol('parametricAuthStateCache');

function parseRetryAfterSeconds(value: string | null): number | undefined {
  if (!value) return undefined;
  const asNumber = Number.parseInt(value, 10);
  if (Number.isFinite(asNumber) && asNumber > 0) {
    return asNumber;
  }
  const asDateMs = Date.parse(value);
  if (Number.isFinite(asDateMs)) {
    const deltaMs = asDateMs - Date.now();
    if (deltaMs > 0) {
      return Math.ceil(deltaMs / 1000);
    }
  }
  return undefined;
}

function resolveAuthServiceUrl(_req?: Request): string {
  return AUTH_SERVICE_URL;
}

export interface RemoteAuthUser {
  id: number;
  username: string;
  is_admin: boolean;
}

export interface RemoteAuthState {
  authenticated: boolean;
  has_game_access: boolean;
  user: RemoteAuthUser | null;
  permissions: string[];
  auth_service_error?: boolean;
  auth_rate_limited?: boolean;
  auth_retry_after_sec?: number;
}

function getAppPublicBaseUrl(): string {
  return APP_PUBLIC_BASE_URL_PARSED;
}

function parseAppPublicBaseUrl(rawValue: string | undefined): string {
  const configuredBase = rawValue?.trim();
  if (!configuredBase) {
    throw new Error('APP_PUBLIC_BASE_URL must be set.');
  }
  let parsed: URL;
  try {
    parsed = new URL(configuredBase);
  } catch {
    throw new Error('APP_PUBLIC_BASE_URL must be a valid URL.');
  }
  const nodeEnv = process.env.NODE_ENV;
  const isLocalHttp =
    parsed.protocol === 'http:' &&
    (parsed.hostname === 'localhost' ||
      parsed.hostname === '127.0.0.1' ||
      parsed.hostname === '::1');
  const isNonProd = nodeEnv === 'development' || nodeEnv === 'test';
  if (parsed.protocol !== 'https:' && !(isLocalHttp || isNonProd)) {
    throw new Error('APP_PUBLIC_BASE_URL must use https://');
  }
  return parsed.toString().replace(/\/+$/, '');
}

const APP_PUBLIC_BASE_URL_PARSED = parseAppPublicBaseUrl(process.env.APP_PUBLIC_BASE_URL);

function isSafeRelativePath(nextPath: string): boolean {
  return (
    nextPath.startsWith('/') &&
    !nextPath.startsWith('//') &&
    !nextPath.includes('\\') &&
    !/^[a-zA-Z][a-zA-Z\d+\-.]*:/.test(nextPath)
  );
}

type AuthStateCache = Partial<Record<string, Promise<RemoteAuthState>>>;

function cacheKeyForGame(gameId?: string): string {
  return gameId ?? '__global__';
}

function getRequestAuthCache(req: Request): AuthStateCache {
  const reqWithCache = req as Request & {
    [AUTH_STATE_CACHE_KEY]?: AuthStateCache;
  };
  if (!reqWithCache[AUTH_STATE_CACHE_KEY]) {
    reqWithCache[AUTH_STATE_CACHE_KEY] = {};
  }
  return reqWithCache[AUTH_STATE_CACHE_KEY];
}

export function buildAuthLoginUrl(req: Request, nextPath?: string): string {
  const requested = nextPath || req.originalUrl || '/';
  const safeNextPath = isSafeRelativePath(requested) ? requested : '/';
  const next = new URL(safeNextPath, getAppPublicBaseUrl()).toString();
  const loginUrl = new URL(`${resolveAuthServiceUrl(req)}/login`);
  loginUrl.searchParams.set('next', next);
  return loginUrl.toString();
}

export async function fetchRemoteAuthState(
  req: Request,
  gameId = GAME_ID,
): Promise<RemoteAuthState> {
  const cache = getRequestAuthCache(req);
  const cacheKey = cacheKeyForGame(gameId);
  if (cache[cacheKey]) return await cache[cacheKey];

  cache[cacheKey] = (async () => {
    const meUrl = new URL(`${resolveAuthServiceUrl(req)}/api/auth/me`);
    meUrl.searchParams.set('app', gameId);
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), AUTH_FETCH_TIMEOUT_MS);
    try {
      const upstream = await fetch(meUrl, {
        method: 'GET',
        headers: {
          cookie: req.headers.cookie ?? '',
          accept: 'application/json',
        },
        signal: controller.signal,
      });
      if (!upstream.ok) {
        if (upstream.status === 429) {
          const retryAfterSec = parseRetryAfterSeconds(upstream.headers.get('retry-after'));
          return {
            authenticated: false,
            has_game_access: false,
            user: null,
            permissions: [],
            auth_service_error: true,
            auth_rate_limited: true,
            auth_retry_after_sec: retryAfterSec,
          };
        }
        if (upstream.status >= 500) {
          return {
            authenticated: false,
            has_game_access: false,
            user: null,
            permissions: [],
            auth_service_error: true,
          };
        }
        return {
          authenticated: false,
          has_game_access: false,
          user: null,
          permissions: [],
        };
      }
      const rawBody = await upstream.json();
      const body: Partial<RemoteAuthState> =
        rawBody && typeof rawBody === 'object' ? (rawBody as Partial<RemoteAuthState>) : {};
      const user = body.user;
      return {
        authenticated: body.authenticated === true,
        has_game_access: body.has_game_access === true,
        user:
          user &&
          typeof user.id === 'number' &&
          typeof user.username === 'string' &&
          typeof user.is_admin === 'boolean'
            ? user
            : null,
        permissions: Array.isArray(body.permissions)
          ? body.permissions.filter((p): p is string => typeof p === 'string')
          : [],
      };
    } catch {
      return {
        authenticated: false,
        has_game_access: false,
        user: null,
        permissions: [],
        auth_service_error: true,
      };
    } finally {
      clearTimeout(timeout);
    }
  })();

  return await cache[cacheKey];
}

export async function syncSessionFromAuth(req: Request): Promise<RemoteAuthState> {
  const state = await fetchRemoteAuthState(req, GAME_ID);
  if (state.auth_service_error) {
    return state;
  }
  if (!state.authenticated || !state.user) {
    delete req.session.user_id;
    delete req.session.username;
    delete req.session.is_admin;
    delete req.session.login_time;
    return state;
  }
  req.session.user_id = state.user.id;
  req.session.username = state.user.username;
  req.session.is_admin = state.user.is_admin;
  if (
    typeof req.session.login_time !== 'number' ||
    Date.now() - req.session.login_time > SESSION_TOUCH_INTERVAL_MS
  ) {
    req.session.login_time = Date.now();
  }
  return state;
}

export async function proxyAuthJson(req: Request, res: Response, path: string): Promise<void> {
  const url = `${resolveAuthServiceUrl(req)}${path}`;
  const method = req.method.toUpperCase();
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), AUTH_FETCH_TIMEOUT_MS);
  try {
    const upstream = await fetch(url, {
      method,
      headers: {
        'content-type': 'application/json',
        accept: 'application/json',
        cookie: req.headers.cookie ?? '',
      },
      body: method === 'GET' ? undefined : JSON.stringify(req.body ?? {}),
      signal: controller.signal,
    });

    const setCookies = (
      upstream.headers as Headers & {
        getSetCookie?: () => string[];
      }
    ).getSetCookie?.();
    if (setCookies && setCookies.length > 0) {
      res.setHeader('set-cookie', setCookies);
    }

    const contentType = upstream.headers.get('content-type');
    const responseText = await upstream.text();
    res.status(upstream.status);
    if (contentType && contentType.includes('application/json')) {
      res.type('application/json');
    }
    res.send(responseText);
  } catch {
    res.status(502).json({ error: 'Auth service unavailable' });
  } finally {
    clearTimeout(timeout);
  }
}

export async function proxyAuthLogout(req: Request, res: Response): Promise<void> {
  const authBase = resolveAuthServiceUrl(req);
  const csrfUrl = `${authBase}/api/auth/csrf`;
  const logoutUrl = `${authBase}/api/auth/logout`;

  try {
    const csrfController = new AbortController();
    const csrfTimeout = setTimeout(() => csrfController.abort(), AUTH_FETCH_TIMEOUT_MS);
    let csrfResponse: globalThis.Response;
    try {
      csrfResponse = await fetch(csrfUrl, {
        method: 'GET',
        headers: {
          cookie: req.headers.cookie ?? '',
          accept: 'application/json',
        },
        signal: csrfController.signal,
      });
    } finally {
      clearTimeout(csrfTimeout);
    }
    if (!csrfResponse.ok) {
      throw new Error('Failed to fetch CSRF token for logout');
    }
    const rawCsrfBody: unknown = await csrfResponse.json();
    const csrfBody =
      rawCsrfBody &&
      typeof rawCsrfBody === 'object' &&
      'csrfToken' in rawCsrfBody &&
      typeof (rawCsrfBody as { csrfToken: unknown }).csrfToken === 'string'
        ? { csrfToken: (rawCsrfBody as { csrfToken: string }).csrfToken }
        : null;
    if (!csrfBody || !csrfBody.csrfToken) {
      throw new Error('Missing CSRF token for logout');
    }

    const logoutController = new AbortController();
    const logoutTimeout = setTimeout(() => logoutController.abort(), AUTH_FETCH_TIMEOUT_MS);
    let upstream: globalThis.Response;
    try {
      upstream = await fetch(logoutUrl, {
        method: 'POST',
        headers: {
          cookie: req.headers.cookie ?? '',
          accept: 'application/json',
          'content-type': 'application/json',
          'x-csrf-token': csrfBody.csrfToken,
        },
        body: JSON.stringify({ _csrf: csrfBody.csrfToken }),
        signal: logoutController.signal,
      });
    } finally {
      clearTimeout(logoutTimeout);
    }

    const setCookies = (
      upstream.headers as Headers & {
        getSetCookie?: () => string[];
      }
    ).getSetCookie?.();

    if (setCookies && setCookies.length > 0) {
      res.setHeader('set-cookie', setCookies);
    }

    req.session.destroy((err) => {
      if (err) {
        console.error('[auth.remoteAuth] Session destruction failed:', err);
        res.status(500).json({ error: 'Session destruction failed' });
        return;
      }
      res.json({ success: true });
    });
  } catch {
    req.session.destroy((err) => {
      if (err) {
        console.error('[auth.remoteAuth] Session destruction failed:', err);
        res.status(500).json({ error: 'Session destruction failed' });
        return;
      }
      res.status(502).json({ error: 'Auth service unavailable' });
    });
  }
}
