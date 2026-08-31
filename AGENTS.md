# Armory

## Org standards

Shared Dark Avian Labs engineering conventions (README shape, CI/PR runners, validate, release tracks) live in AppBase [`docs/org-standards/`](../AppBase/docs/org-standards/). The design system (theme axes, glass contracts, UI primitives, Clerk appearance) lives in AppBase [`AGENTS.md`](../AppBase/AGENTS.md). There is no shared UI package: when you change layout, glass, buttons, modals, or dropdowns here, apply the same change in Codex.

## Overview

Armory is a Warframe mod builder. Catalog data comes from Digital Extremes' public exports, with wiki and other sources filling gaps. Clerk handles sign-in. Codex reads Armory's catalog SQLite for Warframe collection sync.

The React SPA is served only when `NODE_ENV=production`. In development the API runs alone (root URL 404s); use Vite for the client. Default listen port is **3002**. See `README.md` for scripts and env.

## Databases

Three SQLite files. Do not point any two at the same path, and do not reuse Codex or BudgetPlanner files.

| File    | Env               | Role                                                               |
| ------- | ----------------- | ------------------------------------------------------------------ |
| Catalog | `ARMORY_DB_PATH`  | Equipment, mods, users-for-public-URLs. Codex reads this file.     |
| User    | `USER_DB_PATH`    | Builds, loadouts, favorites. Absolute path required in production. |
| Session | `SESSION_DB_PATH` | CSRF only, not Clerk login.                                        |

Boot creates/migrates schema and recovers the import lease. It does **not** fill the catalog. An empty catalog after first start is normal until `pnpm run data:import` or Admin Force Full Re-import. Codex needs a populated catalog, so import (or start Armory after an import) before expecting Warframe sync to work.

Force Full Re-import downloads and verifies required DE exports first, then resets catalog tables. User DB is untouched. Reset also leaves `armory_users` and `codex_modular_weapons` in the catalog DB, and refuses if user tables are accidentally present there. `armory_users` (Clerk id → username) lives in the catalog DB so public profile URLs work without the user DB.

## Catalog that Codex depends on

After weapons export processing, Armory fills `codex_modular_weapons` for Codex's Modular Weapons worksheet (MR-style parts; scaffolds/grips/braces excluded). Sync is display-name deduped. Codex falls back to path heuristics on `weapons` if the table is empty; keep this table authoritative. DE flags `codex_secret` / `exclude_from_codex` are stored but Codex does not filter on them today.

`warframe_market_links` is also catalog-side. Codex is the primary consumer; Armory has no first-class HTTP API for these rows. Market-link failures are recorded and do not abort the rest of import. Catalog reset **does** clear this table.

Overframe artifact-slot scrape is force-only. Prefer the Admin slot editor for polarity fixes; a normal import will not rewrite slots.

## Builds and sharing

Saves use `/Armory/Helminth/...`, `/Armory/Ability/...`, and `/Armory/Archon/...` in `mod_config`. Older v1 Helminth fields still resolve; keep that working if you touch `buildReference.ts`. Generated Helminth registry files are script-produced; do not hand-edit them.

Planner damage/riven stats are computed on the client. Per-user caps are **250 builds** and **50 loadouts**.

Visibility: `private` (owner/admin), `public` (listed), `unlisted` (token in `?token=` / `?share_token=` only). Default create is `private`. Denied reads return **404**, not 403. A loadout cannot become `public`/`unlisted` while any linked build is still `private`. An unlisted loadout token can reveal the owner's linked `public`/`unlisted` builds without each build's own token. Public discovery lists `public` only.

## Auth

Clerk keys are required in production (`apps.armory === 'admin'` for admin). Placeholder keys (`pk_test_placeholder` / `sk_test_placeholder`) make the middleware throw 500 on every request; the server still listens. Missing `SESSION_SECRET` outside production needs `ALLOW_INSECURE_DEV=1` and a loopback `HOST`. Production `SECURE_COOKIES` requires `TRUST_PROXY`. CSRF tokens rotate when the Clerk user id on the express session changes (`server/session/bindClerkUserSession.ts`).

## Toolchain

Node **26+**, pnpm **11.x**, exact `packageManager` (Corepack rejects dist-tags). Encrypted `.env.development` / `.env.production` need `DOTENV_PRIVATE_KEY_*` or `.env.keys`. `pnpm run validate` is the quality gate.

On Windows, Cursor agent shells may prepend bundled Node 22. After changing Node versions, run `pnpm rebuild better-sqlite3`.
