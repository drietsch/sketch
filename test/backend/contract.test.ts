import { describe, expect, test } from 'vitest';
import { RoughCanvas } from '../../src/canvas.js';
import { RoughSVG } from '../../src/svg.js';
import { RoughGenerator } from '../../src/generator.js';
import { SVGNS } from '../../src/core.js';
import { recordingCanvas } from '../support/recording-context.js';

describe('canvas op dispatch', () => {
  test('emits one context call per op, with the right arity', () => {
    const drawable = new RoughGenerator().rectangle(10, 10, 80, 60, { seed: 11 });
    const { canvas, calls } = recordingCanvas();
    new RoughCanvas(canvas).draw(drawable);

    const ops = drawable.sets.flatMap((s) => s.ops);
    const drawCalls = calls.filter((c) => ['moveTo', 'lineTo', 'bezierCurveTo'].includes(c[0]));

    expect(drawCalls).toHaveLength(ops.length);
    for (const [name, ...args] of drawCalls) {
      expect(args).toHaveLength(name === 'bezierCurveTo' ? 6 : 2);
      expect(args.every((a) => typeof a === 'number' && Number.isFinite(a))).toBe(true);
    }
  });

  test('save/restore stay balanced', () => {
    const drawable = new RoughGenerator().rectangle(10, 10, 80, 60, {
      seed: 11,
      fill: 'red',
      fillStyle: 'solid',
    });
    const { canvas, calls } = recordingCanvas();
    new RoughCanvas(canvas).draw(drawable);

    const saves = calls.filter((c) => c[0] === 'save').length;
    const restores = calls.filter((c) => c[0] === 'restore').length;
    expect(saves).toBe(restores);
    expect(saves).toBeGreaterThan(0);
  });

  test('honours fixedDecimalPlaceDigits', () => {
    const drawable = new RoughGenerator().rectangle(10, 10, 80, 60, {
      seed: 11,
      fixedDecimalPlaceDigits: 1,
    });
    const { canvas, calls } = recordingCanvas();
    new RoughCanvas(canvas).draw(drawable);

    const coords = calls
      .filter((c) => ['moveTo', 'lineTo', 'bezierCurveTo'].includes(c[0]))
      .flatMap((c) => c.slice(1) as number[]);

    expect(coords.length).toBeGreaterThan(0);
    for (const n of coords) expect(n).toBe(+n.toFixed(1));
  });

  test('stroke: none emits no drawing calls at all', () => {
    // The generator drops the 'path' OpSet entirely when stroke is 'none', so
    // canvas.ts:24's `o.stroke === 'none' ? 'transparent'` branch is unreachable
    // through the generator -- it only applies to a hand-built Drawable.
    const drawable = new RoughGenerator().rectangle(10, 10, 80, 60, { seed: 11, stroke: 'none' });
    expect(drawable.sets).toHaveLength(0);

    const { canvas, calls } = recordingCanvas();
    new RoughCanvas(canvas).draw(drawable);
    expect(calls).toHaveLength(0);
  });

  test('stroke: none with a fill still emits the fill sketch', () => {
    const drawable = new RoughGenerator().rectangle(10, 10, 80, 60, {
      seed: 11,
      stroke: 'none',
      fill: 'red',
    });
    expect(drawable.sets.map((s) => s.type)).toEqual(['fillSketch']);

    const { canvas, calls } = recordingCanvas();
    new RoughCanvas(canvas).draw(drawable);
    expect(calls.some((c) => c[0] === 'stroke')).toBe(true);
  });
});

describe('generator.toPaths', () => {
  /**
   * Acceptance test for bug 4: generator.ts:262,270,293 all call
   * this.opsToPath(drawing) with no precision argument, while svg.ts:66 and
   * canvas.ts:65 both forward o.fixedDecimalPlaceDigits. So toPaths() silently
   * ignores the option. Forwarding it flips this to a normal assertion.
   */
  test.fails('honours fixedDecimalPlaceDigits', () => {
    const g = new RoughGenerator();
    const drawable = g.rectangle(10, 10, 80, 60, { seed: 11, fixedDecimalPlaceDigits: 1 });

    const numbers = g
      .toPaths(drawable)
      .flatMap((p) => p.d.match(/-?\d+(\.\d+)?/g) ?? [])
      .map(Number);

    expect(numbers.length).toBeGreaterThan(0);
    for (const n of numbers) expect(n).toBe(+n.toFixed(1));
  });
});

describe('svg backend', () => {
  test('returns a detached g element containing path children', () => {
    const svg = document.createElementNS(SVGNS, 'svg');
    const group = new RoughSVG(svg).draw(new RoughGenerator().rectangle(10, 10, 80, 60, { seed: 11, fill: 'red' }));

    expect(group.tagName).toBe('g');
    expect(group.parentNode).toBeNull();
    expect(group.children.length).toBeGreaterThan(0);
    for (const child of group.children) expect(child.tagName).toBe('path');
  });

  test('stroke: none produces an empty group', () => {
    const svg = document.createElementNS(SVGNS, 'svg');
    const group = new RoughSVG(svg).draw(new RoughGenerator().rectangle(10, 10, 80, 60, { seed: 11, stroke: 'none' }));

    expect(group.tagName).toBe('g');
    expect(group.children).toHaveLength(0);
  });
});
