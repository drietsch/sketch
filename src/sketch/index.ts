// Internal barrel for the sketch-geometry engine, derived from roughjs.
//
// Nothing in here is part of the package's public API. The rest of the library
// imports from this file only, so the engine can be reshaped without touching
// callers, and the engine never reaches back into the library.

export { RoughGenerator } from './generator.js';
export { roundedRectPath, lineLength } from './geometry.js';
export { Random, randomSeed } from './math.js';
export { fillRuleFor } from './options.js';
export { SVGNS } from './core.js';

export type { FillStyle, Options, ResolvedOptions, Drawable, OpSet, OpSetType, Op, OpType, PathInfo } from './core.js';
export type { Point, Line } from './geometry.js';
