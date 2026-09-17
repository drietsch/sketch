import { describe, expect, test } from 'vitest';
import { RoughGenerator } from '../../../src/sketch/generator.js';

describe('generator.toPaths', () => {
  /**
   * toPaths() used to call opsToPath(drawing) with no precision argument, so
   * PathInfo.d ignored an option the rendered output honoured. The library's
   * SVG output is built from toPaths(), so this is the one place precision
   * must hold.
   */
  test('honours fixedDecimalPlaceDigits', () => {
    const g = new RoughGenerator();
    const drawable = g.rectangle(10, 10, 80, 60, { seed: 11, fixedDecimalPlaceDigits: 1 });

    const numbers = g
      .toPaths(drawable)
      .flatMap((p) => p.d.match(/-?\d+(\.\d+)?/g) ?? [])
      .map(Number);

    expect(numbers.length).toBeGreaterThan(0);
    for (const n of numbers) expect(n).toBe(+n.toFixed(1));
  });

  test('stroke: none drops the outline set entirely', () => {
    const drawable = new RoughGenerator().rectangle(10, 10, 80, 60, { seed: 11, stroke: 'none' });
    expect(drawable.sets).toHaveLength(0);
  });

  test('stroke: none with a fill still emits the fill sketch', () => {
    const drawable = new RoughGenerator().rectangle(10, 10, 80, 60, { seed: 11, stroke: 'none', fill: 'red' });
    expect(drawable.sets.map((s) => s.type)).toEqual(['fillSketch']);
  });
});

describe('generator.roundedRectangle', () => {
  test('sketches the outline as four lines and four corner curves', () => {
    const g = new RoughGenerator();
    const d = g.roundedRectangle(0, 0, 100, 50, 8, { seed: 5, disableMultiStroke: true });
    expect(d.shape).toBe('roundedRectangle');
    const ops = d.sets[0].ops;
    expect(ops[0].op).toBe('move');
    // The engine starts every segment with its own move, so a closed outline
    // of 8 segments plus the closing line yields 9 moves and 9 curves (the
    // engine draws straight runs as slightly bowed cubics too).
    expect(ops.filter((o) => o.op === 'move')).toHaveLength(9);
    expect(ops.filter((o) => o.op === 'bcurveTo')).toHaveLength(9);
  });

  test('radius 0 falls back to the plain rectangle', () => {
    const g = new RoughGenerator();
    expect(g.roundedRectangle(0, 0, 100, 50, 0, { seed: 5 })).toEqual(g.rectangle(0, 0, 100, 50, { seed: 5 }));
  });

  test('clamps the radius to half the shorter side', () => {
    const g = new RoughGenerator();
    const a = g.roundedRectangle(0, 0, 100, 40, 20, { seed: 5 });
    const b = g.roundedRectangle(0, 0, 100, 40, 500, { seed: 5 });
    expect(a).toEqual(b);
  });

  test('respects fill', () => {
    const g = new RoughGenerator();
    const d = g.roundedRectangle(0, 0, 100, 50, 8, { seed: 5, fill: 'red', fillStyle: 'solid' });
    expect(d.sets.map((s) => s.type)).toEqual(['fillPath', 'path']);
  });
});
