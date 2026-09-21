---
'@drietsch/sketch': minor
---

Labels over a hatch get a halo.

Text and icons on a hatched face — a pressed toggle, a selected toggle-group
option, an avatar on its muted hachure, a button under the hover hatch — were
crossed by the hatch lines and hard to read. The face colour is now laid under
them first, a little wider than the pen and its straying contours, so the
lines stop short of the ink the way a gel pen clears its ground. Each
component uses its own face colour, so a hovered primary button's white label
gets an accent halo under the white hatch.

`TypeStyle` gains `halo`: `true` lays the theme's surface under a `TEXT` node
you put over a hatched box of your own, a `Paint` names the colour, and
`false` takes a component's default away. It travels with the document.

Golden digests move for the six scenes that show one of those faces.
