import type { AccordionItem, AccordionNode, CollapsibleNode, TabsNode } from '../core/types.js';
import type { ComponentDef, Part, Region } from './types.js';
import { centredTextTop, rectPart, textPart } from './common.js';
import { fontSizeOf, hasOwnFill, resolvePartStyle, textColor } from './style.js';
import { layoutText } from '../text/layout.js';

const HEADER = 36;
const PADDING_X = 12;
const CHEVRON = 16;

/** A header that shows or hides its children. */
export const collapsible: ComponentDef<CollapsibleNode> = {
  container: true,
  resizable: true,
  interactive: true,
  focusable: true,
  capabilities: { open: true },
  layoutDependsOnState: true,
  validate: (node) => (node.characters ? undefined : 'characters (the header text) is required'),
  localBounds: (node) => ({ x: 0, y: 0, width: node.width ?? 0, height: node.height ?? HEADER }),
  contentOffset: () => ({ x: 0, y: HEADER }),
  childVisible: (node) => !!node.open,
  expand: (node, ctx) => {
    const { theme, font } = ctx;
    const open = ctx.open ?? node.open ?? false;
    const fontSize = fontSizeOf(node.style, theme);
    const width = node.width ?? 0;
    const parts: Part[] = [
      rectPart('header', theme, node, {
        x: 0,
        y: 0,
        width,
        height: HEADER,
        cornerRadius: theme.radius,
        overrides: hasOwnFill(node) ? {} : { fill: theme.surface, fillStyle: 'solid' },
      }),
      {
        key: 'chevron',
        kind: 'icon',
        x: PADDING_X,
        y: (HEADER - CHEVRON) / 2,
        size: CHEVRON,
        icon: ctx.icons(open ? 'chevron-down' : 'chevron-right'),
        color: theme.muted,
        style: resolvePartStyle(theme, node),
      },
      textPart('title', theme, node, {
        x: PADDING_X + CHEVRON + 8,
        y: centredTextTop(font, fontSize, HEADER),
        text: node.characters,
        fontSize,
        color: textColor(node.style, theme.text),
      }),
    ];
    return parts;
  },
  regions: (node, ctx): Region[] => [
    {
      key: 'header',
      bounds: { x: 0, y: 0, width: node.width ?? 0, height: HEADER },
      action: { open: !(ctx.open ?? node.open ?? false) },
    },
  ],
};

function itemsOf(node: AccordionNode): AccordionItem[] {
  return node.items.map((i) => (typeof i === 'string' ? { label: i } : i));
}

function openSet(node: AccordionNode, live: string | number | string[] | undefined): Set<string> {
  const v = live ?? node.value;
  return new Set(Array.isArray(v) ? v : typeof v === 'string' ? [v] : []);
}

/** Stacked headers, each revealing its body text while open. */
export const accordion: ComponentDef<AccordionNode> = {
  interactive: true,
  focusable: true,
  resizable: true,
  capabilities: { choose: true, open: true },
  layoutDependsOnState: true,
  validate: (node) => {
    if (!Array.isArray(node.items) || node.items.length === 0) return 'items must be a non-empty array';
    const labels = itemsOf(node).map((i) => i.label);
    if (labels.some((l) => !l)) return 'every item needs a label';
    const v = node.value;
    const list = Array.isArray(v) ? v : typeof v === 'string' ? [v] : [];
    if (!node.multiple && list.length > 1) return 'value must be a single item unless multiple';
    if (list.some((l) => !labels.includes(l))) return `value must be one of ${labels.join(', ')}`;
    return undefined;
  },
  localBounds: (node, ctx) => ({ x: 0, y: 0, width: node.width, height: accordionRows(node, ctx).total }),
  expand: (node, ctx) => {
    const { theme, font } = ctx;
    const fontSize = fontSizeOf(node.style, theme);
    const open = openSet(node, ctx.value);
    const parts: Part[] = [];
    const rows = accordionRows(node, ctx);
    rows.rows.forEach((row, i) => {
      const item = row.item;
      const isOpen = open.has(item.label);
      parts.push(
        rectPart(`${i}.header`, theme, node, {
          x: 0,
          y: row.y,
          width: node.width,
          height: HEADER,
          overrides: hasOwnFill(node) ? {} : { fill: theme.surface, fillStyle: 'solid' },
        }),
        {
          key: `${i}.chevron`,
          kind: 'icon',
          x: node.width - PADDING_X - CHEVRON,
          y: row.y + (HEADER - CHEVRON) / 2,
          size: CHEVRON,
          icon: ctx.icons(isOpen ? 'chevron-up' : 'chevron-down'),
          color: theme.muted,
          style: resolvePartStyle(theme, node),
        },
        textPart(`${i}.label`, theme, node, {
          x: PADDING_X,
          y: row.y + centredTextTop(font, fontSize, HEADER),
          text: item.label,
          fontSize,
          color: textColor(node.style, theme.text),
        }),
      );
      if (isOpen && item.characters) {
        parts.push(
          textPart(`${i}.body`, theme, node, {
            x: PADDING_X,
            y: row.y + HEADER + 6,
            text: item.characters,
            fontSize,
            color: textColor(node.style, theme.muted),
          }),
        );
      }
    });
    return parts;
  },
  regions: (node, ctx): Region[] => {
    const open = openSet(node, ctx.value);
    return accordionRows(node, ctx).rows.map((row) => {
      const label = row.item.label;
      let next: string[];
      if (open.has(label)) next = [...open].filter((l) => l !== label);
      else next = node.multiple ? [...open, label] : [label];
      // A single-select accordion stores one label; "none open" is an empty list either way.
      const value = node.multiple || next.length === 0 ? next : next[0];
      return {
        key: `option:${label}`,
        bounds: { x: 0, y: row.y, width: node.width, height: HEADER },
        action: { value },
      };
    });
  },
};

