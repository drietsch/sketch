---
'@drietsch/sketch': minor
---

Handodle is the font.

**A scribbled marker hand, in capitals.** The package now ships Handodle
(Putracetol Studio) in place of Grape Nuts. Its letters are drawn with a
marker — a doubled line and all — and that drawing is the look, so each
letter is laid down as its own outline, filled a little short of solid, with
no line put round it. As before, every string is folded to capitals when it
is drawn; the model keeps the case you wrote.

**Weight is going over it again.** A heavier weight lays the same letter
down again a hair off the first: 700 three times, 900 four, the shift kept
under a pixel or two so the word thickens without ghosting. From 700 up the
words also get a light marker under them on their own
(`theme.boldMarkerOpacity`, 0.18; `style.marker: false` declines it).
`theme.textPasses` (1) is how many times a plain weight is laid down.

**What the file lacks is written by hand.** The font file carries no glyphs
for the digits, `ß`, `· ± ™`, the marks `? ( ) ! % & @ # $ * < > ^ { } ‹ › ‚`,
the arrows or the check marks. Those are written in this repository as pen strokes in the same hand,
drawn by the engine with the face's pen and gone over twice like its drawn
lines, so a price or a date sits with the words. Drop the full font in and
its own glyphs take over.

`StrokeFontData` gains `penWidth` and `penPasses`; a face may mix outline
and stroke glyphs. The stroke path (Hershey-style faces, or a monoline face
reduced with `scripts/gen-stroke-font.mjs`) writes each stroke as one smooth
engine line, with a hand that wobbles in proportion to the size.

**Licence.** Handodle is a commercial face; see THIRD-PARTY-NOTICES.md for
its terms and for what this build of it is. Redistributing the package is
the redistributor's responsibility.

Documents saved with `grape-nuts` need that font handed back:
`loadDemo(json, { font })`. Golden digests move: every scene with text draws
differently.
