import { StrokeFont } from './font.js';
import { HERSHEY_SANS } from './fonts/hershey-sans.js';
import { GRAPE_NUTS } from './fonts/grape-nuts.js';

export { StrokeFont } from './font.js';
export type { StrokeFontData, StrokeGlyph, OutlineGlyph } from './font.js';
export { layoutText, wrapText } from './layout.js';
export type { PlacedGlyph, TextAlign, TextLayout } from './layout.js';

/** Grape Nuts (SIL OFL), a handwriting font drawn in capitals: the default. */
export const DEFAULT_FONT = new StrokeFont(GRAPE_NUTS);
/** The Hershey sans, a single-stroke font drawn as sketched strokes; the default before 0.8.0. */
export const HERSHEY_FONT = new StrokeFont(HERSHEY_SANS);

/** The fonts that ship with the package, by name, so a document saved with either loads without help. */
export const BUILTIN_FONTS: ReadonlyMap<string, StrokeFont> = new Map([
  [DEFAULT_FONT.name, DEFAULT_FONT],
  [HERSHEY_FONT.name, HERSHEY_FONT],
]);
