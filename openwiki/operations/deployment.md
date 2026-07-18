---
type: Operations Guide
title: Deployment
description: Build, env, health checks, and CI deploy expectations for Armory.
tags: [ops, ci, deploy, env]
timestamp: 2026-07-18T20:40:00Z
---

# Deployment

Armory ships as a built Node server (`dist/server`) plus a Vite client (`dist/client`) served only when `NODE_ENV=production`. Local agent setup details live in [AGENTS.md](../../AGENTS.md); quality gates are in [testing](../testing/test-structure.md).

## Where to start

| Concern      | Path                                                          |
| ------------ | ------------------------------------------------------------- |
| Env template | `.env.example`                                                |
| Server boot  | `server/index.ts`                                             |
| CI           | `.github/workflows/ci.yml`, `.github/workflows/pr.yml`        |
| Health       | `GET /healthz`, `GET /readyz` (expect 200 when DBs reachable) |

## Runtime requirements

- Node ≥26, pnpm ≥11 with exact `packageManager` version.
- Absolute `USER_DB_PATH` in production; prefer absolute catalog/session paths too.
- Clerk keys required in production.
- With `SECURE_COOKIES` in production, `TRUST_PROXY` must be enabled.
- Encrypted `.env.development` / `.env.production` via dotenvx when private keys are available; never commit `.env.keys`.

## Deploy shape (CI)

Main-branch CI validates, builds with production env, and rsyncs `dist/`, icons, production deps, and encrypted env material to the host, then restarts the service. Smoke-check `/healthz` and `/readyz` after deploy.

## What to watch out for

- Development mode will not serve the SPA — do not treat “Cannot GET /” as a deploy failure in local API-only mode.
- Catalog must be imported on the host (or restored) for a useful production planner; schema-only boot is insufficient.
- Rebuild `better-sqlite3` after changing Node versions on the host.

## Related

- [System overview](../architecture/overview.md)
- [Clerk auth](../integrations/clerk-auth.md)
- [Test structure](../testing/test-structure.md)
- [Quickstart](../quickstart.md)
