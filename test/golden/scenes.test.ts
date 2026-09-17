import { describe, expect, test } from 'vitest';
import { SCENES } from '../support/scenes.js';
import { digestSvg } from '../support/svg-digest.js';

/**
 * Golden master for the library's SVG output. A change here means the visual
 * signature changed; it must be deliberate and explained in the commit.
 *
 * Digests keep the snapshot small. The full string is snapshotted only while
 * it stays reviewable.
 */
const FULL_SNAPSHOT_LIMIT = 40_000;

describe.each(Object.keys(SCENES))('%s', (name) => {
  test('digest', () => {
    const demo = SCENES[name]();
    const duration = demo.duration;
    // A static scene has one frame; an animated one is pinned at four points.
    const times = duration > 0 ? [0, duration / 4, duration / 2, duration] : [0];
    for (const t of times) {
      const svg = demo.toSVG(t);
      expect(digestSvg(svg)).toMatchSnapshot(`t=${Math.round(t)}`);
      if (svg.length < FULL_SNAPSHOT_LIMIT) {
        expect(svg).toMatchSnapshot(`t=${Math.round(t)} svg`);
      }
    }
  });
});
