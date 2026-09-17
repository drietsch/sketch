import type { Bounds } from '../core/types.js';
import type { StrokeFont } from './font.js';

export type TextAlign = 'LEFT' | 'CENTER' | 'RIGHT';

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
 * line relative to x = 0, so a CENTER-aligned text is centred on the origin.
 */
export function layoutText(font: StrokeFont, text: string, fontSize: number, align: TextAlign = 'LEFT'): TextLayout {
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
    const start = align === 'CENTER' ? -width / 2 : align === 'RIGHT' ? -width : 0;
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

/**
 * Breaks text into lines no wider than `maxWidth`, at spaces, keeping explicit
 * newlines. A single word wider than the limit stays on its own line.
 */
export function wrapText(font: StrokeFont, text: string, fontSize: number, maxWidth: number): string {
  const out: string[] = [];
  for (const paragraph of text.split('\n')) {
    let line = '';
    for (const word of paragraph.split(' ')) {
      const candidate = line ? `${line} ${word}` : word;
      if (line && font.measure(candidate, fontSize) > maxWidth) {
        out.push(line);
        line = word;
      } else {
        line = candidate;
      }
    }
    out.push(line);
  }
  return out.join('\n');
}
