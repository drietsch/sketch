# Changelog

This project follows [Semantic Versioning](https://semver.org/).

## 5.0.0

First release of `@drietsch/roughjs`, a maintained fork of
[rough-stuff/rough](https://github.com/rough-stuff/rough) at upstream 4.6.6
(commit `56a2762`, 2023-11-19). Upstream has had no code changes since.

Because the package name is new, **nothing that depends on `roughjs` is
affected**. Migration is opt-in; see the table in the README.

### Breaking

- **ESM only.** The CommonJS and UMD/IIFE builds are gone, along with the
  `roughjs/bundled/*` deep import paths. The package declares `"type": "module"`
  and a real `exports` map, so `require()` fails with a clear error.
- **Named exports replace the default object.** `rough.canvas(el)` becomes
  `new RoughCanvas(el)`, `rough.svg(el)` becomes `new RoughSVG(el)`,
  `rough.generator()` becomes `new RoughGenerator()`, and `rough.newSeed()`
  becomes the named export `newSeed()`. The old default object statically
  referenced all three classes, so importing it forced bundlers to retain the
  canvas backend even in SVG-only applications.
- **Node 24 or newer**, declared via `engines`.
- **`Config` is gone.** Constructors take `Options` directly:
  `new RoughCanvas(el, { seed: 42 })` rather than
  `new RoughCanvas(el, { options: { seed: 42 } })`.
- **Repeated calls with identical arguments now produce identical drawings.**
  Previously a call made *without* an options object reused the generator's
  accumulating random stream while a call made *with* one got a fresh stream, so
  the same arguments rendered differently depending only on whether options were
  passed. A `Drawable` is now a pure function of its arguments and options; pass
  `seed: newSeed()` where per-call variety is wanted.
- **`fillStyle` is typed** as its seven real values instead of `string`, so a
  typo'd fill style fails to compile rather than silently falling back to
  hachure.
- Removed unused public types: `Config`, `DrawingSurface`, `Rectangle`, and
  `OpSet.size` / `OpSet.path` (never written or read).

### Fixed

- **`fillStyle: 'dots'` now honours `seed`.** It jittered each dot with raw
  `Math.random()`, making it the one fill style that could not be reproduced
  even with an explicit seed. It now uses the seeded randomizer like every other
  style. As a consequence dot jitter also responds to `roughness`, which it
  previously ignored — output is unchanged at the default roughness of 1.
- **Canvas and SVG now fill identically.** The canvas backend applied the
  `evenodd` fill rule to `curve`, `polygon` and `path`; the SVG backend omitted
  `path`. The same `Drawable` therefore rendered differently depending on the
  backend. Both now share one implementation.
- **`toPaths()` honours `fixedDecimalPlaceDigits`.** It ignored the option
  entirely, while both backends respected it, so `PathInfo.d` came back at full
  precision no matter what was requested.
- **Drawings made with default options are reproducible.** The default seed of
  `0` made the PRNG fall back to `Math.random()` on every draw, and
  `drawable.options.seed` reported `0` — a value that could not reproduce it. A
  generator now materialises a real seed and reports it.
- **Drawing no longer mutates the generator.** `defaultOptions` silently
  acquired a `Random` instance as a side effect of rendering.
- A whitespace-collapsing `String.replace` in the SVG path parser passed a
  string literal instead of a regular expression and had therefore never run.
  Corrected; behaviour is unchanged, because the path parser already tolerates
  arbitrary whitespace.

### Changed

- **Types are reachable from the root import.** `Options`, `Drawable`, `OpSet`,
  `Op`, `PathInfo`, `Point` and the rest previously required deep-importing
  `roughjs/bin/core`.
- **Zero runtime dependencies.** `hachure-fill`, `path-data-parser`,
  `points-on-curve` and `points-on-path` are bundled, as the previous Rollup
  build already did by omission. Their MIT notices ship in
  `THIRD-PARTY-NOTICES.md`; previously the published bundles carried none,
  because minification stripped every comment.
- Fillers are constructed per call instead of being cached in a module-level
  map, where each one permanently held the `RenderHelper` of whichever
  generator created it first.
- The published tarball contains only `dist/`, `README.md`, `LICENSE`,
  `CHANGELOG.md` and `THIRD-PARTY-NOTICES.md`. 4.6.6 also shipped
  `tsconfig.json`, `.eslintrc.json`, `.github/` and `package-lock.json`.
- Source maps and unminified output are published; 4.x shipped neither.

### Internal

- Toolchain replaced: pnpm, tsdown, Vitest, oxlint, Prettier, TypeScript 7,
  in place of Rollup 2, ESLint 7 and TypeScript 4.5.
- First automated tests in the project's history: 1,953 covering a 945-case
  golden matrix, backend contracts, PRNG reproducibility and the fillers, plus
  a check that the built bundle reproduces the source byte for byte.
- First CI in the project's history.

### Known issues

- The seeded PRNG preserves the trailing-zero count of its seed, so a seed of
  2^30 yields `0.5` forever and power-of-two seeds start near zero. Inherited
  from upstream and deliberately not changed: a different multiplier would
  re-render every seeded drawing in existence.

---

# Pre-fork history (upstream `rough-stuff/rough`)

Everything below documents the upstream `roughjs` package, not
`@drietsch/roughjs`. This fork branched from upstream 4.6.6.

## 4.6.x — reconstructed

Upstream shipped 4.6.0 through 4.6.6 without changelog entries. The following is
**reconstructed from commit history** and was not written by the upstream
maintainer.

- **4.6.6** — round the gap value for the hachure algorithm
- **4.6.5** — `curve()` accepts a series of curves (`Point[][]`)
- **4.6.4** — added the `fillShapeRoughnessGain` option
- **4.6.3** — curve layer and solid-fill path layer adjustments
- **4.6.2** — revert ellipse solid fill
- **4.6.1** — fix solid fills for curves
- **4.6.0** — replace the internal hachure implementation with `hachure-fill`

## 4.5.0 and earlier

# [4.5.0] - 2021-05-09
* Better algorithm for nested and intersecting paths https://github.com/rough-stuff/rough/issues/183
* Improved zigzag fill for concave shapes and nested paths.
* Fixed "dots" fill when roughness was <1 Itw as creatings weird shapes https://github.com/rough-stuff/rough/issues/193
* Configure precision when rendering to canvas as well as SVG using `fixedDecimalPlaceDigits` property.
* Solid fill was broken for Arcs if arc angle was > 180 degrees
* Remove notch from ellipses when roughness = 0


# [4.4.0] - 2021-05-09

* Added `preserveVertices` option when drawing shapes. Especially useful in paths. When rendering a shape, the vertices or the end points of the shape are not randomized if this is set to TRUE. This allows connected segments to always be connected. 

## [4.3.0] - 2020-05-11

* Added options to draw dashed lines - *strokeLineDash, strokeLineDashOffset, fillLineDash, fillLineDashOffset*
* Added option to disable double stroking effect - *disableMultiStroke, disableMultiStrokeFill*.
* Bug fixes to solid fill in SVG which was not obeying evenodd rules by default

## [4.1.0] - 2020-01-13

* Added ability to **fill** non-svg curves

## [4.0.0] - 2020-01-13

* Add optional seeding for randomness to ensure shapes generated with same arguments result in same vectors
* Implemented a new algorithm for hachure generation based on scanlines. Smaller in code size, and about 20% faster
* Algorithm update - adjust shape randomness and curve-step-counts based on the size of the shape
* Removed async/worker builds - can be achieved in the app level, so no need to be in the lib
* Support no-stroke sketching. `stroke: "none"` will not generate outline vectors anymore
* Removed `sunburst` fill style - it had a lot of corner cases where it did not work, and not very popular.

## [3.1.0] - 2019-03-14

* Added three new fill styles: **sunburst**, **dashed**, and **zigzag-line**
* Added three new properties in *Options* to support these fill styles:
* **dashOffset** - length of dashes in dashed fill
* **dashGap** - length of gap between dashes in dashed fill
* **zigzagOffset** - width of zigzag triangle when using zigzag-lines fill
