---
type: Domain Concept
title: Codex Modular Weapons
description: Derived modular-component catalog for Codex worksheets, plus DE codex_secret / exclude_from_codex flags.
tags: [codex, modular, catalog]
timestamp: 2026-07-18T21:05:00Z
---

# Codex Modular Weapons

After weapons export processing, Armory derives a Codex-oriented subset of modular parts into `codex_modular_weapons`. Codex Warframe sync prefers this table for the Modular Weapons worksheet. Separately, DE export booleans are stored as `codex_secret` / `exclude_from_codex` on several catalog tables. Related: [databases](../architecture/database.md), [data import](../workflows/data-import.md), [Warframe Market links](../integrations/warframe-market.md).

## Where to start

| Concern                 | Path                                                                |
| ----------------------- | ------------------------------------------------------------------- |
| Heuristics + sync       | `server/codexModularWeapons.ts`                                     |
| Called from export load | `server/db/queries.ts` (`syncCodexModularWeaponsTable`)             |
| Schema / bootstrap      | `server/db/catalogSchema.ts` (`ensureCodexModularWeaponsPopulated`) |
| Tests                   | `server/codexModularWeapons.test.ts`                                |

## Modular trackables

`isCodexModularTrackableWeapon` keeps MR-style trackable components (barrels, tips, prisms) and excludes scaffolds/grips/braces and similar path markers. Display override example: `"Mote Prism"` → `"Mote Amp"`.

Table `codex_modular_weapons`: `unique_name` PK, `name`, `display_order`, `active` (soft-off when no longer trackable). Sync is **display-name deduped** (first unique_name wins). `ensureCodexModularWeaponsPopulated` fills only when active count is 0 and `weapons` already has rows.

Codex falls back to duplicated path heuristics on `weapons` if the table is missing/empty — prefer keeping this Armory table authoritative.

## DE codex flags

Persisted from export JSON as integers on catalog entities:

| Tables                                    | Flags                                |
| ----------------------------------------- | ------------------------------------ |
| `warframes`, `weapons`, `mods`, `arcanes` | `codex_secret`, `exclude_from_codex` |
| `companions`                              | `codex_secret` only                  |

**Today:** Armory stores the flags; Codex sync does **not** filter on them. Treat them as preserved DE metadata until consumer code is added.

## What to watch out for

- `codex_modular_weapons` may not be cleared by the same reset path as other catalog tables — force re-import / weapons reprocess should refresh it; verify after catalog resets.
- Market Modular Weapons names prefer active rows from this table — populate before expecting complete market indexing.
- Do not assume `exclude_from_codex` hides items in Codex collection yet.

## Related

- [Databases](../architecture/database.md)
- [Data import](../workflows/data-import.md)
- [Warframe Market links](../integrations/warframe-market.md)
- [Warframe modding](warframe-modding.md)
