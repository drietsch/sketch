import type { NodeBase, Theme, TypeStyle } from '../core/types.js';
import type { StrokeFont } from '../text/font.js';
import type { Part, PartStyle } from './types.js';
import { haloOf, markerOf, resolvePartStyle } from './style.js';

export type TextPart = Extract<Part, { kind: 'text' }>;

/** The plain letterform; heavier weights go round it again with a broader pen. */
export const REGULAR_WEIGHT = 400;
/** What a component's own heading is written with, unless the node's style says otherwise. */
export const TITLE_WEIGHT = 600;
export type RectPart = Extract<Part, { kind: 'rect' }>;

/** Top y for a single-line text part so that its cap height is centred in a box of `height`. */
export function centredTextTop(font: StrokeFont, fontSize: number, height: number): number {
  return height / 2 + font.capHeight(fontSize) / 2 - font.ascent(fontSize);
}

/** A sketched text part. The node supplies its `sketch` roughness; everything else is explicit. */
export function textPart(
  key: string,
  theme: Theme,
  node: NodeBase,
  opts: {
    x: number;
    y: number;
    text: string;
    fontSize: number;
    color: string;
    align?: TextPart['align'];
    /** A component's own default weight; the node's `style.fontWeight` wins over it. */
    weight?: number;
    /** The face colour laid under the glyphs when they sit on a hatched fill. */
    halo?: string;
  },
): TextPart {
  const style = (node as { style?: TypeStyle }).style;
  const weight = style?.fontWeight ?? opts.weight ?? REGULAR_WEIGHT;
  return {
    key,
    kind: 'text',
    x: opts.x,
    y: opts.y,
    text: opts.text,
    fontSize: opts.fontSize,
    align: opts.align ?? 'LEFT',
    color: opts.color,
    weight,
    marker: markerOf(style, theme, weight),
    ...haloEntry((node as { style?: TypeStyle }).style, theme, opts.halo),
    style: resolvePartStyle(theme, node, { roughness: node.sketch?.roughness ?? theme.textRoughness }),
  };
}

/** The node's own `style.halo` decides; without one, the component's default stands. */
function haloEntry(style: TypeStyle | undefined, theme: Theme, fallback: string | undefined): { halo?: string } {
  const halo = style?.halo !== undefined ? haloOf(style, theme) : fallback;
  return halo === undefined ? {} : { halo };
}

/** A sketched box part styled from the node's fills/strokes, with component overrides applied last. */
export function rectPart(
  key: string,
  theme: Theme,
  node: NodeBase | undefined,
  opts: { x: number; y: number; width: number; height: number; cornerRadius?: number; overrides?: Partial<PartStyle> },
): RectPart {
  return {
    key,
    kind: 'rect',
    x: opts.x,
    y: opts.y,
    width: opts.width,
    height: opts.height,
    cornerRadius: opts.cornerRadius,
    style: resolvePartStyle(theme, node, opts.overrides),
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
