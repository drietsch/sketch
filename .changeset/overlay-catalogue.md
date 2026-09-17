---
'@drietsch/sketch': minor
---

The rest of Base UI's catalogue: fifteen popups and overlays, on an anchoring and overlay layer.

New node types with factories: `TOOLTIP`, `PREVIEW_CARD`, `POPOVER`, `MENU`,
`CONTEXT_MENU`, `MENUBAR`, `NAVIGATION_MENU`, `SELECT`, `COMBOBOX`,
`AUTOCOMPLETE`, `DIALOG`, `ALERT_DIALOG`, `DRAWER`, `TOAST` and `SCROLL_AREA`.
A popup with an `anchor` is placed against that node by the layout pass (after
everything else, so it follows auto-layout and `set` steps) and needs no
coordinates; dialogs, drawers and toasts sit against the page. Popups draw on
the overlay layer above every ordinary node, together with their children,
and hit-testing lets a dialog's own buttons win over its body while its
backdrop takes every other click.

The timeline understands how they open: hovering an anchor opens its tooltip
after the delay and rests there, and moving away closes it; a click on a
popover's anchor toggles it; a click outside an open menu, select or popover
dismisses it; typing into a combobox opens and filters its list; `open` and
`close` on any of them go through the anchor or the close mark when there is
one and apply instantly otherwise. A row scrolled out of a scroll area's
viewport is rejected as a target with a clear error.

Also: a scroll area clips its children with a self-contained `clipPath` per
group (so a mounted document still equals `toSVG(t)`), the focus ring paints
under overlays unless its node is inside one, `wrapText` word-wraps
descriptions, and containers with a default size (`WINDOW`, `DIALOG`,
`POPOVER`, `DRAWER`) no longer require a stored width or height.
