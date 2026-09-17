import { hachureLines } from 'hachure-fill';
import type { Point, Line } from '../geometry.js';
import type { ResolvedOptions } from '../core.js';
import { Random } from '../math.js';

export function polygonHachureLines(polygonList: Point[][], o: ResolvedOptions): Line[] {
  const angle = o.hachureAngle + 90;
  let gap = o.hachureGap;
  if (gap < 0) {
    gap = o.strokeWidth * 4;
  }
  gap = Math.round(Math.max(gap, 0.1));
  let skipOffset = 1;
  if (o.roughness >= 1) {
    // Attach the seeded stream rather than falling back to Math.random: every
    // generator method computes the outline (which attaches the randomizer)
    // before the fill, so in practice this branch always finds one -- but the
    // library's determinism contract must not depend on call order.
    if (!o.randomizer) {
      o.randomizer = new Random(o.seed || 0);
    }
    if (o.randomizer.next() > 0.7) {
      skipOffset = gap;
    }
  }
  return hachureLines(polygonList, gap, angle, skipOffset || 1);
}
