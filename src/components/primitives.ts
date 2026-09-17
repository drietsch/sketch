import { pointsOnPath } from 'points-on-path';
import type { Bounds, EllipseNode, LineNode, PathNode, RectNode } from '../core/types.js';
import type { ComponentDef } from './types.js';
import { resolvePartStyle } from './style.js';

export const rect: ComponentDef<RectNode> = {
  localBounds: (node) => ({ x: 0, y: 0, width: node.width, height: node.height }),
  expand: (node, ctx) => [
    {
      key: 'self',
      kind: 'rect',
      x: 0,
      y: 0,
      width: node.width,
      height: node.height,
      radius: node.radius,
      style: resolvePartStyle(ctx.theme, node.style),
    },
  ],
};

export const ellipse: ComponentDef<EllipseNode> = {
  localBounds: (node) => ({ x: 0, y: 0, width: node.width, height: node.height }),
  expand: (node, ctx) => [
    {
      key: 'self',
      kind: 'ellipse',
      x: 0,
      y: 0,
      width: node.width,
      height: node.height,
      style: resolvePartStyle(ctx.theme, node.style),
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
      style: resolvePartStyle(ctx.theme, node.style),
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

export const path: ComponentDef<PathNode> = {
  localBounds: (node) => pathBounds(node.d),
  expand: (node, ctx) => [{ key: 'self', kind: 'path', d: node.d, style: resolvePartStyle(ctx.theme, node.style) }],
};
