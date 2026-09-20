# sketch API reference

`@drietsch/sketch` builds hand-drawn GUI mockups from an API and animates how
someone uses them. This is the complete public surface of the package: every
export, every node type with its props, every timeline step, every error. It
is written to be read by a person or an agent before writing code.

For a task-oriented walkthrough see [for-agents.md](for-agents.md); for
prose and examples see the [README](../README.md).

```ts
import { createDemo, loadDemo } from '@drietsch/sketch';
```

The package is ESM only and needs Node 24 or a modern browser. It has no
runtime dependencies and never touches the DOM unless `mount` or
`renderInto` is called.

## Contents

1. [Creating a demo](#creating-a-demo)
2. [Demo](#demo)
3. [Node props](#node-props)
4. [Node types](#node-types)
5. [Timeline](#timeline)
6. [Scene](#scene)
7. [Player](#player)
8. [Icons, fonts, theme](#icons-fonts-theme)
9. [Documents](#documents)
10. [Determinism](#determinism)
11. [Errors](#errors)
12. [Exports](#exports)

## Creating a demo

### `createDemo(options: DemoOptions): Demo`

| Option       | Type             | Default                          | Notes                                                                                                       |
| ------------ | ---------------- | -------------------------------- | ----------------------------------------------------------------------------------------------------------- |
| `width`      | `number`         | required                         | Document width in px. Must be positive.                                                                     |
| `height`     | `number`         | required                         | Document height in px. Must be positive.                                                                    |
| `seed`       | `number`         | random                           | Integer in `[0, 2^31)`. Read `demo.seed` to reproduce a run that used a random seed.                        |
| `theme`      | `Partial<Theme>` | `DEFAULT_THEME`                  | Colours, stroke weight, roughness, corner radius, font size. See [Theme](#theme).                           |
| `background` | `string \| null` | the theme background (`#ffffff`) | A CSS colour, or `null` for a transparent document.                                                         |
| `font`       | `StrokeFont`     | `DEFAULT_FONT`                   | The font for all text. Grape Nuts, in capitals, is the one the package ships; a document may bring its own. |

### `loadDemo(json: DemoJSON | string, options?: { font?: StrokeFont }): Demo`

Rebuilds a demo from `demo.toJSON()` output (an object or its JSON string).
The result renders byte-identically to the original at every time. A
document saved with either built-in font loads as it was; one saved with a
custom font must be loaded with that font, or `loadDemo` throws. Invalid
documents throw `DemoJSONError`.

### `parseDemoJSON(json: unknown): DemoJSON`

Validates and migrates a document (version 1 documents are upgraded to
version 2) without building a demo. Throws `DemoJSONError`.

## Demo

### Properties

| Property     | Type                   | Notes                                                       |
| ------------ | ---------------------- | ----------------------------------------------------------- |
| `width`      | `number`               |                                                             |
| `height`     | `number`               |                                                             |
| `seed`       | `number`               | The seed in use, also when it was chosen at random.         |
| `theme`      | `Theme`                | The resolved theme.                                         |
| `background` | `string \| undefined`  | `undefined` for a transparent document.                     |
| `font`       | `StrokeFont`           |                                                             |
| `scene`      | `Scene`                | The node tree. See [Scene](#scene).                         |
| `timeline`   | `Timeline`             | The interaction script. See [Timeline](#timeline).          |
| `icons`      | `Map<string, IconDef>` | Icons registered on this demo with `demo.registerIcon`.     |
| `duration`   | `number`               | Total length of the timeline in ms; `0` for a static scene. |

### Node factories

One method per node type. Each takes the node's props (see
[Node props](#node-props)), adds the node to the scene and returns the stored
node. `id` is optional; a missing id is generated as `<type>-<n>` in lower
case (`rectangle-1`, `radio-group-2`). The factories are listed with their
props under [Node types](#node-types).

### Rendering

| Method                       | Returns                 | Notes                                                                                                                                                         |
| ---------------------------- | ----------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `toSVG(t = 0)`               | `string`                | The frame at time `t` (ms) as a complete SVG document. Byte-identical for the same document, seed and `t`.                                                    |
| `frameAt(t = 0)`             | `Frame`                 | The same frame as a virtual tree: `{ width, height, background?, groups }`, one group per visible node in paint order, each with `key`, `hash`, `el`, `html`. |
| `frames(fps = 30)`           | `Generator<{ t, svg }>` | Every frame of the timeline at a fixed rate, ending exactly at `duration`. For video export.                                                                  |
| `mount(container, options?)` | `Player`                | Renders into an existing `<svg>`, or into a new one appended to `container`, and returns a [Player](#player).                                                 |
| `renderInto(svg, t = 0)`     | `void`                  | Patches an existing `<svg>` to the frame at `t`, replacing only the groups that changed.                                                                      |
| `stateAt(t)`                 | `InteractionState`      | Cursor position, focus, pressed node, live values, checked and open maps, accumulated `set` patches, active step index.                                       |
| `nodeAt(id, t)`              | `SceneNode`             | The node with the timeline's `set` patches and live `value`, `checked`, `open` (`pressed` for a `TOGGLE`) at `t`. The scene itself is never mutated.          |
| `toJSON()`                   | `DemoJSON`              | The whole demo as a self-contained document. See [Documents](#documents).                                                                                     |
| `registerIcon(name, def)`    | `void`                  | An icon usable by name in this demo only; it travels with `toJSON()`.                                                                                         |
| `resolveIcon(icon)`          | `IconDef`               | Resolves a name (demo icons, then global, then built-ins) or passes a definition through. Throws for unknown names.                                           |

Time is in milliseconds. Frames before `0` show the initial state; frames
after `duration` show the final state.

## Node props

Every factory accepts the node's own props plus an optional `id`, in one of
four positioning forms. Coordinates are relative to the parent's content
origin (below a frame's title bar, inside a container's padding), or to the
document for top-level nodes.

| Form         | Extra props                                                                                                 | When                                                                                                                                                                            |
| ------------ | ----------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| literal      | `x`, `y`                                                                                                    | Anywhere.                                                                                                                                                                       |
| relative     | one of `below`, `above`, `rightOf`, `leftOf` (a node id), `gap?`, `alignTo?` (`start` \| `center` \| `end`) | Placed against an existing node; resolved once into `x`/`y` when added. The new node gets the reference's parent unless `parent` is given. `x`/`y` become cross-axis overrides. |
| layout child | `parent` (a container id), optional `x`, `y`                                                                | Inside a container: an auto-layout parent positions it; any other container puts it at its content origin (or at `x`/`y` when given).                                           |
| anchored     | none                                                                                                        | Popups with an `anchor` prop, and dialogs, drawers and toasts: the layout places them. `x`/`y` are ignored.                                                                     |

Containers also accept `padding`, a shorthand for the four `padding*` props:
a number, `[vertical, horizontal]` or `[top, right, bottom, left]`.

### Common props (`NodeBase`)

| Prop                                  | Type                         | Notes                                                                                                                |
| ------------------------------------- | ---------------------------- | -------------------------------------------------------------------------------------------------------------------- |
| `id`                                  | `string`                     | Letters, digits, `_`, `.`, `:`, `-`; unique in the scene. Generated when omitted.                                    |
| `x`, `y`                              | `number`                     | See the forms above.                                                                                                 |
| `parent`                              | `string`                     | Id of the parent node. Any node can have children; containers lay them out.                                          |
| `visible`                             | `boolean`                    | Default `true`. An invisible node and its subtree are not rendered, hit-tested or targetable.                        |
| `opacity`                             | `number`                     | Whole-node opacity, 0..1.                                                                                            |
| `fills`                               | `Paint[]`                    | Bottom to top; the first visible one is drawn. Absent: the component's default. `[]`: no fill.                       |
| `strokes`                             | `Paint[]`                    | The first visible one outlines the node. Absent: the theme stroke. `[]`: no outline.                                 |
| `strokeWeight`                        | `number`                     | Default: the theme's `strokeWeight` (1.2).                                                                           |
| `strokeDashes`                        | `number[]`                   | Dash pattern in px.                                                                                                  |
| `sketch`                              | `SketchStyle`                | `roughness`, `bowing`, `fillStyle`, `hachureGap`, `hachureAngle`, `fillWeight`. Unset fields fall back to the theme. |
| `sketchVariant`                       | `number`                     | Re-rolls this node's jitter without changing the document seed.                                                      |
| `interactive`                         | `boolean`                    | Whether the node takes clicks. Components default to `true`, primitives to `false`.                                  |
| `layoutPositioning`                   | `'AUTO' \| 'ABSOLUTE'`       | `ABSOLUTE` children of a layout container keep their `x`/`y`.                                                        |
| `layoutSizingHorizontal`              | `'FIXED' \| 'HUG' \| 'FILL'` | `HUG` wraps content (containers only); `FILL` takes the parent's free space (resizable nodes only).                  |
| `layoutSizingVertical`                | same                         |                                                                                                                      |
| `checked`, `open`, `value`, `pressed` | model state                  | Authored state under Base UI's names. The timeline overrides it live and never writes back.                          |
| `reactions`                           | `Reaction[]`                 | What clicking this node does, beyond what the component already does. See Reactions below.                           |

`Paint` is `{ type: 'SOLID', color, opacity?, visible? }`; `color` is a
Figma `{ r, g, b, a? }` in 0..1 or any CSS colour string. Only solid paints
are supported.

`fillStyle` is one of `hachure` (default), `solid`, `zigzag`, `cross-hatch`,
`dots`, `dashed`, `zigzag-line`.

Text-bearing nodes take `style: TypeStyle` with `fontSize`, `fontWeight`,
`marker`, `textAlignHorizontal` (`LEFT` | `CENTER` | `RIGHT`) and `fills` for
the glyph colour. Interactive components take `state: ComponentState` with
`focused`, `pressed`, `hovered`, `disabled` for the authored (static) look.

### Pencil, weight and the marker

Text is drawn rather than printed: every glyph is gone round with a fine
graphite line, each contour straying a hair from the letterform so no two
lines are the same. The letterform is laid down a little short of solid and
the contours lighter still, so tone builds where they overlap.
`theme.textPasses` (1) sets how many contours a plain weight gets; `0` leaves
the bare letterform.

The font ships in one cut, so weight is more contours rather than a broader
pen: 400 is one, 700 three, 900 four, and the pen itself barely grows. Any
value from 400 to 900 works, and the whole treatment is held back below 24px
so small text keeps its counters open rather than filling in.

Because the contours are sketched, text follows the document seed — the same
document and seed still render the same bytes, but a different seed writes the
words differently.

```ts
demo.text({ id: 'h', x: 40, y: 40, characters: 'Checkout', style: { fontSize: 30, fontWeight: 700 } });
demo.text({ id: 'h2', x: 40, y: 100, characters: 'Billing', style: { fontSize: 26, marker: true } });
demo.text({
  id: 'h3',
  x: 40,
  y: 160,
  characters: 'Overdue',
  style: { fontSize: 26, fontWeight: 700, marker: { type: 'SOLID', color: '#ffd23f', opacity: 0.5 } },
});
```

A component's own heading — a window, frame, dialog, drawer or toast title, and
a fieldset's legend — is written at 600 without being asked; the node's own
`style.fontWeight` overrides that.

`marker` sweeps a band under the words before they are written, so the ink
reads over it: `true` takes the theme's grey, a `Paint` names the colour and
how strongly it shows. It is never automatic. A `HIGHLIGHT` mark is a different
thing — a review mark, drawn over the interface, which would grey a heading out
rather than back it.

Bold costs output: the pen is real geometry, so a bold string is roughly three
to four times the path data of the same string at 400. It is meant for
headings, not for body text.

### Reactions

A component already knows what clicking it does: a checkbox toggles, a menu
item is chosen, a dialog's close mark shuts it. `reactions` is where the
author says what else a click does — the part that belongs to this mockup
rather than to the component.

```ts
demo.button({
  id: 'cancel',
  x: 20,
  y: 20,
  characters: 'Cancel',
  reactions: [{ trigger: 'ON_CLICK', action: { target: 'confirm', open: false } }],
});
demo.dialog({ id: 'confirm', title: 'Delete?', width: 240, height: 120, open: true });
demo.timeline.click('cancel');
```

`Reaction` is `{ trigger, action }`. `trigger` is Figma's vocabulary; only
`'ON_CLICK'` is understood so far. `action` is a `WidgetAction`: `target`
(the node it changes, defaulting to the node the reaction sits on) plus any
of `checked`, `open`, `value` and `focus`. An action that sets none of those
is rejected.

- Every reaction on the node the click hits fires, in the order written.
- They run **after** the component's own effect, so a reaction that sets the
  same field wins.
- They fire for any click that lands on the node, including the clicks a
  semantic step makes on the way (`check`, `choose`, `open`, …), but not for
  steps that set state directly (`set`, `setValue`) or for a hand-written
  `press`/`release` pair.
- A reaction may name a node added after it. A target that never exists
  fails the step that would have fired it.

### The hand-drawn frame

A container's outline is not one rounded rectangle. It is a light marker band,
then four straight edges that each run `frameOvershoot` past their corners,
gone over a second time with a thinner pen, and two short strokes re-inking
each corner — the way a hand draws a box, and the reason corners cross instead
of closing.

It applies to `WINDOW`, `FRAME`, `FIELDSET`, `FORM` and `TOOLBAR`, and to the
raised panels of `DIALOG`, `ALERT_DIALOG` and `DRAWER`, which take the ink
without the band because their shadow already carries the weight. A node with
no stroke (`strokes: []`) has no outline to draw, so it gets none of this, and
`SCROLL_AREA` keeps the plain rectangle because its clip would cut the
overshoot off mid-stroke.

On a small box the treatment would swamp the shape, so it scales itself down:
the overshoot is capped at a quarter of the shorter side, the band at an
eighth, a box shallower than 56px gets the ink without a band, and one
shallower than 28px keeps the plain rectangle. A node's own `sketch.roughness`
and `sketch.bowing` still scale the whole treatment, and
`theme.frameOvershoot: 0` turns it off:

```ts
const demo = createDemo({ width: 400, height: 300, theme: { frameOvershoot: 0 } });
```

### Auto-layout props (`AutoLayoutProps`)

On any container (`FRAME`, `WINDOW`, `FIELD`, `FIELDSET`, `FORM`, `TOOLBAR`,
`COLLAPSIBLE`, `TABS`, `POPOVER`, `DIALOG`, `ALERT_DIALOG`, `DRAWER`,
`SCROLL_AREA`), Figma's names:

| Prop                           | Values                                        | Default |
| ------------------------------ | --------------------------------------------- | ------- |
| `layoutMode`                   | `NONE` \| `HORIZONTAL` \| `VERTICAL`          | `NONE`  |
| `itemSpacing`                  | number                                        | `0`     |
| `paddingTop/Right/Bottom/Left` | number                                        | `0`     |
| `primaryAxisAlignItems`        | `MIN` \| `CENTER` \| `MAX` \| `SPACE_BETWEEN` | `MIN`   |
| `counterAxisAlignItems`        | `MIN` \| `CENTER` \| `MAX`                    | `MIN`   |

A container needs a stored `width`/`height` only on a `FIXED` axis, and only
when it has no default size (`WINDOW`, `POPOVER`, `DIALOG`, `ALERT_DIALOG`,
`DRAWER` have one). Children with `visible: false`, `ABSOLUTE` positioning or
an anchor are skipped by the flow. A container that hides all its children (a
closed collapsible) hugs to its own chrome.

## Node types

Types use Figma's names where Figma has one and Base UI's prop names where it
does not. Model state (`checked`, `open`, `value`, `pressed`) is a prop on the
node; the "Steps" column lists the semantic timeline steps the type accepts
(`text` means `type`, `clear`, `setValue`).

### Primitives

| Factory          | Type        | Props                                                                   |
| ---------------- | ----------- | ----------------------------------------------------------------------- |
| `demo.rectangle` | `RECTANGLE` | `width`, `height`, `cornerRadius?`                                      |
| `demo.ellipse`   | `ELLIPSE`   | `width`, `height`                                                       |
| `demo.line`      | `LINE`      | `x2`, `y2` (end point, same space as `x`/`y`)                           |
| `demo.vector`    | `VECTOR`    | `d` (SVG path data in local coordinates)                                |
| `demo.text`      | `TEXT`      | `characters`, `style?`; `\n` breaks lines                               |
| `demo.icon`      | `ICON`      | `icon` (a built-in name, a registered name or an `IconDef`), `size?` 20 |

Primitives are not interactive by default; set `interactive: true` to let a
rectangle take clicks (a click target for a context menu, for instance).

### Components

| Factory                        | Type     | Props                                                                                        | Steps |
| ------------------------------ | -------- | -------------------------------------------------------------------------------------------- | ----- |
| `demo.button`                  | `BUTTON` | `characters`, `icon?`, `width?`, `height?` 36, `variant?` (`default` \| `primary`), `state?` | click |
| `demo.input`                   | `INPUT`  | `width`, `height?` 36, `value?`, `placeholder?`, `state?`                                    | text  |
| `demo.frame`                   | `FRAME`  | `width`, `height`, `title?` (children start below the 34 px title bar); auto-layout          |       |
| `demo.window` / `demo.browser` | `WINDOW` | `width`, `height`, `title?`, `url?` (browser chrome shows it); auto-layout                   |       |

### Controls

| Factory              | Type             | Props                                                                               | Steps                  |
| -------------------- | ---------------- | ----------------------------------------------------------------------------------- | ---------------------- |
| `demo.checkbox`      | `CHECKBOX`       | `characters?`, `checked?`, `indeterminate?`                                         | check, uncheck, toggle |
| `demo.checkboxGroup` | `CHECKBOX_GROUP` | `options: string[]`, `value?: string[]`, `orientation?` (`vertical`)                | check(option), choose  |
| `demo.switch`        | `SWITCH`         | `characters?`, `checked?`                                                           | check, uncheck, toggle |
| `demo.toggle`        | `TOGGLE`         | `characters?`, `icon?`, `pressed?`                                                  | check, uncheck, toggle |
| `demo.toggleGroup`   | `TOGGLE_GROUP`   | `options`, `value?: string \| string[]`, `multiple?`, `orientation?` (`horizontal`) | choose, check(option)  |
| `demo.radioGroup`    | `RADIO_GROUP`    | `options`, `value?`, `orientation?` (`vertical`)                                    | choose                 |
| `demo.slider`        | `SLIDER`         | `width`, `value?`, `min?` 0, `max?` 100, `step?` 1                                  | drag, choose(number)   |
| `demo.progress`      | `PROGRESS`       | `width`, `value?`, `max?` 100, `indeterminate?`, `characters?`                      |                        |
| `demo.meter`         | `METER`          | `width`, `value?`, `min?` 0, `max?` 100, `characters?`                              |                        |
| `demo.separator`     | `SEPARATOR`      | `length`, `orientation?` (`horizontal`)                                             |                        |
| `demo.avatar`        | `AVATAR`         | `characters?` (first two letters shown), `icon?`, `size?` 36                        |                        |
| `demo.numberField`   | `NUMBER_FIELD`   | `width`, `value?`, `min?`, `max?`, `step?` 1, `placeholder?`                        | choose(number), text   |
| `demo.otpField`      | `OTP_FIELD`      | `length?` 6, `value?`                                                               | text                   |

### Containers

| Factory            | Type          | Props                                                                                             | Steps               |
| ------------------ | ------------- | ------------------------------------------------------------------------------------------------- | ------------------- |
| `demo.field`       | `FIELD`       | `label?`, `description?`, `error?`, `width`; vertical `HUG` container for one control             |                     |
| `demo.fieldset`    | `FIELDSET`    | `legend?`, `width`, `height`; children start below the legend                                     |                     |
| `demo.form`        | `FORM`        | `width`; a vertical container with `itemSpacing: 10` by default                                   |                     |
| `demo.toolbar`     | `TOOLBAR`     | `orientation?` (`horizontal`), `height` (or `width` when vertical); padded, `itemSpacing: 6`      |                     |
| `demo.collapsible` | `COLLAPSIBLE` | `characters` (header), `width`, `open?`; hides its children while closed; vertical `HUG`          | open, close         |
| `demo.accordion`   | `ACCORDION`   | `width`, `items: (string \| { label, characters? })[]`, `value?: string \| string[]`, `multiple?` | choose, open, close |
| `demo.tabs`        | `TABS`        | `width`, `height`, `tabs: string[]`, `value?`; shows the child at the active tab's index          | choose              |

### Popups and overlays

Anchored popups take `anchor` (a node id) and `side?` (`top` | `bottom` |
`left` | `right`) and ignore `x`/`y`. Dialogs, drawers and toasts sit against
the page. All keep `open` as model state and draw above every ordinary node.

| Factory               | Type              | Props                                                                                                                        | Steps                     |
| --------------------- | ----------------- | ---------------------------------------------------------------------------------------------------------------------------- | ------------------------- |
| `demo.tooltip`        | `TOOLTIP`         | `anchor`, `characters`, `side?` top, `delay?` 400                                                                            | hover, open, close        |
| `demo.previewCard`    | `PREVIEW_CARD`    | `anchor`, `title?`, `description?`, `width?` 240, `side?` bottom, `delay?` 400                                               | hover, open, close        |
| `demo.popover`        | `POPOVER`         | `anchor`, `title?`, `description?`, `width?` 260, `side?` bottom; vertical `HUG` container                                   | open, close               |
| `demo.menu`           | `MENU`            | `characters?`, `icon?`, `items: MenuItem[]`, `width?`, `value?`; a button that drops the list                                | choose, open, close       |
| `demo.contextMenu`    | `CONTEXT_MENU`    | `anchor`, `items`, `width?`, `value?`; a click on the anchor opens it over the anchor                                        | choose, open, close       |
| `demo.menubar`        | `MENUBAR`         | `menus: { label, items }[]`, `value?` (the open menu)                                                                        | choose, open, close       |
| `demo.navigationMenu` | `NAVIGATION_MENU` | `items: { label, items? }[]`, `value?`                                                                                       | choose, open, close       |
| `demo.select`         | `SELECT`          | `width`, `options`, `value?`, `placeholder?`                                                                                 | choose, open, close       |
| `demo.combobox`       | `COMBOBOX`        | `width`, `options`, `value?`, `placeholder?`; typing filters the list                                                        | text, choose, open, close |
| `demo.autocomplete`   | `AUTOCOMPLETE`    | as combobox, without the chevron; the list appears while typing                                                              | text, choose, open, close |
| `demo.dialog`         | `DIALOG`          | `title`, `description?`, `width?` 420; centred over a backdrop; vertical `HUG` container                                     | open, close               |
| `demo.alertDialog`    | `ALERT_DIALOG`    | as dialog; the backdrop does not dismiss it                                                                                  | open, close               |
| `demo.drawer`         | `DRAWER`          | `title?`, `side?` right, `width?` 320 (`height?` 280 for top/bottom); vertical container                                     | open, close               |
| `demo.toast`          | `TOAST`           | `title`, `description?`, `variant?` (`info` \| `success` \| `warning` \| `error`), `stack?` 0, `width?` 320; open by default | open, close               |
| `demo.scrollArea`     | `SCROLL_AREA`     | `width`, `height`, `contentHeight`, `value?` (scroll offset); clips and scrolls its children                                 | drag, choose(number)      |

`MenuItem` is a label string, `{ label, icon?, disabled?, items? }` (`items`
is a submenu, on `MENU` and `CONTEXT_MENU` only) or `'-'` for a separator.

### Annotation marks

Marks drawn over a finished interface, the way someone reviewing it would.
They are held in a hand rather than drawn by a tool, so they wobble more than
the controls beneath them, and none of them is hit-tested: a click goes
straight through to the interface.

Each mark follows a `target`, taking its box from that node's, so it stays put
when the interface moves or resizes. `spread` grows that box first, which is
how a ring clears what it circles. Without a target a mark sits at its own
`x`/`y` and needs a `width` (and a `height`, except for `UNDERLINE`).

| Factory          | Type        | Props                                                                                                                                                                           |
| ---------------- | ----------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `demo.highlight` | `HIGHLIGHT` | `target?`, `spread?`, `variant?` (`marker` \| `block`); `fills` set the ink, marker yellow at 0.45 by default                                                                   |
| `demo.encircle`  | `ENCIRCLE`  | `target?`, `spread?`, `shape?` (`oval` \| `rect`), `passes?` 2 (1–4, each a fresh turn of the pen)                                                                              |
| `demo.underline` | `UNDERLINE` | `target?`, `variant?` (`straight` \| `double` \| `wavy` \| `zigzag` \| `scribble` \| `loop`), `placement?` (`under` \| `through`)                                               |
| `demo.arrow`     | `ARROW`     | `from`, `to`, `curve?` (`straight` \| `curved` \| `s` \| `elbow`), `bend?` 0.2, `head?` (`end` \| `start` \| `both` \| `none`), `headSize?` 14, `gap?` 6, `fromSide?`/`toSide?` |
| `demo.callout`   | `CALLOUT`   | `characters`, `target?`, `side?` top, `align?` center, `gap?` 22, `shape?` (`bubble` \| `burst` \| `cloud`), `width?` 170                                                       |

Marks ink themselves in the theme's accent; give them `strokes` for a
different pen. They are drawn at roughly twice the theme's roughness, which
the node's own `sketch.roughness` still overrides.

**Arrows** take an endpoint as a node id or a `{ x, y }` point. Aimed at a
node, the shaft stops `gap` short of that node's edge rather than its centre,
and `fromSide`/`toSide` (`auto` by default, else `top`/`right`/`bottom`/`left`)
pin which edge it leaves and meets; `auto` takes the shortest way between the
two boxes. The head sits at `to` unless `head` says otherwise, and follows the
shaft's direction where it arrives, so a curved or elbowed arrow points the
way it is actually travelling.

**Callouts** are placed like popups: `side` picks which way the bubble sits
from its target and `align` slides it along that edge. The tail is drawn from
the bubble's own edge to the target's, so it re-aims itself whenever either
one moves. A `cloud` trails two puffs instead of a tail.

```ts
demo.button({ id: 'pay', x: 40, y: 40, characters: 'Pay now', variant: 'primary' });
demo.encircle({ id: 'ring', target: 'pay', spread: 10 });
demo.callout({ id: 'tip', target: 'pay', side: 'top', characters: 'One tap and you are done' });
demo.text({ id: 'small', x: 260, y: 48, characters: 'Terms apply' });
demo.underline({ id: 'mark', target: 'small', variant: 'wavy' });
demo.arrow({ id: 'link', from: 'small', to: 'pay', curve: 'curved' });
```

## Timeline

`demo.timeline` is a builder; every method returns the timeline. Steps run
in order; each starts when the previous one ends unless `at` says otherwise.
Durations below are the defaults; `options.duration` overrides a step's
computed length and `options.key` pins its random streams.

### Cursor and keyboard

| Method                         | Effect                                                                                                                                                   | Duration                                                 |
| ------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------- |
| `moveCursor(target, options?)` | Moves along a curved, seeded path to a node (a point inside its central half) or to a `{ x, y }`.                                                        | Fitts-like, 180..1400 ms by distance                     |
| `click(target?, options?)`     | Moves there first when a target is given, then presses and releases where the cursor is. Applies the hit node's natural effect and the focus rule.       | hold 60..120 ms                                          |
| `press(target?)`, `release()`  | The two halves of a click.                                                                                                                               |                                                          |
| `type(target, text)`           | Types into an `INPUT`, `NUMBER_FIELD`, `OTP_FIELD`, `COMBOBOX` or `AUTOCOMPLETE`, appending to its live value; focuses it first if needed. `\b` deletes. | ~60..140 ms per key, longer after spaces and punctuation |
| `clear(target)`                | Empties the value.                                                                                                                                       | 180 ms                                                   |
| `setValue(target, value)`      | Sets a live value instantly, for any node.                                                                                                               | 0                                                        |
| `focus(target)`, `blur()`      | Move or clear keyboard focus instantly.                                                                                                                  | 0                                                        |
| `wait(ms)`                     | Holds.                                                                                                                                                   | `ms`                                                     |
| `set(target, patch)`           | Patches the node from this moment on (any props, including layout); the scene itself is untouched.                                                       | 0                                                        |
| `at(ms)`                       | Starts the next step at an absolute time; earlier than the previous end is an error.                                                                     |                                                          |
| `startAt({ x, y })`            | Where the cursor rests before the first step. Default: 60 % across, 75 % down.                                                                           |                                                          |

### Semantic steps

Each expands into the cursor moves and clicks a person would make on the
control's regions, verified to land there, and records the state change so
seeking stays a pure replay.

| Method                          | On                                                                                       | Effect                                                                                                                                                                                                                                                     |
| ------------------------------- | ---------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `check(target, option?)`        | `CHECKBOX`, `SWITCH`, `TOGGLE`; with `option`: `CHECKBOX_GROUP`, multiple `TOGGLE_GROUP` | Clicks until checked; already checked: only moves there.                                                                                                                                                                                                   |
| `uncheck(target, option?)`      | same                                                                                     | The reverse.                                                                                                                                                                                                                                               |
| `toggle(target)`                | `CHECKBOX`, `SWITCH`, `TOGGLE`                                                           | Flips it.                                                                                                                                                                                                                                                  |
| `choose(target, value)`         | any type with an option region for `value`                                               | Opens the control if needed (select, menu), makes the intermediate choices (a menubar's menu, a submenu's parent), clicks the option. On a `NUMBER_FIELD` steps until the number is reached; on a `SLIDER` or `SCROLL_AREA` clicks the track at the value. |
| `open(target)`, `close(target)` | anything with an `open` state                                                            | Clicks the region or anchor that does it (a collapsible header, a popover's anchor, a dialog's close mark); with nothing to click, applies instantly. Already there: only moves.                                                                           |
| `hover(target)`                 | any node                                                                                 | Moves there. A tooltip or preview card anchored to it opens after its delay and the cursor rests 700 ms; moving away later closes it. `hover(tooltip)` hovers its anchor.                                                                                  |
| `drag(target, value)`           | `SLIDER`, `SCROLL_AREA`                                                                  | Presses the thumb, moves to the value (snapped to `step` and range) and releases; the value follows the cursor on the way.                                                                                                                                 |

Clicks also have side effects on popups: a click on a popover's or context
menu's anchor toggles it, and a click outside an open menu, select, combobox,
popover or context menu dismisses it. A dialog's backdrop closes a `DIALOG`
but not an `ALERT_DIALOG`.

### Other methods

| Method                   | Notes                                                                    |
| ------------------------ | ------------------------------------------------------------------------ |
| `add(step)`              | Appends a raw `Step` object (see the JSON form below).                   |
| `reset()`                | Removes every step and the start point.                                  |
| `steps`                  | The authored steps (read-only).                                          |
| `cursor`                 | The start point, if set.                                                 |
| `version`                | Bumps on every change; the demo recompiles lazily.                       |
| `toJSON()`, `load(json)` | `{ version: 1, steps, cursor? }`; `load` also accepts a bare step array. |

### Step JSON

Each step is `{ type, ...fields, key?, duration?, at? }`:

```
moveCursor { target }        click { target? }       press { target? }   release {}
type { target, text }        clear { target }        wait { duration }
focus { target }             blur {}                 setValue { target, value }
set { target, patch }        check { target, option? }   uncheck { target, option? }
toggle { target }            choose { target, value }    open { target }   close { target }
hover { target }             drag { target, value }
```

`target` is a node id, or `{ x, y }` for `moveCursor`, `click` and `press`.

## Scene

`demo.scene` holds the node tree. Factories call `add`; use the scene for
edits, queries and geometry.

| Method                                                                                                | Notes                                                                                                                    |
| ----------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------ |
| `add(node)`                                                                                           | Adds a complete node (`type`, `id`, `x`, `y` and props). Validates; throws on any problem.                               |
| `update(id, patch)`                                                                                   | Shallow-merges a patch; `style`, `sketch` and `state` merge one level deep. `parent` reparents.                          |
| `remove(id)`                                                                                          | Removes the node and its subtree.                                                                                        |
| `has(id)`, `get(id)`, `node(id)`                                                                      | Lookup; `node` throws for unknown ids.                                                                                   |
| `all()`, `visible()`                                                                                  | Nodes in paint order; `visible` skips hidden subtrees and children a component hides (closed collapsible, inactive tab). |
| `childrenOf(parent?)`                                                                                 | Child ids in paint order; top level without an argument.                                                                 |
| `bringToFront(id)`, `sendToBack(id)`                                                                  | Paint order among siblings.                                                                                              |
| `bounds(id)`                                                                                          | Absolute laid-out box `{ x, y, width, height }`.                                                                         |
| `position(id)`                                                                                        | Absolute origin of the node's local space.                                                                               |
| `localBounds(id)`, `measure(node)`                                                                    | Intrinsic size in local space.                                                                                           |
| `contentOrigin(id)`                                                                                   | Where a container's children start (below a title bar, inside padding).                                                  |
| `resolved(id)`                                                                                        | The node with the sizes the layout gave it (`FILL`, `HUG`).                                                              |
| `layout()`                                                                                            | The whole layout, cached by scene version.                                                                               |
| `hitTest(point)`, `hitTestDetailed(point)`                                                            | The topmost interactive node under a point, and the region within it.                                                    |
| `isInView(id)`                                                                                        | Whether a node is inside every clipping ancestor's viewport.                                                             |
| `isInteractive(node)`, `isFocusable(node)`, `isDescendant(id, ancestor)`, `childShown(parent, index)` | Predicates.                                                                                                              |
| `version`, `nodeVersion(id)`                                                                          | Change counters.                                                                                                         |
| `clone()`, `toJSON()`                                                                                 | A deep copy; the nested document form.                                                                                   |

## Player

Returned by `demo.mount(container, options)`.

| Option     | Default | Notes                                           |
| ---------- | ------- | ----------------------------------------------- |
| `autoplay` | `false` |                                                 |
| `loop`     | `false` |                                                 |
| `rate`     | `1`     | Playback rate.                                  |
| `clock`    | rAF     | `{ now, requestFrame, cancelFrame }` for tests. |

| Member                                    | Notes                                                                   |
| ----------------------------------------- | ----------------------------------------------------------------------- |
| `play()`, `pause()`, `toggle()`, `stop()` | `stop` pauses and seeks to 0.                                           |
| `seek(t)`                                 | Exact: the frame shown is the frame `toSVG(t)` produces.                |
| `time`, `duration`, `playing`             | Read-only.                                                              |
| `rate`, `loop`                            | Writable.                                                               |
| `on(event, cb)`                           | `play`, `pause`, `seeked`, `timeupdate`, `end`; returns an unsubscribe. |
| `render()`                                | Re-renders the current time.                                            |
| `destroy()`                               | Pauses and drops all listeners; leaves the SVG in place.                |

## Icons, fonts, theme

| Export                    | Notes                                                                                                                                                                                                                                                                             |
| ------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `iconNames()`             | The 47 built-in icon names plus globally registered ones.                                                                                                                                                                                                                         |
| `registerIcon(name, def)` | Registers an icon for the whole process. `demo.registerIcon` scopes it to one demo and saves it with the document.                                                                                                                                                                |
| `IconDef`                 | `{ viewBox?: string, nodes: [tag, attrs][], rough?: boolean }`, the shape of `@sketchyicons/data`; any of its 1,756 icons can be passed directly. `rough: true` sketches clean paths.                                                                                             |
| `DEFAULT_FONT`            | Grape Nuts (SIL OFL) as vendored glyph outlines, drawn in capitals: text is folded to upper case when measured and drawn, the model keeps its case. Covers printable ASCII, Latin-1 letters and common symbols, `…`, curly quotes and dashes; anything else draws as a small box. |
| `StrokeFont`              | Built from `StrokeFontData`: `kind` (`stroke` polylines or `outline` paths), `uppercase`, `lineHeight`, metrics and `glyphs`. Methods: `measure`, `advance`, `caretX`, `glyph`, `fold`, `ascent`, `descent`, `capHeight`, `lineHeight`, `scale`, `outline`.                       |
| `DEFAULT_THEME`           | See below.                                                                                                                                                                                                                                                                        |

Built-in icons: arrow-left, arrow-right, bell, bookmark, calendar, check,
chevron-down, chevron-left, chevron-right, chevron-up, circle-alert,
circle-check, circle-x, copy, download, eye, eye-off, file, folder, globe,
heart, house, image, info, link, list, lock, log-in, log-out, mail, menu,
minus, pause, pencil, play, plus, refresh-cw, search, send, settings,
shopping-cart, star, triangle-alert, upload, user, x.

### Theme

| Key                | Default   | Used for                                                                                   |
| ------------------ | --------- | ------------------------------------------------------------------------------------------ |
| `stroke`           | `#1f2430` | Outlines                                                                                   |
| `text`             | `#1f2430` | Text                                                                                       |
| `accent`           | `#2f6fed` | Primary buttons, checked state, focus, selection                                           |
| `muted`            | `#8a8f98` | Placeholders, descriptions, tracks                                                         |
| `surface`          | `#ffffff` | Component faces                                                                            |
| `background`       | `#ffffff` | Document background                                                                        |
| `strokeWeight`     | `1.2`     |                                                                                            |
| `roughness`        | `1`       | Sketch jitter                                                                              |
| `bowing`           | `1`       | Sketch line bowing                                                                         |
| `radius`           | `6`       | Corner radius of components                                                                |
| `fontSize`         | `14`      |                                                                                            |
| `textRoughness`    | `0.6`     | Text wants less wobble than boxes                                                          |
| `frameOvershoot`   | `8`       | How far a container's outline runs past its corners; `0` draws the plain rounded rectangle |
| `frameBand`        | `8`       | Width of the marker band under that outline; `0` leaves the ink bare                       |
| `frameBandOpacity` | `0.5`     | Opacity of the band                                                                        |

## Documents

`demo.toJSON()` returns a `DemoJSON`:

```ts
{
  version: 2,
  width, height, seed,
  theme,                 // the resolved Theme
  background,            // string or null
  font,                  // font name; a custom font must be supplied to loadDemo
  icons?,                // icon definitions the nodes use that are not built in
  children,              // top-level nodes, back to front, each with its own `children`
  timeline?,             // the steps, when there are any
  cursor?                // the start point, when set
}
```

Stored nodes never contain computed sizes or resolved placements; layout
defaults are omitted. `loadDemo(demo.toJSON())` renders byte-identically to
`demo` at every time, and `toJSON()` of the result equals the input.

## Determinism

`toSVG(t)`, `frameAt(t)` and every frame the player shows are pure functions
of the document, the seed and `t`. The library never reads `Math.random` or
the clock while rendering; a random seed is drawn once, when `createDemo` is
called without one. The same document with a different seed gives different
jitter, cursor paths and typing cadence but the same semantics. A step's
random streams are keyed by its index unless `key` is given, so inserting a
step re-rolls the jitter of later steps but never what they do.

## Errors

All are thrown synchronously. Timeline problems surface when the timeline is
compiled, which happens on the first render, `duration`, `stateAt`,
`nodeAt` or `mount` after a change; they are `CompileError` instances with
`stepIndex` and a message of the form `Timeline step N: ...`.

| Message                                                    | Cause                                                                                   |
| ---------------------------------------------------------- | --------------------------------------------------------------------------------------- |
| `unknown target "x"`                                       | No node with that id.                                                                   |
| `target "x" is not visible`                                | The node (or an ancestor) has `visible: false`.                                         |
| `target "x" is scrolled out of view`                       | Inside a scroll area, outside its viewport; `drag` the area first.                      |
| `target "x" is a BUTTON, which cannot be checked`          | The step is not one the type supports (see the Steps columns).                          |
| `target "x" has no option "y"`                             | `choose`/`check` named something the control does not offer (and no route leads to it). |
| `target "x" cannot reach 9`                                | A number field's stepper cannot get there within `min`/`max`.                           |
| `target "x" is not focusable`                              | `focus()` on a non-focusable node.                                                      |
| `region "close" of "x" is covered and cannot be clicked`   | Something draws over the whole region.                                                  |
| `reaction on "x" targets unknown node "y"`                 | A reaction on the node the click hit names a node that is not in the scene.             |
| `at=10 is earlier than the end of the previous step (500)` | Steps must not overlap.                                                                 |

Scene errors are plain `Error`s with the node named, for example
`Node "x": width is required unless layoutSizingHorizontal is HUG or FILL`,
`Node "x": value must be one of A, B`, `Node "x": anchor "y" does not exist`,
`Duplicate node id "x"`, `Unknown parent "p" for node "x"`. Document errors
are `DemoJSONError`s.

## Exports

Runtime: `createDemo`, `loadDemo`, `Demo`, `Scene`, `Timeline`, `Player`,
`registerIcon`, `iconNames`, `StrokeFont`, `DEFAULT_FONT`,
`DEFAULT_THEME`, `CompileError`, `DemoJSONError`, `parseDemoJSON`.

Types: `DemoOptions`, `LoadOptions`, `DemoJSON`, `Props`, `RelativeProps`,
`LayoutChildProps`, `ContainerProps`, `AnchoredProps`, `NodeProps`,
`StepOptions`, `Step`, `StepType`, `Target`, `TimelineJSON`,
`InteractionState`, `PlayerOptions`, `PlayerEvent`, `Clock`, `Placement`,
`Align`, `PlaceDirection`, `Padding`, `Layout`, `LayoutEntry`, `IconDef`,
`IconElement`, `StrokeFontData`, `StrokeGlyph`, `OutlineGlyph`, `TextAlign`, `TextLayout`,
`PlacedGlyph`, `Frame`, `FrameGroup`, `VElement`, `Bounds`, `Point`, `Size`,
`Color`, `ColorLike`, `Paint`, `SolidPaint`, `FillStyle`, `SketchStyle`,
`TypeStyle`, `TextAlignHorizontal`, `Theme`, `ComponentState`, `ControlValue`,
`Orientation`, `Side`, `AutoLayoutProps`, `LayoutMode`, `LayoutSizing`,
`LayoutPositioning`, `PrimaryAxisAlignItems`, `CounterAxisAlignItems`,
`NodeBase`, `SceneNode`, `NodeType`, `NodeOf`, `NodePatch`, `MenuItem`,
`MenuGroup`, `NavigationItem`, `AccordionItem`, `ToastVariant`, `Region`,
`WidgetAction`, `Reaction`, `ReactionTrigger`, `Capabilities`, `Anchoring`,
`AnnotationBase`, `UnderlineVariant`, `ArrowEnd`, `ArrowSide`, `CalloutShape`,
and one `XxxNode` interface per node type (`RectangleNode` … `CalloutNode`).
