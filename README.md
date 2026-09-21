# sketch

`@drietsch/sketch`: an API-first JavaScript/TypeScript library for creating
and animating hand-drawn GUI mockups.

Build complete interfaces (windows, panels, forms, buttons, inputs, checkboxes,
sliders, tabs, icons, text) in a sketch-style visual language, mark them up
the way a reviewer would (highlights, rings, underlines, arrows, callouts),
then script how someone uses them: the cursor moves, clicks, checks, chooses,
drags and types on a seekable timeline, and the mockup's own buttons can react.
Output is SVG, as a string in Node or a live document in the browser, and
everything is deterministic: the same document, seed and timestamp always
produce byte-identical output.

> Everything that can be drawn, edited, animated or interacted with has a
> public API representation. A future visual editor uses the same API.

Documentation: [for agents](docs/for-agents.md) (workflow, rules, recipes,
errors) and the [API reference](docs/API.md) (every export, node type, prop,
step and error). Both ship in the package, with an `llms.txt` index.

```ts
import { createDemo } from '@drietsch/sketch';

const demo = createDemo({ width: 900, height: 600, seed: 42 });

demo.input({ id: 'email', x: 250, y: 200, width: 350, placeholder: 'Email' });
demo.button({ id: 'login', x: 470, y: 300, characters: 'Sign in' });

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

**Vocabulary.** Nodes, properties and the document follow Figma's naming
wherever Figma has a name for the concept (`FRAME`, `RECTANGLE`, `TEXT`,
`characters`, `fills`, `strokes`, `strokeWeight`, `cornerRadius`,
`textAlignHorizontal`, nested `children`), so anyone, or any agent, who has
seen Figma's node model can read and write a sketch document without
learning a second one. What Figma does not have, the hand-drawn look and the
interaction timeline, lives under its own keys (`sketch`, `timeline`).

**Scene.** What exists: a flat store of nodes addressed by id, each with a
type, a position and optional `parent`. Children are positioned relative to
their parent's content area, so moving a window moves everything in it.
Nodes are created through the demo's factories and edited through the scene:
`demo.scene.get(id)` (or `node(id)`, which throws instead of returning
`undefined`), `update(id, patch)`, `bounds(id)`, `remove(id)`,
`bringToFront(id)` and `hitTest(point)` are the whole editing surface.

**Components.** Semantic nodes that expand into sketched parts: `BUTTON`,
`INPUT`, `FRAME` and `WINDOW` (plain or browser chrome), next to the
primitives `RECTANGLE`, `ELLIPSE`, `LINE`, `VECTOR`, `TEXT` and `ICON`. Inputs and buttons are simulated
graphical controls, not native HTML, so focus rings, carets, hover and
pressed looks are all drawn and all exportable. Annotation marks
(`HIGHLIGHT`, `ENCIRCLE`, `UNDERLINE`, `ARROW`, `CALLOUT`) are nodes as well:
they target another node and follow it, and take no clicks.

**Timeline.** What happens and when. A fluent builder over a plain list of
steps: `moveCursor`, `click`, `press`, `release`, `type`, `clear`, `wait`,
`focus`, `blur`, `setValue` and `set` (patch a node from that moment on).
Durations are computed when the timeline is compiled against the scene:
cursor moves follow Fitts's law along seeded curved paths, clicks hold for a
human moment, typing has a human cadence. Pass `duration` to override. A
node's own `reactions` fire on top: a click on a Cancel button can close its
dialog without the timeline saying so.

**Rendering.** `demo.frameAt(t)` is a pure function of the document and the
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

|                                                                    |                                                                                                                                       |
| ------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------- |
| `createDemo({ width, height, seed?, theme?, background?, font? })` | A new demo. Omit `seed` for a random one and read it back from `demo.seed`.                                                           |
| `loadDemo(json, { font? })`                                        | Rebuilds a demo from `toJSON()` output; renders identically.                                                                          |
| `demo.toJSON()`                                                    | A version 2 document: settings, theme, nested `children` back to front, custom icons, timeline. Version 1 documents load and migrate. |
| `demo.frameAt(t)` / `demo.toSVG(t)`                                | The frame at `t` ms as a virtual tree or an SVG string.                                                                               |
| `demo.frames(fps)`                                                 | Every frame of the timeline, for export.                                                                                              |
| `demo.mount(el, { autoplay?, loop?, rate?, clock? })`              | Renders into `el` (a container or an `<svg>`) and returns a `Player`.                                                                 |
| `demo.nodeAt(id, t)`                                               | A node with the timeline's patches and live value applied at `t`.                                                                     |
| `demo.duration`                                                    | Length of the timeline in ms.                                                                                                         |
| `demo.registerIcon(name, def)`                                     | An icon for this demo only; travels with `toJSON()`.                                                                                  |

### Nodes

Every factory takes the node's props with an optional `id` (auto-generated as
`rectangle-1`, `frame-2`, … otherwise) and returns the stored node. Node
`type`s are Figma's: `RECTANGLE`, `ELLIPSE`, `LINE`, `VECTOR`, `TEXT`, `FRAME`,
and sketch's own `ICON`, `BUTTON`, `INPUT`, `WINDOW`.

| Factory                        | Type        | Props                                                                        |
| ------------------------------ | ----------- | ---------------------------------------------------------------------------- |
| `demo.rectangle`               | `RECTANGLE` | `width`, `height`, `cornerRadius?`                                           |
| `demo.ellipse`                 | `ELLIPSE`   | `width`, `height`                                                            |
| `demo.line`                    | `LINE`      | `x2`, `y2`                                                                   |
| `demo.vector`                  | `VECTOR`    | `d` (SVG path data in local coordinates)                                     |
| `demo.text`                    | `TEXT`      | `characters`, `style?` (a `TypeStyle`); `\n` breaks lines                    |
| `demo.icon`                    | `ICON`      | `icon` (a built-in name or an icon definition), `size?`                      |
| `demo.button`                  | `BUTTON`    | `characters`, `icon?`, `width?`, `height?`, `variant?` (`primary`), `state?` |
| `demo.input`                   | `INPUT`     | `width`, `height?`, `value?`, `placeholder?`, `state?`                       |
| `demo.frame`                   | `FRAME`     | `width`, `height`, `title?` (children start below the title bar)             |
| `demo.window` / `demo.browser` | `WINDOW`    | `width`, `height`, `title?`, `url?`                                          |

#### Controls

Base UI's catalogue of controls, as node types. Their model state follows
Base UI's names (`checked`, `pressed`, `open`, `value`) and is a prop on the
node, which the timeline can change live (see [Semantic steps](#semantic-steps)).
List-like controls take their items as props; their entries are drawn parts
with clickable regions, not nodes.

| Factory              | Type             | Props                                                                        |
| -------------------- | ---------------- | ---------------------------------------------------------------------------- |
| `demo.checkbox`      | `CHECKBOX`       | `characters?`, `checked?`, `indeterminate?`                                  |
| `demo.checkboxGroup` | `CHECKBOX_GROUP` | `options`, `value?: string[]`, `orientation?` (`vertical`)                   |
| `demo.switch`        | `SWITCH`         | `characters?`, `checked?`                                                    |
| `demo.toggle`        | `TOGGLE`         | `characters?`, `icon?`, `pressed?`                                           |
| `demo.toggleGroup`   | `TOGGLE_GROUP`   | `options`, `value?`, `multiple?`, `orientation?` (`horizontal`)              |
| `demo.radioGroup`    | `RADIO_GROUP`    | `options`, `value?`, `orientation?` (`vertical`)                             |
| `demo.slider`        | `SLIDER`         | `width`, `value?`, `min?` 0, `max?` 100, `step?` 1                           |
| `demo.progress`      | `PROGRESS`       | `width`, `value?`, `max?` 100, `indeterminate?`, `characters?`               |
| `demo.meter`         | `METER`          | `width`, `value`, `min?` 0, `max?` 100, `characters?`                        |
| `demo.separator`     | `SEPARATOR`      | `length`, `orientation?` (`horizontal`)                                      |
| `demo.avatar`        | `AVATAR`         | `characters?` (initials), `icon?`, `size?` 36                                |
| `demo.numberField`   | `NUMBER_FIELD`   | `width`, `value?`, `min?`, `max?`, `step?` 1, `placeholder?`                 |
| `demo.otpField`      | `OTP_FIELD`      | `length?` 6, `value?`                                                        |
| `demo.field`         | `FIELD`          | `label?`, `description?`, `error?`; a vertical HUG container for one control |
| `demo.fieldset`      | `FIELDSET`       | `width`, `height`, `legend?`; children start below the legend                |
| `demo.form`          | `FORM`           | a vertical container with `itemSpacing: 10` by default                       |
| `demo.toolbar`       | `TOOLBAR`        | `orientation?`; a padded row (or column) of its children                     |
| `demo.collapsible`   | `COLLAPSIBLE`    | `characters` (header), `open?`; hides its children while closed              |
| `demo.accordion`     | `ACCORDION`      | `width`, `items` (labels or `{ label, characters? }`), `value?`, `multiple?` |
| `demo.tabs`          | `TABS`           | `width`, `height`, `tabs`, `value?`; shows the child at the active index     |

```ts
demo.form({ id: 'signup', x: 30, y: 30, width: 280, layoutSizingVertical: 'HUG' });
demo.field({ id: 'f-plan', parent: 'signup', label: 'Plan', description: 'Change any time.', width: 280 });
demo.radioGroup({ id: 'plan', parent: 'f-plan', options: ['Free', 'Team'], value: 'Free' });
demo.field({ id: 'f-volume', parent: 'signup', label: 'Volume', width: 280 });
demo.slider({ id: 'volume', parent: 'f-volume', width: 280, value: 20 });

