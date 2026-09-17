import type { AvatarNode } from '../core/types.js';
import type { ComponentDef, Part } from './types.js';
import { resolvePartStyle, textColor } from './style.js';
import { centredTextTop, textPart } from './common.js';

const DEFAULT_SIZE = 36;

/** A circle with initials or an icon. */
export const avatar: ComponentDef<AvatarNode> = {
  localBounds: (node) => ({ x: 0, y: 0, width: node.size ?? DEFAULT_SIZE, height: node.size ?? DEFAULT_SIZE }),
  expand: (node, ctx) => {
    const { theme, font } = ctx;
    const size = node.size ?? DEFAULT_SIZE;
    const parts: Part[] = [
      {
        key: 'circle',
        kind: 'ellipse',
        x: 0,
        y: 0,
        width: size,
        height: size,
        style: resolvePartStyle(
          theme,
          node,
          node.fills === undefined ? { fill: theme.muted, fillStyle: 'hachure', hachureGap: 4 } : {},
        ),
      },
    ];
    const color = textColor(node.style, theme.text);
    if (node.icon) {
      const icon = Math.round(size * 0.55);
      parts.push({
        key: 'icon',
        kind: 'icon',
        x: (size - icon) / 2,
        y: (size - icon) / 2,
        size: icon,
        icon: ctx.icons(node.icon),
        color,
        style: resolvePartStyle(theme, node),
      });
    } else if (node.characters) {
      const fontSize = node.style?.fontSize ?? Math.round(size * 0.4);
      const text = node.characters.slice(0, 2).toUpperCase();
      parts.push(
        textPart('initials', theme, node, {
          x: (size - font.measure(text, fontSize)) / 2,
          y: centredTextTop(font, fontSize, size),
          text,
          fontSize,
          color,
        }),
      );
    }
    return parts;
  },
};
