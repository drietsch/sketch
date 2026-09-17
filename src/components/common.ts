import type { Style, Theme } from '../core/types.js';
import type { StrokeFont } from '../text/font.js';
import type { Part, PartStyle } from './types.js';
import { resolvePartStyle } from './style.js';

export type TextPart = Extract<Part, { kind: 'text' }>;
export type RectPart = Extract<Part, { kind: 'rect' }>;

/** Top y for a single-line text part so that its cap height is centred in a box of `height`. */
export function centredTextTop(font: StrokeFont, fontSize: number, height: number): number {
  return height / 2 + font.capHeight(fontSize) / 2 - font.ascent(fontSize);
}

export function textPart(
  key: string,
  theme: Theme,
  font: StrokeFont,
  opts: {
    x: number;
    y: number;
    text: string;
    fontSize: number;
    color: string;
    align?: TextPart['align'];
    style?: Style;
  },
): TextPart {
  void font;
  return {
    key,
    kind: 'text',
    x: opts.x,
    y: opts.y,
    text: opts.text,
    fontSize: opts.fontSize,
    align: opts.align ?? 'start',
    color: opts.color,
    style: resolvePartStyle(theme, opts.style, { roughness: opts.style?.roughness ?? theme.textRoughness }),
  };
}

export function rectPart(
  key: string,
  theme: Theme,
  opts: {
    x: number;
    y: number;
    width: number;
    height: number;
    radius?: number;
    style?: Style;
    overrides?: Partial<PartStyle>;
  },
): RectPart {
  return {
    key,
    kind: 'rect',
    x: opts.x,
    y: opts.y,
    width: opts.width,
    height: opts.height,
    radius: opts.radius,
    style: resolvePartStyle(theme, opts.style, opts.overrides),
  };
}

/** Shifts every geometric part by (dx, dy); used for the pressed look. */
export function offsetParts(parts: Part[], dx: number, dy: number): Part[] {
  return parts.map((p) => {
    switch (p.kind) {
      case 'rect':
      case 'ellipse':
      case 'text':
      case 'icon':
        return { ...p, x: p.x + dx, y: p.y + dy };
      case 'line':
        return { ...p, x1: p.x1 + dx, y1: p.y1 + dy, x2: p.x2 + dx, y2: p.y2 + dy };
      default:
        return p;
    }
  });
}
