import type { CheckboxNode } from '../core/types.js';
import type { ComponentDef } from './types.js';
import { CONTROL, LABEL_GAP, checkBoxParts, controlWidth, labelPart } from './controls.js';
import { fontSizeOf } from './style.js';

/** A box with a check; clicking anywhere on it (or its label) toggles `checked`. */
export const checkbox: ComponentDef<CheckboxNode> = {
  focusable: true,
  interactive: true,
  capabilities: { check: true },
  localBounds: (node, ctx) => ({
    x: 0,
    y: 0,
    width: controlWidth(ctx.font, fontSizeOf(node.style, ctx.theme), CONTROL, node.characters),
    height: CONTROL,
  }),
  expand: (node, ctx) => {
    const checked = ctx.checked ?? node.checked ?? false;
    const parts = checkBoxParts('', ctx.theme, node, ctx, 0, 0, checked, node.indeterminate);
    if (node.characters)
      parts.push(labelPart('label', ctx.theme, ctx.font, node, node.characters, CONTROL + LABEL_GAP, 0, CONTROL));
    return parts;
  },
  click: (node, ctx) => ({ checked: !(ctx.checked ?? node.checked ?? false) }),
};
