---
'@drietsch/sketch': minor
---

Nodes can carry authored click actions, so a mockup's own buttons do something.

`NodeBase` gains `reactions: Reaction[]`, Figma's name for what an interaction
does. A reaction is `{ trigger: 'ON_CLICK', action }`, where the action is the
same `WidgetAction` a component's own click returns: `target` (defaulting to the
node carrying the reaction) plus any of `checked`, `open`, `value` and `focus`.
A dialog's Cancel button now closes the dialog by itself:

```ts
demo.button({
  id: 'cancel',
  parent: 'actions',
  characters: 'Cancel',
  reactions: [{ trigger: 'ON_CLICK', action: { target: 'confirm', open: false } }],
});
demo.timeline.click('cancel');
```

Every reaction on the node a click hits fires, in the order written, after the
component's own effect, so a reaction wins where the two disagree. They fire for
any click that lands on the node, including the clicks a semantic step makes on
the way, but not for `set`, `setValue` or a hand-written `press`/`release` pair.
A reaction may name a node added after it; a target that never exists is a
`CompileError` on the step that would have fired it, and a malformed reaction is
rejected when the node is added or loaded.

New exported types: `Reaction` and `ReactionTrigger`. `WidgetAction` moved to
`core/types` and is still exported under the same name. Nothing else changes:
documents without reactions compile and render exactly as before.
