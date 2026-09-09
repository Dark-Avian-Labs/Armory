import type { NextFunction, Request, Response } from 'express';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

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
import { getClerkAuthState, isClerkConfigured, requireArmoryAdmin, requireAuthApi } from './middleware.js';

const previousClerkEnv = {
  CLERK_PUBLISHABLE_KEY: process.env.CLERK_PUBLISHABLE_KEY,
  CLERK_SECRET_KEY: process.env.CLERK_SECRET_KEY,
};

function restoreClerkEnv(): void {
  for (const [name, value] of Object.entries(previousClerkEnv)) {
    if (value === undefined) delete process.env[name];
    else process.env[name] = value;
  }
}

function setClerkKeys(publishable: string, secret: string): void {
  process.env.CLERK_PUBLISHABLE_KEY = publishable;
  process.env.CLERK_SECRET_KEY = secret;
}

describe('isClerkConfigured', () => {
  afterEach(restoreClerkEnv);

  it('returns false when both keys are empty', () => {
    delete process.env.CLERK_PUBLISHABLE_KEY;
    delete process.env.CLERK_SECRET_KEY;
    expect(isClerkConfigured()).toBe(false);
  });

  it('rejects bare pk_test_ and sk_test_ prefixes', () => {
    setClerkKeys('pk_test_', 'sk_test_abc');
    expect(() => isClerkConfigured()).toThrow(/FATAL/);
  });

  it('rejects a secret that is only sk_live_', () => {
    setClerkKeys('pk_live_abc', 'sk_live_');
    expect(() => isClerkConfigured()).toThrow(/FATAL/);
  });

  it('rejects placeholder keys', () => {
    setClerkKeys('pk_test_placeholder', 'sk_test_placeholder');
    expect(() => isClerkConfigured()).toThrow(/FATAL/);
  });
});

describe('getClerkAuthState', () => {
  beforeEach(() => {
    setClerkKeys('pk_test_armoryunit', 'sk_test_armoryunit');
    authState.userId = null;
    authState.sessionClaims = undefined;
  });

  afterEach(restoreClerkEnv);

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

  it('returns signed-out when Clerk keys are empty even if getAuth has a user', () => {
    delete process.env.CLERK_PUBLISHABLE_KEY;
    delete process.env.CLERK_SECRET_KEY;
    authState.userId = 'user_1';
    expect(getClerkAuthState({} as Request)).toEqual({
      authenticated: false,
      userId: null,
      isArmoryAdmin: false,
    });
  });
});

describe('requireAuthApi', () => {
  beforeEach(() => {
    setClerkKeys('pk_test_armoryunit', 'sk_test_armoryunit');
    authState.userId = null;
  });

  afterEach(restoreClerkEnv);

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
    setClerkKeys('pk_test_armoryunit', 'sk_test_armoryunit');
    authState.userId = null;
    authState.sessionClaims = undefined;
  });

  afterEach(restoreClerkEnv);

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
