import { describe, expect, test } from 'vitest';
import { applyOps, opsDone, planTyping } from '../../../src/timeline/typing.js';
import { Random } from '../../../src/sketch/index.js';

describe('planTyping', () => {
  test('one op per character, monotonic times, human-scale delays', () => {
    const plan = planTyping('email', '', 'hello world.', new Random(9), true);
    expect(plan.ops).toHaveLength(12);
    expect(plan.opEnds).toHaveLength(12);
    expect(plan.opEnds[0]).toBeGreaterThanOrEqual(120);
    expect(plan.opEnds[0]).toBeLessThanOrEqual(180);
    for (let i = 1; i < plan.opEnds.length; i++) {
      const gap = plan.opEnds[i] - plan.opEnds[i - 1];
      expect(gap).toBeGreaterThanOrEqual(60);
      expect(gap).toBeLessThanOrEqual(140 * 2.2 + 1);
    }
    // The key after the space is slower than a typical key.
    const afterSpace = plan.opEnds[6] - plan.opEnds[5];
    expect(afterSpace).toBeGreaterThanOrEqual(60 * 1.6);
  });

  test('backspace becomes a delete op', () => {
    const plan = planTyping('e', 'ab', 'c\bd', new Random(1), false);
    expect(plan.ops).toEqual(['c', { del: true }, 'd']);
    expect(applyOps(plan.base, plan.ops, 1)).toBe('abc');
    expect(applyOps(plan.base, plan.ops, 2)).toBe('ab');
    expect(applyOps(plan.base, plan.ops, 3)).toBe('abd');
    expect(applyOps(plan.base, plan.ops, 99)).toBe('abd');
  });

  test('a total duration rescales the cadence', () => {
    const plan = planTyping('e', '', 'abcdef', new Random(2), true, 3000);
    expect(plan.opEnds.at(-1)).toBe(3000);
    expect(plan.opEnds[0]).toBeGreaterThan(0);
  });

  test('empty text yields no ops', () => {
    expect(planTyping('e', 'x', '', new Random(2), true)).toMatchObject({ ops: [], opEnds: [], base: 'x' });
  });

  test('opsDone counts ops whose end has passed', () => {
    const ends = [100, 200, 300];
    expect(opsDone(ends, 0)).toBe(0);
    expect(opsDone(ends, 99)).toBe(0);
    expect(opsDone(ends, 100)).toBe(1);
    expect(opsDone(ends, 250)).toBe(2);
    expect(opsDone(ends, 1000)).toBe(3);
    expect(opsDone([], 5)).toBe(0);
  });
});
