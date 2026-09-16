import { describe, expect, test } from 'vitest';
import { RoughCanvas } from '../../src/canvas.js';
import { RoughSVG } from '../../src/svg.js';
import { RoughGenerator } from '../../src/generator.js';
import { SVGNS } from '../../src/core.js';
import { canvasFillRule, recordingCanvas } from '../support/recording-context.js';
import type { Drawable } from '../../src/core.js';

/**
 * Acceptance test for the backend fill-rule divergence.
 *
 * canvas.ts:39 applies 'evenodd' for 'curve' | 'polygon' | 'path'.
 * svg.ts:43 applies it for 'curve' | 'polygon' only -- 'path' is missing.
 * So the same Drawable renders differently depending on the backend.
 *
 * 'path' is marked test.fails to pin the defect. Extracting a shared
 * fillRuleFor() used by both backends flips it to a normal assertion.
 */
const FILL = { fill: '#e74c3c', fillStyle: 'solid', seed: 99 } as const;

const SHAPES: Record<string, (g: RoughGenerator) => Drawable> = {
  rectangle: (g) => g.rectangle(10, 10, 80, 60, FILL),
  ellipse: (g) => g.ellipse(50, 50, 80, 60, FILL),
  circle: (g) => g.circle(50, 50, 60, FILL),
  linearPath: (g) =>
    g.linearPath(
      [
        [10, 10],
        [80, 20],
        [50, 70],
      ],
      FILL,
    ),
  polygon: (g) =>
    g.polygon(
      [
        [10, 10],
        [80, 20],
        [50, 70],
      ],
      FILL,
    ),
  arc: (g) => g.arc(50, 50, 80, 60, Math.PI, Math.PI * 1.7, true, FILL),
  curve: (g) =>
    g.curve(
      [
        [10, 10],
        [80, 20],
        [50, 70],
        [20, 40],
      ],
      FILL,
    ),
  path: (g) => g.path('M10 10 L80 20 L50 70 Z', FILL),
};

function svgFillRule(drawable: Drawable): string {
  const svg = document.createElementNS(SVGNS, 'svg');
  const group = new RoughSVG(svg).draw(drawable);
  const filled = [...group.children].find((el) => (el.getAttribute('fill') ?? 'none') !== 'none');
  return filled?.getAttribute('fill-rule') ?? 'nonzero';
}

describe.each(Object.keys(SHAPES))('%s', (shape) => {
  const known = shape === 'path' ? test.fails : test;

  known('canvas and svg agree on the fill rule', () => {
    const drawable = SHAPES[shape](new RoughGenerator());

    const { canvas, calls } = recordingCanvas();
    new RoughCanvas(canvas).draw(drawable);

    expect(canvasFillRule(calls)).toBe(svgFillRule(drawable));
  });
});
