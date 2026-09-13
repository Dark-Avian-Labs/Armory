<p align="center">
  <img src="https://raw.githubusercontent.com/Dark-Avian-Labs/.github/refs/heads/main/banner.png" alt="Dark Avian Labs">
</p>

# Armory

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg?style=flat-square)](LICENSE)
[![CI](https://img.shields.io/github/actions/workflow/status/Dark-Avian-Labs/Armory/ci.yml?style=flat-square&label=CI)](https://github.com/Dark-Avian-Labs/Armory/actions/workflows/ci.yml)
[![PR](https://img.shields.io/github/actions/workflow/status/Dark-Avian-Labs/Armory/pr.yml?style=flat-square&label=PR)](https://github.com/Dark-Avian-Labs/Armory/actions/workflows/pr.yml)
![Node](https://img.shields.io/badge/Node-%3E%3D26-339933?logo=node.js&logoColor=white&style=flat-square)
![TypeScript](https://img.shields.io/badge/TypeScript-7.x-3178C6?logo=typescript&logoColor=white&style=flat-square)
![React](https://img.shields.io/badge/React-19.x-61DAFB?logo=react&logoColor=black&style=flat-square)
![Vite](https://img.shields.io/badge/Vite-8.x-646CFF?logo=vite&logoColor=white&style=flat-square)
![Tailwind CSS](https://img.shields.io/badge/Tailwind_CSS-4.x-06B6D4?logo=tailwindcss&logoColor=white&style=flat-square)
[![Cursor](https://img.shields.io/badge/Cursor-IDE-141414?logo=cursor&logoColor=white&style=flat-square)](https://cursor.com)

Armory is where Warframe builds get assembled for real. Pick a frame, stack mods, Helminth, Archon shards, and Incarnon, then save the loadout so the next mission is a click away instead of another trip through the Arsenal.

The catalog follows Digital Extremes' public export and fills gaps from the wiki, so names and stats stay close to what you see in game. Codex reads that same catalog when it tracks your collection.

Live: [armory.darkavianlabs.com](https://armory.darkavianlabs.com)

## Gotchas

- Three SQLite files: catalog, user builds, and sessions. They must be different paths.
- First boot is an empty catalog on purpose. Import data (or Admin Force Full Re-import) before Codex can sync Warframe.

## License

MIT
