---
type: Repository Overview
title: Armory Quickstart
description: Entrypoint for agents and humans — what Armory is, how to run it, and where to dig deeper.
tags: [quickstart, armory]
timestamp: 2026-07-18T21:05:00Z
---

# Armory Quickstart

## What it is

**Armory** is a Warframe mod builder and planner. It imports equipment and mod data from Digital Extremes’ public exports (plus wiki and third-party enrichment), lets players configure builds with Helminth, Archon shards, and Incarnon options, and persists user builds/loadouts behind Clerk auth. Codex reads Armory’s catalog SQLite (`ARMORY_DB_PATH`) for Warframe sync.

## Stack and layout

| Layer   | Choice                                                         |
| ------- | -------------------------------------------------------------- |
| Runtime | Node ≥26, pnpm ≥11 (`packageManager` exact version)            |
| Server  | Express 5, better-sqlite3, TypeScript ESM                      |
| Client  | React 19, Vite 8, Tailwind CSS 4, React Router 7               |
| Auth    | Clerk (`@clerk/express` / `@clerk/react`) + CSRF session store |

```
client/     React SPA (ModBuilder, builds, loadouts, admin)
server/     Express API, import pipeline, scraping, auth, DB
shared/     Build keys, Helminth/Archon registries, pipeline steps
scripts/    Generators, runtime-preflight, quality helpers
tests/      Cross-cutting Vitest suites
data/       Default SQLite + exports/images (local)
```

## How to run

1. `pnpm install`
2. Copy `.env.example` → `.env` (or use dotenvx with `DOTENV_PRIVATE_KEY_DEVELOPMENT`)
3. `pnpm run build`
4. Populate catalog: `pnpm run data:import` (or Admin Force Full Re-import after first start)
5. `pnpm start` — default port **3002**

Preferred encrypted-env start (from [AGENTS.md](../AGENTS.md)):

```bash
NODE_ENV=development pnpm dotenvx run -f .env.development -- node dist/server/index.js
```

Without the private key: `NODE_ENV=development node --env-file=.env dist/server/index.js`.

**Dev UI:** Express serves the SPA only when `NODE_ENV=production`. In development the API is API-only (root returns 404); use Vite for the client.

Quality gate: `pnpm run validate` (preflight → format → lint → typecheck → tests).

## Concept map

| Area         | Page                                                                                                                                            |
| ------------ | ----------------------------------------------------------------------------------------------------------------------------------------------- |
| Architecture | [System overview](architecture/overview.md) · [Databases](architecture/database.md)                                                             |
| Workflows    | [Data import](workflows/data-import.md) · [Mod building](workflows/mod-building.md) · [Share and visibility](workflows/share-and-visibility.md) |
| Domain       | [Warframe modding](domain/warframe-modding.md) · [Codex modular weapons](domain/codex-modular-weapons.md)                                       |
| Integrations | [Clerk auth](integrations/clerk-auth.md) · [Warframe Market links](integrations/warframe-market.md)                                             |
| Operations   | [Deployment](operations/deployment.md)                                                                                                          |
| Testing      | [Test structure](testing/test-structure.md)                                                                                                     |

## Agent gotchas

- Keep `packageManager` as an **exact** pnpm version (Corepack rejects dist-tags).
- Placeholder Clerk keys (`pk_test_placeholder` / `sk_test_placeholder`) make Clerk middleware return **500** on routes — server still listens.
- Three SQLite files: catalog (`ARMORY_DB_PATH`), user (`USER_DB_PATH`), session (`SESSION_DB_PATH`). Codex reads the catalog only.
- Server start creates/migrates schema; **full catalog populate is `data:import` or admin import**, not automatic on listen.
- Build keys in `mod_config` use `/Armory/Helminth/...`, `/Armory/Ability/...`, `/Armory/Archon/...` (older v1 fields still load).
- Force Full Re-import resets **catalog tables only**; user DB is untouched.
- Start/import Armory before Codex so `armory.db` exists and is populated.
- Windows agent shells may prepend Node 22 — prefer system Node 26; rebuild `better-sqlite3` after Node changes.
- UI tokens are mirrored manually with Codex (no shared UI package).
