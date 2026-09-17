import type { Bounds, ContextMenuNode, MenuItem, MenuNode, MenubarNode, NavigationMenuNode } from '../core/types.js';
import type { ComponentDef, LayoutContext, Part, Region } from './types.js';
import { BUTTON_HEIGHT } from './button.js';
import {
  ICON,
  POPUP_PADDING,
  SIDE_OFFSET,
  bodyRegion,
  menuRowParts,
  menuRowRegions,
  menuRows,
  menuWidth,
  panelParts,
} from './popups.js';
import { centredTextTop, rectPart, textPart } from './common.js';
import { fontSizeOf, hasOwnFill, resolvePartStyle, textColor } from './style.js';

const isOpen = (node: { open?: boolean }, ctx: { open?: boolean }) => ctx.open ?? node.open ?? false;
const PADDING_X = 14;
const CHEVRON = 16;
const BAR_HEIGHT = 36;
const BAR_PADDING = 12;

function validateItems(items: unknown): string | undefined {
  if (!Array.isArray(items) || items.length === 0) return 'items must be a non-empty array';
  for (const item of items as MenuItem[]) {
    if (typeof item === 'string') {
      if (!item) return 'an item label cannot be empty';
    } else if (!item || typeof item.label !== 'string' || !item.label) return 'every item needs a label';
  }
  return undefined;
}

/** The dropdown panel (parts) and its regions below `y0`, node-local. */
function dropdown(
  keyPrefix: string,
  node: MenuNode | ContextMenuNode | MenubarNode | NavigationMenuNode,
  ctx: Parameters<ComponentDef<MenuNode>['expand']>[1],
  items: readonly MenuItem[],
  box: { x: number; y: number; width: number },
  highlight?: string,
): { parts: Part[]; regions: Region[]; bounds: Bounds } {
  const { rows, height } = menuRows(items, box.y + POPUP_PADDING / 2);
  const bounds = { x: box.x, y: box.y, width: box.width, height: height + POPUP_PADDING };
  const parts = [
    ...panelParts(keyPrefix, ctx.theme, node, bounds),
    ...menuRowParts(keyPrefix, ctx.theme, node, ctx, rows, box, highlight),
  ];
  const regions = [
    bodyRegion(bounds, `${keyPrefix}body`),
    ...menuRowRegions(rows, box, (label) => ({ value: label, open: false })),
  ];
  return { parts, regions, bounds };
}

function menuTriggerWidth(node: MenuNode, ctx: LayoutContext): number {
  const fontSize = fontSizeOf(node.style, ctx.theme);
  const label = node.characters ? ctx.font.measure(node.characters, fontSize) + 8 : 0;
  const icon = node.icon ? ICON + (node.characters ? 8 : 0) : 0;
  return Math.ceil(PADDING_X * 2 + icon + label + CHEVRON);
}

