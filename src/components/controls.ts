import type { Bounds, NodeBase, Orientation, Theme, TypeStyle } from '../core/types.js';
import type { StrokeFont } from '../text/font.js';
import type { Part, Region, RenderContext } from './types.js';
import { centredTextTop, rectPart, textPart } from './common.js';
import { fontSizeOf, resolvePartStyle, textColor } from './style.js';

/** Metrics shared by the control family, so it reads as one set. */
export const CONTROL = 18;
export const SWITCH_WIDTH = 36;
export const SWITCH_HEIGHT = 20;
export const THUMB = 14;
export const TRACK = 6;
export const LABEL_GAP = 8;
export const ROW = 28;
export const FIELD_GAP = 6;
export const GROUP_GAP = 10;

/** Width of a control plus its label. */
export function controlWidth(font: StrokeFont, fontSize: number, control: number, label?: string): number {
  return label ? control + LABEL_GAP + font.measure(label, fontSize) : control;
}

/** The label part to the right of a control whose top is at `y`, vertically centred on its height. */
export function labelPart(
  key: string,
  theme: Theme,
  font: StrokeFont,
  node: NodeBase & { style?: TypeStyle },
  text: string,
  x: number,
  y: number,
  controlHeight: number,
  color = textColor(node.style, theme.text),
): Part {
  const fontSize = fontSizeOf(node.style, theme);
  return textPart(key, theme, node, { x, y: y + centredTextTop(font, fontSize, controlHeight), text, fontSize, color });
}

/** A checked box: accent solid fill with a surface-coloured check (or dash). */
export function checkBoxParts(
  keyPrefix: string,
  theme: Theme,
  node: NodeBase,
  ctx: RenderContext,
  x: number,
  y: number,
  checked: boolean,
  indeterminate = false,
  round = false,
): Part[] {
  const size = CONTROL;
  const box: Part = round
    ? {
        key: `${keyPrefix}box`,
        kind: 'ellipse',
        x,
        y,
        width: size,
        height: size,
        style: resolvePartStyle(
          theme,
          node,
          checked
            ? { fill: theme.accent, fillStyle: 'solid', stroke: theme.accent }
            : { fill: theme.surface, fillStyle: 'solid' },
        ),
      }
    : rectPart(`${keyPrefix}box`, theme, node, {
        x,
        y,
        width: size,
        height: size,
        cornerRadius: 4,
        overrides: checked
          ? { fill: theme.accent, fillStyle: 'solid', stroke: theme.accent }
          : { fill: theme.surface, fillStyle: 'solid' },
      });
  const parts: Part[] = [box];
  if (round && checked) {
    const dot = 8;
    parts.push({
      key: `${keyPrefix}dot`,
      kind: 'ellipse',
      x: x + (size - dot) / 2,
      y: y + (size - dot) / 2,
      width: dot,
      height: dot,
      style: resolvePartStyle(theme, node, { fill: theme.surface, fillStyle: 'solid', stroke: 'none' }),
    });
  } else if (checked && indeterminate) {
    parts.push({
      key: `${keyPrefix}dash`,
      kind: 'line',
      x1: x + 4,
      y1: y + size / 2,
      x2: x + size - 4,
      y2: y + size / 2,
      style: resolvePartStyle(theme, node, { stroke: theme.surface, strokeWeight: 2 }),
    });
  } else if (checked) {
    parts.push({
      key: `${keyPrefix}mark`,
      kind: 'icon',
      x: x + 2,
      y: y + 2,
      size: size - 4,
      icon: ctx.icons('check'),
      color: theme.surface,
      style: resolvePartStyle(theme, node),
    });
  }
  return parts;
}

/** Lays out a group's options in rows or a row, returning each option's local box. */
export function optionBoxes(
  options: readonly string[],
  orientation: Orientation,
  itemHeight: number,
  itemWidth: (option: string) => number,
): Bounds[] {
  let x = 0;
  let y = 0;
  return options.map((option) => {
    const width = itemWidth(option);
    const box = { x, y, width, height: itemHeight };
    if (orientation === 'horizontal') x += width + GROUP_GAP * 2;
    else y += itemHeight + GROUP_GAP;
    return box;
  });
}

/** Regions for a list of option boxes, each choosing its option. */
export function optionRegions(
  options: readonly string[],
  boxes: readonly Bounds[],
  action: (option: string) => Region['action'],
): Region[] {
  return options.map((option, i) => ({ key: `option:${option}`, bounds: boxes[i], action: action(option) }));
}

/** The overall box of a set of local boxes. */
export function union(boxes: readonly Bounds[], fallback: Bounds = { x: 0, y: 0, width: 0, height: 0 }): Bounds {
  if (boxes.length === 0) return fallback;
  const minX = Math.min(...boxes.map((b) => b.x));
  const minY = Math.min(...boxes.map((b) => b.y));
  const maxX = Math.max(...boxes.map((b) => b.x + b.width));
  const maxY = Math.max(...boxes.map((b) => b.y + b.height));
  return { x: minX, y: minY, width: maxX - minX, height: maxY - minY };
}

/** Is the option selected in a single- or multi-valued group? */
export function selected(value: string | string[] | number | undefined, option: string): boolean {
  return Array.isArray(value) ? value.includes(option) : value === option;
}

/** Validation shared by option groups. */
export function validateOptions(options: unknown, value: unknown, multiple: boolean): string | undefined {
  if (!Array.isArray(options) || options.length === 0 || !options.every((o) => typeof o === 'string' && o.length > 0)) {
    return 'options must be a non-empty array of strings';
  }
  if (value === undefined) return undefined;
  if (multiple) {
    if (!Array.isArray(value) || !value.every((v) => options.includes(v))) return 'value must be an array of options';
  } else if (typeof value !== 'string' || !options.includes(value)) {
    return `value must be one of ${options.join(', ')}`;
  }
  return undefined;
}
