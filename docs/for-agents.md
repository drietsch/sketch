# sketch for agents

How to use `@drietsch/sketch` to produce a hand-drawn GUI mockup, or an
animated demo of someone using it, from code. This is the walkthrough; the
[API reference](API.md) has every prop and method.

## What the library does

- You describe a screen as a tree of nodes with Figma's vocabulary
  (`RECTANGLE`, `FRAME`, `TEXT`, `fills`, `strokes`, auto-layout) and Base
  UI's component catalogue (`BUTTON`, `INPUT`, `CHECKBOX`, `SELECT`, `DIALOG`,
  ... 45 types).
- You script how it is used with a timeline: the cursor moves, clicks, types,
  checks, chooses, drags, opens.
- You get SVG: a string for any time `t`, every frame for a video, or a live
  element in a browser with a player.
- Everything is deterministic. The same document, seed and time always give
  the same bytes. There is nothing to wait for and no randomness to control.

## The shortest useful program

```ts
import { createDemo } from '@drietsch/sketch';

const demo = createDemo({ width: 900, height: 600, seed: 42 });
demo.browser({ id: 'win', x: 40, y: 30, width: 820, height: 540, url: 'https://example.com/login' });
demo.frame({ id: 'card', parent: 'win', x: 210, y: 70, width: 400, height: 300, title: 'Welcome back' });
demo.input({ id: 'email', parent: 'card', x: 24, y: 24, width: 352, placeholder: 'you@example.com' });
demo.input({ id: 'password', below: 'email', gap: 16, width: 352, placeholder: 'Password' });
demo.button({ id: 'login', below: 'password', gap: 24, width: 352, characters: 'Sign in', variant: 'primary' });

demo.timeline
  .click('email')
  .type('email', 'ada@example.com')
  .click('password')
  .type('password', 'hunter2')
  .click('login');

const still = demo.toSVG(); // the mockup at t = 0
const end = demo.toSVG(demo.duration); // after the interaction
for (const { t, svg } of demo.frames(30)) {
  /* write each frame */
}
```

In a browser, `demo.mount(element, { autoplay: true, loop: true })` renders
it live and returns a player with `play`, `pause`, `seek`.

## Workflow

1. **Size the document** with `createDemo({ width, height, seed })`. Always
   pass a seed when the output must be reproducible.
2. **Build the screen** top-down: a `browser` or `window`, frames inside it,
   controls inside those. Give every node you will refer to later an `id`.
3. **Position** with one of: literal `x`/`y`; relative placement (`below`,
   `above`, `rightOf`, `leftOf` plus `gap`); or auto-layout (a container with
   `layoutMode`, children without coordinates). Popups need no position.
4. **Script the timeline** with semantic steps. Prefer `check`, `choose`,
   `open`, `drag`, `type` over raw `moveCursor`/`click`: they aim at the right
   region of the control and record the state change.
5. **Render**: `toSVG(t)`, `frames(fps)`, or `mount`.
6. **Persist** with `toJSON()` and rebuild with `loadDemo(json)`; the result
   renders byte-identically.

## Rules that save time

- **Ids are strings of letters, digits, `_`, `.`, `:` and `-`** and must be
  unique. Reuse them exactly in the timeline (they are case-sensitive). A
  wrong id fails at compile time with the step number.
- **Coordinates are relative to the parent's content origin.** Inside a
  frame with a title, `y: 0` is just below the title bar. Inside padding, it
  is inside the padding.
- **A container on a `FIXED` axis needs a size.** Give a `FRAME`, `FORM`,
  `TOOLBAR` or `TABS` a `width`/`height`, or set `layoutSizingVertical: 'HUG'`
  so it wraps its children (`FIELD`, `COLLAPSIBLE`, `POPOVER`, `DIALOG` hug by
  default).
- **Layout children have no coordinates.** In a container with `layoutMode`,
  omit `x`/`y`; the container positions them. To pin one, set
  `layoutPositioning: 'ABSOLUTE'` and give `x`/`y`.
