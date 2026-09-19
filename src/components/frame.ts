import type { FrameNode } from '../core/types.js';
import type { ComponentDef, Part } from './types.js';
import { centredTextTop, rectPart, textPart, TITLE_WEIGHT } from './common.js';
import { handFrameParts, handRuleParts } from './hand-frame.js';
import { fontSizeOf, hasOwnFill, resolvePartStyle, textColor } from './style.js';

export const FRAME_TITLE_HEIGHT = 34;
const PADDING_X = 12;

/** The rule under a frame's title, hand-drawn where the theme asks for it. */
function ruleParts(
  theme: Parameters<typeof handRuleParts>[1],
  node: Parameters<typeof handRuleParts>[2],
  width: number,
): Part[] {
  const rule = { x1: 0, y1: FRAME_TITLE_HEIGHT, x2: width, y2: FRAME_TITLE_HEIGHT };
  const hand = handRuleParts('divider-', theme, node, rule);
  if (hand.length) return hand;
  return [{ key: 'divider', kind: 'line', ...rule, style: resolvePartStyle(theme, node, { fill: undefined }) }];
}

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
    const hand = handFrameParts('frame-', theme, node, { x: 0, y: 0, width, height, overrides });
    const parts: Part[] = [
      rectPart('box', theme, node, {
        x: 0,
        y: 0,
        width,
        height,
        cornerRadius: theme.radius,
        overrides: hand.length ? { ...overrides, stroke: 'none' } : overrides,
      }),
      ...hand,
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
          weight: TITLE_WEIGHT,
        }),
        ...ruleParts(theme, node, width),
      );
    }
    return parts;
  },
};
