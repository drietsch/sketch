import type { Bounds } from '../core/types.js';
import type { StrokeFont } from './font.js';

export type TextAlign = 'start' | 'middle' | 'end';

export interface PlacedGlyph {
  ch: string;
  /** Index of the character within the whole text (newlines count). */
  index: number;
  x: number;
  /** Baseline y. */
  y: number;
}

export interface TextLayout {
  glyphs: PlacedGlyph[];
  bounds: Bounds;
  lineWidths: number[];
}

/**
 * Lays out text top-aligned at (0, 0): the first baseline sits one ascent
 * below the origin, later lines one line-height apart. `align` positions each
 * line relative to x = 0, so a middle-aligned text is centred on the origin.
 */
export function layoutText(font: StrokeFont, text: string, fontSize: number, align: TextAlign = 'start'): TextLayout {
  const lines = text.split('\n');
  const lineHeight = font.lineHeight(fontSize);
  const ascent = font.ascent(fontSize);
  const glyphs: PlacedGlyph[] = [];
  const lineWidths: number[] = [];
  let index = 0;
  let minX = 0;
  let maxX = 0;
  lines.forEach((line, row) => {
    const width = font.measure(line, fontSize);
    lineWidths.push(width);
    const start = align === 'middle' ? -width / 2 : align === 'end' ? -width : 0;
    minX = Math.min(minX, start);
    maxX = Math.max(maxX, start + width);
    const y = ascent + row * lineHeight;
    let x = start;
    for (const ch of line) {
      glyphs.push({ ch, index, x, y });
      x += font.advance(ch, fontSize);
      index += 1;
    }
    index += 1; // the newline
  });
  const height = (lines.length - 1) * lineHeight + ascent + font.descent(fontSize);
  return { glyphs, lineWidths, bounds: { x: minX, y: 0, width: maxX - minX, height } };
}
