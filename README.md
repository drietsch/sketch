# @drietsch/sketchdemo

An API-first JavaScript/TypeScript library for creating and animating
hand-drawn GUI mockups.

Build complete interfaces (windows, panels, inputs, buttons, icons, text) in a
sketch-style visual language, then script how someone uses them: the cursor
moves, clicks, focuses and types on a seekable timeline. Output is SVG, and
everything is deterministic: the same document, seed and timestamp always
produce byte-identical output.

> **Status:** under construction. The sketch-geometry engine (derived from
> roughjs) is in place; the scene model, components, timeline and renderer are
> being built. See [`docs/BASE-IDEA.md`](docs/BASE-IDEA.md) for the briefing.

## The idea

```ts
import { createDemo } from '@drietsch/sketchdemo';

const demo = createDemo({ width: 900, height: 600, seed: 42 });

demo.input({ id: 'email', x: 250, y: 200, width: 350, placeholder: 'Email' });
demo.button({ id: 'login', x: 470, y: 300, text: 'Sign in' });

demo.timeline.moveCursor('email').click().type('email', 'hello@example.com').moveCursor('login').click();

demo.toSVG(1500); // the frame at 1.5 s, as an SVG string
```

Everything that can be drawn, edited, animated or interacted with has a public
API representation. A future visual editor uses the same API.

## Development

```sh
pnpm install
pnpm run check          # lint, format, typecheck, tests, build, dist tests
pnpm run verify:pages   # render every examples/ page in headless Chromium
pnpm run verify:package # pack, install into a temp project, smoke-test
```

## Credits

The sketch-geometry engine in `src/sketch/` is derived from
[roughjs](https://github.com/rough-stuff/rough) by Preet Shihn (MIT). See
[`THIRD-PARTY-NOTICES.md`](THIRD-PARTY-NOTICES.md).

## License

MIT
