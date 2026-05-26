import type { NextFunction, Request, Response } from 'express';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const authState = vi.hoisted(() => ({
  userId: null as string | null,
  sessionClaims: undefined as Record<string, unknown> | undefined,
}));

vi.mock('@clerk/express', () => ({
  getAuth: () => ({
    userId: authState.userId,
    sessionClaims: authState.sessionClaims,
  }),
  clerkMiddleware: () => (_req: Request, _res: Response, next: NextFunction) => next(),
}));

import { mockResponse } from '../testing/mockResponse.js';
import { getClerkAuthState, requireArmoryAdmin, requireAuthApi } from './middleware.js';

describe('getClerkAuthState', () => {
  beforeEach(() => {
    authState.userId = null;
    authState.sessionClaims = undefined;
  });

  it('returns authenticated admin state', () => {
    authState.userId = 'user_1';
    authState.sessionClaims = { metadata: { apps: { armory: 'admin' } } };
    const state = getClerkAuthState({} as Request);
    expect(state.authenticated).toBe(true);
    expect(state.userId).toBe('user_1');
    expect(state.isArmoryAdmin).toBe(true);
  });

  it('returns unauthenticated when userId is missing', () => {
    const state = getClerkAuthState({} as Request);
    expect(state.authenticated).toBe(false);
    expect(state.isArmoryAdmin).toBe(false);
  });

  it('returns authenticated non-admin for signed-in user without admin role', () => {
    authState.userId = 'user_2';
    authState.sessionClaims = { metadata: { apps: { armory: 'user' } } };
    const state = getClerkAuthState({} as Request);
    expect(state.authenticated).toBe(true);
    expect(state.isArmoryAdmin).toBe(false);
  });
});

describe('requireAuthApi', () => {
  beforeEach(() => {
    authState.userId = null;
  });

  it('returns 401 JSON when unauthenticated', () => {
    const res = mockResponse();
    const next = vi.fn();
    requireAuthApi({} as Request, res, next);
    expect(res.statusCode).toBe(401);
    expect(res.body).toEqual({ error: 'Unauthorized' });
    expect(next).not.toHaveBeenCalled();
  });

  it('calls next when authenticated with userId', () => {
    authState.userId = 'user_1';
    const res = mockResponse();
    const next = vi.fn();
    requireAuthApi({} as Request, res, next);
    expect(next).toHaveBeenCalledOnce();
  });
});

describe('requireArmoryAdmin', () => {
  beforeEach(() => {
    authState.userId = null;
    authState.sessionClaims = undefined;
  });

  it('returns 401 when unauthenticated', () => {
    const res = mockResponse();
    const next = vi.fn();
    requireArmoryAdmin({} as Request, res, next);
    expect(res.statusCode).toBe(401);
    expect(next).not.toHaveBeenCalled();
  });

  it('returns 403 for authenticated non-admin', () => {
    authState.userId = 'user_1';
    authState.sessionClaims = { metadata: { apps: { armory: 'user' } } };
    const res = mockResponse();
    const next = vi.fn();
    requireArmoryAdmin({} as Request, res, next);
    expect(res.statusCode).toBe(403);
    expect(res.body).toEqual({ error: 'Game admin access required' });
    expect(next).not.toHaveBeenCalled();
  });

  it('calls next for armory admin', () => {
    authState.userId = 'user_1';
    authState.sessionClaims = { metadata: { apps: { armory: 'admin' } } };
    const res = mockResponse();
    const next = vi.fn();
    requireArmoryAdmin({} as Request, res, next);
    expect(next).toHaveBeenCalledOnce();
  });
});
