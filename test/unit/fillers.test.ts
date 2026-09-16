import { describe, expect, test, vi } from 'vitest';
import { getFiller } from '../../src/fillers/filler.js';
import { DotFiller } from '../../src/fillers/dot-filler.js';
import { HatchFiller } from '../../src/fillers/hatch-filler.js';
import { ZigZagLineFiller } from '../../src/fillers/zigzag-line-filler.js';
import { DashedFiller } from '../../src/fillers/dashed-filler.js';
import type { RenderHelper } from '../../src/fillers/filler-interface.js';
import type { Op, OpSet, ResolvedOptions } from '../../src/core.js';
import type { Point } from '../../src/geometry.js';
import { FILL_STYLES } from '../support/cases.js';
import { Random } from '../../src/math.js';

type Call = readonly [string, ...unknown[]];

/**
 * Stub RenderHelper. Fillers receive their drawing primitives by injection
 * (filler-interface.ts), which is what breaks the renderer<->filler cycle, so
 * they can be tested in isolation without touching the renderer.
 *
 * Behaviour tests below construct fillers directly rather than through
 * getFiller(): filler.ts caches instances in a module-level map, so getFiller
 * returns an instance bound to whichever helper reached it first and a fresh
 * stub would silently record nothing.
 */
function stubHelper(): { helper: RenderHelper; calls: Call[] } {
  const calls: Call[] = [];
  const helper: RenderHelper = {
    randOffset: (x) => {
      calls.push(['randOffset', x]);
      return 0;
    },
    randOffsetWithRange: (min, max) => {
      calls.push(['randOffsetWithRange', min, max]);
      return 0;
    },
    ellipse: (x, y, w, h): OpSet => {
      calls.push(['ellipse', x, y, w, h]);
      return { type: 'fillSketch', ops: [] };
    },
    doubleLineOps: (x1, y1, x2, y2): Op[] => {
      calls.push(['doubleLineOps', x1, y1, x2, y2]);
      return [];
    },
  };
  return { helper, calls };
}

const options = (extra: Partial<ResolvedOptions> = {}): ResolvedOptions =>
  ({
    maxRandomnessOffset: 2,
    roughness: 1,
    bowing: 1,
    stroke: '#000',
    strokeWidth: 1,
    curveTightness: 0,
    curveFitting: 0.95,
    curveStepCount: 9,
    fillStyle: 'hachure',
    fillWeight: -1,
    hachureAngle: -41,
    hachureGap: -1,
    dashOffset: -1,
    dashGap: -1,
    zigzagOffset: -1,
    seed: 5,
    disableMultiStroke: false,
    disableMultiStrokeFill: false,
    preserveVertices: false,
    fillShapeRoughnessGain: 0.8,
    ...extra,
  }) as ResolvedOptions;

const SQUARE: Point[][] = [
  [
    [0, 0],
    [100, 0],
    [100, 100],
    [0, 100],
  ],
];

describe('getFiller', () => {
  test.each(FILL_STYLES)('resolves %s to a filler', (fillStyle) => {
    const { helper } = stubHelper();
    expect(getFiller(options({ fillStyle }), helper)).toBeDefined();
  });

  test('falls back to hachure for an unknown style', () => {
    const { helper } = stubHelper();
    const unknown = getFiller(options({ fillStyle: 'not-a-style' as never }), helper);
    const hachure = getFiller(options({ fillStyle: 'hachure' }), helper);
    expect(unknown.constructor.name).toBe(hachure.constructor.name);
  });

  test('CURRENT BEHAVIOUR: instances are cached in a module-level singleton', () => {
    // filler.ts:10 keeps `const fillers = {}` at module scope, so every
    // RoughGenerator in the process shares one filler instance and the helper
    // captured by whichever generator constructed it first wins permanently.
    // Replacing the cache with per-call construction flips this assertion.
    const a = stubHelper();
    const b = stubHelper();
    expect(getFiller(options({ fillStyle: 'zigzag' }), a.helper)).toBe(
      getFiller(options({ fillStyle: 'zigzag' }), b.helper),
    );
  });
});