- **Relative placement is resolved once**, when the node is added. Later
  edits and `set` steps do not move neighbours; auto-layout does.
- **Model state is a prop.** Author the initial state with `checked`, `open`,
  `value`, `pressed`. Do not use `state` for that; `state` is the transient
  look (`focused`, `hovered`, `pressed`, `disabled`).
- **`type` appends.** To replace a value, `clear` first or use `setValue`.
- **Instant steps share a timestamp.** `close('dlg').open('dlg')` with nothing
  between them leaves it open at that instant. Put a `wait` between steps
  you want to see one after the other.
- **A component's own buttons do nothing by themselves.** A dialog's Cancel
  button is just a button. Give it a reaction —
  `reactions: [{ trigger: 'ON_CLICK', action: { target: 'dlg', open: false } }]` —
  and `click('cancel')` closes the dialog. Without one, drive it from the
  timeline instead: `.click('cancel').close('dlg')`.
- **Text is drawn in capitals.** The default font (Grape Nuts) folds every
  string to upper case when drawing and measuring; the model keeps the case
  you wrote, so `type('email', 'ada@example.com')` shows ADA@EXAMPLE.COM and
  `nodeAt` reports `'ada@example.com'`. It covers ASCII, Latin-1 letters and
  symbols, `…`, curly quotes and dashes; other characters draw as a small
  box. There is no mixed-case font in the package; a document may supply its
  own through `createDemo({ font })`.
- **Keep the whole scene inside the document.** Nothing is clipped except
  inside a `SCROLL_AREA`; anchored popups are pulled back onto the page.

## Recipes

### A form with auto-layout

```ts
demo.form({ id: 'signup', x: 30, y: 30, width: 320, layoutSizingVertical: 'HUG' });
demo.field({ id: 'f-name', parent: 'signup', label: 'Name', width: 320 });
demo.input({ id: 'name', parent: 'f-name', width: 320, placeholder: 'Ada Lovelace' });
demo.field({ id: 'f-plan', parent: 'signup', label: 'Plan', description: 'Change any time.', width: 320 });
demo.radioGroup({ id: 'plan', parent: 'f-plan', options: ['Free', 'Team'], value: 'Free' });
demo.field({ id: 'f-volume', parent: 'signup', label: 'Volume', width: 320 });
demo.slider({ id: 'volume', parent: 'f-volume', width: 320, value: 20 });
demo.toolbar({
  id: 'actions',
  parent: 'signup',
  height: 48,
  layoutSizingHorizontal: 'FILL',
  primaryAxisAlignItems: 'MAX',
  fills: [],
  strokes: [],
});
demo.button({ id: 'cancel', parent: 'actions', characters: 'Cancel' });
demo.button({ id: 'save', parent: 'actions', characters: 'Save', variant: 'primary' });

demo.timeline.click('name').type('name', 'Ada').choose('plan', 'Team').drag('volume', 75).click('save');
```

### Menus, selects and popups

```ts
demo.button({ id: 'share', x: 20, y: 20, characters: 'Share', icon: 'send' });
demo.tooltip({ anchor: 'share', characters: 'Share this file' });
demo.popover({ id: 'share-pop', anchor: 'share', title: 'Share', width: 260 });
demo.input({ id: 'email', parent: 'share-pop', width: 236, placeholder: 'name@example.com' });
demo.button({ id: 'send', parent: 'share-pop', characters: 'Send', variant: 'primary' });

demo.menu({
  id: 'file',
  x: 160,
  y: 20,
  characters: 'File',
  items: ['New', { label: 'Export', items: ['PDF', 'PNG'] }, '-', 'Quit'],
});
demo.select({ id: 'country', x: 20, y: 80, width: 200, options: ['Austria', 'Germany'], value: 'Austria' });
demo.combobox({ id: 'city', x: 240, y: 80, width: 200, options: ['Berlin', 'Bern', 'Vienna'], placeholder: 'City' });

demo.timeline
  .hover('share') // tooltip appears after 400 ms and the cursor rests
  .open('share-pop') // clicks the Share button
  .type('email', 'grace@example.com')
  .click('send')
  .close('share-pop')
  .choose('file', 'PNG') // opens File, then Export, then clicks PNG
  .choose('country', 'Germany') // opens the list, clicks Germany
  .type('city', 'Ber')
  .choose('city', 'Bern');
```

