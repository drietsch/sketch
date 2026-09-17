import type { SeparatorNode } from '../core/types.js';
import type { ComponentDef } from './types.js';
import { resolvePartStyle } from './style.js';

/** A single sketched line, horizontal by default. */
export const separator: ComponentDef<SeparatorNode> = {
  validate: (node) => (node.length > 0 ? undefined : 'length must be positive'),
  localBounds: (node) =>
    node.orientation === 'vertical'
      ? { x: 0, y: 0, width: 1, height: node.length }
      : { x: 0, y: 0, width: node.length, height: 1 },
  expand: (node, ctx) => [
    {
      key: 'line',
      kind: 'line',
      x1: 0,
      y1: 0,
      x2: node.orientation === 'vertical' ? 0 : node.length,
      y2: node.orientation === 'vertical' ? node.length : 0,
      style: resolvePartStyle(ctx.theme, node, { stroke: node.strokes === undefined ? ctx.theme.muted : undefined }),
    },
  ],
};
