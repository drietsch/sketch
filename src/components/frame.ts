import type { FrameNode } from '../core/types.js';
import type { ComponentDef, Part } from './types.js';
import { centredTextTop, rectPart, textPart } from './common.js';
import { fontSizeOf, hasOwnFill, resolvePartStyle, textColor } from './style.js';

export const FRAME_TITLE_HEIGHT = 34;
const PADDING_X = 12;

/** A container with an optional title bar. Children are positioned from below the bar. */
export const frame: ComponentDef<FrameNode> = {
  resizable: true,
  container: true,
  interactive: true,
  // Under HUG sizing the layout pass supplies the size; a bare HUG frame measures as 0 until then.
  localBounds: (node) => ({ x: 0, y: 0, width: node.width ?? 0, height: node.height ?? 0 }),
  contentOffset: (node) => ({ x: 0, y: node.title ? FRAME_TITLE_HEIGHT : 0 }),
  expand: (node, ctx) => {
    const { theme, font } = ctx;
    const overrides: Parameters<typeof rectPart>[3]['overrides'] = {};
    if (!hasOwnFill(node)) overrides.fill = theme.surface;
    if (node.sketch?.fillStyle === undefined) overrides.fillStyle = 'solid';
    const width = node.width ?? 0;
    const height = node.height ?? 0;
    const parts: Part[] = [
      rectPart('box', theme, node, { x: 0, y: 0, width, height, cornerRadius: theme.radius, overrides }),
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
          x2: width,
          y2: FRAME_TITLE_HEIGHT,
          style: resolvePartStyle(theme, node, { fill: undefined }),
        },
      );
    }
    return parts;
  },
};
