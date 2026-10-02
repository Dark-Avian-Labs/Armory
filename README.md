<p align="center">
  <img src="https://raw.githubusercontent.com/Dark-Avian-Labs/.github/refs/heads/main/banner.png" alt="Dark Avian Labs">
</p>

# Armory

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg?style=flat-square)](LICENSE)
![Node](https://img.shields.io/badge/Node-%3E%3D26-339933?logo=node.js&logoColor=white&style=flat-square)
![TypeScript](https://img.shields.io/badge/TypeScript-7.x-3178C6?logo=typescript&logoColor=white&style=flat-square)
![React](https://img.shields.io/badge/React-19.x-61DAFB?logo=react&logoColor=black&style=flat-square)
![Vite](https://img.shields.io/badge/Vite-8.x-646CFF?logo=vite&logoColor=white&style=flat-square)
![Tailwind CSS](https://img.shields.io/badge/Tailwind_CSS-4.x-06B6D4?logo=tailwindcss&logoColor=white&style=flat-square)
[![Cursor](https://img.shields.io/badge/Cursor-IDE-141414?logo=cursor&logoColor=white&style=flat-square)](https://cursor.com)

Armory is a Warframe mod builder that feels closer to the Arsenal than to a spreadsheet. Pick a frame or weapon, stack the mods, and save the result so the next mission is a click away.

It is for players who theorycraft at a desk and want the extra stats, Helminth choices, and shard layouts the in-game screen does not keep around.

## Features

**A builder for the whole kit.** Frames, weapons, companions, and the rest of the arsenal open in the same mod screen. Helminth replacements, Archon shards, Incarnon upgrades, and rivens sit on that build instead of in a separate note.

**Named builds and loadouts.** A build is one item. A loadout groups the pieces you actually take on a mission. Favorites keep the ones you reuse at the top.

**Public, unlisted, or private.** Public builds show up in the catalog for that item. Unlisted builds open from the link. Private ones stay on your account. A share image can carry a background you pick, which is the version people post.

**Foil on the odd mods.** Atragraph mods get a holo pass on the card, so the weird ones are easy to spot in a full grid.

**The same names as Codex.** The item list is a copy of Codex's Warframe catalog. A frame you track there is the frame you build here.

## What you should know

Public builds are open to anyone. Saving your own, favorites, and private builds need a Dark Avian Labs account. The same sign-in opens Codex, Outfitter, BudgetPlanner, and Sentinel. The left rail jumps between those sites.

The catalog starts empty on a fresh copy. It fills when you sync it from a Codex catalog database. Until that sync has run, the builder has nothing to pick.

Live: [armory.darkavianlabs.com](https://armory.darkavianlabs.com)

## Self-hosting

Node 26 or newer, and pnpm 12. Copy `.env.example` to `.env.development`. `pnpm start` leaves `NODE_ENV` unset, so it reads that file. A hosted process needs `NODE_ENV=production` and `.env.production`, or production refuses to boot.

```
pnpm install
pnpm run build
pnpm start
```

`pnpm run catalog:sync` copies Codex's Warframe catalog into Armory. It runs from the build output, so it has to follow `pnpm run build`, and `CODEX_WARFRAME_CATALOG_DB_PATH` has to point at a real Codex database. The client bundle reads `VITE_` values at build time, so fill `.env.production` before `pnpm run build` when you are hosting.

## License

MIT
