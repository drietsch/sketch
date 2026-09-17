import type { SwitchNode } from '../core/types.js';
import type { ComponentDef, Part } from './types.js';
import { LABEL_GAP, SWITCH_HEIGHT, SWITCH_WIDTH, THUMB, controlWidth, labelPart } from './controls.js';
import { rectPart } from './common.js';
import { fontSizeOf, resolvePartStyle } from './style.js';

/** A pill track with a thumb that sits on the checked side. */
export const switch_: ComponentDef<SwitchNode> = {
  focusable: true,
  interactive: true,
  capabilities: { check: true },
  localBounds: (node, ctx) => ({
    x: 0,
    y: 0,
    width: controlWidth(ctx.font, fontSizeOf(node.style, ctx.theme), SWITCH_WIDTH, node.characters),
    height: SWITCH_HEIGHT,
  }),
  expand: (node, ctx) => {
    const { theme } = ctx;
    const checked = ctx.checked ?? node.checked ?? false;
    const inset = (SWITCH_HEIGHT - THUMB) / 2;
    const parts: Part[] = [
      rectPart('track', theme, node, {
        x: 0,
        y: 0,
        width: SWITCH_WIDTH,
        height: SWITCH_HEIGHT,
        cornerRadius: SWITCH_HEIGHT / 2,
        overrides: checked
          ? { fill: theme.accent, fillStyle: 'solid', stroke: theme.accent }
          : { fill: theme.surface, fillStyle: 'solid' },
      }),
      {
        key: 'thumb',
        kind: 'ellipse',
        x: checked ? SWITCH_WIDTH - inset - THUMB : inset,
        y: inset,
        width: THUMB,
        height: THUMB,
        style: resolvePartStyle(theme, node, {
          fill: checked ? theme.surface : theme.stroke,
          fillStyle: 'solid',
          stroke: checked ? theme.surface : theme.stroke,
        }),
      },
    ];
    if (node.characters)
      parts.push(
        labelPart('label', theme, ctx.font, node, node.characters, SWITCH_WIDTH + LABEL_GAP, 0, SWITCH_HEIGHT),
      );
    return parts;
  },
  click: (node, ctx) => ({ checked: !(ctx.checked ?? node.checked ?? false) }),
};
