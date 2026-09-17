# Changelog

This project follows [Semantic Versioning](https://semver.org/).

## 0.7.1

### Patch Changes

- 8307d89: Documentation for agents ships with the package: `docs/API.md` (every export,
  node type, prop, timeline step and error), `docs/for-agents.md` (workflow,
  rules, runnable recipes, error-to-fix table) and an `llms.txt` index. Every
  code block in the docs and the README runs against the built package in CI.

## 0.7.0

### Minor Changes

- 8c2df46: Submenus, one-step `choose` through menus, and a catalogue check.
  
  A `MENU` or `CONTEXT_MENU` item may carry `items`, which opens a submenu to
  its right while it is the menu's `value`. `choose(menu, item)` now walks the
  way there in one step: it opens the menu, opens the submenu that holds the
  item and clicks it, and `choose(menubar, item)` opens the menu that holds the
  item first. Components declare that route through `pathTo`.
  
  `pnpm run verify:components` (part of `check` and CI) asserts that every
  registered node type has a factory on `Demo`, an exported node interface, a
  README table row and a fixture that pins its look.

## 0.6.0

### Minor Changes

- 63fcb2e: The rest of Base UI's catalogue: fifteen popups and overlays, on an anchoring and overlay layer.
  
  New node types with factories: `TOOLTIP`, `PREVIEW_CARD`, `POPOVER`, `MENU`,
  `CONTEXT_MENU`, `MENUBAR`, `NAVIGATION_MENU`, `SELECT`, `COMBOBOX`,
  `AUTOCOMPLETE`, `DIALOG`, `ALERT_DIALOG`, `DRAWER`, `TOAST` and `SCROLL_AREA`.
  A popup with an `anchor` is placed against that node by the layout pass (after
  everything else, so it follows auto-layout and `set` steps) and needs no
  coordinates; dialogs, drawers and toasts sit against the page. Popups draw on
  the overlay layer above every ordinary node, together with their children,
  and hit-testing lets a dialog's own buttons win over its body while its
  backdrop takes every other click.
  
  The timeline understands how they open: hovering an anchor opens its tooltip
  after the delay and rests there, and moving away closes it; a click on a
  popover's anchor toggles it; a click outside an open menu, select or popover
  dismisses it; typing into a combobox opens and filters its list; `open` and
  `close` on any of them go through the anchor or the close mark when there is
  one and apply instantly otherwise. A row scrolled out of a scroll area's
  viewport is rejected as a target with a clear error.
  
  Also: a scroll area clips its children with a self-contained `clipPath` per
  group (so a mounted document still equals `toSVG(t)`), the focus ring paints
  under overlays unless its node is inside one, `wrapText` word-wraps
  descriptions, and containers with a default size (`WINDOW`, `DIALOG`,
  `POPOVER`, `DRAWER`) no longer require a stored width or height.

## 0.5.0

### Minor Changes

- 0e2df5b: Twenty controls from Base UI's catalogue, and semantic timeline steps that use them.
  
  New node types, each with a factory (`demo.checkbox`, `demo.radioGroup`, …):
  `CHECKBOX`, `CHECKBOX_GROUP`, `SWITCH`, `TOGGLE`, `TOGGLE_GROUP`, `RADIO_GROUP`,
  `SLIDER`, `PROGRESS`, `METER`, `SEPARATOR`, `AVATAR`, `NUMBER_FIELD`,
  `OTP_FIELD`, `FIELD`, `FIELDSET`, `FORM`, `TOOLBAR`, `COLLAPSIBLE`, `ACCORDION`
  and `TABS`. Model state uses Base UI's names as props on the node (`checked`,
  `pressed`, `open`, `value`); list-like controls take `options`, `items` or
  `tabs` and draw their entries as parts with clickable regions. `FIELD`, `FORM`,
  `TOOLBAR` and `COLLAPSIBLE` are auto-layout containers with sensible defaults;
  a closed `COLLAPSIBLE` and the inactive panels of `TABS` hide their children.
  
  The timeline gains `check`, `uncheck`, `toggle`, `choose`, `open`, `close`,
  `hover` and `drag`. Each compiles into the cursor moves and clicks a person
  would make on the control's regions (an option row, a tab header, a stepper
  button, the slider thumb) and records the state change on the compiled step,
  so seeking stays a pure replay. A plain `click(id)` applies a control's natural
  effect. A step the target cannot take is a `CompileError` naming the step, the
  node and its type. `demo.nodeAt(id, t)` reports the live `value`, `checked`,
  `open` and `pressed`.
  
  Components declare `regions`, a `click` action, `capabilities`, `validate`,
  `container`, `childVisible` and `layoutDependsOnState`; `Scene.hitTestDetailed`
  resolves a point to a node and its region; parts may sit on an overlay layer
  that paints above every ordinary node (used by the popups of the next release).
  The stroke font gains `…`, curly quotes, en and em dashes. Breaking:
  `ComponentState.checked` moved to the node's `checked` prop; `InteractionState`
  keeps `values`, `checked` and `open` maps.

