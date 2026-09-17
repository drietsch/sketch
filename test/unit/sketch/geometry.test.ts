import { describe, expect, test } from 'vitest';
import { lineLength } from '../../../src/sketch/geometry.js';
import type { Line } from '../../../src/sketch/geometry.js';

describe('lineLength', () => {
  test.each([
    [
      'horizontal',
      [
        [0, 0],
        [10, 0],
      ] as Line,
      10,
    ],
    [
      'vertical',
      [
        [0, 0],
        [0, 7],
      ] as Line,
      7,
    ],
    [
      '3-4-5 triangle',
      [
        [0, 0],
        [3, 4],
      ] as Line,
      5,
    ],
    [
      'zero length',
      [
        [5, 5],
        [5, 5],
      ] as Line,
      0,
    ],
    [
      'negative coordinates',
      [
        [-3, -4],
        [0, 0],
      ] as Line,
      5,
    ],
    [
      'direction independent',
      [
        [3, 4],
        [0, 0],
      ] as Line,
      5,
    ],
  ])('%s', (_name, line, expected) => {
    expect(lineLength(line)).toBeCloseTo(expected, 10);
  });
});
