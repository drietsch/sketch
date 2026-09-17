import type { InputNode } from '../core/types.js';
import type { ComponentDef, Part } from './types.js';
import { centredTextTop, rectPart, textPart } from './common.js';
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

export const input: ComponentDef<InputNode> = {
  focusable: true,
  interactive: true,
  localBounds: (node) => ({ x: 0, y: 0, width: node.width, height: node.height ?? INPUT_HEIGHT }),
  expand: (node, ctx) => {
    const { theme, font, state } = ctx;
    const height = node.height ?? INPUT_HEIGHT;
    const fontSize = node.style?.fontSize ?? theme.fontSize;
    const innerWidth = Math.max(0, node.width - INPUT_PADDING_X * 2);
    const value = ctx.value ?? node.value ?? '';
    const parts: Part[] = [
      rectPart('box', theme, {
        x: 0,
        y: 0,
        width: node.width,
        height,
        radius: theme.radius,
        style: node.style,
        overrides: {
          fill: node.style?.fill ?? theme.surface,
          fillStyle: node.style?.fillStyle ?? 'solid',
          stroke: node.style?.stroke ?? (state.focused ? theme.accent : theme.stroke),
        },
      }),
    ];
    const textTop = centredTextTop(font, fontSize, height);
    let caretX = INPUT_PADDING_X;
    if (value) {
      const shown = visibleValue(font, value, fontSize, innerWidth);
      parts.push(
        textPart('value', theme, font, {
          x: INPUT_PADDING_X,
          y: textTop,
          text: shown,
          fontSize,
          color: node.style?.color ?? theme.text,
          style: node.style,
        }),
      );
      caretX += font.measure(shown, fontSize);
    } else if (node.placeholder) {
      parts.push(
        textPart('placeholder', theme, font, {
          x: INPUT_PADDING_X,
          y: textTop,
          text: visibleValue(font, node.placeholder, fontSize, innerWidth),
          fontSize,
          color: theme.muted,
          style: node.style,
        }),
      );
    }
    if (state.focused && ctx.caretVisible !== false) {
      const capHeight = font.capHeight(fontSize);
      const top = height / 2 - capHeight / 2 - 2;
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
  },
};
