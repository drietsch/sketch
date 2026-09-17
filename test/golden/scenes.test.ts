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
    const svg = SCENES[name]().toSVG();
    expect(digestSvg(svg)).toMatchSnapshot();
    if (svg.length < FULL_SNAPSHOT_LIMIT) {
      expect(svg).toMatchSnapshot();
    }
  });
});
