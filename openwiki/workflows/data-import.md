---
type: Workflow
title: Data Import
description: DE export download, SQLite load, wiki/Overframe enrichment, CLI and admin triggers.
tags: [import, pipeline, catalog]
timestamp: 2026-08-23T04:20:00Z
---

# Data Import

The import pipeline downloads Digital Extremes public exports, rebuilds catalog tables when hashes change, then enriches with wiki, Overframe (force-only for slots), images, and Warframe Market links. It feeds the [catalog database](../architecture/database.md) used by the [mod builder](mod-building.md) and by Codex.

## Where to start

| Trigger          | Path                                                                                        |
| ---------------- | ------------------------------------------------------------------------------------------- |
| Step definitions | `shared/pipelineSteps.ts`                                                                   |
| Orchestration    | `server/import/startupPipeline.ts`, `pipeline.ts`                                           |
| CLI              | `pnpm run data:import` → `server/import/runManualImport.ts`                                 |
| Admin job / SSE  | `server/import/adminImportJob.ts`                                                           |
| Catalog reset    | `server/db/resetCatalogData.ts`                                                             |
| Safe fetch/path  | `server/http/fetchWithTimeout.ts`, `allowedFetchHosts.ts`, `server/import/safeImagePath.ts` |

## Steps (order)

Defined in `PIPELINE_STEPS`:

1. `schema` — create/migrate tables
2. `officialExports` — DE manifest + export JSON
3. `sqliteFromExports` — rebuild game tables when hashes change
4. `warframeRankExceptions` — rank-30 bonus exceptions
5. `exaltedStanceMods` — exalted stance mods / images
6. `atragraphMods` — foil mod art
7. `images` — item images
8. `hiddenCompanionWeapons` — beast claw stats from wiki
9. `overframe` — artifact slots (**manual force only**)
10. `wiki` — abilities, shards, rivens, fire behaviors, etc.
11. `helminthWiki` — Helminth subsumable flags
12. `incarnonWiki` — Incarnon evolutions
13. `warframeMarketLinks` — trade link index

Admin can pass `forceImport`, `forceImages`, and `forceSteps`. Lease/locking uses catalog `import_runs` / `import_lease` so concurrent imports do not collide.

## Typical flows

**CLI:** `pnpm run build` then `pnpm run data:import`.

**Admin:** authenticated Armory admin runs import via API/UI (streamed progress). Force Full Re-import **downloads and verifies required DE exports first**; `resetCatalogData` runs only after those files are on disk and `missingRequiredExports()` is empty. Scraped/image column restore is not the goal of that reset.

## What to watch out for

- Server listen path does **not** auto-run the full pipeline — only schema/lease recovery.
- Overframe slot scrape is force-only; prefer Admin slot editor for polarity fixes.
- Wiki fetches need a valid `WIKI_USER_AGENT`.
- Never reset catalog into a DB that also holds user tables.
- Outbound imports use HTTPS host allowlists, `redirect: 'error'`, response byte caps, DNS-rebinding pin (`allowedFetchHosts.ts` + undici `Agent` in `fetchWithTimeout.ts`), and path containment under `IMAGES_DIR` (no `..` escapes). Export JSON is validated before it replaces on-disk files. Manifest decompression uses `@napi-rs/lzma` with a **64 MB** decompressed cap. Overframe traffic goes through `fetchOverframe` (cuimp) with its own host checks. Successful import busts `modListCache` and `catalogResponseCache`.
- Admin SSE import progress skips response compression (`text/event-stream`).

## Related

- [Databases](../architecture/database.md)
- [Warframe modding](../domain/warframe-modding.md)
- [Warframe Market links](../integrations/warframe-market.md)
- [Codex modular weapons](../domain/codex-modular-weapons.md)
- [Clerk auth](../integrations/clerk-auth.md) (admin gate)
