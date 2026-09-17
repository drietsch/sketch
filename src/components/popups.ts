import type { Bounds, MenuItem, NodeBase, Theme, TypeStyle } from '../core/types.js';
import type { Part, PartStyle, Region, RenderContext } from './types.js';
import { ROW } from './controls.js';
import { centredTextTop, rectPart, textPart } from './common.js';
import { fontSizeOf, resolvePartStyle, textColor } from './style.js';

/** Metrics shared by the popup family. */
export const POPUP_PADDING = 8;
export const SIDE_OFFSET = 6;
export const ARROW = 8;
export const MENU_WIDTH = 180;
export const SEPARATOR_ROW = 9;
export const ICON = 16;
export const DIALOG_WIDTH = 420;
export const DRAWER_WIDTH = 320;
export const TOAST_WIDTH = 320;
export const CLOSE = 18;

/** A raised panel on the overlay layer: a soft shadow under a solid surface box. */
export function panelParts(
  keyPrefix: string,
  theme: Theme,
  node: NodeBase,
  box: Bounds,
  overrides: Partial<PartStyle> = {},
): Part[] {
  const shadow = rectPart(`${keyPrefix}shadow`, theme, undefined, {
    x: box.x + 3,
    y: box.y + 4,
    width: box.width,
    height: box.height,
    cornerRadius: theme.radius,
    overrides: { stroke: 'none', fill: theme.muted, fillStyle: 'solid', opacity: 0.25 },
  });
  const panel = rectPart(`${keyPrefix}panel`, theme, node, {
    x: box.x,
    y: box.y,
    width: box.width,
    height: box.height,
    cornerRadius: theme.radius,
    overrides: { fill: theme.surface, fillStyle: 'solid', ...overrides },
  });
  return [
    { ...shadow, layer: 'overlay' },
    { ...panel, layer: 'overlay' },
  ];
}

/** A small triangle pointing from a popup towards its anchor, drawn on the given side of the box. */
export function arrowPart(
  key: string,
  theme: Theme,
  node: NodeBase,
  box: Bounds,
  side: 'top' | 'bottom' | 'left' | 'right',
  fill: string,
): Part {
  const cx = box.x + box.width / 2;
  const cy = box.y + box.height / 2;
  const a = ARROW / 2;
  let d: string;
  // `side` is where the popup sits relative to its anchor, so the arrow is on the opposite edge.
  if (side === 'top')
    d = `M${cx - a} ${box.y + box.height} L${cx} ${box.y + box.height + a} L${cx + a} ${box.y + box.height} Z`;
  else if (side === 'bottom') d = `M${cx - a} ${box.y} L${cx} ${box.y - a} L${cx + a} ${box.y} Z`;
  else if (side === 'left')
    d = `M${box.x + box.width} ${cy - a} L${box.x + box.width + a} ${cy} L${box.x + box.width} ${cy + a} Z`;
  else d = `M${box.x} ${cy - a} L${box.x - a} ${cy} L${box.x} ${cy + a} Z`;
  return { key, kind: 'path', d, style: resolvePartStyle(theme, node, { fill, fillStyle: 'solid' }), layer: 'overlay' };
}

export interface MenuRow {
  item: MenuItem;
  label: string;
  y: number;
  height: number;
  separator: boolean;
  disabled: boolean;
  /** The row opens a submenu. */
  submenu: boolean;
}

/** Rows of a menu from `y0`, separators shorter than items. */
export function menuRows(items: readonly MenuItem[], y0: number): { rows: MenuRow[]; height: number } {
  let y = y0;
  const rows = items.map((item) => {
    const separator = item === '-';
    const height = separator ? SEPARATOR_ROW : ROW;
    const row: MenuRow = {
      item,
      label: typeof item === 'string' ? item : item.label,
      y,
      height,
      separator,
      disabled: typeof item !== 'string' && !!item.disabled,
      submenu: typeof item !== 'string' && !!item.items?.length,
    };
    y += height;
    return row;
  });
  return { rows, height: y - y0 };
}

/** The intrinsic width of a menu panel: its widest row, within limits. */
export function menuWidth(
  ctx: { font: RenderContext['font'] },
  items: readonly MenuItem[],
  fontSize: number,
  min = MENU_WIDTH,
): number {
  let widest = 0;
  for (const item of items) {
    if (item === '-') continue;
    const label = typeof item === 'string' ? item : item.label;
    const icon = typeof item !== 'string' && item.icon ? ICON + POPUP_PADDING : 0;
    widest = Math.max(widest, ctx.font.measure(label, fontSize) + icon);
  }
  return Math.max(min, Math.ceil(widest + POPUP_PADDING * 2 + 24));
}