demo.tabs({ id: 'tabs', x: 340, y: 30, width: 250, height: 120, tabs: ['General', 'Billing'] });
demo.text({ id: 'general', parent: 'tabs', characters: 'General settings' }); // shown with the first tab
demo.button({ id: 'billing', parent: 'tabs', characters: 'Add card' }); // shown with the second
```

`demo.nodeAt(id, t)` returns a node with the live `value`, `checked`, `open`
(or `pressed` for a toggle) at time `t`.

#### Popups and overlays

Everything that opens over the page. A popup with an `anchor` sits against
that node (`side`: `top`, `bottom`, `left`, `right`) and needs no `x`/`y`;
dialogs, drawers and toasts sit against the page. Popups draw on an overlay
layer above every ordinary node, and their children (a dialog's buttons, a
popover's form) come with them. All of them keep `open` as model state.

| Factory               | Type              | Props                                                                                     |
| --------------------- | ----------------- | ----------------------------------------------------------------------------------------- |
| `demo.tooltip`        | `TOOLTIP`         | `anchor`, `characters`, `side?` top, `delay?` 400; opens while hovered                    |
| `demo.previewCard`    | `PREVIEW_CARD`    | `anchor`, `title?`, `description?`, `width?` 240; opens while hovered                     |
| `demo.popover`        | `POPOVER`         | `anchor`, `title?`, `description?`, `width?` 260; a click toggles it; container           |
| `demo.menu`           | `MENU`            | `characters?`, `icon?`, `items`; a button that drops the list; `value` is the last choice |
| `demo.contextMenu`    | `CONTEXT_MENU`    | `anchor`, `items`; a click on the anchor opens it over it                                 |
| `demo.menubar`        | `MENUBAR`         | `menus: { label, items }[]`; `value` is the open menu                                     |
| `demo.navigationMenu` | `NAVIGATION_MENU` | `items: { label, items? }[]`; links and dropdowns                                         |
| `demo.select`         | `SELECT`          | `width`, `options`, `value?`, `placeholder?`                                              |
| `demo.combobox`       | `COMBOBOX`        | `width`, `options`, `value?`, `placeholder?`; typing filters the list                     |
| `demo.autocomplete`   | `AUTOCOMPLETE`    | as combobox, without the chevron; the list appears while typing                           |
| `demo.dialog`         | `DIALOG`          | `title`, `description?`, `width?` 420; centred over a backdrop; container                 |
| `demo.alertDialog`    | `ALERT_DIALOG`    | as dialog, but only its own buttons close it                                              |
| `demo.drawer`         | `DRAWER`          | `title?`, `side?` right, `width?` 320; a page-edge panel; container                       |
| `demo.toast`          | `TOAST`           | `title`, `description?`, `variant?`, `stack?`; bottom-right, shown by default             |
| `demo.scrollArea`     | `SCROLL_AREA`     | `width`, `height`, `contentHeight`, `value?`; clips and scrolls its children              |

Menu items are labels, `{ label, icon?, disabled?, items? }` objects (`items`
opens a submenu on `MENU` and `CONTEXT_MENU`), or `'-'` for a separator.

```ts
demo.button({ id: 'share', x: 20, y: 20, characters: 'Share' });
demo.tooltip({ anchor: 'share', characters: 'Share this file' });
demo.popover({ id: 'share-pop', anchor: 'share', title: 'Share', width: 260 });
demo.input({ id: 'email', parent: 'share-pop', width: 236, placeholder: 'name@example.com' });
demo.button({ id: 'send', parent: 'share-pop', characters: 'Send', variant: 'primary' });

