import type { PatternFiller, RenderHelper } from './filler-interface.js';
import type { ResolvedOptions, OpSet, Op } from '../core.js';
import type { Point, Line } from '../geometry.js';
import { lineLength } from '../geometry.js';
import { polygonHachureLines } from './scan-line-hachure.js';

export class DotFiller implements PatternFiller {
  private helper: RenderHelper;

  constructor(helper: RenderHelper) {
    this.helper = helper;
  }

  fillPolygons(polygonList: Point[][], o: ResolvedOptions): OpSet {
    o = Object.assign({}, o, { hachureAngle: 0 });
    const lines = polygonHachureLines(polygonList, o);
    return this.dotsOnLines(lines, o);
  }

  private dotsOnLines(lines: Line[], o: ResolvedOptions): OpSet {
    const ops: Op[] = [];
    let gap = o.hachureGap;
    if (gap < 0) {
      gap = o.strokeWidth * 4;
    }
    gap = Math.max(gap, 0.1);
    let fweight = o.fillWeight;
    if (fweight < 0) {
      fweight = o.strokeWidth / 2;
    }
    const ro = gap / 4;
    for (const line of lines) {
      const length = lineLength(line);
      const dl = length / gap;
      const count = Math.ceil(dl) - 1;
      const offset = length - count * gap;
      const x = (line[0][0] + line[1][0]) / 2 - gap / 4;
      const minY = Math.min(line[0][1], line[1][1]);

      for (let i = 0; i < count; i++) {
        const y = minY + offset + i * gap;
        // Was Math.random(), which made a 'dots' fill irreproducible even with an
        // explicit seed -- every other fill routes through the seeded randomizer.
        //
        // Note this also scales the jitter by o.roughness, which the raw
        // Math.random() version did not: dots now respond to roughness like every
        // other fill style. Identical at the default roughness of 1.
        const cx = x + this.helper.randOffsetWithRange(-ro, ro, o);
        const cy = y + this.helper.randOffsetWithRange(-ro, ro, o);
        const el = this.helper.ellipse(cx, cy, fweight, fweight, o);
        ops.push(...el.ops);
      }
    }
    return { type: 'fillSketch', ops };
  }
}
