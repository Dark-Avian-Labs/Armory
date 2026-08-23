---
type: Data Model
title: Databases
description: Catalog, user, and session SQLite roles — paths, schemas, and Codex read access.
tags: [sqlite, database, catalog]
timestamp: 2026-08-23T04:20:00Z
---

# Databases

Armory uses three SQLite files. Paths are resolved in `server/config.ts`. Production requires an **absolute** `USER_DB_PATH`; absolute paths are recommended for all three.

| Env               | Default             | Schema                                                 | Purpose                                              |
| ----------------- | ------------------- | ------------------------------------------------------ | ---------------------------------------------------- |
| `ARMORY_DB_PATH`  | `./data/armory.db`  | `server/db/catalogSchema.ts`                           | Game catalog (Codex reads this read-only)            |
| `USER_DB_PATH`    | `./data/builds.db`  | `server/db/userSchema.ts`                              | Builds, loadouts, favorites                          |
| `SESSION_DB_PATH` | `./data/session.db` | `server/db/sessionSchema.ts` + `sqliteSessionStore.ts` | Express-session store for **CSRF** (not Clerk login) |

Wiring: `server/db/connection.ts`, `server/db/schema.ts` (`createAppSchema` = catalog + user).

## Catalog (`armory.db`)

Core tables include `warframes`, `abilities`, `weapons`, `companions`, `mods` (+ `mod_level_stats`, `mod_sets`, `mod_set_members`), `arcanes`, `archon_shard_types` / `archon_shard_buffs`, `warframe_market_links`, `codex_modular_weapons`, and `armory_users` (Clerk id → username, soft-delete; used for public profile URLs and owner display names). Import bookkeeping uses lease/run tables managed by the import stack. `resetCatalogData` does **not** clear `armory_users` or `codex_modular_weapons`.

**Codex:** opens `ARMORY_DB_PATH` read-only for Warframe catalog sync. Keep catalog healthy and imported before expecting Codex sync to work. See also [Codex modular weapons](../domain/codex-modular-weapons.md) and [Warframe Market links](../integrations/warframe-market.md).

## User (`builds.db`)

- `builds` — per-user `mod_config` JSON, visibility, share tokens
- `loadouts` / `loadout_builds` — loadout composition
- `build_favorites` — favorites keyed by `clerk_user_id`

Force Full Re-import and `server/db/resetCatalogData.ts` clear **catalog** tables only and refuse if user tables are accidentally present in the catalog DB.

## Session (`session.db`)

Stores Express sessions used with CSRF middleware via the in-repo `SqliteSessionStore` (`server/db/sqliteSessionStore.ts`). Clerk identity is separate; do not treat this DB as the source of truth for login.

## What to watch out for

- Relative paths in production for `USER_DB_PATH` fatal-exit.
- Do not point Codex at the user DB — only the catalog path is shared.
- Schema auto-create on boot ≠ populated catalog; run [data import](../workflows/data-import.md).

## Related

- [System overview](overview.md)
- [Data import](../workflows/data-import.md)
- [Mod building](../workflows/mod-building.md)
