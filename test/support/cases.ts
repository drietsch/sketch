import type { Options } from '../../src/sketch/core.js';
import type { Point } from '../../src/sketch/geometry.js';
import type { RoughGenerator } from '../../src/sketch/generator.js';

export const FILL_STYLES = ['hachure', 'solid', 'zigzag', 'cross-hatch', 'dots', 'dashed', 'zigzag-line'] as const;

const POLY: Point[] = [
  [20, 20],
  [180, 30],
  [170, 140],
  [60, 160],
  [30, 90],
];
const C1: Point[] = [
  [10, 10],
  [200, 10],
  [100, 100],
  [100, 50],
  [300, 100],
  [60, 200],
];
const C2: Point[] = [
  [20, 180],
  [90, 120],
  [160, 190],
];
const ARC_PATH = 'M80 80 A 45 45, 0, 0, 0, 125 125 L 125 80 Z';
const MULTI_PATH = 'M37 17v15H14V17H37zM50 0H0v50h50V0z M20 20 L 30 40 L 10 40 Z';

export interface ShapeCase {
  readonly shape: string;
  readonly run: (g: RoughGenerator, o: Options) => ReturnType<RoughGenerator['line']>;
}

/**
 * Chosen to cross branch boundaries in renderer.ts, not just to cover the nine
 * public shape methods. The comments name the branch each case exists for.
 */
export const SHAPES: readonly ShapeCase[] = [
  { shape: 'line', run: (g, o) => g.line(10, 10, 190, 90, o) },
  { shape: 'line-long', run: (g, o) => g.line(0, 0, 640, 480, o) }, // > 500 roughnessGain band
  { shape: 'line-mid', run: (g, o) => g.line(0, 0, 300, 0, o) }, // 200..500 interpolated band
  { shape: 'rectangle', run: (g, o) => g.rectangle(10, 10, 180, 120, o) },
  { shape: 'rect-tiny', run: (g, o) => g.rectangle(5, 5, 3, 3, o) }, // offset^2*100 > lengthSq
  { shape: 'ellipse', run: (g, o) => g.ellipse(100, 100, 160, 90, o) },
  { shape: 'ellipse-big', run: (g, o) => g.ellipse(400, 400, 700, 700, o) }, // stepCount > curveStepCount
  { shape: 'circle', run: (g, o) => g.circle(100, 100, 120, o) },
  { shape: 'linearPath', run: (g, o) => g.linearPath(POLY, o) },
  { shape: 'linearPath-2pt', run: (g, o) => g.linearPath([POLY[0], POLY[1]], o) }, // len === 2
  { shape: 'polygon', run: (g, o) => g.polygon(POLY, o) },
  { shape: 'arc-open', run: (g, o) => g.arc(100, 100, 160, 120, Math.PI, Math.PI * 1.6, false, o) },
  { shape: 'arc-closed', run: (g, o) => g.arc(100, 100, 160, 120, Math.PI, Math.PI * 1.6, true, o) },
  { shape: 'arc-negative', run: (g, o) => g.arc(100, 100, 160, 120, -1, 1, true, o) }, // while (strt < 0)
  { shape: 'arc-overfull', run: (g, o) => g.arc(100, 100, 160, 120, 0, Math.PI * 3, true, o) }, // > 2pi clamp
  { shape: 'curve', run: (g, o) => g.curve(C1, o) },
  { shape: 'curve-3pt', run: (g, o) => g.curve(C2, o) }, // len === 3
  { shape: 'curve-multi', run: (g, o) => g.curve([C1, C2], o) }, // Point[][] arm
  { shape: 'path', run: (g, o) => g.path(ARC_PATH, o) },
  { shape: 'path-multi', run: (g, o) => g.path(MULTI_PATH, o) }, // sets.length > 1 solid fill
  { shape: 'path-empty', run: (g, o) => g.path('', o) },
];

function withFill(extra: Options = {}): { name: string; options: Options }[] {
  return FILL_STYLES.map((fillStyle) => ({
    name: `fill-${fillStyle}`,
    options: { fill: '#e74c3c', fillStyle, ...extra },
  }));
}

function suffix(cases: { name: string; options: Options }[], s: string) {
  return cases.map((c) => ({ name: `${c.name}-${s}`, options: c.options }));
}

export const OPTION_CASES: readonly { name: string; options: Options }[] = [
  { name: 'stroke-only', options: {} },
  { name: 'roughness-0', options: { roughness: 0 } }, // coreOnly / disableMultiStroke
  { name: 'roughness-2.8', options: { roughness: 2.8 } },
  { name: 'bowing-6', options: { bowing: 6 } },
  { name: 'maxRandomnessOffset-8', options: { maxRandomnessOffset: 8 } },
  { name: 'strokeWidth-5', options: { strokeWidth: 5 } },
  { name: 'disableMultiStroke', options: { disableMultiStroke: true } },
  { name: 'preserveVertices', options: { preserveVertices: true } },
  { name: 'curveStepCount-4', options: { curveStepCount: 4 } },
  { name: 'curveFitting-1', options: { curveFitting: 1 } },
  { name: 'curveTightness-0.7', options: { curveTightness: 0.7 } },
  { name: 'fixedDecimals-2', options: { fixedDecimalPlaceDigits: 2 } },
  { name: 'stroke-none-fill', options: { stroke: 'none', fill: '#39f' } },
  { name: 'simplification-0.3', options: { simplification: 0.3 } },
  {
    name: 'fillShapeRoughnessGain-0',
    options: { fill: '#39f', fillStyle: 'solid', fillShapeRoughnessGain: 0 },
  },
  ...withFill(),
  ...suffix(withFill({ hachureAngle: 0, hachureGap: 12 }), 'ang0-gap12'),
  ...suffix(withFill({ hachureAngle: 90, fillWeight: 4 }), 'ang90-w4'),
  ...suffix(withFill({ disableMultiStrokeFill: true }), 'single'),
  {
    name: 'fill-dashed-tuned',
    options: { fill: '#e74c3c', fillStyle: 'dashed', dashOffset: 6, dashGap: 3 },
  },
  {
    name: 'fill-zigzagline-tuned',
    options: { fill: '#e74c3c', fillStyle: 'zigzag-line', zigzagOffset: 7 },
  },
];
