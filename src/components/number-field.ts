import type { NumberFieldNode } from '../core/types.js';
import type { ComponentDef, Part, Region } from './types.js';
import { INPUT_HEIGHT, INPUT_PADDING_X } from './input.js';
import { centredTextTop, rectPart, textPart } from './common.js';
import { fontSizeOf, hasOwnFill, resolvePartStyle, textColor } from './style.js';

const STEPPER = 28;

function bounds(node: NumberFieldNode) {
  return { min: node.min ?? -Infinity, max: node.max ?? Infinity, step: node.step ?? 1 };
}

function current(node: NumberFieldNode, live: number | string | string[] | undefined): number | undefined {
  if (typeof live === 'number') return live;
  if (typeof live === 'string' && live !== '' && Number.isFinite(Number(live))) return Number(live);
  return node.value;
}

/** An input for a number with decrement and increment buttons at its ends. */
export const numberField: ComponentDef<NumberFieldNode> = {
  focusable: true,
  interactive: true,
  resizable: true,
  capabilities: { choose: true, text: true },
  validate: (node) => {
    const { min, max, step } = bounds(node);
    if (!(max > min)) return 'max must be greater than min';
    if (!(step > 0)) return 'step must be positive';
    return undefined;
  },
  localBounds: (node) => ({ x: 0, y: 0, width: node.width, height: INPUT_HEIGHT }),
  expand: (node, ctx) => {
    const { theme, font, state } = ctx;
    const fontSize = fontSizeOf(node.style, theme);
    const value = current(node, ctx.value);
    const overrides: Partial<ReturnType<typeof resolvePartStyle>> = {};
    if (!hasOwnFill(node)) overrides.fill = theme.surface;
    if (node.sketch?.fillStyle === undefined) overrides.fillStyle = 'solid';
    if (state.focused && node.strokes === undefined) overrides.stroke = theme.accent;
    const parts: Part[] = [
      rectPart('box', theme, node, {
        x: 0,
        y: 0,
        width: node.width,
        height: INPUT_HEIGHT,
        cornerRadius: theme.radius,
        overrides,
      }),
      {
        key: 'div-left',
        kind: 'line',
        x1: STEPPER,
        y1: 0,
        x2: STEPPER,
        y2: INPUT_HEIGHT,
        style: resolvePartStyle(theme, node, { fill: undefined }),
      },
      {
        key: 'div-right',
        kind: 'line',
        x1: node.width - STEPPER,
        y1: 0,
        x2: node.width - STEPPER,
        y2: INPUT_HEIGHT,
        style: resolvePartStyle(theme, node, { fill: undefined }),
      },
      {
        key: 'minus',
        kind: 'icon',
        x: (STEPPER - 16) / 2,
        y: (INPUT_HEIGHT - 16) / 2,
        size: 16,
        icon: ctx.icons('minus'),
        color: theme.muted,
        style: resolvePartStyle(theme, node),
      },
      {
        key: 'plus',
        kind: 'icon',
        x: node.width - STEPPER + (STEPPER - 16) / 2,
        y: (INPUT_HEIGHT - 16) / 2,
        size: 16,
        icon: ctx.icons('plus'),
        color: theme.muted,
        style: resolvePartStyle(theme, node),
      },
    ];
    const text = value === undefined ? (node.placeholder ?? '') : String(value);
    if (text) {
      parts.push(
        textPart('value', theme, node, {
          x: STEPPER + INPUT_PADDING_X,
          y: centredTextTop(font, fontSize, INPUT_HEIGHT),
          text,
          fontSize,
          color: value === undefined ? theme.muted : textColor(node.style, theme.text),
        }),
      );
    }
    return parts;
  },
  regions: (node, ctx): Region[] => {
    const { min, max, step } = bounds(node);
    const v = current(node, ctx.value) ?? (Number.isFinite(min) ? min : 0);
    const clamp = (n: number) => Math.min(max, Math.max(min, n));
    return [
      {
        key: 'decrement',
        bounds: { x: 0, y: 0, width: STEPPER, height: INPUT_HEIGHT },
        action: { value: clamp(v - step) },
      },
      {
        key: 'increment',
        bounds: { x: node.width - STEPPER, y: 0, width: STEPPER, height: INPUT_HEIGHT },
        action: { value: clamp(v + step) },
      },
    ];
  },
};
