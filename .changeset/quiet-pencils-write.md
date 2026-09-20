---
'@drietsch/sketch': minor
---

One font, written in pencil.

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
