# Changelog

This project follows [Semantic Versioning](https://semver.org/).

## 0.9.0

### Minor Changes

- 7bb72d0: Nodes can carry authored click actions, so a mockup's own buttons do something.
  
  `NodeBase` gains `reactions: Reaction[]`, Figma's name for what an interaction
  does. A reaction is `{ trigger: 'ON_CLICK', action }`, where the action is the
  same `WidgetAction` a component's own click returns: `target` (defaulting to the
  node carrying the reaction) plus any of `checked`, `open`, `value` and `focus`.
  A dialog's Cancel button now closes the dialog by itself:
  
  ```ts
  demo.button({
    id: 'cancel',
    parent: 'actions',
    characters: 'Cancel',
    reactions: [{ trigger: 'ON_CLICK', action: { target: 'confirm', open: false } }],
  });
  demo.timeline.click('cancel');
  ```
  
  Every reaction on the node a click hits fires, in the order written, after the
  component's own effect, so a reaction wins where the two disagree. They fire for
  any click that lands on the node, including the clicks a semantic step makes on
  the way, but not for `set`, `setValue` or a hand-written `press`/`release` pair.
  A reaction may name a node added after it; a target that never exists is a
  `CompileError` on the step that would have fired it, and a malformed reaction is
  rejected when the node is added or loaded.
  
  New exported types: `Reaction` and `ReactionTrigger`. `WidgetAction` moved to
  `core/types` and is still exported under the same name. Nothing else changes:
  documents without reactions compile and render exactly as before.
- 7bb72d0: Annotation marks: the layer someone reviewing a screen draws on top of it.
  
  Five node types, all drawn by the engine like everything else, so they wobble
  the way a pen does rather than arriving as clean vectors — at roughly twice the
  theme's roughness, which a node's own `sketch.roughness` still overrides.
  
  - `HIGHLIGHT` — a translucent marker band, one thick sweep or the whole box.
  - `ENCIRCLE` — a ring around the box, `oval` or `rect`, drawn in `passes` turns
    of the pen, each from its own random stream so the turns differ.
  - `UNDERLINE` — `straight`, `double`, `wavy`, `zigzag`, `scribble` or `loop`,
    under the box or struck `through` it.
  - `ARROW` — a shaft between two nodes or points: `straight`, `curved`, `s` or
    `elbow`, with heads at either or both ends.
  - `CALLOUT` — a `bubble`, `burst` or `cloud` carrying a note.
  
  ```ts
  demo.button({ id: 'pay', x: 40, y: 60, characters: 'Pay now', variant: 'primary' });
  demo.encircle({ id: 'ring', target: 'pay', spread: 10 });
  demo.callout({ id: 'tip', target: 'pay', side: 'top', characters: 'One tap and you are done' });
  demo.arrow({ id: 'link', from: 'terms', to: 'pay', curve: 'curved' });
  ```
  
  A mark names a `target` and takes that node's box, so it follows what it
  annotates when the interface moves or resizes; `spread` grows the box first, so
  a ring clears what it circles. Without a target a mark sits at its own `x`/`y`
  and size. Marks are never hit-tested, so one drawn over a button does not eat
  the click, and they stay outside an auto-layout parent's flow.
  
  An arrow's endpoints are node ids or `{ x, y }` points. Aimed at a node it
  stops `gap` short of that node's edge rather than its centre, `fromSide`/`toSide`
  pin which edges it leaves and meets (`auto` takes the shortest way), and the
  head follows the shaft's direction where it arrives, so a curved or elbowed
  arrow points the way it is travelling. A callout is placed like a popup —
  `side` and `align` — and its tail is drawn from the bubble's edge to the
  target's, so it re-aims itself whenever either one moves.
  
  New in `ComponentDef` for components that take their geometry from other nodes:
  `fit` (which nodes to wait for, the box to occupy, and whether it can place
  itself) and `references` (ids the scene checks exist). New exported types:
  `AnnotationBase`, `HighlightNode`, `EncircleNode`, `UnderlineNode`,
  `UnderlineVariant`, `ArrowNode`, `ArrowEnd`, `ArrowSide`, `CalloutNode`,
  `CalloutShape`.
- dd277d3: Text can carry weight, and a heading can sit on a marker.
  
  The default font ships in one cut, and its glyphs were the one thing in a scene
  the engine never touched: filled outlines, straight into a path, while
  everything around them wobbled. A weight above 400 now goes round the same
  letterform again, so a heading gains thickness and a hand-drawn edge in the
  same stroke; how the pen does that is under *One font, written in pencil*.
  
  ```ts
  demo.text({ id: 'h', x: 40, y: 40, characters: 'Checkout', style: { fontSize: 30, fontWeight: 700 } });
  demo.text({ id: 'h2', x: 40, y: 100, characters: 'Billing', style: { fontSize: 26, marker: true } });
  ```
  
  `TypeStyle` gains `fontWeight` (400–900) and `marker`. Any value in between
  works, since there is no second face to snap to. The pen is held back below
  24px and is barely there at label sizes, so small text keeps its counters open
  instead of filling in.
  
  `marker` sweeps a band under the words before they are written, so the ink
  reads over it: `true` takes the theme's grey, a `Paint` names the colour and
  opacity. It is never applied on its own — a banded heading is a decision, and
  an automatic one would blunt what a `HIGHLIGHT` mark means. (A `HIGHLIGHT`
  cannot do this job: it is a review mark and draws on top, which greys the
  heading out.)
  
  A component's own heading — window, frame, dialog, drawer and toast titles, and
  a fieldset's legend — is written at 600 by default, which moves those scenes'
  golden digests. The node's own `style.fontWeight` overrides it, and every other
  piece of text stays at 400.
  
  Bold is real geometry: a bold string is roughly three to four times the path
  data of the same string at 400, so it belongs on headings rather than body
  text.
