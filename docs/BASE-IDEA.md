# Project Briefing

Build an **API-first JavaScript/TypeScript library for creating and animating hand-drawn GUI mockups**.

The goal is to make it easy to programmatically create complete interfaces — windows, forms, buttons, inputs, menus, icons, dialogs, browser frames, and similar UI elements — in a sketch-style visual language, and then animate how someone interacts with them.

The project can take inspiration from Rough.js, Sketchyicons, and Ghost Cursor, but does not need to depend on or fork them. Their useful ideas are:

- Rough.js: imperfect, hand-drawn geometry
- Sketchyicons: deterministic sketch-style vector icons
- Ghost Cursor: natural-looking cursor paths and interaction timing

The core discipline is:

> **Everything must be possible through the API.**

Anything that can be drawn, edited, animated, or interacted with must have a public API representation. A future visual editor should simply use the same APIs rather than having special internal functionality.

A typical API could look roughly like:

```ts
const demo = createDemo({
  width: 900,
  height: 600,
  seed: 42,
});

demo.input({
  id: 'email',
  x: 250,
  y: 200,
  width: 350,
  placeholder: 'Email',
});

demo.button({
  id: 'login',
  x: 470,
  y: 300,
  text: 'Sign in',
});

demo.timeline.moveCursor('email').click().type('email', 'hello@example.com').moveCursor('login').click();
```

The important architectural pieces are:

**Scene model** — describes what exists: shapes, text, icons and semantic GUI components.

**Sketch renderer** — turns clean geometry into deterministic hand-drawn geometry.

**GUI components** — higher-level objects such as inputs, buttons, checkboxes, browser windows and dialogs.

**Interaction engine** — handles cursor movement, clicking, focus, keyboard input and typing.

**Timeline** — describes what happens and when, and supports play, pause and seeking.

**Renderer** — SVG should be the initial rendering target. Canvas or other output formats can come later.

The system should be deterministic. Given the same document, seed and timestamp, it should produce exactly the same result. Sketch imperfections, cursor paths and typing timings should therefore use seeded randomness rather than true randomness.

Semantic IDs should connect everything:

```ts
scene.get("email");
scene.update("email", ...);
scene.bounds("email");

timeline.moveCursor("email");
timeline.click("email");
timeline.type("email", "hello@example.com");
```

Inputs and other controls should initially be **simulated graphical controls**, not native HTML inputs. This gives full control over sketch styling, caret rendering, selection, focus, typing animation and export.

The initial implementation should stay small. A good MVP would include:

- SVG rendering
- lines, rectangles, rounded rectangles, paths and text
- sketch-style deterministic geometry
- icons
- button, input, panel and browser/window components
- semantic IDs and bounds
- cursor movement
- clicking
- animated typing
- focus state
- timeline playback and seeking
- JSON-serializable scenes and timelines

The deeper idea is not simply “Rough.js plus cursor animation.”

It is:

> **A programmable visual language for sketching interfaces and demonstrating how they are used.**

The hand-drawn appearance is the visual identity; the real foundation is the combination of an API-first scene model, semantic GUI components, deterministic rendering and a scriptable interaction timeline.