/** A button that drops a list of actions; the last chosen one is its `value`. */
export const menu: ComponentDef<MenuNode> = {
  focusable: true,
  interactive: true,
  capabilities: { open: true, choose: true },
  dismissOnOutside: true,
  validate: (node) => validateItems(node.items),
  localBounds: (node, ctx) => ({ x: 0, y: 0, width: node.width ?? menuTriggerWidth(node, ctx), height: BUTTON_HEIGHT }),
  expand: (node, ctx) => {
    const { theme, font, state } = ctx;
    const fontSize = fontSizeOf(node.style, theme);
    const width = node.width ?? menuTriggerWidth(node, ctx);
    const open = isOpen(node, ctx);
    const overrides: Parameters<typeof rectPart>[3]['overrides'] = {};
    if (!hasOwnFill(node)) overrides.fill = theme.surface;
    if (node.sketch?.fillStyle === undefined) overrides.fillStyle = 'solid';
    if ((open || state.pressed) && node.strokes === undefined) overrides.stroke = theme.accent;
    const parts: Part[] = [
      rectPart('box', theme, node, { x: 0, y: 0, width, height: BUTTON_HEIGHT, cornerRadius: theme.radius, overrides }),
    ];
    let x = PADDING_X;
    const color = textColor(node.style, theme.text);
    if (node.icon) {
      parts.push({
        key: 'icon',
        kind: 'icon',
        x,
        y: (BUTTON_HEIGHT - ICON) / 2,
        size: ICON,
        icon: ctx.icons(node.icon),
        color,
        style: resolvePartStyle(theme, node),
      });
      x += ICON + (node.characters ? 8 : 0);
    }
    if (node.characters) {
      parts.push(
        textPart('label', theme, node, {
          x,
          y: centredTextTop(font, fontSize, BUTTON_HEIGHT),
          text: node.characters,
          fontSize,
          color,
        }),
      );
    }
    parts.push({
      key: 'chevron',
      kind: 'icon',
      x: width - PADDING_X - CHEVRON + 4,
      y: (BUTTON_HEIGHT - CHEVRON) / 2,
      size: CHEVRON,
      icon: ctx.icons(open ? 'chevron-up' : 'chevron-down'),
      color: theme.muted,
      style: resolvePartStyle(theme, node),
    });
    if (open) {
      const fontSizeRows = fontSizeOf(node.style, theme);
      const w = Math.max(width, menuWidth(ctx, node.items, fontSizeRows));
      parts.push(...dropdown('menu.', node, ctx, node.items, { x: 0, y: BUTTON_HEIGHT + SIDE_OFFSET, width: w }).parts);
    }
    return parts;
  },
  regions: (node, ctx): Region[] => {
    const open = isOpen(node, ctx);
    const width = node.width ?? menuTriggerWidth(node, ctx);
    const out: Region[] = [
      { key: 'trigger', bounds: { x: 0, y: 0, width, height: BUTTON_HEIGHT }, action: { open: !open } },
    ];
    if (open) {
      const w = Math.max(width, menuWidth(ctx, node.items, fontSizeOf(node.style, ctx.theme)));
      out.push(...dropdown('menu.', node, ctx, node.items, { x: 0, y: BUTTON_HEIGHT + SIDE_OFFSET, width: w }).regions);
    }
    return out;
  },
};

/** A menu that opens over its anchor when the anchor is clicked. */
export const contextMenu: ComponentDef<ContextMenuNode> = {
  capabilities: { open: true, choose: true },
  trigger: 'click',
  dismissOnOutside: true,
  validate: (node) => validateItems(node.items),
  anchor: (node) => ({ id: node.anchor, side: 'center' }),
  localBounds: (node, ctx) => {
    const width = node.width ?? menuWidth(ctx, node.items, fontSizeOf(node.style, ctx.theme));
    return { x: 0, y: 0, width, height: menuRows(node.items, 0).height + POPUP_PADDING };
  },
  expand: (node, ctx) => {
    if (!isOpen(node, ctx)) return [];
    const width = node.width ?? menuWidth(ctx, node.items, fontSizeOf(node.style, ctx.theme));
    return dropdown('', node, ctx, node.items, { x: 0, y: 0, width }).parts;
  },
  regions: (node, ctx): Region[] => {
    if (!isOpen(node, ctx)) return [];
    const width = node.width ?? menuWidth(ctx, node.items, fontSizeOf(node.style, ctx.theme));
    return dropdown('', node, ctx, node.items, { x: 0, y: 0, width }).regions;
  },
};

interface BarEntry {
  label: string;
  items?: MenuItem[];
}

/** Boxes of a bar's top-level labels, left to right. */
function barBoxes(entries: readonly BarEntry[], ctx: LayoutContext, fontSize: number, withChevron: boolean): Bounds[] {
  let x = 0;
  return entries.map((e) => {
    const chevron = withChevron && e.items?.length ? CHEVRON + 4 : 0;
    const width = Math.ceil(BAR_PADDING * 2 + ctx.font.measure(e.label, fontSize) + chevron);
    const box = { x, y: 0, width, height: BAR_HEIGHT };
    x += width;
    return box;
  });
}

/** MENUBAR and NAVIGATION_MENU share one shape: a row of labels, one of which may be open over a dropdown. */
const entries = (node: MenubarNode | NavigationMenuNode): BarEntry[] =>
  node.type === 'MENUBAR' ? node.menus : node.items;