demo.dialog({ id: 'confirm', title: 'Delete this file?', description: 'It moves to the trash.' });
demo.button({ id: 'cancel', parent: 'confirm', characters: 'Cancel' });

demo.timeline.hover('share').open('share-pop').type('email', 'grace@example.com').click('send').close('share-pop');
demo.timeline.open('confirm').click('cancel').close('confirm');
```

Common props on every node: `x`, `y`, `parent`, `visible`, `opacity`,
`interactive`, `sketchVariant`, and the Figma-shaped visual properties:

- `fills: Paint[]` and `strokes: Paint[]`, bottom to top; the first visible
  one is drawn. Only `{ type: 'SOLID', color, opacity?, visible? }` is
  supported. `color` is a Figma `{ r, g, b, a }` in 0..1 or, for convenience,
  any CSS colour string. Absent means the component's default; an empty array
  means none.
- `strokeWeight`, `strokeDashes`, `cornerRadius`.
- `sketch: { roughness?, bowing?, fillStyle?, hachureGap?, hachureAngle?, fillWeight? }`,
  the hand-drawn look. `fillStyle` is `hachure` (default), `solid`, `zigzag`,
  `cross-hatch`, `dots`, `dashed` or `zigzag-line`.

Text-bearing nodes (`TEXT`, `BUTTON`, `INPUT`, `FRAME`, `WINDOW`) take a
`style: TypeStyle` with `fontSize`, `textAlignHorizontal` (`LEFT`, `CENTER`,
`RIGHT`) and `fills` for the glyph colour. `state` accepts `focused`,
`pressed`, `hovered` and `disabled`.

```ts
demo.rectangle({
  x: 20,
  y: 20,
  width: 120,
  height: 60,
  cornerRadius: 8,
  fills: [{ type: 'SOLID', color: { r: 0.48, g: 0.64, b: 0.97 } }],
  strokes: [{ type: 'SOLID', color: '#1f2430' }],
  strokeWeight: 2,
  strokeDashes: [6, 4],
  sketch: { fillStyle: 'cross-hatch', roughness: 1.5 },
});
demo.text({
  x: 20,
  y: 100,
  characters: 'Hello',
  style: { fontSize: 18, fills: [{ type: 'SOLID', color: '#2f6fed' }] },
});
```

### Annotation marks

Marks drawn over a finished interface, the way someone reviewing it would: a
highlighter band, a ring around a control, an underline, an arrow, a bubble
with a note. They are held in a hand rather than drawn by a tool, so they
wobble more than the controls beneath them, and none of them is hit-tested, so
a click goes straight through to the interface.

```ts
demo.button({ id: 'pay', x: 40, y: 60, characters: 'Pay now', variant: 'primary' });
demo.encircle({ id: 'ring', target: 'pay', spread: 10 });
demo.callout({ id: 'tip', target: 'pay', side: 'top', characters: 'One tap and you are done' });

