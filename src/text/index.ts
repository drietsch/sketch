import { StrokeFont } from './font.js';
import { HANDODLE } from './fonts/handodle.js';

export { StrokeFont } from './font.js';
export type { StrokeFontData, StrokeGlyph, OutlineGlyph } from './font.js';
export { layoutText, wrapText } from './layout.js';
export type { PlacedGlyph, TextAlign, TextLayout } from './layout.js';

/** Handodle, a scribbled marker handwriting face drawn in capitals: the one font the package ships. */
export const DEFAULT_FONT = new StrokeFont(HANDODLE);
/**
 * The font that ships with the package, by name, so a document saved with it
 * loads without help. A document naming any other font must be handed it:
 * `loadDemo(json, { font })`.
 */
export const BUILTIN_FONTS: ReadonlyMap<string, StrokeFont> = new Map([[DEFAULT_FONT.name, DEFAULT_FONT]]);