### A dialog and a toast

```ts
demo.button({ id: 'trash', x: 20, y: 20, characters: 'Delete', icon: 'x' });
demo.dialog({
  id: 'confirm',
  title: 'Delete this file?',
  description: 'It moves to the trash for 30 days.',
  width: 360,
});
demo.toolbar({
  id: 'confirm-actions',
  parent: 'confirm',
  height: 48,
  layoutSizingHorizontal: 'FILL',
  primaryAxisAlignItems: 'MAX',
  fills: [],
  strokes: [],
});
demo.button({
  id: 'cancel',
  parent: 'confirm-actions',
  characters: 'Cancel',
  reactions: [{ trigger: 'ON_CLICK', action: { target: 'confirm', open: false } }],
});
demo.button({
  id: 'delete',
  parent: 'confirm-actions',
  characters: 'Delete',
  variant: 'primary',
  reactions: [
    { trigger: 'ON_CLICK', action: { target: 'confirm', open: false } },
    { trigger: 'ON_CLICK', action: { target: 'done', open: true } },
  ],
});
demo.toast({ id: 'done', title: 'Deleted', variant: 'success', open: false });

// The buttons carry the behaviour, so the timeline only says what is clicked.
demo.timeline.click('trash').open('confirm').click('delete').wait(800);
```

### Marking up a screen

```ts
demo.text({ id: 'price', x: 40, y: 40, characters: 'EUR 49', style: { fontSize: 22 } });
demo.underline({ id: 'struck', target: 'price', variant: 'scribble', placement: 'through' });
demo.text({ id: 'deal', x: 180, y: 40, characters: 'EUR 29', style: { fontSize: 22 } });
demo.highlight({ id: 'band', target: 'deal', spread: 4 });

demo.button({ id: 'pay', x: 40, y: 120, characters: 'Pay now', variant: 'primary' });
demo.encircle({ id: 'ring', target: 'pay', spread: 10 });
demo.callout({ id: 'tip', target: 'pay', side: 'right', characters: 'One tap and you are done' });
demo.arrow({ id: 'link', from: 'deal', to: 'pay', curve: 'curved' });
```

A mark follows its `target`, so it stays right when the interface moves; give
it `spread` to clear what it marks. Marks are not hit-tested, so one over a
button never eats the click. An arrow's endpoints are node ids or points, and
it stops at a node's edge rather than its centre.

### Tabs, accordion, collapsible

```ts
demo.tabs({ id: 'tabs', x: 20, y: 20, width: 300, height: 160, tabs: ['General', 'Billing'], value: 'General' });
demo.text({ id: 'general', parent: 'tabs', characters: 'General settings' }); // shown with tab 1
demo.button({ id: 'billing', parent: 'tabs', characters: 'Add card', icon: 'plus' }); // shown with tab 2
demo.accordion({
  id: 'faq',
  below: 'tabs',
  gap: 16,
  width: 300,
  items: [{ label: 'Shipping', characters: 'Two days.' }, 'Returns'],
});
demo.collapsible({ id: 'advanced', below: 'faq', gap: 16, width: 300, characters: 'Advanced', padding: 12 });
demo.checkbox({ id: 'beta', parent: 'advanced', characters: 'Beta features' });

demo.timeline.choose('tabs', 'Billing').choose('faq', 'Shipping').open('advanced').check('beta');
```

### Scrolling content

