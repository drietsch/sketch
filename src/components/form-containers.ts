import type { FieldNode, FieldsetNode, FormNode, ToolbarNode } from '../core/types.js';
import type { ComponentDef, Part } from './types.js';
import { FIELD_GAP } from './controls.js';
import { rectPart, textPart } from './common.js';
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
    const parts: Part[] = [
      rectPart('box', theme, node, {
        x: 0,
        y: top,
        width: node.width ?? 0,
        height: (node.height ?? 0) - top,
        cornerRadius: theme.radius,
        overrides: { fill: undefined },
      }),
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
  expand: (node, ctx) =>
    hasOwnFill(node) || node.strokes
      ? [
          rectPart('box', ctx.theme, node, {
            x: 0,
            y: 0,
            width: node.width ?? 0,
            height: node.height ?? 0,
            cornerRadius: ctx.theme.radius,
            overrides: {},
          }),
        ]
      : [],
};

/** A strip that lays its children out in a row (or column), with a subtle box. */
export const toolbar: ComponentDef<ToolbarNode> = {
  container: true,
  resizable: true,
  interactive: true,
  localBounds: (node) => ({ x: 0, y: 0, width: node.width ?? 0, height: node.height ?? 0 }),
  expand: (node, ctx) => [
    rectPart('box', ctx.theme, node, {
      x: 0,
      y: 0,
      width: node.width ?? 0,
      height: node.height ?? 0,
      cornerRadius: ctx.theme.radius,
      overrides: {
        ...(hasOwnFill(node) ? {} : { fill: ctx.theme.surface, fillStyle: 'solid' }),
        ...(node.strokes === undefined ? { stroke: ctx.theme.muted } : {}),
      },
    }),
  ],
};
