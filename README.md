# sketch

`@drietsch/sketch`: an API-first JavaScript/TypeScript library for creating
and animating hand-drawn GUI mockups.

Build complete interfaces (windows, panels, inputs, buttons, icons, text) in a
sketch-style visual language, then script how someone uses them: the cursor
moves, clicks, focuses and types on a seekable timeline. Output is SVG, as a
string in Node or a live document in the browser, and everything is
deterministic: the same document, seed and timestamp always produce
byte-identical output.

> Everything that can be drawn, edited, animated or interacted with has a
> public API representation. A future visual editor uses the same API.

```ts
import { createDemo } from '@drietsch/sketch';

const demo = createDemo({ width: 900, height: 600, seed: 42 });

demo.input({ id: 'email', x: 250, y: 200, width: 350, placeholder: 'Email' });
demo.button({ id: 'login', x: 470, y: 300, text: 'Sign in' });

demo.timeline.moveCursor('email').click().type('email', 'hello@example.com').moveCursor('login').click();

demo.toSVG(1500); // the frame at 1.5 s, as an SVG string
demo.mount(document.querySelector('#stage')).play(); // or play it in the browser
```

## Install

```sh
npm install @drietsch/sketch
```

ESM only, zero runtime dependencies, Node 24+ or any modern browser. Import it
from a bundler or a `<script type="module">`.

## Concepts

**Scene.** What exists: a flat store of nodes addressed by id, each with a
type, a position and optional `parent`. Children are positioned relative to
their parent's content area, so moving a window moves everything in it.
Nodes are created through the demo's factories and edited through the scene:
`demo.scene.get(id)` (or `node(id)`, which throws instead of returning
`undefined`), `update(id, patch)`, `bounds(id)`, `remove(id)`,
`bringToFront(id)` and `hitTest(point)` are the whole editing surface.

**Components.** Semantic nodes that expand into sketched parts: `button`,
`input`, `panel`, `window` and `browser`, next to the primitives `rect`,
`ellipse`, `line`, `path`, `text` and `icon`. Inputs and buttons are simulated
graphical controls, not native HTML, so focus rings, carets, hover and
pressed looks are all drawn and all exportable.

**Timeline.** What happens and when. A fluent builder over a plain list of
steps: `moveCursor`, `click`, `press`, `release`, `type`, `clear`, `wait`,
`focus`, `blur`, `setValue` and `set` (patch a node from that moment on).
Durations are computed when the timeline is compiled against the scene:
cursor moves follow Fitts's law along seeded curved paths, clicks hold for a
human moment, typing has a human cadence. Pass `duration` to override.

**Rendering.** `demo.frame(t)` is a pure function of the document and the
time. `toSVG(t)` serialises it; `mount(el)` renders it into a live `<svg>`
and returns a `Player` with `play`, `pause`, `seek`, `rate`, `loop` and
events. Between two frames only the groups that changed are rebuilt.

**Determinism.** Every source of randomness, from the wobble of a line to the
curve of a cursor path to the pause between two keystrokes, is drawn from a
seeded stream keyed by the document seed and a stable name (the node id, the
step key). Changing one node never re-randomises another, and seeking to a
time gives the same frame whether you jump there or play through.
`Math.random` and the clock are never consulted while rendering.

## API

### Document

|                                                                    |                                                                                           |
| ------------------------------------------------------------------ | ----------------------------------------------------------------------------------------- |
| `createDemo({ width, height, seed?, theme?, background?, font? })` | A new demo. Omit `seed` for a random one and read it back from `demo.seed`.               |
| `loadDemo(json, { font? })`                                        | Rebuilds a demo from `toJSON()` output; renders identically.                              |
| `demo.toJSON()`                                                    | A plain document: settings, theme, nodes in paint order, embedded custom icons, timeline. |
| `demo.frame(t)` / `demo.toSVG(t)`                                  | The frame at `t` ms as a virtual tree or an SVG string.                                   |
| `demo.frames(fps)`                                                 | Every frame of the timeline, for export.                                                  |
| `demo.mount(el, { autoplay?, loop?, rate?, clock? })`              | Renders into `el` (a container or an `<svg>`) and returns a `Player`.                     |
| `demo.nodeAt(id, t)`                                               | A node with the timeline's patches and live value applied at `t`.                         |
| `demo.duration`                                                    | Length of the timeline in ms.                                                             |
| `demo.registerIcon(name, def)`                                     | An icon for this demo only; travels with `toJSON()`.                                      |

### Nodes

Every factory takes the node's props with an optional `id` (auto-generated as
`type-n` otherwise) and returns the stored node. Common props: `x`, `y`,
`parent`, `style`, `hidden`, `interactive`, `sketchVariant`.

