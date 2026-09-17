---
'@drietsch/sketch': minor
---

The default font is now Grape Nuts, a handwriting face, set in capitals.

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