- fed3db9: One font, written in pencil.
  
  **Text is drawn now, not printed.** Every glyph is gone round with a fine
  graphite line, once by default, each contour straying a hair from the
  letterform so the lines differ the way a hand's do. The letterform itself is
  laid down a little short of solid, and the contours lighter still, so tone
  builds where strokes overlap instead of arriving flat and black.
  
  **Weight is contour strokes, not a broader pen.** A heavier weight goes round
  the letter more times rather than widening the nib: 400 is one contour, 700 is
  three, 900 is four, and the pen itself barely grows. The previous approach —
  one fat pen — thickened a word by eroding its counters, which stopped looking
  written at all. `theme.textPasses` sets the base number of contours, and `0`
  leaves the bare letterform.
  
  **Consequence: text follows the document seed.** A plain weight used to render
  identically whatever the seed; now the hand over it does not. The same document
  and seed still give the same bytes.
  
  **Only Grape Nuts ships.** `HERSHEY_FONT` is no longer exported and its data is
  out of the bundle. Documents saved before 0.8.0 name it, so loading one now
  throws unless the font is supplied — the error already says how:
  
  ```ts
  loadDemo(json, { font: myHersheyFont });
  ```
  
  The converted face has moved to `test/support/hershey-sans.ts`, where the
  migration tests hand it to `loadDemo` to prove those documents still render
  byte-identically. `createDemo({ font })` still takes any `StrokeFont`, and the
  stroke-font path is unchanged for one.
  
  Golden digests move: every scene with text draws differently.
- dd277d3: Containers are drawn the way a hand draws a box.
  
  A rounded rectangle from the engine closes its corners neatly however rough the
  line is, which is what made a window frame read as printed rather than drawn.
  A container's outline is now a light marker band, four straight edges that each
  run past their corners, a second thinner pass over them, and two short strokes
  re-inking each corner.
  
  It applies to `WINDOW`, `FRAME`, `FIELDSET`, `FORM` and `TOOLBAR`, and to the
  raised panels of `DIALOG`, `ALERT_DIALOG` and `DRAWER` — those take the ink
  without the band, since their shadow already carries the weight. A node with no
  stroke gets none of it, and `SCROLL_AREA` keeps the plain rectangle because its
  clip would cut the overshoot off mid-stroke.
  
  Three new theme keys, all of which a document can dial or turn off:
  
  ```ts
  createDemo({ width: 900, height: 600, theme: { frameOvershoot: 12, frameBand: 10, frameBandOpacity: 0.4 } });
  createDemo({ width: 900, height: 600, theme: { frameOvershoot: 0 } }); // the old plain rectangle
  ```
  
  `frameOvershoot` (8) is how far each edge runs past its corner, capped at a
  quarter of the box's shorter side; `frameBand` (8) is the band's width, capped
  at an eighth; `frameBandOpacity` (0.5) is how strongly it shows. A container
  shallower than 56px takes the ink without a band, and one shallower than 28px
  keeps the plain rectangle, so a toolbar strip does not turn to scribble. A node's own `sketch.roughness` and
  `sketch.bowing` scale the whole treatment as before.
  
  Every scene with a container renders differently, so the golden digests move.
  Nothing about the model, the timeline or the API changes.

## 0.8.0

### Minor Changes

- 63190d0: The default font is now Grape Nuts, a handwriting face, set in capitals.
  
  Text is drawn from vendored glyph outlines of
  [Grape Nuts](https://fonts.google.com/specimen/Grape+Nuts) (SIL Open Font
  License) as filled paths, folded to upper case when measured and drawn while
  the model keeps the case you wrote. It covers printable ASCII, the Latin-1
  letters and common symbols, and the typographic characters UI copy uses.
  The previous default, the Hershey sans drawn as sketched single strokes, is
  exported as `HERSHEY_FONT`; a document saved with either built-in font loads
  without help, since `loadDemo` finds built-in fonts by name.
  
  `StrokeFontData` gains `kind` (`stroke` | `outline`), `uppercase` and
  `lineHeight`, and `OutlineGlyph`; `StrokeFont` gains `fold` and `outline`.
  Every scene that shows text renders differently from 0.7; the engine and
  geometry are untouched.

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
