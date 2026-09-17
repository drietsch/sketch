import type { OtpFieldNode } from '../core/types.js';
import type { ComponentDef, Part } from './types.js';
import { INPUT_HEIGHT } from './input.js';
import { centredTextTop, rectPart, textPart } from './common.js';
import { fontSizeOf, hasOwnFill, textColor } from './style.js';
import { h } from '../render/frame.js';

const SLOT = 36;
const GAP = 8;

/** One box per character of a one-time code; typing fills the slots in order. */
export const otpField: ComponentDef<OtpFieldNode> = {
  focusable: true,
  interactive: true,
  capabilities: { text: true },
  validate: (node) => ((node.length ?? 6) >= 1 ? undefined : 'length must be at least 1'),
  localBounds: (node) => {
    const n = node.length ?? 6;
    return { x: 0, y: 0, width: n * SLOT + (n - 1) * GAP, height: INPUT_HEIGHT };
  },
  expand: (node, ctx) => {
    const { theme, font, state } = ctx;
    const n = node.length ?? 6;
    const live = ctx.value ?? node.value ?? '';
    const chars = [...(typeof live === 'string' ? live : String(live))].slice(0, n);
    const fontSize = Math.max(fontSizeOf(node.style, theme), 16);
    const parts: Part[] = [];
    for (let i = 0; i < n; i++) {
      const x = i * (SLOT + GAP);
      const active = state.focused && i === Math.min(chars.length, n - 1);
      const overrides: Record<string, unknown> = {};
      if (!hasOwnFill(node)) overrides.fill = theme.surface;
      if (node.sketch?.fillStyle === undefined) overrides.fillStyle = 'solid';
      if (active && node.strokes === undefined) overrides.stroke = theme.accent;
      parts.push(
        rectPart(`slot-${i}`, theme, node, {
          x,
          y: 0,
          width: SLOT,
          height: INPUT_HEIGHT,
          cornerRadius: theme.radius,
          overrides,
        }),
      );
      if (chars[i] !== undefined) {
        parts.push(
          textPart(`char-${i}`, theme, node, {
            x: x + (SLOT - font.measure(chars[i], fontSize)) / 2,
            y: centredTextTop(font, fontSize, INPUT_HEIGHT),
            text: chars[i],
            fontSize,
            color: textColor(node.style, theme.text),
          }),
        );
      }
      if (active && ctx.caretVisible !== false && chars.length < n) {
        const cap = font.capHeight(fontSize);
        parts.push({
          key: `caret-${i}`,
          kind: 'raw',
          el: h('line', {
            x1: x + SLOT / 2,
            y1: INPUT_HEIGHT / 2 - cap / 2 - 2,
            x2: x + SLOT / 2,
            y2: INPUT_HEIGHT / 2 + cap / 2 + 2,
            stroke: theme.accent,
            'stroke-width': 1.5,
            'stroke-linecap': 'round',
          }),
          style: parts[0].style,
        });
      }
    }
    return parts;
  },
};
