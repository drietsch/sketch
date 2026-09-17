import type { FrameNode } from '../core/types.js';
import type { ComponentDef, Part } from './types.js';
import { centredTextTop, rectPart, textPart } from './common.js';
import { fontSizeOf, hasOwnFill, resolvePartStyle, textColor } from './style.js';

export const FRAME_TITLE_HEIGHT = 34;
const PADDING_X = 12;

/** A container with an optional title bar. Children are positioned from below the bar. */
export const frame: ComponentDef<FrameNode> = {
  interactive: true,
  localBounds: (node) => ({ x: 0, y: 0, width: node.width, height: node.height }),
  contentOffset: (node) => ({ x: 0, y: node.title ? FRAME_TITLE_HEIGHT : 0 }),
  expand: (node, ctx) => {
    const { theme, font } = ctx;
    const overrides: Parameters<typeof rectPart>[3]['overrides'] = {};
    if (!hasOwnFill(node)) overrides.fill = theme.surface;
    if (node.sketch?.fillStyle === undefined) overrides.fillStyle = 'solid';
    const parts: Part[] = [
      rectPart('box', theme, node, {
        x: 0,
        y: 0,
        width: node.width,
        height: node.height,
        cornerRadius: theme.radius,
        overrides,
      }),
    ];
    if (node.title) {
      const fontSize = fontSizeOf(node.style, theme);
      parts.push(
        textPart('title', theme, node, {
          x: PADDING_X,
          y: centredTextTop(font, fontSize, FRAME_TITLE_HEIGHT),
          text: node.title,
          fontSize,
          color: textColor(node.style, theme.text),
        }),
        {
          key: 'divider',
          kind: 'line',
          x1: 0,
          y1: FRAME_TITLE_HEIGHT,
          x2: node.width,
          y2: FRAME_TITLE_HEIGHT,
          style: resolvePartStyle(theme, node, { fill: undefined }),
        },
      );
    }
    return parts;
  },
};
