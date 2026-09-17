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
