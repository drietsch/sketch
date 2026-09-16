// Public entry point.
//
// v4 exported a single default object literal and nothing else, which meant
// RoughCanvas, RoughSVG, RoughGenerator and every type were unreachable without
// deep-importing internal paths. It also defeated tree-shaking: the default
// object statically references all three classes, so an SVG-only consumer still
// paid for the canvas backend.

export { RoughGenerator } from './generator.js';
export { RoughCanvas } from './canvas.js';
export { RoughSVG } from './svg.js';
export { Random, randomSeed, randomSeed as newSeed } from './math.js';
export { SVGNS } from './core.js';

export type { FillStyle, Options, ResolvedOptions, Drawable, OpSet, OpSetType, Op, OpType, PathInfo } from './core.js';
export type { Point, Line } from './geometry.js';
export type { PatternFiller, RenderHelper } from './fillers/filler-interface.js';
