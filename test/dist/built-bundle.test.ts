import { expect, test } from 'vitest';
import { readFile } from 'node:fs/promises';
import * as source from '../../src/index.js';
import * as built from '../../dist/index.js';
import { SCENES } from '../support/scenes.js';

/**
 * Proves the published bundle behaves identically to the source it was built
 * from. A build-config mistake -- a mis-resolved dependency, a wrong target, a
 * dropped module -- cannot pass CI without failing here.
 *
 * Runs in its own project because it requires `pnpm build` to have run first.
 */
test('built bundle renders every fixture byte-identically to source', () => {
  // The fixtures are built against the source entry; the bundle rebuilds each
  // from its JSON document, so this also proves loadDemo across the boundary.
  for (const name of Object.keys(SCENES)) {
    const fromSource = SCENES[name]();
    const replay = (built as unknown as typeof source).loadDemo(fromSource.toJSON());
    const duration = fromSource.duration;
    for (const t of duration > 0 ? [0, duration / 3, duration] : [0]) {
      expect(replay.toSVG(t), `${name} @ ${t}`).toBe(fromSource.toSVG(t));
    }
  }
});

/**
 * The exact public surface. Every name here is a compatibility promise, so
 * both an accidental addition and an accidental removal must fail.
 */
export const PUBLIC_EXPORTS = [
  'CompileError',
  'DEFAULT_FONT',
  'DEFAULT_THEME',
  'Demo',
  'DemoJSONError',
  'Player',
  'Scene',
  'StrokeFont',
  'Timeline',
  'createDemo',
  'iconNames',
  'loadDemo',
  'parseDemoJSON',
  'registerIcon',
];

test('built bundle exposes exactly the documented named exports', () => {
  expect(Object.keys(built).sort()).toEqual(PUBLIC_EXPORTS);
  expect(Object.keys(source).sort()).toEqual(PUBLIC_EXPORTS);
});

test('built bundle has no bare imports and no engine internals in its surface', async () => {
  const bundle = await readFile(new URL('../../dist/index.js', import.meta.url), 'utf8');
  const bare = [...bundle.matchAll(/^import .* from ["']([^.][^"']*)["']/gm)].map((m) => m[1]);
  expect(bare).toEqual([]);
  expect(built).not.toHaveProperty('RoughGenerator');
});