demo.text({ id: 'price', x: 260, y: 66, characters: 'EUR 49' });
demo.highlight({ id: 'band', target: 'price', spread: 4 });
demo.underline({ id: 'mark', target: 'price', variant: 'wavy' });
demo.arrow({ id: 'link', from: 'price', to: 'pay', curve: 'curved' });
```

| Factory          | Type        | What it draws                                                                             |
| ---------------- | ----------- | ----------------------------------------------------------------------------------------- |
| `demo.highlight` | `HIGHLIGHT` | A translucent marker band: one thick sweep, or the whole box (`variant: 'block'`)         |
| `demo.encircle`  | `ENCIRCLE`  | A ring around the box, an `oval` or a `rect`, drawn in `passes` turns of the pen          |
| `demo.underline` | `UNDERLINE` | `straight`, `double`, `wavy`, `zigzag`, `scribble` or `loop`, under the box or through it |
| `demo.arrow`     | `ARROW`     | A shaft between two nodes or points, `straight`, `curved`, `s` or `elbow`, with heads     |
| `demo.callout`   | `CALLOUT`   | A `bubble`, `burst` or `cloud` carrying a note, with a tail back to its target            |

A mark with a `target` takes that node's box, so it follows what it annotates;
`spread` grows the box first. Without a target it sits at its own `x`/`y` and
size. Marks ink themselves in the theme's accent, or in `strokes` when given.
See [docs/API.md](docs/API.md) for every prop, including how an arrow chooses
which edges to leave and meet.

### Weight and the marker

Text is drawn in pencil: every glyph is gone round with a fine graphite line
that strays a hair from the letterform, so the words look written rather than
set. Grape Nuts ships in one cut, so a heavier weight is not a second face —
it is the same letter gone round more times, which is what gives a heading its
weight without thickening the nib until the counters close.

```ts
demo.text({ id: 'h', x: 40, y: 40, characters: 'Checkout', style: { fontSize: 30, fontWeight: 700 } });
demo.text({ id: 'h2', x: 40, y: 100, characters: 'Billing', style: { fontSize: 26, marker: true } });
```

`fontWeight` runs from 400 to 900 — one contour to four — and is held back on
small text so counters stay open. `marker` sweeps a grey band under the words
before they are written. Component titles are written at 600 already;
everything else stays at 400 until you ask. Contours are real geometry, so keep
the heavy weights for headings rather than body text. `theme.textPasses: 0`
gives the bare letterform back.

### The hand-drawn frame

Containers are not outlined with a rounded rectangle. A window, frame,
fieldset, form, toolbar or dialog gets a light marker band, four edges that run
past their corners, a second thinner pass over them and two short strokes
re-inking each corner, so the box reads as drawn rather than printed. The
treatment scales itself down on small boxes, and the theme dials it:

```ts
const demo = createDemo({
  width: 900,
  height: 600,
  theme: { frameOvershoot: 12, frameBand: 10, frameBandOpacity: 0.4 },
});
```

`frameOvershoot: 0` goes back to the plain rectangle; `frameBand: 0` keeps the
overshooting edges but drops the grey band.

### Relative placement

Instead of `x` and `y`, a node can say where it sits relative to one that
already exists. The position is resolved once, when the node is added, and
stored as plain coordinates; later edits do not reflow neighbours.

```ts
demo.frame({ id: 'card', x: 40, y: 40, width: 400, height: 300, title: 'Sign in' });
demo.text({ id: 'label', parent: 'card', x: 24, y: 20, characters: 'Email' });
demo.input({ id: 'email', below: 'label', gap: 10, width: 320 });
demo.button({ id: 'go', below: 'email', gap: 20, characters: 'Sign in' });
demo.button({ id: 'cancel', rightOf: 'go', gap: 12, characters: 'Cancel' });
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

