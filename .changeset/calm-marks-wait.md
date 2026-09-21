---
'@drietsch/sketch': patch
---

`gap` reaches an arrow and a callout.

`demo.arrow({ gap })` and `demo.callout({ gap })` threw "gap and alignTo need
one of below, above, rightOf, leftOf": the relative-placement splitter claimed
the key before the node saw it, so the documented clearance of a shaft or a
tail could not be set. On those two types `gap` is now the node's own unless a
direction stands beside it, in which case it is the placement's, as before.

**Getting the look.** The README and the agent guide gain a section on why a
screen drawn with the library reads as printed or as sketched — controls with
state rather than text lists, an icon on every control, one primary button,
headings at 700 with a marker, marks kept for review, sibling frames 16px
apart, a still rendered mid-use — with one worked screen that `verify:docs`
runs.
