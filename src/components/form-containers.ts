import type { FieldNode, FieldsetNode, FormNode, ToolbarNode } from '../core/types.js';
import type { ComponentDef, Part } from './types.js';
import { FIELD_GAP } from './controls.js';
import { rectPart, textPart, TITLE_WEIGHT } from './common.js';
import { handFrameParts } from './hand-frame.js';
import { fontSizeOf, hasOwnFill, textColor } from './style.js';

const noteSize = (fontSize: number) => Math.max(10, fontSize - 2);

/** A label above a control, an optional description or error below. Children start under the label. */
export const field: ComponentDef<FieldNode> = {
  container: true,
  resizable: true,
  interactive: true,
  localBounds: (node) => ({ x: 0, y: 0, width: node.width ?? 0, height: node.height ?? 0 }),
  contentOffset: (node, ctx) => ({
    x: 0,
    y: node.label ? ctx.font.lineHeight(fontSizeOf(node.style, ctx.theme)) + FIELD_GAP : 0,
  }),
  contentTrailing: (node, ctx) => ({
    x: 0,
    y:
      (node.error ?? node.description)
        ? ctx.font.lineHeight(noteSize(fontSizeOf(node.style, ctx.theme))) + FIELD_GAP
        : 0,
  }),
  expand: (node, ctx) => {
    const { theme, font } = ctx;
    const fontSize = fontSizeOf(node.style, theme);
    const parts: Part[] = [];
    if (node.label)
      parts.push(
        textPart('label', theme, node, {
          x: 0,
          y: 0,
          text: node.label,
          fontSize,
          color: textColor(node.style, theme.text),
        }),
      );
    const note = node.error ?? node.description;
    if (note) {
      const small = noteSize(fontSize);
      const height = node.height ?? 0;
      parts.push(
        textPart('note', theme, node, {
          x: 0,
          y: height - font.lineHeight(small),
          text: note,
          fontSize: small,
          color: node.error ? '#c0392b' : theme.muted,
        }),
      );
    }
    return parts;
  },
};

const LEGEND_PADDING = 12;

/** A bordered group with a legend cut into its top edge. */
export const fieldset: ComponentDef<FieldsetNode> = {
  container: true,
  resizable: true,
  interactive: true,
  localBounds: (node) => ({ x: 0, y: 0, width: node.width ?? 0, height: node.height ?? 0 }),
  contentOffset: (node, ctx) => ({ x: 0, y: node.legend ? ctx.font.lineHeight(fontSizeOf(node.style, ctx.theme)) : 0 }),
  expand: (node, ctx) => {
    const { theme } = ctx;
    const fontSize = fontSizeOf(node.style, theme);
    const legendHeight = node.legend ? ctx.font.lineHeight(fontSize) : 0;
    const top = legendHeight / 2;
    const outline = { x: 0, y: top, width: node.width ?? 0, height: (node.height ?? 0) - top };
    const hand = handFrameParts('frame-', theme, node, { ...outline, overrides: { fill: undefined } });
    const parts: Part[] = [
      rectPart('box', theme, node, {
        ...outline,
        cornerRadius: theme.radius,
        overrides: hand.length ? { fill: undefined, stroke: 'none' } : { fill: undefined },
      }),
      ...hand,
    ];
    if (node.legend) {
      parts.push(
        rectPart('legend-bg', theme, node, {
          x: LEGEND_PADDING - 4,
          y: 0,
          width: ctx.font.measure(node.legend, fontSize) + 8,
          height: legendHeight,
          overrides: { stroke: 'none', fill: theme.surface, fillStyle: 'solid' },
        }),
        textPart('legend', theme, node, {
          x: LEGEND_PADDING,
          y: 0,
          text: node.legend,
          fontSize,
          color: textColor(node.style, theme.text),
          weight: TITLE_WEIGHT,
        }),
      );
    }
    return parts;
  },
};

/** An invisible vertical stack of fields. */
export const form: ComponentDef<FormNode> = {
  container: true,
  resizable: true,
  interactive: true,
  localBounds: (node) => ({ x: 0, y: 0, width: node.width ?? 0, height: node.height ?? 0 }),
  expand: (node, ctx) => {
    if (!hasOwnFill(node) && !node.strokes) return [];
    const box = { x: 0, y: 0, width: node.width ?? 0, height: node.height ?? 0 };
    const hand = handFrameParts('frame-', ctx.theme, node, box);
    return [
      rectPart('box', ctx.theme, node, {
        ...box,
        cornerRadius: ctx.theme.radius,
        overrides: hand.length ? { stroke: 'none' } : {},
      }),
      ...hand,
    ];
  },
};

/** A strip that lays its children out in a row (or column), with a subtle box. */
export const toolbar: ComponentDef<ToolbarNode> = {
  container: true,
  resizable: true,
  interactive: true,
  localBounds: (node) => ({ x: 0, y: 0, width: node.width ?? 0, height: node.height ?? 0 }),
  expand: (node, ctx) => {
    const box = { x: 0, y: 0, width: node.width ?? 0, height: node.height ?? 0 };
    const overrides = {
      ...(hasOwnFill(node) ? {} : { fill: ctx.theme.surface, fillStyle: 'solid' as const }),
      ...(node.strokes === undefined ? { stroke: ctx.theme.muted } : {}),
    };
    const hand = handFrameParts('frame-', ctx.theme, node, { ...box, overrides });
    return [
      rectPart('box', ctx.theme, node, {
        ...box,
        cornerRadius: ctx.theme.radius,
        overrides: hand.length ? { ...overrides, stroke: 'none' } : overrides,
      }),
      ...hand,
    ];
  },
};
