# Pre-blur background prototype

Standalone page for comparing background blur strategies used in Armory/Codex.

## Run locally

From this folder:

```bash
npx serve .
```

Then open the URL it prints (usually `http://localhost:3000`).

A local server is required so the ASCII art assets in `./assets/` load correctly.

## What to try

Use the header controls for **color mode** (dark/light), **UI style** (Prism, Shadow, Clear, Liquid), and **render mode** (Hybrid, Pre-blur only, Legacy).

1. **Hybrid (default)** — sharp ASCII + CSS gradients in gaps; pre-blurred slices in frosted themes; small live blur on headers/modal. Clear uses solid panels. Liquid uses pre-blur slices + SVG distortion on the slice (not live backdrop blur).
2. **Pre-blur only** — same panel slices, no live header blur.
3. **Legacy** — live `backdrop-filter` on panels (original Prism/Shadow behavior).

The badge shows the active combo, e.g. `hybrid · shadow · dark`.

Use the sliders to adjust background blur radius and header blur radius. Scroll the table, hover rows under the sticky header, and open the modal to compare banding and motion.