```ts
// 12 text rows of 14 px with 8 px between them, inside 10 px of padding: 276 px of content.
demo.scrollArea({
  id: 'list',
  x: 20,
  y: 20,
  width: 300,
  height: 120,
  contentHeight: 280,
  layoutMode: 'VERTICAL',
  padding: 10,
  itemSpacing: 8,
});
for (let i = 1; i <= 12; i++) demo.text({ id: `row-${i}`, parent: 'list', characters: `Document ${i}.pdf` });

demo.timeline.drag('list', 160).click('row-11'); // rows out of view cannot be clicked until scrolled to
```

### Styling a node

```ts
demo.rectangle({
  x: 20,
  y: 20,
  width: 160,
  height: 80,
  cornerRadius: 8,
  fills: [{ type: 'SOLID', color: '#ffd166' }],
  strokes: [{ type: 'SOLID', color: { r: 0.12, g: 0.14, b: 0.19 } }],
  strokeWeight: 2,
  sketch: { fillStyle: 'cross-hatch', roughness: 1.5 },
});
demo.text({
  x: 20,
  y: 120,
  characters: 'Hello',
  style: { fontSize: 18, fills: [{ type: 'SOLID', color: '#2f6fed' }] },
});
```

### Changing the scene mid-timeline

```ts
demo.button({ id: 'login', x: 470, y: 300, characters: 'Sign in' });
demo.text({ id: 'done', x: 470, y: 360, characters: 'Signed in!', visible: false });
demo.timeline.click('login').set('done', { visible: true }).wait(500);
```

`set` patches any prop from that moment on, including layout props, so a
frame reflows at that time. `demo.nodeAt('done', t)` reports the patched node.

### Inspecting what happened

```ts
demo.select({ id: 'country', x: 20, y: 20, width: 200, options: ['Austria', 'Germany'], value: 'Austria' });
demo.timeline.choose('country', 'Germany');
const t = demo.duration; // total ms
demo.stateAt(t).cursor; // where the cursor is at t
demo.nodeAt('country', t).value; // live model state: 'Germany'
demo.scene.bounds('country'); // absolute laid-out box
```

## Reading errors

Errors are thrown synchronously and name the node or the step.

| You see                                                                    | Do this                                                                                |
| -------------------------------------------------------------------------- | -------------------------------------------------------------------------------------- |
| `Node "x" needs x and y, a placement ..., or a container parent.`          | Give `x`/`y`, a `below`/`rightOf` placement, or put it in a container.                 |
| `Node "x": width is required unless layoutSizingHorizontal is HUG or FILL` | Give the container a `width`/`height` or make it `HUG`.                                |
| `Node "x": value must be one of A, B`                                      | `value` must be one of `options`.                                                      |
| `Node "x": anchor "y" does not exist`                                      | Add the anchor node before the popup.                                                  |
| `Cannot place "x" below "y": parent "p" has layoutMode VERTICAL ...`       | Inside an auto-layout container, drop the placement; the container positions children. |
| `Timeline step 3: unknown target "x"`                                      | The id does not exist; check spelling.                                                 |
| `Timeline step 3: target "x" is a BUTTON, which cannot be checked`         | Use a step the type supports (`click` a button; `check` a checkbox).                   |
| `Timeline step 3: target "x" has no option "y"`                            | The option is not in `options`/`items`/`tabs`; spelling and case matter.               |
| `Timeline step 3: target "x" is scrolled out of view`                      | `drag(area, offset)` first.                                                            |
| `Timeline step 3: at=10 is earlier than the end of the previous step`      | Increase `at` or drop it.                                                              |

## Output guarantees

- `toSVG(t)` is byte-identical across runs, machines and `loadDemo` round
  trips for the same document, seed and `t`.
- Seeking to `t` equals playing to `t`; nothing depends on the order frames
  are asked for.
- The SVG is self-contained: no external fonts, images or scripts. Text is
  drawn as paths from glyph data that ships with the package.
- A mounted document patched by the player serialises to exactly `toSVG(t)`.
