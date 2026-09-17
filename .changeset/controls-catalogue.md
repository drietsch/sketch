---
'@drietsch/sketch': minor
---

Twenty controls from Base UI's catalogue, and semantic timeline steps that use them.

New node types, each with a factory (`demo.checkbox`, `demo.radioGroup`, …):
`CHECKBOX`, `CHECKBOX_GROUP`, `SWITCH`, `TOGGLE`, `TOGGLE_GROUP`, `RADIO_GROUP`,
`SLIDER`, `PROGRESS`, `METER`, `SEPARATOR`, `AVATAR`, `NUMBER_FIELD`,
`OTP_FIELD`, `FIELD`, `FIELDSET`, `FORM`, `TOOLBAR`, `COLLAPSIBLE`, `ACCORDION`
and `TABS`. Model state uses Base UI's names as props on the node (`checked`,
`pressed`, `open`, `value`); list-like controls take `options`, `items` or
`tabs` and draw their entries as parts with clickable regions. `FIELD`, `FORM`,
`TOOLBAR` and `COLLAPSIBLE` are auto-layout containers with sensible defaults;
a closed `COLLAPSIBLE` and the inactive panels of `TABS` hide their children.

The timeline gains `check`, `uncheck`, `toggle`, `choose`, `open`, `close`,
`hover` and `drag`. Each compiles into the cursor moves and clicks a person
would make on the control's regions (an option row, a tab header, a stepper
button, the slider thumb) and records the state change on the compiled step,
so seeking stays a pure replay. A plain `click(id)` applies a control's natural
effect. A step the target cannot take is a `CompileError` naming the step, the
node and its type. `demo.nodeAt(id, t)` reports the live `value`, `checked`,
`open` and `pressed`.

Components declare `regions`, a `click` action, `capabilities`, `validate`,
`container`, `childVisible` and `layoutDependsOnState`; `Scene.hitTestDetailed`
resolves a point to a node and its region; parts may sit on an overlay layer
that paints above every ordinary node (used by the popups of the next release).
The stroke font gains `…`, curly quotes, en and em dashes. Breaking:
`ComponentState.checked` moved to the node's `checked` prop; `InteractionState`
keeps `values`, `checked` and `open` maps.