/** The parts of a menu's rows (labels, icons, separators, the highlighted row) on the overlay layer. */
export function menuRowParts(
  keyPrefix: string,
  theme: Theme,
  node: NodeBase & { style?: TypeStyle },
  ctx: RenderContext,
  rows: readonly MenuRow[],
  box: { x: number; width: number },
  highlight?: string,
): Part[] {
  const { font } = ctx;
  const fontSize = fontSizeOf(node.style, theme);
  const parts: Part[] = [];
  rows.forEach((row, i) => {
    if (row.separator) {
      parts.push({
        key: `${keyPrefix}${i}.sep`,
        kind: 'line',
        x1: box.x + POPUP_PADDING,
        y1: row.y + row.height / 2,
        x2: box.x + box.width - POPUP_PADDING,
        y2: row.y + row.height / 2,
        style: resolvePartStyle(theme, node, { stroke: theme.muted, fill: undefined }),
        layer: 'overlay',
      });
      return;
    }
    if (highlight !== undefined && row.label === highlight && !row.disabled) {
      parts.push({
        ...rectPart(`${keyPrefix}${i}.highlight`, theme, undefined, {
          x: box.x + 4,
          y: row.y + 2,
          width: box.width - 8,
          height: row.height - 4,
          cornerRadius: Math.max(0, theme.radius - 2),
          overrides: {
            stroke: 'none',
            fill: theme.accent,
            fillStyle: 'hachure',
            hachureGap: 6,
            fillWeight: 0.6,
            opacity: 0.35,
          },
        }),
        layer: 'overlay',
      });
    }
    let x = box.x + POPUP_PADDING + 4;
    const color = row.disabled ? theme.muted : textColor(node.style, theme.text);
    if (typeof row.item !== 'string' && row.item.icon) {
      parts.push({
        key: `${keyPrefix}${i}.icon`,
        kind: 'icon',
        x,
        y: row.y + (row.height - ICON) / 2,
        size: ICON,
        icon: ctx.icons(row.item.icon),
        color,
        style: resolvePartStyle(theme, node),
        layer: 'overlay',
      });
      x += ICON + POPUP_PADDING;
    }
    parts.push({
      ...textPart(`${keyPrefix}${i}.label`, theme, node, {
        x,
        y: row.y + centredTextTop(font, fontSize, row.height),
        text: row.label,
        fontSize,
        color,
      }),
      layer: 'overlay',
    });
    if (row.submenu) {
      parts.push({
        key: `${keyPrefix}${i}.more`,
        kind: 'icon',
        x: box.x + box.width - POPUP_PADDING - ICON,
        y: row.y + (row.height - ICON) / 2,
        size: ICON,
        icon: ctx.icons('chevron-right'),
        color: theme.muted,
        style: resolvePartStyle(theme, node),
        layer: 'overlay',
      });
    }
  });
  return parts;
}

/** One overlay region per selectable row; a disabled row swallows the click. */
export function menuRowRegions(
  rows: readonly MenuRow[],
  box: { x: number; width: number },
  action: (row: MenuRow) => Region['action'],
): Region[] {
  return rows
    .filter((row) => !row.separator)
    .map((row) => {
      const region: Region = {
        key: `option:${row.label}`,
        bounds: { x: box.x, y: row.y, width: box.width, height: row.height },
        layer: 'overlay',
      };
      if (!row.disabled) region.action = action(row);
      return region;
    });
}

/** The labels chosen on the way to `value` in a tree of menu items: the submenu parent(s), outermost first. */
export function pathToItem(items: readonly MenuItem[], value: string): string[] | undefined {
  for (const item of items) {
    if (item === '-') continue;
    const label = typeof item === 'string' ? item : item.label;
    if (label === value) return [];
    if (typeof item !== 'string' && item.items) {
      const below = pathToItem(item.items, value);
      if (below) return [label, ...below];
    }
  }
  return undefined;
}

/** A region that covers the whole panel so clicks on it go nowhere else. */
export function bodyRegion(box: Bounds, key = 'body'): Region {
  return { key, bounds: box, layer: 'overlay' };
}

/** A dimmed sheet over the whole document, drawn as-is (no sketching at the page edge). */
export function backdropPart(
  key: string,
  theme: Theme,
  node: NodeBase,
  ctx: RenderContext,
  origin: { x: number; y: number },
): Part {
  return {
    key,
    kind: 'raw',
    el: {
      tag: 'rect',
      attrs: {
        x: -origin.x,
        y: -origin.y,
        width: ctx.document.width,
        height: ctx.document.height,
        fill: theme.text,
        'fill-opacity': 0.3,
      },
    },
    style: resolvePartStyle(theme, node),
    layer: 'overlay',
  };
}

/** The absolute origin of a node's local space, for parts that must cover the document. */
export function originOf(ctx: RenderContext, id: string, local: Bounds): { x: number; y: number } {
  const b = ctx.bounds(id);
  return { x: b.x - local.x, y: b.y - local.y };
}

/** A small "x" in the top-right corner of a box, with its region. */
export function closeParts(
  keyPrefix: string,
  theme: Theme,
  node: NodeBase,
  ctx: RenderContext,
  box: Bounds,
): { parts: Part[]; region: Region } {
  const x = box.x + box.width - POPUP_PADDING - CLOSE;
  const y = box.y + POPUP_PADDING;
  return {
    parts: [
      {
        key: `${keyPrefix}close`,
        kind: 'icon',
        x,
        y,
        size: CLOSE,
        icon: ctx.icons('x'),
        color: theme.muted,
        style: resolvePartStyle(theme, node),
        layer: 'overlay',
      },
    ],
    region: {
      key: 'close',
      bounds: { x: x - 4, y: y - 4, width: CLOSE + 8, height: CLOSE + 8 },
      action: { open: false },
      layer: 'overlay',
    },
  };
}