## 0.4.0

### Minor Changes

- Auto-layout frames, with Figma's properties.
  
  A `FRAME` (or a `WINDOW`'s content area) can position its children:
  `layoutMode` (`HORIZONTAL` / `VERTICAL`), `itemSpacing`, `padding*` (plus a
  `padding` shorthand at creation), `primaryAxisAlignItems` (`MIN` / `CENTER` /
  `MAX` / `SPACE_BETWEEN`), `counterAxisAlignItems`, and `layoutSizingHorizontal`
  / `layoutSizingVertical` (`FIXED` / `HUG` / `FILL`). Children of such a frame
  need no coordinates; `layoutPositioning: 'ABSOLUTE'` opts a child out. A frame
  needs a stored size only on a `FIXED` axis.
  
  Every geometry read (`bounds`, `position`, `hitTest`, relative placement, the
  timeline compiler, the renderer) goes through one cached layout pass, so
  laid-out and literal nodes behave alike, and timeline `set` steps that change
  spacing, a label or visibility reflow at that moment. Stored nodes and
  documents never contain computed sizes. Scenes without auto-layout render
  byte-identically to before.
  
  The patched scene a timeline `set` step produces is now cached per patch
  state, so a player pays one clone per step rather than per frame.

## 0.3.0

### Minor Changes

- Figma's vocabulary, Figma's property shapes, and a nested document.
  
  **Breaking.** Node types are Figma's, in upper snake case: `RECTANGLE`,
  `ELLIPSE`, `LINE`, `VECTOR` (was path), `TEXT`, `FRAME` (was panel), and
  sketch's own `ICON`, `BUTTON`, `INPUT`, `WINDOW`. Factories follow:
  `demo.rectangle()`, `demo.vector()`, `demo.frame()`. Auto-generated ids are
  lowercase (`rectangle-1`). The render method `demo.frame(t)` is now
  `demo.frameAt(t)` so that `frame` can be the container factory.
  
  **Breaking.** Visual properties take Figma's shapes at node level: `fills` and
  `strokes` are `Paint[]` (`{ type: 'SOLID', color, opacity?, visible? }`, colour
  as `{ r, g, b, a }` in 0..1 or a CSS string), plus `strokeWeight`,
  `strokeDashes`, `cornerRadius`, `opacity`, `visible` (replaces `hidden`). Text
  content is `characters`; text styling is a `style: TypeStyle` with `fontSize`,
  `textAlignHorizontal` (`LEFT` / `CENTER` / `RIGHT`) and `fills`. The
  hand-drawn knobs move under `sketch: { roughness, bowing, fillStyle,
  hachureGap, hachureAngle, fillWeight }`. The old `style` bag is gone.
  `Theme.strokeWidth` is `strokeWeight`.
  
  **Breaking.** Documents are version 2: nested `children` back to front, no
  `parent` keys. Version 1 documents (0.1.0 and 0.2.0) load and migrate
  automatically, timeline patches included, and render byte-identically.
  
  **Unchanged.** Every sketched pixel: the only difference in rendered output
  is the `data-type` attribute carrying the new type names.

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