### Auto-layout

A `FRAME` (or a `WINDOW`'s content area) can lay out its children itself,
with Figma's auto-layout properties. Children of such a frame need no
coordinates; the frame can hug its content and children can fill the space.

```ts
demo.frame({
  id: 'form',
  x: 40,
  y: 40,
  width: 360,
  layoutMode: 'VERTICAL',
  itemSpacing: 12,
  padding: 24,
  layoutSizingVertical: 'HUG',
});
demo.text({ parent: 'form', characters: 'Email' });
demo.input({ parent: 'form', width: 100, layoutSizingHorizontal: 'FILL', placeholder: 'you@example.com' });
demo.frame({
  parent: 'form',
  height: 36,
  layoutMode: 'HORIZONTAL',
  layoutSizingHorizontal: 'FILL',
  primaryAxisAlignItems: 'SPACE_BETWEEN',
  fills: [],
  strokes: [],
});
```

On the container: `layoutMode` (`NONE`, `HORIZONTAL`, `VERTICAL`),
`itemSpacing`, `paddingLeft` / `paddingRight` / `paddingTop` / `paddingBottom`
(or a `padding` shorthand: a number, `[vertical, horizontal]` or
`[top, right, bottom, left]`), `primaryAxisAlignItems` (`MIN`, `CENTER`,
`MAX`, `SPACE_BETWEEN`), `counterAxisAlignItems` (`MIN`, `CENTER`, `MAX`), and
`layoutSizingHorizontal` / `layoutSizingVertical` (`FIXED`, `HUG`, `FILL`). A
`FRAME` needs `width`/`height` only on a `FIXED` axis.

On any child: `layoutSizingHorizontal` / `layoutSizingVertical` set to `FILL`
to take the available space (rectangles, ellipses, inputs, buttons and
frames; text and icons are always their intrinsic size), and
`layoutPositioning: 'ABSOLUTE'` to opt out and keep its own `x`/`y`.

The stored node keeps what you wrote; `scene.bounds(id)` is the laid-out
truth, and `toJSON()` never contains computed sizes. Timeline `set` steps that
change spacing, a label or visibility reflow at that moment. Relative
placement (`below:` …) into an auto-layout frame is an error unless the node
is `ABSOLUTE`.

### Timeline

```ts
demo.input({ id: 'email', x: 40, y: 40, width: 300 });
demo.text({ id: 'done', x: 40, y: 100, characters: 'Sent!', visible: false });
demo.timeline
  .moveCursor('email') // or a point { x, y }; options { duration?, key? }
  .click() // clicks where the cursor is; click('login') moves there first
  .type('email', 'hello') // focuses the input if needed; '\b' deletes
  .wait(300)
  .set('done', { visible: true }) // patch a node from this moment on
  .at(4000)
  .blur(); // start the next step at an absolute time
```

`demo.timeline.toJSON()` and `Timeline.fromJSON()` round-trip the step list.
A step's `key` pins its random streams, so inserting steps before it never
changes its path or cadence.

#### Semantic steps

A control is used by what it does, not by where its parts are. Each of these
compiles into the cursor moves and clicks that a person would make, on the
exact region of the control (an option, a tab header, the increment button,
the slider thumb), and records the state change so `stateAt(t)` stays a pure
replay:

<!-- no-run -->

```ts
demo.timeline
  .check('remember') // a CHECKBOX, SWITCH or TOGGLE; uncheck() and toggle() likewise
  .check('toppings', 'Olives') // one option of a CHECKBOX_GROUP or multiple TOGGLE_GROUP
  .choose('plan', 'Team') // a RADIO_GROUP, TOGGLE_GROUP, TABS or ACCORDION option
  .choose('seats', 3) // a NUMBER_FIELD: clicks the stepper until it gets there
  .drag('volume', 75) // a SLIDER: press the thumb, move, release; snaps to the step
  .open('advanced') // a COLLAPSIBLE (or an ACCORDION item); close() likewise
  .hover('save'); // moves there and rests
```

A plain `click(id)` applies the control's natural effect: a checkbox toggles,
a tab activates, a slider jumps to the cursor. A step a control cannot take
(`check` on a `BUTTON`) is a `CompileError` naming the step, the node and its
type; a step already satisfied (`check` on a checked box) only moves the
cursor there.

Popups follow the same rules through their anchors. `hover(anchor)` (or
`hover(tooltip)`) opens a tooltip or preview card after its delay and rests on
it; moving away closes it. `open(popover)` clicks its anchor, as does a plain
`click(anchor)`, which toggles it. `choose(select, option)` opens the list if
needed and clicks the option; `choose(menubar, item)` opens the menu that
holds the item first, and `choose(menu, item)` walks into the submenu that
holds it. A click outside an open menu, select or popover dismisses it; a dialog
closes from its backdrop or its close mark (`close(dialog)` clicks that), an
alert dialog only from `close()`. A row scrolled out of a scroll area's
viewport cannot be a target until `drag(area, offset)` brings it into view.

#### Reactions

A component knows its own behaviour, but not what this particular mockup
means by it: a dialog's Cancel button is just a button. `reactions` is where
the node says what else a click on it does, in Figma's prototyping term.

```ts
demo.button({
  id: 'cancel',
  x: 40,
  y: 40,
  characters: 'Cancel',
  reactions: [{ trigger: 'ON_CLICK', action: { target: 'confirm', open: false } }],
});
demo.dialog({ id: 'confirm', title: 'Delete this file?', width: 320, open: true });
demo.timeline.click('cancel'); // closes the dialog
```

The action is the same `WidgetAction` a component's own click returns:
`target` (the node it changes, defaulting to the one carrying the reaction)
plus any of `checked`, `open`, `value` and `focus`. Reactions fire after the
component's own effect, so they win where the two disagree, and they fire for
any click that lands on the node, including the ones a semantic step makes on
the way.

### Text and icons

Text is drawn from glyph data that ships with the package, so measurement,
carets and bounds are exact and identical in every environment and the SVG
needs no fonts. The default font is
[Grape Nuts](https://fonts.google.com/specimen/Grape+Nuts), a handwriting
face, set in capitals: every string is folded to upper case when it is drawn
and measured, so `characters: 'Sign in'` reads SIGN IN while the model keeps
`'Sign in'`. It covers printable ASCII, the Latin-1 letters and common
symbols, and the typographic characters UI copy uses (`…`, curly quotes,
dashes); anything else draws as a small box.

The package ships this one font. A document may bring its own through
`createDemo({ font })`, and one saved with a font the package does not carry
must be handed it again: `loadDemo(json, { font })`.

A custom `StrokeFont` built from `StrokeFontData` (stroke polylines or
outline paths) can be passed the same way; a document saved with one must be
loaded with it.

Icons use the [`@sketchyicons/data`](https://github.com/Fantomiald/sketchyicons)
shape: 47 common icons are built in (`iconNames()` lists them; the API
reference names them by group), any of that package's 1,756 icons can be
passed as `demo.icon({ icon: { nodes: Rocket } })`, and
`registerIcon(name, def)` adds one by name. Set `rough: true` on a
definition of clean paths to sketch them.

## Examples

The pages in [`examples/`](examples/) load the built bundle. Run
`pnpm build`, then open them from a static server (or run
`pnpm run verify:pages` to render them all in headless Chromium).

- `sketch-styles.html`: every fill style and primitive
- `text-and-icons.html`: the font at several sizes and weights, every built-in icon
- `login-form.html`: the briefing's mockup with every component state
- `login-demo.html`: the same, animated, with a scrub bar over `toSVG(t)`
- `player.html`: mounted into a live SVG and driven by the `Player`
- `auto-layout.html`: a signup form laid out entirely by auto-layout, playing on a loop
- `controls.html`: every control in its states, then a form driven by the semantic steps
- `overlays.html`: menus, selects, a popover, a dialog, a drawer, toasts and a scroll area over one timeline
- `annotations.html`: highlights, rings, underlines, arrows and callouts over a finished screen, each following its target

## Development

```sh
pnpm install
pnpm run check              # lint, format, catalogue, build, docs, typecheck, tests, dist tests
pnpm run verify:components  # every registered type has a factory, an export, README and API rows and a fixture
pnpm run verify:docs        # every code block in the docs runs against the built package
pnpm run verify:pages       # render every examples/ page in headless Chromium
pnpm run verify:package     # pack, install into a temp project, smoke-test
```

The engine's 945-case golden digest and the library's per-fixture SVG digests
pin the visual output; a change to either must be deliberate. A new component
is one file in `src/components/`, a registry entry, a node interface, a
factory on `Demo`, a README row and a fixture; `verify:components` says which
of those is missing.

## Credits

The sketch-geometry engine in `src/sketch/` is derived from
[roughjs](https://github.com/rough-stuff/rough) by Preet Shihn (MIT). Text
uses Grape Nuts by Robert Leuschke (SIL OFL); icons
come from sketchyicons, derived from Lucide and Feather. See
[`THIRD-PARTY-NOTICES.md`](THIRD-PARTY-NOTICES.md).

## License

MIT