describe('DotFiller', () => {
  test('draws via helper.ellipse', () => {
    const { helper, calls } = stubHelper();
    const o = options({ fillStyle: 'dots' });
    new DotFiller(helper).fillPolygons(SQUARE, o);
    expect(calls.filter((c) => c[0] === 'ellipse').length).toBeGreaterThan(0);
  });

  test('never reaches for Math.random when a randomizer is present', () => {
    // dot-filler.ts used to jitter each dot with raw Math.random(), which is why
    // fillStyle 'dots' was irreproducible even under an explicit seed.
    //
    // The randomizer must be attached explicitly here: in normal use renderer.ts
    // does that lazily, but these tests drive the filler directly, and
    // scan-line-hachure.ts still falls back to Math.random when none is set.
    const { helper } = stubHelper();
    const o = options({ fillStyle: 'dots' });
    o.randomizer = new Random(12345);

    const spy = vi.spyOn(Math, 'random');
    spy.mockClear();

    new DotFiller(helper).fillPolygons(SQUARE, o);

    expect(spy).not.toHaveBeenCalled();
  });

  test('jitters through the injected randomizer', () => {
    const { helper, calls } = stubHelper();
    new DotFiller(helper).fillPolygons(SQUARE, options({ fillStyle: 'dots' }));

    const jitter = calls.filter((c) => c[0] === 'randOffsetWithRange');
    expect(jitter.length).toBeGreaterThan(0);
    // two draws per dot, one per axis
    expect(jitter.length).toBe(calls.filter((c) => c[0] === 'ellipse').length * 2);
  });

  test('dot jitter now scales with roughness', () => {
    // A consequence of routing through randOffsetWithRange, which applies
    // o.roughness (renderer.ts:314). The raw Math.random() version ignored
    // roughness entirely, so dots were the only fill style that did not respond
    // to it. Identical at the default roughness of 1.
    //
    // The stub reproduces renderer.ts's _offset formula with a fixed draw of
    // 0.75, isolating the roughness factor.
    const jitterFor = (roughness: number): number[] => {
      const { helper } = stubHelper();
      const seen: number[] = [];
      const o = options({ fillStyle: 'dots', roughness });
      o.randomizer = new Random(12345);

      new DotFiller({
        ...helper,
        randOffsetWithRange: (min, max, opts) => {
          const v = opts.roughness * (0.75 * (max - min) + min);
          seen.push(v);
          return v;
        },
      }).fillPolygons(SQUARE, o);
      return seen;
    };

    const atZero = jitterFor(0);
    const atTwo = jitterFor(2);

    expect(atZero.length).toBeGreaterThan(0);
    expect(atZero.every((v) => v === 0)).toBe(true);
    expect(atTwo.some((v) => v !== 0)).toBe(true);
  });
});

describe('HatchFiller', () => {
  test('runs two passes, the second rotated 90 degrees', () => {
    const { helper, calls } = stubHelper();
    const o = options({ fillStyle: 'cross-hatch', hachureAngle: 0, hachureGap: 20 });
    new HatchFiller(helper).fillPolygons(SQUARE, o);

    const lines = calls.filter((c) => c[0] === 'doubleLineOps');
    const horizontal = lines.filter((c) => c[2] === c[4]); // y1 === y2
    const vertical = lines.filter((c) => c[1] === c[3]); // x1 === x2

    expect(horizontal.length).toBeGreaterThan(0);
    expect(vertical.length).toBeGreaterThan(0);
  });
});

describe('ZigZagLineFiller', () => {
  test('emits line segments along each hachure line', () => {
    const { helper, calls } = stubHelper();
    const o = options({ fillStyle: 'zigzag-line', hachureGap: 20, zigzagOffset: 5 });
    new ZigZagLineFiller(helper).fillPolygons(SQUARE, o);

    expect(calls.filter((c) => c[0] === 'doubleLineOps').length).toBeGreaterThan(0);
  });
});

describe('DashedFiller', () => {
  test('breaks each hachure line into multiple dashes', () => {
    const { helper, calls } = stubHelper();
    const o = options({ fillStyle: 'dashed', hachureGap: 20, dashOffset: 6, dashGap: 4 });
    new DashedFiller(helper).fillPolygons(SQUARE, o);

    expect(calls.filter((c) => c[0] === 'doubleLineOps').length).toBeGreaterThan(4);
  });
});
