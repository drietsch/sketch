import { StrokeFont } from './font.js';
import { GRAPE_NUTS } from './fonts/grape-nuts.js';

export { StrokeFont } from './font.js';
export type { StrokeFontData, StrokeGlyph, OutlineGlyph } from './font.js';
export { layoutText, wrapText } from './layout.js';
export type { PlacedGlyph, TextAlign, TextLayout } from './layout.js';

/** Grape Nuts (SIL OFL), a handwriting font drawn in capitals: the one font the package ships. */
export const DEFAULT_FONT = new StrokeFont(GRAPE_NUTS);
/**
 * The font that ships with the package, by name, so a document saved with it
 * loads without help. A document naming any other font must be handed it:
 * `loadDemo(json, { font })`.
 */
export const BUILTIN_FONTS: ReadonlyMap<string, StrokeFont> = new Map([[DEFAULT_FONT.name, DEFAULT_FONT]]);
