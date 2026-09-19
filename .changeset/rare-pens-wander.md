---
'@drietsch/sketch': minor
---

Containers are drawn the way a hand draws a box.

A rounded rectangle from the engine closes its corners neatly however rough the
line is, which is what made a window frame read as printed rather than drawn.
A container's outline is now a light marker band, four straight edges that each
run past their corners, a second thinner pass over them, and two short strokes
re-inking each corner.

It applies to `WINDOW`, `FRAME`, `FIELDSET`, `FORM` and `TOOLBAR`, and to the
raised panels of `DIALOG`, `ALERT_DIALOG` and `DRAWER` — those take the ink
without the band, since their shadow already carries the weight. A node with no
stroke gets none of it, and `SCROLL_AREA` keeps the plain rectangle because its
clip would cut the overshoot off mid-stroke.

Three new theme keys, all of which a document can dial or turn off:

```ts
createDemo({ width: 900, height: 600, theme: { frameOvershoot: 12, frameBand: 10, frameBandOpacity: 0.4 } });
createDemo({ width: 900, height: 600, theme: { frameOvershoot: 0 } }); // the old plain rectangle
```

`frameOvershoot` (8) is how far each edge runs past its corner, capped at a
quarter of the box's shorter side; `frameBand` (8) is the band's width, capped
at an eighth; `frameBandOpacity` (0.5) is how strongly it shows. A container
shallower than 56px takes the ink without a band, and one shallower than 28px
keeps the plain rectangle, so a toolbar strip does not turn to scribble. A node's own `sketch.roughness` and
`sketch.bowing` scale the whole treatment as before.

Every scene with a container renders differently, so the golden digests move.
Nothing about the model, the timeline or the API changes.