| Factory                        | Props                                                                             |
| ------------------------------ | --------------------------------------------------------------------------------- |
| `demo.rect`                    | `width`, `height`, `radius?`                                                      |
| `demo.ellipse`                 | `width`, `height`                                                                 |
| `demo.line`                    | `x2`, `y2`                                                                        |
| `demo.path`                    | `d` (SVG path data in local coordinates)                                          |
| `demo.text`                    | `text`, `fontSize?`, `align?` (`start`, `middle`, `end`); `\n` breaks lines       |
| `demo.icon`                    | `icon` (a built-in name or an icon definition), `size?`                           |
| `demo.button`                  | `text`, `icon?`, `width?`, `height?`, `variant?` (`default`, `primary`), `state?` |
| `demo.input`                   | `width`, `height?`, `value?`, `placeholder?`, `state?`                            |
| `demo.panel`                   | `width`, `height`, `title?`                                                       |
| `demo.window` / `demo.browser` | `width`, `height`, `title?`, `url?`                                               |

`style` accepts `stroke`, `strokeWidth`, `fill`, `fillStyle` (`hachure`,
`solid`, `zigzag`, `cross-hatch`, `dots`, `dashed`, `zigzag-line`),
`roughness`, `bowing`, `hachureGap`, `hachureAngle`, `fillWeight`, `dash`,
`opacity`, `color` and `fontSize`. `state` accepts `focused`, `pressed`,
`hovered` and `disabled`.

### Relative placement

Instead of `x` and `y`, a node can say where it sits relative to one that
already exists. The position is resolved once, when the node is added, and
stored as plain coordinates; later edits do not reflow neighbours.

```ts
demo.text({ id: 'label', parent: 'card', x: 24, y: 20, text: 'Email' });
demo.input({ id: 'email', below: 'label', gap: 10, width: 320 });
demo.button({ id: 'go', below: 'email', gap: 20, text: 'Sign in' });
demo.button({ id: 'cancel', rightOf: 'go', gap: 12, text: 'Cancel' });
```

- One of `below`, `above`, `rightOf` or `leftOf`, naming the reference node.
- `gap` is the distance between the two edges (default 0, may be negative).
- `alignTo` aligns the cross axis: `start` (default), `center` or `end`.
  Stacking vertically aligns left edges; stacking horizontally aligns tops.
- `x` or `y` on the cross axis overrides the aligned value; giving the
  placement's own axis is an error.
- The new node inherits the reference's `parent` unless `parent` is given.
- A `line` keeps its vector: `x2`/`y2` are read as offsets from the resolved
  origin.

Placement works on boxes, so a centred text or an auto-sized button lands
where its visible edge should be. Placed and literal coordinates render
byte-identically.

### Timeline

```ts
demo.timeline
  .moveCursor('email') // or a point { x, y }; options { duration?, key? }
  .click() // clicks where the cursor is; click('login') moves there first
  .type('email', 'hello') // focuses the input if needed; '\b' deletes
  .wait(300)
  .set('done', { hidden: false }) // patch a node from this moment on
  .at(4000)
  .blur(); // start the next step at an absolute time
```

`demo.timeline.toJSON()` and `Timeline.fromJSON()` round-trip the step list.
A step's `key` pins its random streams, so inserting steps before it never
changes its path or cadence.

### Text and icons

Text is drawn as sketched strokes from a built-in single-stroke font (the
Hershey sans), so measurement, carets and bounds are exact and identical in
every environment. Printable ASCII is covered; other characters draw as a
small box. A custom `StrokeFont` can be passed to `createDemo`.

Icons use the [`@sketchyicons/data`](https://github.com/Fantomiald/sketchyicons)
shape: 47 common icons are built in (`iconNames()` lists them), any of that
package's 1,756 icons can be passed to `demo.icon({ icon })` directly, and
`registerIcon(name, def)` adds more by name. Set `rough: true` on a
definition of clean paths to sketch them.

## Examples

The pages in [`examples/`](examples/) load the built bundle. Run
`pnpm build`, then open them from a static server (or run
`pnpm run verify:pages` to render them all in headless Chromium).

- `sketch-styles.html`: every fill style and primitive
- `text-and-icons.html`: the stroke font at several sizes, every built-in icon
- `login-form.html`: the briefing's mockup with every component state
- `login-demo.html`: the same, animated, with a scrub bar over `toSVG(t)`
- `player.html`: mounted into a live SVG and driven by the `Player`

## Development

```sh
pnpm install
pnpm run check          # lint, format, typecheck, tests, build, dist tests
pnpm run verify:pages   # render every examples/ page in headless Chromium
pnpm run verify:package # pack, install into a temp project, smoke-test
```

The engine's 946-case golden digest and the library's per-fixture SVG digests
pin the visual output; a change to either must be deliberate.

## Credits

The sketch-geometry engine in `src/sketch/` is derived from
[roughjs](https://github.com/rough-stuff/rough) by Preet Shihn (MIT). Text
uses the Hershey Fonts; icons come from sketchyicons, derived from Lucide and
Feather. See [`THIRD-PARTY-NOTICES.md`](THIRD-PARTY-NOTICES.md).

## License

MIT
