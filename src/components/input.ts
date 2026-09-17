import type { InputNode, NodeBase, TypeStyle } from '../core/types.js';
import type { ComponentDef, Part, RenderContext } from './types.js';
import { centredTextTop, rectPart, textPart } from './common.js';
import { fontSizeOf, hasOwnFill, textColor } from './style.js';
import { h } from '../render/frame.js';
import type { StrokeFont } from '../text/font.js';

export const INPUT_HEIGHT = 36;
export const INPUT_PADDING_X = 12;

/**
 * The part of the value that fits in the box, ending at the caret: when the
 * text overflows, the start scrolls out of view so the caret stays visible.
 * Truncation instead of clipping keeps the output free of clipPath ids.
 */
export function visibleValue(font: StrokeFont, value: string, fontSize: number, innerWidth: number): string {
  const chars = [...value];
  let start = 0;
  while (start < chars.length && font.measure(chars.slice(start).join(''), fontSize) > innerWidth) {
    start += 1;
  }
  return chars.slice(start).join('');
}

/** What the box of an input-like control shows: the live text or a placeholder, and where its caret sits. */
export interface InputBoxOptions {
  width: number;
  height: number;
  value: string;
  placeholder?: string;
  /** Space kept free at the right end (a select's chevron). */
  trailing?: number;
}

/**
 * The parts of an input's box: the outline (accent while focused), the value
 * or placeholder, the caret. Shared by INPUT, COMBOBOX and AUTOCOMPLETE so
 * they read as one family.
 */
export function inputBoxParts(
  node: InputNode | (NodeBase & { style?: TypeStyle }),
  ctx: RenderContext,
  o: InputBoxOptions,
): Part[] {
  const { theme, font, state } = ctx;
  const fontSize = fontSizeOf(node.style, theme);
  const innerWidth = Math.max(0, o.width - INPUT_PADDING_X * 2 - (o.trailing ?? 0));
  const overrides: Parameters<typeof rectPart>[3]['overrides'] = {};
  if (!hasOwnFill(node)) overrides.fill = theme.surface;
  if (node.sketch?.fillStyle === undefined) overrides.fillStyle = 'solid';
  // Focus turns the outline to the accent colour unless the node sets its own strokes.
  if (state.focused && node.strokes === undefined) overrides.stroke = theme.accent;
  const parts: Part[] = [
    rectPart('box', theme, node, {
      x: 0,
      y: 0,
      width: o.width,
      height: o.height,
      cornerRadius: theme.radius,
      overrides,
    }),
  ];
  const textTop = centredTextTop(font, fontSize, o.height);
  let caretX = INPUT_PADDING_X;
  if (o.value) {
    const shown = visibleValue(font, o.value, fontSize, innerWidth);
    parts.push(
      textPart('value', theme, node, {
        x: INPUT_PADDING_X,
        y: textTop,
        text: shown,
        fontSize,
        color: textColor(node.style, theme.text),
      }),
    );
    caretX += font.measure(shown, fontSize);
  } else if (o.placeholder) {
    parts.push(
      textPart('placeholder', theme, node, {
        x: INPUT_PADDING_X,
        y: textTop,
        text: visibleValue(font, o.placeholder, fontSize, innerWidth),
        fontSize,
        color: theme.muted,
      }),
    );
  }
  if (state.focused && ctx.caretVisible !== false) {
    const capHeight = font.capHeight(fontSize);
    const top = o.height / 2 - capHeight / 2 - 2;
    parts.push({
      key: 'caret',
      kind: 'raw',
      el: h('line', {
        x1: caretX + 1,
        y1: top,
        x2: caretX + 1,
        y2: top + capHeight + 4,
        stroke: theme.accent,
        'stroke-width': 1.5,
        'stroke-linecap': 'round',
      }),
      style: parts[0].style,
    });
  }
  return parts;
}

export const input: ComponentDef<InputNode> = {
  resizable: true,
  focusable: true,
  interactive: true,
  capabilities: { text: true },
  localBounds: (node) => ({ x: 0, y: 0, width: node.width, height: node.height ?? INPUT_HEIGHT }),
  expand: (node, ctx) => {
    const live = ctx.value ?? node.value ?? '';
    return inputBoxParts(node, ctx, {
      width: node.width,
      height: node.height ?? INPUT_HEIGHT,
      value: typeof live === 'string' ? live : String(live),
      placeholder: node.placeholder,
    });
  },
};
