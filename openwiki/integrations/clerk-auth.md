---
type: Integration
title: Clerk Authentication
description: Clerk identity, Armory admin role, CSRF session store, and webhook hooks.
tags: [clerk, auth, csrf, admin]
timestamp: 2026-08-23T04:20:00Z
---

# Clerk Authentication

Armory uses Clerk for sign-in and session claims. Express-session + the vendored `SqliteSessionStore` (`server/db/sqliteSessionStore.ts` on `SESSION_DB_PATH`) backs CSRF for state-changing requests. Usernames live in catalog `armory_users`, not the user DB. Admin capabilities gate [data import](../workflows/data-import.md) and other admin routes. See [deployment](../operations/deployment.md) for production key requirements.

## Where to start

| Concern            | Path                                                |
| ------------------ | --------------------------------------------------- |
| Middleware / admin | `server/auth/middleware.ts`, `server/auth/clerk.ts` |
| Auth routes        | `server/routes/auth.ts`                             |
| Webhooks           | `server/routes/webhooks.ts` (Clerk)                 |
| Client auth UI     | `client/components/Auth/`, `client/features/auth/`  |
| App id             | `server/gameId.ts` (`GAME_ID` / armory)             |

## Behavior

1. Clerk middleware verifies the user on protected API routes.
2. Session claims metadata `apps.armory === 'admin'` → `isArmoryAdmin` (via `isAppAdmin`).
3. `requireArmoryAdmin` (and related guards) return 403 for non-admins.
4. CSRF tokens are tied to the Express session store in `session.db`, separate from Clerk.
5. `GET /api/auth/me` calls Clerk `getUser` only when there is no active `armory_users` row for that id; later username updates come through the Clerk webhook.
6. Production requires real `CLERK_SECRET_KEY` and publishable key (`CLERK_PUBLISHABLE_KEY` or `VITE_CLERK_PUBLISHABLE_KEY`).
7. Session cookie may be scoped with `COOKIE_DOMAIN` so sibling apps on the same apex share CSRF/session state; `ALLOWED_APP_ORIGINS` lists full trust peers (Codex + Armory).

## What to watch out for

- Placeholder Clerk keys cause middleware to **500** on requests — expected in bare local setups without real keys; the process still listens.
- Admin role lives in Clerk public/session metadata (`apps.armory`), not in Armory SQLite.
- Do not document or commit real secrets; use `.env.example` placeholders only.
- Missing `SESSION_SECRET` outside production requires `ALLOW_INSECURE_DEV=1` with loopback-only `HOST` — see [deployment](../operations/deployment.md).

## Related

- [System overview](../architecture/overview.md)
- [Mod building](../workflows/mod-building.md)
- [Deployment](../operations/deployment.md)
