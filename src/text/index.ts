import { StrokeFont } from './font.js';
import { HERSHEY_SANS } from './fonts/hershey-sans.js';

export { StrokeFont } from './font.js';
export type { StrokeFontData, StrokeGlyph } from './font.js';
export { layoutText } from './layout.js';
export type { PlacedGlyph, TextAlign, TextLayout } from './layout.js';

export const DEFAULT_FONT = new StrokeFont(HERSHEY_SANS);
