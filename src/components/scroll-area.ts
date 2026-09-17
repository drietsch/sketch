import type { ScrollAreaNode } from '../core/types.js';
import type { ComponentDef, Part, Region } from './types.js';
import { rectPart } from './common.js';
import { hasOwnFill } from './style.js';

const BAR = 8;
const BAR_INSET = 3;
const MIN_THUMB = 24;

function range(node: ScrollAreaNode): number {
  return Math.max(0, node.contentHeight - node.height);
}

function offsetOf(node: ScrollAreaNode, live: unknown): number {
  const v = typeof live === 'number' ? live : (node.value ?? 0);
  return Math.max(0, Math.min(range(node), v));
}

/** Track and thumb geometry down the right edge. */
function thumb(
  node: ScrollAreaNode,
  offset: number,
): { x: number; trackY: number; trackHeight: number; y: number; height: number } {
  const trackY = BAR_INSET;
  const trackHeight = node.height - BAR_INSET * 2;
  const visible = Math.min(1, node.height / Math.max(node.contentHeight, 1));
  const height = Math.max(MIN_THUMB, Math.round(trackHeight * visible));
  const travel = trackHeight - height;
  const max = range(node);
  const y = trackY + (max > 0 ? (offset / max) * travel : 0);
  return { x: node.width - BAR - BAR_INSET, trackY, trackHeight, y, height };
}

/** A viewport over taller content: children scroll by `value` and are clipped; the thumb drags. */
export const scrollArea: ComponentDef<ScrollAreaNode> = {
  container: true,
  resizable: true,
  interactive: true,
  capabilities: { drag: true, choose: true },
  layoutDependsOnState: true,
  validate: (node) => {
    if (!(node.contentHeight > 0)) return 'contentHeight must be positive';
    if (node.value !== undefined && (node.value < 0 || node.value > range(node)))
      return `value must be within 0..${range(node)}`;
    return undefined;
  },
  localBounds: (node) => ({ x: 0, y: 0, width: node.width, height: node.height }),
  clip: (node) => ({ x: 0, y: 0, width: node.width, height: node.height }),
  contentOffset: (node) => ({ x: 0, y: -offsetOf(node, undefined) }),
  expand: (node, ctx) => {
    const { theme, state } = ctx;
    const offset = offsetOf(node, ctx.value);
    const t = thumb(node, offset);
    const parts: Part[] = [
      rectPart('box', theme, node, {
        x: 0,
        y: 0,
        width: node.width,
        height: node.height,
        cornerRadius: theme.radius,
        overrides: hasOwnFill(node) ? {} : { fill: undefined },
      }),
    ];
    if (range(node) > 0) {
      parts.push(
        rectPart('track', theme, undefined, {
          x: t.x,
          y: t.trackY,
          width: BAR,
          height: t.trackHeight,
          cornerRadius: BAR / 2,
          overrides: { stroke: 'none', fill: theme.muted, fillStyle: 'solid', opacity: 0.2 },
        }),
        rectPart('thumb', theme, undefined, {
          x: t.x,
          y: t.y,
          width: BAR,
          height: t.height,
          cornerRadius: BAR / 2,
          overrides: { stroke: 'none', fill: state.pressed ? theme.accent : theme.muted, fillStyle: 'solid' },
        }),
      );
    }
    return parts;
  },
  regions: (node, ctx): Region[] => {
    if (range(node) === 0) return [];
    const t = thumb(node, offsetOf(node, ctx.value));
    return [
      { key: 'track', bounds: { x: t.x - 2, y: 0, width: BAR + 4, height: node.height } },
      { key: 'thumb', bounds: { x: t.x - 2, y: t.y, width: BAR + 4, height: t.height } },
    ];
  },
  drag: {
    valueAt: (node, _ctx, p) => {
      const t = thumb(node, 0);
      const travel = t.trackHeight - t.height;
      if (travel <= 0) return 0;
      const centre = p.y - t.trackY - t.height / 2;
      return Math.round(Math.max(0, Math.min(1, centre / travel)) * range(node));
    },
    pointFor: (node, _ctx, v) => {
      const t = thumb(node, offsetOf(node, v));
      return { x: t.x + BAR / 2, y: t.y + t.height / 2 };
    },
  },
};
