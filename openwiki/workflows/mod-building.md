---
type: Workflow
title: Mod Building
description: Builder UI, mod_config persistence, loadouts, favorites, and stable Armory build keys.
tags: [builds, loadouts, mod-builder]
timestamp: 2026-07-18T20:40:00Z
---

# Mod Building

Players configure equipment in the ModBuilder UI, persist builds to the [user database](../architecture/database.md), and group them into loadouts. Domain rules (Helminth, Archon, polarities) are covered in [Warframe modding](../domain/warframe-modding.md). Saves require [Clerk auth](../integrations/clerk-auth.md).

## Where to start

| Concern                 | Path                                                                   |
| ----------------------- | ---------------------------------------------------------------------- |
| UI                      | `client/components/ModBuilder/`                                        |
| Builds API              | `server/routes/buildsRouter.ts`                                        |
| Loadouts API            | `server/routes/loadoutsRouter.ts`                                      |
| `mod_config` validation | `server/routes/modConfigValidation.ts` (and related shared validators) |
| Stable keys             | `shared/buildReference.ts`, Helminth/Archon registries                 |

## Persistence model

1. Client edits slots, polarities, Helminth replacement, Archon shards, Incarnon choices, etc.
2. `POST`/`PUT` `/api/builds` stores Zod-validated `mod_config` JSON on `builds`.
3. Loadouts reference builds via `loadout_builds`.
4. Visibility (`private` / `public` / `unlisted`) and share tokens control discovery/sharing.
5. Favorites land in `build_favorites`.

## Build keys

Saved configs prefer stable Armory namespaces:

- `/Armory/Helminth/...`
- `/Armory/Ability/...`
- `/Armory/Archon/...`

Older v1 Helminth fields (DE unique names / ability indexes) still resolve via `shared/buildReference.ts` for backward compatibility.

## What to watch out for

- Catalog must be imported before the builder has useful equipment/mod lists.
- Artifact slot layout changes may require reconciliation helpers under `server/db/` (admin tooling / migrations).
- Public/unlisted sharing and tokens are security-sensitive — do not weaken access checks in `buildAccess.ts` / `loadoutAccess.ts`.

## Related

- [Warframe modding](../domain/warframe-modding.md)
- [Data import](data-import.md)
- [Share and visibility](share-and-visibility.md)
- [Databases](../architecture/database.md)
