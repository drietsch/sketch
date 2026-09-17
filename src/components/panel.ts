import type { PanelNode } from '../core/types.js';
import type { ComponentDef, Part } from './types.js';
import { centredTextTop, rectPart, textPart } from './common.js';
import { resolvePartStyle } from './style.js';

export const PANEL_TITLE_HEIGHT = 34;
const PADDING_X = 12;

export const panel: ComponentDef<PanelNode> = {
  interactive: true,
  localBounds: (node) => ({ x: 0, y: 0, width: node.width, height: node.height }),
  contentOffset: (node) => ({ x: 0, y: node.title ? PANEL_TITLE_HEIGHT : 0 }),
  expand: (node, ctx) => {
    const { theme, font } = ctx;
    const parts: Part[] = [
      rectPart('box', theme, {
        x: 0,
        y: 0,
        width: node.width,
        height: node.height,
        radius: theme.radius,
        style: node.style,
        overrides: { fill: node.style?.fill ?? theme.surface, fillStyle: node.style?.fillStyle ?? 'solid' },
      }),
    ];
    if (node.title) {
      const fontSize = node.style?.fontSize ?? theme.fontSize;
      parts.push(
        textPart('title', theme, font, {
          x: PADDING_X,
          y: centredTextTop(font, fontSize, PANEL_TITLE_HEIGHT),
          text: node.title,
          fontSize,
          color: node.style?.color ?? theme.text,
          style: node.style,
        }),
        {
          key: 'divider',
          kind: 'line',
          x1: 0,
          y1: PANEL_TITLE_HEIGHT,
          x2: node.width,
          y2: PANEL_TITLE_HEIGHT,
          style: resolvePartStyle(theme, node.style, { fill: undefined }),
        },
      );
    }
    return parts;
  },
};
