import type { ButtonNode } from '../core/types.js';
import type { ComponentDef, Part } from './types.js';
import { centredTextTop, offsetParts, rectPart, textPart } from './common.js';
import { fontSizeOf, hasOwnFill, resolvePartStyle, textColor } from './style.js';

export const BUTTON_HEIGHT = 36;
const PADDING_X = 16;
const ICON_SIZE = 18;
const ICON_GAP = 8;

function metrics(node: ButtonNode, measure: (text: string) => number) {
  const iconWidth = node.icon ? ICON_SIZE + ICON_GAP : 0;
  const textWidth = node.characters ? measure(node.characters) : 0;
  const width = node.width ?? Math.ceil(PADDING_X * 2 + iconWidth + textWidth);
  const height = node.height ?? BUTTON_HEIGHT;
  return { width, height, iconWidth, textWidth };
}

export const button: ComponentDef<ButtonNode> = {
  focusable: true,
  interactive: true,
  localBounds: (node, ctx) => {
    const fontSize = fontSizeOf(node.style, ctx.theme);
    const m = metrics(node, (t) => ctx.font.measure(t, fontSize));
    return { x: 0, y: 0, width: m.width, height: m.height };
  },
  expand: (node, ctx) => {
    const { theme, font, state } = ctx;
    const fontSize = fontSizeOf(node.style, theme);
    const m = metrics(node, (t) => font.measure(t, fontSize));
    const primary = node.variant === 'primary';
    const labelColor = textColor(node.style, primary ? theme.surface : theme.text);

    // The face: the node's own fill if it has one, else the variant's default.
    const overrides: Parameters<typeof rectPart>[3]['overrides'] = {
      strokeWeight: (node.strokeWeight ?? theme.strokeWeight) + (state.pressed ? 0.6 : 0),
    };
    if (!hasOwnFill(node)) overrides.fill = primary ? theme.accent : theme.surface;
    if (node.sketch?.fillStyle === undefined) overrides.fillStyle = 'solid';
    const box = rectPart('box', theme, node, {
      x: 0,
      y: 0,
      width: m.width,
      height: m.height,
      cornerRadius: theme.radius,
      overrides,
    });
    const parts: Part[] = [box];

    if (state.hovered && !state.pressed) {
      // A light hatch over the face reads as "lit up" without changing the outline.
      parts.push(
        rectPart('hover', theme, undefined, {
          x: 3,
          y: 3,
          width: m.width - 6,
          height: m.height - 6,
          cornerRadius: Math.max(0, theme.radius - 2),
          overrides: {
            stroke: 'none',
            fill: primary ? theme.surface : theme.accent,
            fillStyle: 'hachure',
            hachureGap: 7,
            fillWeight: 0.6,
            opacity: 0.35,
          },
        }),
      );
    }

    const contentWidth = m.iconWidth + m.textWidth;
    let x = (m.width - contentWidth) / 2;
    if (node.icon) {
      parts.push({
        key: 'icon',
        kind: 'icon',
        x,
        y: (m.height - ICON_SIZE) / 2,
        size: ICON_SIZE,
        icon: ctx.icons(node.icon),
        color: labelColor,
        style: resolvePartStyle(theme, node),
      });
      x += ICON_SIZE + ICON_GAP;
    }
    if (node.characters) {
      parts.push(
        textPart('label', theme, node, {
          x,
          y: centredTextTop(font, fontSize, m.height),
          text: node.characters,
          fontSize,
          color: labelColor,
        }),
      );
    }
    return state.pressed ? offsetParts(parts, 1, 1) : parts;
  },
};
