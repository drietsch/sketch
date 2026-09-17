/** A glyph as strokes: flat [x0, y0, x1, y1, ...] polylines in font units, baseline at y = 0, y down. */
export type StrokeGlyph = [advance: number, strokes: number[][]];

export interface StrokeFontData {
  name: string;
  unitsPerEm: number;
  /** Highest point above the baseline any glyph reaches, in font units. */
  ascent: number;
  /** Lowest point below the baseline any glyph reaches, in font units. */
  descent: number;
  capHeight: number;
  glyphs: Record<string, StrokeGlyph>;
}

/** Advance (in em) for characters the font has no glyph for; they draw as a small box. */
const TOFU_ADVANCE = 0.6;
const LINE_HEIGHT = 1.4;

/**
 * A single-stroke font. All metrics come from the glyph data, so measurement
 * is exact and identical in every environment: no measureText, no layout
 * engine, no installed fonts involved.
 */
export class StrokeFont {
  constructor(readonly data: StrokeFontData) {}

  get name(): string {
    return this.data.name;
  }

  scale(fontSize: number): number {
    return fontSize / this.data.unitsPerEm;
  }

  glyph(ch: string): StrokeGlyph | undefined {
    return this.data.glyphs[ch];
  }

  /** Advance width of one character in px. */
  advance(ch: string, fontSize: number): number {
    const glyph = this.data.glyphs[ch];
    return glyph ? glyph[0] * this.scale(fontSize) : TOFU_ADVANCE * fontSize;
  }

  /** Width of a single line of text in px. */
  measure(text: string, fontSize: number, letterSpacing = 0): number {
    let width = 0;
    for (const ch of text) width += this.advance(ch, fontSize) + letterSpacing;
    return width;
  }

  /** X offset of the caret placed before character `index` (0 = start, text.length = end). */
  caretX(text: string, index: number, fontSize: number, letterSpacing = 0): number {
    return this.measure([...text].slice(0, Math.max(0, index)).join(''), fontSize, letterSpacing);
  }

  ascent(fontSize: number): number {
    return this.data.ascent * this.scale(fontSize);
  }

  descent(fontSize: number): number {
    return this.data.descent * this.scale(fontSize);
  }

  capHeight(fontSize: number): number {
    return this.data.capHeight * this.scale(fontSize);
  }

  lineHeight(fontSize: number): number {
    return LINE_HEIGHT * fontSize;
  }
}
