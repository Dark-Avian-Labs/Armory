---
type: Integration
title: Clerk Authentication
description: Clerk identity, Armory admin role, CSRF session store, and webhook hooks.
tags: [clerk, auth, csrf, admin]
timestamp: 2026-07-18T20:40:00Z
---

# Clerk Authentication

Armory uses Clerk for sign-in and session claims. Express-session + SQLite (`SESSION_DB_PATH`) backs CSRF for state-changing requests. Admin capabilities gate [data import](../workflows/data-import.md) and other admin routes. See [deployment](../operations/deployment.md) for production key requirements.

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
5. Production requires real `CLERK_SECRET_KEY` and publishable key (`CLERK_PUBLISHABLE_KEY` or `VITE_CLERK_PUBLISHABLE_KEY`).

## What to watch out for

- Placeholder Clerk keys cause middleware to **500** on requests — expected in bare local setups without real keys; the process still listens.
- Admin role lives in Clerk public/session metadata (`apps.armory`), not in Armory SQLite.
- Do not document or commit real secrets; use `.env.example` placeholders only.

## Related

- [System overview](../architecture/overview.md)
- [Mod building](../workflows/mod-building.md)
- [Deployment](../operations/deployment.md)
