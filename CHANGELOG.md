# Changelog

This project follows [Semantic Versioning](https://semver.org/).

## 0.2.0

### Minor Changes

- Smaller public surface, one way to remove a node, and relative placement.
  
  **Breaking.** The package now exports exactly 14 names: `createDemo`,
  `loadDemo`, `Demo`, `Scene`, `Timeline`, `Player`, `registerIcon`,
  `iconNames`, `StrokeFont`, `DEFAULT_FONT`, `DEFAULT_THEME`, `CompileError`,
  `DemoJSONError` and `parseDemoJSON`. The renderer, cursor-path maths, seed
  derivation, DOM patching, timing constants and `layoutText` are no longer
  exported, and `Demo.compiled()` is no longer part of the typed surface. Nothing
  documented in the README was removed.
  
  **Breaking.** `demo.remove(id)` is gone. `demo.scene.remove(id)` is the one
  removal path and now also frees the node's cached geometry, which it did not
  before.
  
  **New.** Relative placement: a node can be added with `below`, `above`,
  `rightOf` or `leftOf` naming an existing node, plus `gap` and `alignTo`,
  instead of literal `x`/`y`. The position is resolved once at creation and
  stored as plain coordinates, so documents and rendering are unchanged. Placed
  and literal scenes render byte-identically.

## 0.1.0

First release of sketch (`@drietsch/sketch`): an API-first library for sketching
hand-drawn GUI mockups and animating how they are used.

- Scene model with semantic ids, parents, z-order, bounds and hit-testing.
- Primitives (rect, ellipse, line, path, text, icon) and components (button,
  input, panel, window, browser) with hovered, pressed, focused and disabled
  looks.
- Text drawn as sketched strokes from the Hershey sans stroke font, with
  exact metrics in every environment.
- Icons in the `@sketchyicons/data` shape: 47 built in, any passable
  directly, more registrable by name.
- Timeline: moveCursor, click, press, release, type, clear, wait, focus,
  blur, setValue and set, compiled against the scene with Fitts-style cursor
  timing, seeded curved paths and a human typing cadence.
- Rendering to an SVG string at any time, or into a live `<svg>` through a
  Player with play, pause, seek, rate, loop and events.
- JSON documents that round-trip to byte-identical output.
- Determinism contract: same document, seed and time give the same bytes;
  no unseeded randomness anywhere in rendering.

The sketch-geometry engine in `src/sketch/` is derived from
[roughjs](https://github.com/rough-stuff/rough) 4.6.6 by way of
`@drietsch/roughjs` 5.0.0 (this repository's previous life as a fork). Its
output is pinned by a 946-case golden digest and has not changed.