function bar<N extends MenubarNode | NavigationMenuNode>(kind: 'menubar' | 'navigation'): ComponentDef<N> {
  const boxed = kind === 'menubar';
  const chevrons = kind === 'navigation';
  const active = (node: N, ctx: { value?: unknown; open?: boolean }): string | undefined => {
    if (!isOpen(node, ctx)) return undefined;
    const value = typeof ctx.value === 'string' ? ctx.value : node.value;
    const list = entries(node);
    return list.find((e) => e.label === value)?.label ?? list.find((e) => e.items?.length)?.label;
  };
  const size = (node: N, ctx: LayoutContext): Bounds => {
    const boxes = barBoxes(entries(node), ctx, fontSizeOf(node.style, ctx.theme), chevrons);
    const last = boxes.at(-1);
    return { x: 0, y: 0, width: last ? last.x + last.width : 0, height: BAR_HEIGHT };
  };
  return {
    interactive: true,
    focusable: true,
    capabilities: { open: true, choose: true },
    dismissOnOutside: true,
    validate: (node) => {
      const list = entries(node);
      if (!Array.isArray(list) || list.length === 0)
        return `${node.type === 'MENUBAR' ? 'menus' : 'items'} must be a non-empty array`;
      for (const e of list) {
        if (!e || typeof e.label !== 'string' || !e.label) return 'every entry needs a label';
        if (e.items !== undefined) {
          const problem = validateItems(e.items);
          if (problem) return problem;
        } else if (node.type === 'MENUBAR') return 'every menu needs items';
      }
      return undefined;
    },
    localBounds: size,
    expand: (node, ctx) => {
      const { theme, font } = ctx;
      const fontSize = fontSizeOf(node.style, theme);
      const list = entries(node);
      const boxes = barBoxes(list, ctx, fontSize, chevrons);
      const box = size(node, ctx);
      const current = active(node, ctx);
      const parts: Part[] = [];
      if (boxed) {
        parts.push(
          rectPart('bar', theme, node, {
            x: 0,
            y: 0,
            width: box.width,
            height: BAR_HEIGHT,
            cornerRadius: theme.radius,
            overrides: {
              ...(hasOwnFill(node) ? {} : { fill: theme.surface, fillStyle: 'solid' }),
              ...(node.strokes === undefined ? { stroke: theme.muted } : {}),
            },
          }),
        );
      }
      list.forEach((e, i) => {
        const b = boxes[i];
        const on = e.label === current;
        if (on) {
          parts.push(
            rectPart(`${i}.active`, theme, undefined, {
              x: b.x + 3,
              y: 4,
              width: b.width - 6,
              height: BAR_HEIGHT - 8,
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
          );
        }
        parts.push(
          textPart(`${i}.label`, theme, node, {
            x: b.x + BAR_PADDING,
            y: centredTextTop(font, fontSize, BAR_HEIGHT),
            text: e.label,
            fontSize,
            color: on ? theme.accent : textColor(node.style, theme.text),
          }),
        );
        if (chevrons && e.items?.length) {
          parts.push({
            key: `${i}.chevron`,
            kind: 'icon',
            x: b.x + b.width - BAR_PADDING - CHEVRON + 2,
            y: (BAR_HEIGHT - CHEVRON) / 2,
            size: CHEVRON,
            icon: ctx.icons(on ? 'chevron-up' : 'chevron-down'),
            color: theme.muted,
            style: resolvePartStyle(theme, node),
          });
        }
        if (on && e.items?.length) {
          const w = menuWidth(ctx, e.items, fontSize);
          parts.push(
            ...dropdown(`${i}.`, node, ctx, e.items, { x: b.x, y: BAR_HEIGHT + (boxed ? 2 : SIDE_OFFSET), width: w })
              .parts,
          );
        }
      });
      return parts;
    },
    regions: (node, ctx): Region[] => {
      const list = entries(node);
      const boxes = barBoxes(list, ctx, fontSizeOf(node.style, ctx.theme), chevrons);
      const current = active(node, ctx);
      const out: Region[] = [];
      list.forEach((e, i) => {
        const on = e.label === current;
        const hasItems = !!e.items?.length;
        // A plain link: choosing it records it; a menu: opens (or closes when already open).
        const action = !hasItems
          ? { value: e.label, open: false }
          : on
            ? { open: false }
            : { value: e.label, open: true };
        out.push({ key: `option:${e.label}`, bounds: boxes[i], action });
        if (on && hasItems) {
          const w = menuWidth(ctx, e.items!, fontSizeOf(node.style, ctx.theme));
          out.push(
            ...dropdown(`${i}.`, node, ctx, e.items!, {
              x: boxes[i].x,
              y: BAR_HEIGHT + (boxed ? 2 : SIDE_OFFSET),
              width: w,
            }).regions,
          );
        }
      });
      return out;
    },
  } as ComponentDef<N>;
}

export const menubar = bar<MenubarNode>('menubar');
export const navigationMenu = bar<NavigationMenuNode>('navigation');
