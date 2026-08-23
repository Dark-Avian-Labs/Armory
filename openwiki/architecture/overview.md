---
type: Architecture Overview
title: System Overview
description: Armory client/server split, production SPA serving, and major runtime modules.
tags: [architecture, express, react]
timestamp: 2026-08-23T04:20:00Z
---

# System Overview

Armory is a single-package TypeScript app: an Express API plus a Vite-built React SPA. It depends on the [three SQLite databases](database.md), the [import pipeline](../workflows/data-import.md), and [Clerk authentication](../integrations/clerk-auth.md).

## Where to start

| Concern            | Path                       |
| ------------------ | -------------------------- |
| Server boot        | `server/index.ts`          |
| Config / paths     | `server/config.ts`         |
| Client entry       | `client/main.tsx`          |
| Shared build keys  | `shared/buildReference.ts` |
| Pipeline step list | `shared/pipelineSteps.ts`  |

## Runtime shape

1. Boot runs `ensureDataDirs()`, `createAppSchema()`, artifact-slot repair, import-lease recovery, then listens (default host/port from env; port **3002**).
2. API routes live under `server/routes/` (catalog, builds, loadouts, auth, admin, webhooks).
3. In **production**, Express serves `dist/client` static assets and SPA fallbacks (`/sign-in`, catch-all `index.html`).
4. In **development**, Express is **API-only** — no SPA static mount. Use Vite for UI work.

## Major modules

| Module                          | Role                                                    |
| ------------------------------- | ------------------------------------------------------- |
| `server/db/`                    | Catalog, user, and session schemas + vendored `SqliteSessionStore` |
| `server/import/`                | DE export download and admin/CLI pipeline orchestration |
| `server/scraping/`              | Wiki / Overframe enrichment steps                       |
| `server/auth/`                  | Clerk middleware and admin checks                       |
| `client/components/ModBuilder/` | Primary build editor UI                                 |
| `client/components/Admin/`      | Import controls, slot editors                           |
| `shared/`                       | Registries and validation shared by client and server   |

## What to watch out for

- Do not assume `pnpm start` in development serves `/` — that is intentional.
- Catalog emptiness after first schema create is normal until import runs.
- Cross-app CORS / shared session trust use `ALLOWED_APP_ORIGINS` and `COOKIE_DOMAIN`; see `.env.example`.
- `/images` and `/icons` cache for 30 days. Production `index.html` is `no-cache`; hashed `/assets/*` are immutable for a year (`server/index.ts`).
- Catalog JSON uses `sendCachedCatalogJson` (ETag + 15m TTL, busted on import). Mod lists cache by type/rarity only; free-text search is applied after the cache hit.
- `unhandledRejection` / `uncaughtException` run graceful shutdown and exit **1**.

## Related

- [Databases](database.md)
- [Data import](../workflows/data-import.md)
- [Mod building](../workflows/mod-building.md)
- [Deployment](../operations/deployment.md)
