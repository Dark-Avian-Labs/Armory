---
type: Domain Concept
title: Warframe Modding
description: Helminth, Archon shards, artifact slots, Incarnon, and related in-app game mechanics.
tags: [warframe, helminth, archon, incarnon]
timestamp: 2026-07-18T20:40:00Z
---

# Warframe Modding

Armory models Warframe modding concepts needed for planning builds. Catalog facts come from the [import pipeline](../workflows/data-import.md); the [mod builder](../workflows/mod-building.md) applies them in UI and saved `mod_config`.

## Where to start

| Concept                     | Path                                                                               |
| --------------------------- | ---------------------------------------------------------------------------------- |
| Helminth registry / keys    | `shared/helminthRegistry.ts`, `shared/helminthRegistry.generated.ts`               |
| Archon shards               | `shared/archonShardRegistry.ts`                                                    |
| Build resolution            | `shared/buildReference.ts`                                                         |
| Artifact / slot layout      | `shared/` slot layout helpers; admin slot tooling under `client/components/Admin/` |
| Client damage / riven utils | `client/utils/`                                                                    |

## Core concepts

- **Polarities and slots** — equipment artifact slots constrain which mods fit; Overframe enrichment is force-only (prefer admin slot editor for fixes).
- **Helminth** — subsumable ability replacement; stable keys under `/Armory/Helminth/...`; wiki step sets subsumable flags.
- **Abilities** — referenced via `/Armory/Ability/...` keys derived from DE paths/names.
- **Archon shards** — color/buff catalog + `/Armory/Archon/...` keys in build config.
- **Incarnon** — evolution data synced when weapons export changes (`incarnonWiki` step).
- **Damage / rivens** — client-side helpers compute planner stats from catalog + config (not a separate server sim service).

## What to watch out for

- Prefer Armory keys in new saves; keep v1 Helminth resolution paths working when touching `buildReference.ts`.
- Generated Helminth registry files are produced by scripts — do not hand-edit generated output casually.
- Rank exceptions and exalted stance steps affect catalog truth for specific warframes/weapons.

## Related

- [Mod building](../workflows/mod-building.md)
- [Data import](../workflows/data-import.md)
- [Databases](../architecture/database.md)
