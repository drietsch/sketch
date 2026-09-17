---
'@drietsch/sketch': minor
---

Submenus, one-step `choose` through menus, and a catalogue check.

A `MENU` or `CONTEXT_MENU` item may carry `items`, which opens a submenu to
its right while it is the menu's `value`. `choose(menu, item)` now walks the
way there in one step: it opens the menu, opens the submenu that holds the
item and clicks it, and `choose(menubar, item)` opens the menu that holds the
item first. Components declare that route through `pathTo`.

`pnpm run verify:components` (part of `check` and CI) asserts that every
registered node type has a factory on `Demo`, an exported node interface, a
README table row and a fixture that pins its look.
