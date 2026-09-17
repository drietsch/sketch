import { describe, expect, test } from 'vitest';
import { cursorAt, ease, fittsDuration, planCursorPath, samplePath } from '../../../src/timeline/cursor-path.js';
import { Random } from '../../../src/sketch/index.js';

const from = { x: 100, y: 100 };
const to = { x: 500, y: 300 };

describe('fittsDuration', () => {
  test('grows with distance, shrinks with target size, and is clamped', () => {
    expect(fittsDuration(400, 40)).toBeGreaterThan(fittsDuration(50, 40));
    expect(fittsDuration(400, 40)).toBeGreaterThan(fittsDuration(400, 100));
    expect(fittsDuration(1, 200)).toBe(180);
    expect(fittsDuration(1e9, 8)).toBe(1400);
    expect(fittsDuration(400, 40)).toBeCloseTo(120 + 130 * Math.log2(11), 6);
  });

  test('ease is monotonic from 0 to 1', () => {
    let prev = -1;
    for (let u = 0; u <= 1; u += 0.05) {
      const e = ease(u);
      expect(e).toBeGreaterThanOrEqual(prev);
      prev = e;
    }
    expect(ease(0)).toBe(0);
    expect(ease(1)).toBe(1);
  });
});

describe('planCursorPath', () => {
  test('starts at from and ends exactly at to', () => {
    const path = planCursorPath(from, to, 40, new Random(7));
    expect(cursorAt(path, 0)).toEqual(from);
    expect(cursorAt(path, path.duration)).toBe(path.to);
    expect(cursorAt(path, path.duration + 1000)).toEqual(to);
    const samples = samplePath(path, 10);
    expect(samples[0]).toEqual(from);
    expect(samples[9]).toEqual(to);
  });

  test('is seeded: same seed same path, different seed different path', () => {
    const a = planCursorPath(from, to, 40, new Random(7));
    const b = planCursorPath(from, to, 40, new Random(7));
    const c = planCursorPath(from, to, 40, new Random(8));
    expect(a).toEqual(b);
    expect(a.c1).not.toEqual(c.c1);
  });

  test('bends off the straight line but stays near it', () => {
    const path = planCursorPath(from, to, 40, new Random(3));
    const mid = cursorAt(path, path.duration / 2);
    const chord = Math.hypot(to.x - from.x, to.y - from.y);
    const distanceFromLine =
      Math.abs((to.y - from.y) * mid.x - (to.x - from.x) * mid.y + to.x * from.y - to.y * from.x) / chord;
    expect(distanceFromLine).toBeGreaterThan(1);
    expect(distanceFromLine).toBeLessThan(120);
  });

  test('long moves may overshoot and settle; short ones never do', () => {
    let overshoots = 0;
    for (let seed = 1; seed < 40; seed++) {
      const path = planCursorPath(from, to, 40, new Random(seed));
      if (path.overshoot) {
        overshoots += 1;
        const near = cursorAt(path, path.duration * 0.9);
        expect(Math.hypot(near.x - to.x, near.y - to.y)).toBeLessThan(40);
      }
      expect(planCursorPath(from, { x: 150, y: 120 }, 40, new Random(seed)).overshoot).toBeUndefined();
    }
    expect(overshoots).toBeGreaterThan(5);
    expect(overshoots).toBeLessThan(39);
  });

  test('explicit duration is honoured; zero distance is instant', () => {
    expect(planCursorPath(from, to, 40, new Random(1), 250).duration).toBe(250);
    const still = planCursorPath(from, { x: 100.5, y: 100 }, 40, new Random(1));
    expect(still.duration).toBe(0);
    expect(cursorAt(still, 0)).toEqual({ x: 100.5, y: 100 });
  });

  test('samples move smoothly: no jump larger than a tenth of the chord', () => {
    const path = planCursorPath(from, to, 40, new Random(5));
    const samples = samplePath(path, 60);
    for (let i = 1; i < samples.length; i++) {
      const d = Math.hypot(samples[i].x - samples[i - 1].x, samples[i].y - samples[i - 1].y);
      expect(d).toBeLessThan(45);
    }
  });
});
