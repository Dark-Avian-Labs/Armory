---
type: Integration
title: Warframe Market Links
description: Pipeline step that indexes Warframe Market sell/auction URLs into the catalog for Codex sync.
tags: [warframe-market, catalog, codex, import]
timestamp: 2026-07-18T21:05:00Z
---

# Warframe Market Links

The `warframeMarketLinks` import step builds a trade-link index in the [catalog database](../architecture/database.md). Armory stores the rows; **Codex Warframe sync** is the primary consumer (worksheet `market_href` / `market_href_prime`). This step runs after exports/enrichment in the [data import](../workflows/data-import.md) pipeline and prefers modular names from [Codex modular weapons](../domain/codex-modular-weapons.md).

## Where to start

| Concern         | Path                                                   |
| --------------- | ------------------------------------------------------ |
| Orchestration   | `server/warframeMarket/populateWarframeMarketLinks.ts` |
| Slug fetch      | `server/warframeMarket/fetchWarframeMarketSlugs.ts`    |
| Href rules      | `server/warframeMarket/resolveHref.ts`                 |
| Name normalize  | `server/warframeMarket/canonical.ts`, `slug.ts`        |
| Catalog sources | `server/warframeMarket/armorySources.ts`               |
| Step metadata   | `shared/pipelineSteps.ts` (`warframeMarketLinks`)      |
| Table DDL       | `server/db/catalogSchema.ts` → `warframe_market_links` |

## Behavior

1. Fetch all item slugs from Warframe Market API v2 (`/v2/items`, PC/en).
2. Walk Armory catalog display names by worksheet category.
3. Resolve sell or auction URLs (item sell tries base / `_set` / `_blueprint` slugs; Kuva → lich auctions; Tenet non-melee → sister auctions).
4. Upsert into `warframe_market_links` keyed by `(canonical_key, worksheet_category)` with `market_href`, `market_href_prime`, `link_kind` (`item` \| `sister` \| `lich`).

Runs when the catalog has data and (`dataChanged` **or** the links table is empty). Failures are recorded in the pipeline summary and do not abort the rest of import.

## What to watch out for

- Armory does not expose these rows as a first-class HTTP catalog API for the planner UI — Codex sync reads SQLite directly.
- Prime vs non-prime: prime variants write `market_href_prime`; non-prime rows whose resolved slug is prime-only can be nulled.
- Tenet **melee** is not sister-auction routed.
- Modular Weapons worksheet names prefer active `codex_modular_weapons` rows.
- Fetch timeout for the WM items call is long (120s via `fetchWithTimeout`); empty table forces a refresh next run.
- Catalog reset clears `warframe_market_links` with other catalog tables.

## Related

- [Data import](../workflows/data-import.md)
- [Databases](../architecture/database.md)
- [Codex modular weapons](../domain/codex-modular-weapons.md)