function accordionRows(node: AccordionNode, ctx: Parameters<ComponentDef<AccordionNode>['localBounds']>[1]) {
  const fontSize = fontSizeOf(node.style, ctx.theme);
  const open = openSet(node, undefined);
  const live = (ctx as { value?: string | number | string[] }).value;
  const set = live === undefined ? open : openSet(node, live);
  let y = 0;
  const rows = itemsOf(node).map((item) => {
    const row = { item, y };
    y += HEADER;
    if (set.has(item.label) && item.characters) {
      y += 6 + layoutText(ctx.font, item.characters, fontSize).bounds.height + 10;
    }
    return row;
  });
  return { rows, total: y };
}

const TAB_PADDING = 14;
const STRIP = 40;

/** A strip of tabs above the panel of the active one; the child at the active index is shown. */
export const tabs: ComponentDef<TabsNode> = {
  container: true,
  resizable: true,
  interactive: true,
  focusable: true,
  capabilities: { choose: true },
  layoutDependsOnState: true,
  validate: (node) => {
    if (!Array.isArray(node.tabs) || node.tabs.length === 0 || node.tabs.some((t) => typeof t !== 'string' || !t))
      return 'tabs must be a non-empty array of strings';
    if (node.value !== undefined && !node.tabs.includes(node.value))
      return `value must be one of ${node.tabs.join(', ')}`;
    return undefined;
  },
  localBounds: (node) => ({ x: 0, y: 0, width: node.width ?? 0, height: node.height ?? STRIP }),
  contentOffset: () => ({ x: 0, y: STRIP }),
  childVisible: (node, _ctx, index) => index === node.tabs.indexOf(node.value ?? node.tabs[0]),
  expand: (node, ctx) => {
    const { theme, font } = ctx;
    const active = (typeof ctx.value === 'string' ? ctx.value : node.value) ?? node.tabs[0];
    const fontSize = fontSizeOf(node.style, theme);
    const width = node.width ?? 0;
    const parts: Part[] = [
      {
        key: 'baseline',
        kind: 'line',
        x1: 0,
        y1: STRIP - 1,
        x2: width,
        y2: STRIP - 1,
        style: resolvePartStyle(theme, node, { stroke: theme.muted, fill: undefined }),
      },
    ];
    tabBoxes(node, ctx).forEach((box, i) => {
      const tab = node.tabs[i];
      const on = tab === active;
      parts.push(
        textPart(`${i}.label`, theme, node, {
          x: box.x + TAB_PADDING,
          y: centredTextTop(font, fontSize, STRIP),
          text: tab,
          fontSize,
          color: on ? theme.accent : textColor(node.style, theme.text),
        }),
      );
      if (on) {
        parts.push({
          key: `${i}.indicator`,
          kind: 'line',
          x1: box.x,
          y1: STRIP - 1,
          x2: box.x + box.width,
          y2: STRIP - 1,
          style: resolvePartStyle(theme, node, { stroke: theme.accent, strokeWeight: 2.5, fill: undefined }),
        });
      }
    });
    return parts;
  },
  regions: (node, ctx): Region[] =>
    tabBoxes(node, ctx).map((box, i) => ({
      key: `option:${node.tabs[i]}`,
      bounds: box,
      action: { value: node.tabs[i] },
    })),
};

function tabBoxes(node: TabsNode, ctx: Parameters<ComponentDef<TabsNode>['localBounds']>[1]) {
  const fontSize = fontSizeOf(node.style, ctx.theme);
  let x = 0;
  return node.tabs.map((tab) => {
    const width = Math.ceil(TAB_PADDING * 2 + ctx.font.measure(tab, fontSize));
    const box = { x, y: 0, width, height: STRIP };
    x += width;
    return box;
  });
}
