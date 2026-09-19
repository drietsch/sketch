---
'@drietsch/sketch': minor
---

Text can carry weight, and a heading can sit on a marker.

The default font ships in one cut, and its glyphs were the one thing in a scene
the engine never touched: filled outlines, straight into a path, while
everything around them wobbled. A weight above 400 now goes round the same
letterform again with a broader, sketched pen, so a heading gains thickness and
a hand-drawn edge in the same stroke.

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
