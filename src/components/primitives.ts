import { pointsOnPath } from 'points-on-path';
import type { Bounds, EllipseNode, IconNode, LineNode, RectangleNode, TextNode, VectorNode } from '../core/types.js';
import type { ComponentDef } from './types.js';
import { fontSizeOf, fontWeightOf, haloOf, markerOf, resolvePartStyle, textColor } from './style.js';
import { layoutText } from '../text/layout.js';

export const DEFAULT_ICON_SIZE = 20;

export const rectangle: ComponentDef<RectangleNode> = {
  resizable: true,
  localBounds: (node) => ({ x: 0, y: 0, width: node.width, height: node.height }),
  expand: (node, ctx) => [
    {
      key: 'self',
      kind: 'rect',
      x: 0,
      y: 0,
      width: node.width,
      height: node.height,
      cornerRadius: node.cornerRadius,
      style: resolvePartStyle(ctx.theme, node),
    },
  ],
};

export const ellipse: ComponentDef<EllipseNode> = {
  resizable: true,
  localBounds: (node) => ({ x: 0, y: 0, width: node.width, height: node.height }),
  expand: (node, ctx) => [
    {
      key: 'self',
      kind: 'ellipse',
      x: 0,
      y: 0,
      width: node.width,
      height: node.height,
      style: resolvePartStyle(ctx.theme, node),
    },
  ],
};

export const line: ComponentDef<LineNode> = {
  localBounds: (node) => {
    const dx = node.x2 - node.x;
    const dy = node.y2 - node.y;
    return { x: Math.min(0, dx), y: Math.min(0, dy), width: Math.abs(dx), height: Math.abs(dy) };
  },
  expand: (node, ctx) => [
    {
      key: 'self',
      kind: 'line',
      x1: 0,
      y1: 0,
      x2: node.x2 - node.x,
      y2: node.y2 - node.y,
      style: resolvePartStyle(ctx.theme, node),
    },
  ],
};

const pathBoundsCache = new Map<string, Bounds>();

/** Bounding box of the path's clean geometry, via the same sampling the engine uses for fills. */
export function pathBounds(d: string): Bounds {
  const cached = pathBoundsCache.get(d);
  if (cached) return cached;
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  for (const set of pointsOnPath(d, 1, 0.5)) {
    for (const [x, y] of set) {
      if (x < minX) minX = x;
      if (y < minY) minY = y;
      if (x > maxX) maxX = x;
      if (y > maxY) maxY = y;
    }
  }
  const bounds: Bounds =
    minX === Infinity
      ? { x: 0, y: 0, width: 0, height: 0 }
      : { x: minX, y: minY, width: maxX - minX, height: maxY - minY };
  if (pathBoundsCache.size > 500) pathBoundsCache.clear();
  pathBoundsCache.set(d, bounds);
  return bounds;
}

export const vector: ComponentDef<VectorNode> = {
  localBounds: (node) => pathBounds(node.d),
  expand: (node, ctx) => [{ key: 'self', kind: 'path', d: node.d, style: resolvePartStyle(ctx.theme, node) }],
};

export const text: ComponentDef<TextNode> = {
  localBounds: (node, ctx) =>
    layoutText(ctx.font, node.characters, fontSizeOf(node.style, ctx.theme), node.style?.textAlignHorizontal).bounds,
  expand: (node, ctx) => [
    {
      key: 'self',
      kind: 'text',
      x: 0,
      y: 0,
      text: node.characters,
      fontSize: fontSizeOf(node.style, ctx.theme),
      align: node.style?.textAlignHorizontal ?? 'LEFT',
      color: textColor(node.style, ctx.theme.text),
      weight: fontWeightOf(node.style),
      marker: markerOf(node.style, ctx.theme),
      ...(haloOf(node.style, ctx.theme) === undefined ? {} : { halo: haloOf(node.style, ctx.theme) }),
      style: resolvePartStyle(ctx.theme, node, { roughness: node.sketch?.roughness ?? ctx.theme.textRoughness }),
    },
  ],
};

export const icon: ComponentDef<IconNode> = {
  localBounds: (node) => ({
    x: 0,
    y: 0,
    width: node.size ?? DEFAULT_ICON_SIZE,
    height: node.size ?? DEFAULT_ICON_SIZE,
  }),
  expand: (node, ctx) => {
    // An icon is a stroked drawing: its colour is its stroke paint.
    const style = resolvePartStyle(ctx.theme, node);
    return [
      {
        key: 'self',
        kind: 'icon',
        x: 0,
        y: 0,
        size: node.size ?? DEFAULT_ICON_SIZE,
        icon: ctx.icons(node.icon),
        color: style.stroke === 'none' ? ctx.theme.stroke : style.stroke,
        style,
      },
    ];
  },
};
