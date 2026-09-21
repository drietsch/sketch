import type { ToggleNode } from '../core/types.js';
import type { ComponentDef, Part } from './types.js';
import { BUTTON_HEIGHT } from './button.js';
import { centredTextTop, rectPart, textPart } from './common.js';
import { fontSizeOf, resolvePartStyle, textColor } from './style.js';

const PADDING_X = 12;
const ICON_SIZE = 18;
const ICON_GAP = 6;

/** A button that stays down: `pressed` is model state, toggled by a click. */
export const toggle: ComponentDef<ToggleNode> = {
  focusable: true,
  interactive: true,
  capabilities: { check: true },
  localBounds: (node, ctx) => {
    const fontSize = fontSizeOf(node.style, ctx.theme);
    const text = node.characters ? ctx.font.measure(node.characters, fontSize) : 0;
    const icon = node.icon ? ICON_SIZE + (node.characters ? ICON_GAP : 0) : 0;
    return { x: 0, y: 0, width: Math.ceil(PADDING_X * 2 + icon + text), height: BUTTON_HEIGHT };
  },
  expand: (node, ctx) => {
    const { theme, font } = ctx;
    const down = ctx.checked ?? node.pressed ?? false;
    const fontSize = fontSizeOf(node.style, theme);
    const width = toggle.localBounds(node, ctx).width;
    const parts: Part[] = [
      rectPart('box', theme, node, {
        x: 0,
        y: 0,
        width,
        height: BUTTON_HEIGHT,
        cornerRadius: theme.radius,
        overrides: down
          ? { fill: theme.accent, fillStyle: 'hachure', hachureGap: 5 }
          : { fill: theme.surface, fillStyle: 'solid' },
      }),
    ];
    let x = PADDING_X;
    const color = textColor(node.style, theme.text);
    // The pressed face is hatched; the surface goes back under the label so the hatch stops short of it.
    const halo = down ? theme.surface : undefined;
    if (node.icon) {
      parts.push({
        key: 'icon',
        kind: 'icon',
        x,
        y: (BUTTON_HEIGHT - ICON_SIZE) / 2,
        size: ICON_SIZE,
        icon: ctx.icons(node.icon),
        color,
        halo,
        style: resolvePartStyle(theme, node),
      });
      x += ICON_SIZE + (node.characters ? ICON_GAP : 0);
    }
    if (node.characters) {
      parts.push(
        textPart('label', theme, node, {
          x,
          y: centredTextTop(font, fontSize, BUTTON_HEIGHT),
          text: node.characters,
          fontSize,
          color,
          halo,
        }),
      );
    }
    return parts;
  },
  click: (node, ctx) => ({ checked: !(ctx.checked ?? node.pressed ?? false) }),
};
