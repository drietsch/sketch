# @drietsch/roughjs

**Rough.js** is a small graphics library that lets you draw in a _sketchy_,
_hand-drawn-like_ style. It works with both Canvas and SVG.

> **This is a maintained fork of [rough-stuff/rough](https://github.com/rough-stuff/rough)**,
> which has had no code changes since November 2023. It is ESM-only, has zero
> runtime dependencies, and is published as `@drietsch/roughjs`.
>
> The original `roughjs` package is unaffected and keeps working exactly as it
> does today — see [Migrating from roughjs 4.x](#migrating-from-roughjs-4x).

## Install

```bash
npm install @drietsch/roughjs
```

**This is an ESM-only package.** There is no CommonJS build, no UMD/IIFE build,
and no `roughjs/bundled/*` deep import paths. Requires Node 24 or newer, or any
browser with native ES modules and ES2022.

`require()` does still work on supported Node versions — Node has supported
requiring an ES module since 22.12, and it returns the full named-export
namespace:

```js
const { RoughGenerator } = require('@drietsch/roughjs'); // works on Node >= 22.12
```

Bundlers and tools that resolve only the legacy `main` field will not find an
entry point, because this package ships an `exports` map with no `require`
condition.

### Browser / CDN

Always pin an exact version — never `@latest` in a URL your users load.

```html
<script type="module">
  import { RoughCanvas } from 'https://esm.sh/@drietsch/roughjs@5.0.0';

  const rc = new RoughCanvas(document.getElementById('canvas'));
  rc.rectangle(10, 10, 200, 200);
</script>
```

jsDelivr works too:

```js
import { RoughCanvas } from 'https://cdn.jsdelivr.net/npm/@drietsch/roughjs@5.0.0/+esm';
```

The bundle is 12.3 kB gzipped (unminified — your bundler minifies it).

## Usage

![Rough.js rectangle](https://roughjs.com/images/m1.png)

```js
import { RoughCanvas } from '@drietsch/roughjs';

const rc = new RoughCanvas(document.getElementById('canvas'));
rc.rectangle(10, 10, 200, 200); // x, y, width, height
```

or SVG

```js
import { RoughSVG } from '@drietsch/roughjs';

const rc = new RoughSVG(svg);
const node = rc.rectangle(10, 10, 200, 200); // x, y, width, height
svg.appendChild(node);
```

or headless — `RoughGenerator` needs no DOM at all and renders nothing itself,
which makes it usable in Node:

```js
import { RoughGenerator } from '@drietsch/roughjs';

const gen = new RoughGenerator();
const drawable = gen.rectangle(10, 10, 200, 200, { seed: 42 });
const paths = gen.toPaths(drawable); // [{ d, stroke, strokeWidth, fill }]
```

### Lines and Ellipses

![Rough.js rectangle](https://roughjs.com/images/m2.png)

```js
rc.circle(80, 120, 50); // centerX, centerY, diameter
rc.ellipse(300, 100, 150, 80); // centerX, centerY, width, height
rc.line(80, 120, 300, 100); // x1, y1, x2, y2
```

### Filling

![Rough.js rectangle](https://roughjs.com/images/m3.png)

```js
rc.circle(50, 50, 80, { fill: 'red' }); // fill with red hachure
rc.rectangle(120, 15, 80, 80, { fill: 'red' });
rc.circle(50, 150, 80, {
  fill: 'rgb(10,150,10)',
  fillWeight: 3, // thicker lines for hachure
});
rc.rectangle(220, 15, 80, 80, {
  fill: 'red',
  hachureAngle: 60, // angle of hachure,
  hachureGap: 8,
});
rc.rectangle(120, 105, 80, 80, {
  fill: 'rgba(255,0,200,0.2)',
  fillStyle: 'solid', // solid fill
});
```

Fill styles can be: **hachure** (default), **solid**, **zigzag**,
**cross-hatch**, **dots**, **dashed**, or **zigzag-line**.

![Rough.js fill examples](https://roughjs.com/images/m14.png)

### Sketching style

![Rough.js rectangle](https://roughjs.com/images/m4.png)

```js
rc.rectangle(15, 15, 80, 80, { roughness: 0.5, fill: 'red' });
rc.rectangle(120, 15, 80, 80, { roughness: 2.8, fill: 'blue' });
rc.rectangle(220, 15, 80, 80, { bowing: 6, stroke: 'green', strokeWidth: 3 });
```

### SVG Paths

![Rough.js paths](https://roughjs.com/images/m5.png)

```js
rc.path('M80 80 A 45 45, 0, 0, 0, 125 125 L 125 80 Z', { fill: 'green' });
rc.path('M230 80 A 45 45, 0, 1, 0, 275 125 L 275 80 Z', { fill: 'purple' });
rc.path('M80 230 A 45 45, 0, 0, 1, 125 275 L 125 230 Z', { fill: 'red' });
rc.path('M230 230 A 45 45, 0, 1, 1, 275 275 L 275 230 Z', { fill: 'blue' });
```

SVG Path with simplification:

![Rough.js texas map](https://roughjs.com/images/m9.png) ![Rough.js texas map](https://roughjs.com/images/m10.png)

### Reproducible drawings

Every shape is randomised. Pass an explicit non-zero `seed` to get the same
drawing every time — useful for tests, snapshots, and anything cached.

```js
import { newSeed } from '@drietsch/roughjs';

rc.rectangle(10, 10, 80, 80, { seed: 42 }); // identical on every render
rc.rectangle(10, 10, 80, 80, { seed: newSeed() }); // different each time
```

Identical arguments always produce an identical drawing, so repeated calls with
no `seed` look the same — pass `seed: newSeed()` where you want variety. Every
drawing reports the seed that produced it:

```js
const drawable = gen.rectangle(10, 10, 80, 80);
drawable.options.seed; // replay this later to get the same shape
```

All seven fill styles honour the seed. In 4.x, `fillStyle: 'dots'` did not, and
drawings made with default options could not be reproduced at all — see the
changelog.

## TypeScript

Types ship with the package and are reachable from the root import, which was
not the case in 4.x:

```ts
import type { Options, Drawable, OpSet, PathInfo, Point } from '@drietsch/roughjs';
```

## Migrating from roughjs 4.x

`@drietsch/roughjs` is a separate npm package, so nothing you have today breaks.
`roughjs@4.6.6` keeps working exactly as it does now, and migration is opt-in.

| roughjs 4.x                                                | @drietsch/roughjs 5.x                             |
| ---------------------------------------------------------- | ------------------------------------------------- |
| `require('roughjs')`                                       | works on Node >= 22.12, returns the named exports |
| `require('roughjs/bundled/rough.cjs.js')`                  | gone — the path no longer exists                  |
| `import rough from 'roughjs/bundled/rough.esm.js'`         | `import { RoughCanvas } from '@drietsch/roughjs'` |
| `rough.canvas(el)`                                         | `new RoughCanvas(el)`                             |
| `rough.svg(el)`                                            | `new RoughSVG(el)`                                |
| `rough.generator()`                                        | `new RoughGenerator()`                            |
| `rough.newSeed()`                                          | `newSeed()` (named export)                        |
| `<script src="unpkg.com/roughjs@latest/bundled/rough.js">` | `<script type="module">` with an esm.sh import    |
| `import { RoughCanvas } from 'roughjs'` — did not work     | now works                                         |
| `import type { Options } from 'roughjs'` — did not work    | now works                                         |

Behaviour changes are listed in [CHANGELOG.md](./CHANGELOG.md).

## API & documentation

The [upstream wiki](https://github.com/rough-stuff/rough/wiki) documents the
drawing API, which this fork keeps unchanged apart from the entry points above.

## Credits

Rough.js was created by [Preet Shihn](https://github.com/pshihn). The sketching
algorithm is derived from Handy, a Processing library by Jo Wood, Petra Isenberg,
Tobias Isenberg, Sheelagh Carpendale, Jason Dykes and Aidan Slingsby.

This fork bundles four MIT-licensed packages by the same author —
`hachure-fill`, `path-data-parser`, `points-on-curve` and `points-on-path` —
see [THIRD-PARTY-NOTICES.md](./THIRD-PARTY-NOTICES.md).

Sponsorship goes to the upstream project on
[Open Collective](https://opencollective.com/rough).

## License

[MIT](./LICENSE) © Preet Shihn, and contributors to this fork.
