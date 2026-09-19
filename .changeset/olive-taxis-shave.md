---
'@drietsch/sketch': minor
---

Annotation marks: the layer someone reviewing a screen draws on top of it.

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
