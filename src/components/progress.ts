import type { MeterNode, ProgressNode } from '../core/types.js';
import type { ComponentDef, Part } from './types.js';
import { TRACK, LABEL_GAP } from './controls.js';
import { rectPart, textPart } from './common.js';
import { fontSizeOf, textColor } from './style.js';

const BAR = TRACK + 4;

function bar(
  node: ProgressNode | MeterNode,
  ctx: Parameters<ComponentDef<ProgressNode>['expand']>[1],
  fraction: number,
  striped: boolean,
): Part[] {
  const { theme } = ctx;
  const parts: Part[] = [
    rectPart('track', theme, node, {
      x: 0,
      y: 0,
      width: node.width,
      height: BAR,
      cornerRadius: BAR / 2,
      overrides: { fill: theme.surface, fillStyle: 'solid', stroke: theme.muted },
    }),
  ];
  const width = Math.max(0, Math.min(1, fraction)) * node.width;
  if (width > 1) {
    parts.push(
      rectPart('indicator', theme, node, {
        x: 0,
        y: 0,
        width,
        height: BAR,
        cornerRadius: BAR / 2,
        overrides: striped
          ? { fill: theme.accent, fillStyle: 'hachure', hachureGap: 4, stroke: 'none' }
          : { fill: theme.accent, fillStyle: 'solid', stroke: 'none' },
      }),
    );
  }
  if (node.characters) {
    const fontSize = fontSizeOf(node.style, theme);
    parts.push(
      textPart('label', theme, node, {
        x: 0,
        y: BAR + LABEL_GAP / 2,
        text: node.characters,
        fontSize,
        color: textColor(node.style, theme.muted),
      }),
    );
  }
  return parts;
}

function height(node: ProgressNode | MeterNode, ctx: Parameters<ComponentDef<ProgressNode>['localBounds']>[1]): number {
  return node.characters ? BAR + LABEL_GAP / 2 + ctx.font.lineHeight(fontSizeOf(node.style, ctx.theme)) : BAR;
}

/** A task's progress: a bar filling left to right, hatched while indeterminate. */
export const progress: ComponentDef<ProgressNode> = {
  resizable: true,
  validate: (node) => {
    const max = node.max ?? 100;
    if (!(max > 0)) return 'max must be positive';
    if (node.value !== undefined && (node.value < 0 || node.value > max)) return `value must be within 0..${max}`;
    return undefined;
  },
  localBounds: (node, ctx) => ({ x: 0, y: 0, width: node.width, height: height(node, ctx) }),
  expand: (node, ctx) => {
    const max = node.max ?? 100;
    const live = ctx.value;
    const value = typeof live === 'number' ? live : (node.value ?? 0);
    return node.indeterminate ? bar(node, ctx, 1, true) : bar(node, ctx, value / max, false);
  },
};

/** A value within a range, as a bar. */
export const meter: ComponentDef<MeterNode> = {
  resizable: true,
  validate: (node) => {
    const min = node.min ?? 0;
    const max = node.max ?? 100;
    if (!(max > min)) return 'max must be greater than min';
    if (node.value !== undefined && (node.value < min || node.value > max))
      return `value must be within ${min}..${max}`;
    return undefined;
  },
  localBounds: (node, ctx) => ({ x: 0, y: 0, width: node.width, height: height(node, ctx) }),
  expand: (node, ctx) => {
    const min = node.min ?? 0;
    const max = node.max ?? 100;
    const live = ctx.value;
    const value = typeof live === 'number' ? live : (node.value ?? min);
    return bar(node, ctx, (value - min) / (max - min), false);
  },
};
