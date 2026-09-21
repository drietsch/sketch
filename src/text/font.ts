/** A glyph as strokes: flat [x0, y0, x1, y1, ...] polylines in font units, baseline at y = 0, y down. */
export type StrokeGlyph = [advance: number, strokes: number[][]];
/** A glyph as a filled outline: SVG path data in font units, baseline at y = 0, y down. */
export type OutlineGlyph = [advance: number, d: string];

export interface StrokeFontData {
  name: string;
  unitsPerEm: number;
  /** Highest point above the baseline any glyph reaches, in font units. */
  ascent: number;
  /** Lowest point below the baseline any glyph reaches, in font units. */
  descent: number;
  capHeight: number;
  /**
   * `stroke` (default): polylines, drawn as sketched strokes. `outline`:
   * filled paths, drawn as they are (a handwriting font brings its own look).
   */
  kind?: 'stroke' | 'outline';
  /** Every character is folded to upper case before lookup and measurement. */
  uppercase?: boolean;
  /** Line height as a multiple of the font size. Defaults to 1.4. */
  lineHeight?: number;
  /**
   * Width of the pen the strokes were written with, in font units. A stroke
   * font reduced from outlines carries the width those outlines had; without
   * one the renderer picks a pen from the font size.
   */
  penWidth?: number;
  /**
   * How many times a written stroke of this face is gone over at a plain
   * weight. A face whose drawn letters carry a doubled line writes its stroke
   * glyphs twice, so they sit in the same hand. Default 1.
   */
  penPasses?: number;
  glyphs: Record<string, StrokeGlyph | OutlineGlyph>;
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

  /** Whether glyphs are filled outlines rather than sketched strokes. */
  get outline(): boolean {
    return this.data.kind === 'outline';
  }

  /** The pen the strokes are written with at this size, or undefined for a font that names none. */
  penWidth(fontSize: number): number | undefined {
    return this.data.penWidth === undefined ? undefined : this.data.penWidth * this.scale(fontSize);
  }

  /** The character a glyph is looked up under: the capital, for an upper-case font. */
  fold(ch: string): string {
    if (!this.data.uppercase) return ch;
    const up = ch.toUpperCase();
    return [...up].length === 1 ? up : ch;
  }

  glyph(ch: string): StrokeGlyph | OutlineGlyph | undefined {
    return this.data.glyphs[this.fold(ch)];
  }

  /** Advance width of one character in px. */
  advance(ch: string, fontSize: number): number {
    const glyph = this.data.glyphs[this.fold(ch)];
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
    return (this.data.lineHeight ?? LINE_HEIGHT) * fontSize;
  }
}
