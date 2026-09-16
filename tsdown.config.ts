import { defineConfig } from 'tsdown';

export default defineConfig({
  entry: ['src/index.ts'],
  outDir: 'dist',
  format: 'esm',
  // 'browser', not 'neutral'. Under 'neutral' rolldown ignores the `main` field,
  // and none of the four bundled deps publish an `exports` map -- so they resolve
  // to nothing and are silently emitted as bare imports, producing a package that
  // cannot be installed. Neither publint nor attw catches that.
  platform: 'browser',
  target: 'es2022',

  hash: false,
  clean: true,

  // Libraries ship readable, mappable code; the consumer's bundler minifies.
  minify: false,
  sourcemap: true,
  treeshake: true,

  dts: true,

  // hachure-fill, points-on-curve, points-on-path and path-data-parser are in
  // devDependencies, and tsdown externalises only `dependencies` /
  // `peerDependencies` -- of which this package has none. So all four are
  // inlined and the published package has zero runtime dependencies.
  //
  // That matches what the old Rollup config already did by omission (it declared
  // no `external`), so it is not a behaviour change, just a deliberate one.

  // Publishing correctness gates, run as part of the build.
  publint: true,
  attw: true,
});
