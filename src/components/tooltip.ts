import type { PopoverNode, PreviewCardNode, TooltipNode } from '../core/types.js';
import type { ComponentDef, LayoutContext, Part, Region } from './types.js';
import { ARROW, POPUP_PADDING, SIDE_OFFSET, arrowPart, bodyRegion, panelParts } from './popups.js';
import { centredTextTop, textPart } from './common.js';
import { fontSizeOf, textColor } from './style.js';
import { layoutText, wrapText } from '../text/layout.js';

const TOOLTIP_HEIGHT = 26;
const CARD_WIDTH = 240;
const CARD_PADDING = 12;
const POPOVER_WIDTH = 260;
const POPOVER_PADDING = 12;

const isOpen = (node: { open?: boolean }, ctx: { open?: boolean }) => ctx.open ?? node.open ?? false;

/** A short dark label that appears while its anchor is hovered. */
export const tooltip: ComponentDef<TooltipNode> = {
  capabilities: { open: true, hover: true },
  trigger: 'hover',
  validate: (node) => (node.characters ? undefined : 'characters is required'),
  anchor: (node) => ({ id: node.anchor, side: node.side ?? 'top', gap: SIDE_OFFSET + ARROW / 2 }),
  localBounds: (node, ctx) => ({
    x: 0,
    y: 0,
    width: Math.ceil(ctx.font.measure(node.characters, fontSizeOf(node.style, ctx.theme) - 1) + POPUP_PADDING * 2),
    height: TOOLTIP_HEIGHT,
  }),
  expand: (node, ctx) => {
    if (!isOpen(node, ctx)) return [];
    const { theme, font } = ctx;
    const fontSize = fontSizeOf(node.style, theme) - 1;
    const box = tooltip.localBounds(node, ctx);
    const [, panel] = panelParts('', theme, node, box, { fill: theme.text, stroke: theme.text });
    return [
      panel,
      arrowPart('arrow', theme, node, box, node.side ?? 'top', theme.text),
      {
        ...textPart('label', theme, node, {
          x: POPUP_PADDING,
          y: centredTextTop(font, fontSize, TOOLTIP_HEIGHT),
          text: node.characters,
          fontSize,
          color: textColor(node.style, theme.surface),
        }),
        layer: 'overlay',
      },
    ];
  },
};

function cardHeight(node: PreviewCardNode, ctx: LayoutContext): number {
  const fontSize = fontSizeOf(node.style, ctx.theme);
  const width = (node.width ?? CARD_WIDTH) - CARD_PADDING * 2;
  let h = CARD_PADDING;
  if (node.title) h += ctx.font.lineHeight(fontSize + 1) + 4;
  if (node.description)
    h +=
      layoutText(ctx.font, wrapText(ctx.font, node.description, fontSize - 1, width), fontSize - 1).bounds.height + 4;
  return Math.ceil(h + CARD_PADDING);
}

/** A richer hover card: a title and a wrapped description. */
export const previewCard: ComponentDef<PreviewCardNode> = {
  capabilities: { open: true, hover: true },
  trigger: 'hover',
  anchor: (node) => ({ id: node.anchor, side: node.side ?? 'bottom', gap: SIDE_OFFSET + ARROW / 2 }),
  localBounds: (node, ctx) => ({ x: 0, y: 0, width: node.width ?? CARD_WIDTH, height: cardHeight(node, ctx) }),
  expand: (node, ctx) => {
    if (!isOpen(node, ctx)) return [];
    const { theme, font } = ctx;
    const fontSize = fontSizeOf(node.style, theme);
    const box = previewCard.localBounds(node, ctx);
    const parts: Part[] = [
      ...panelParts('', theme, node, box),
      arrowPart('arrow', theme, node, box, node.side ?? 'bottom', theme.surface),
    ];
    let y = CARD_PADDING;
    if (node.title) {
      parts.push({
        ...textPart('title', theme, node, {
          x: CARD_PADDING,
          y,
          text: node.title,
          fontSize: fontSize + 1,
          color: textColor(node.style, theme.text),
        }),
        layer: 'overlay',
      });
      y += font.lineHeight(fontSize + 1) + 4;
    }
    if (node.description) {
      const text = wrapText(font, node.description, fontSize - 1, box.width - CARD_PADDING * 2);
      parts.push({
        ...textPart('description', theme, node, {
          x: CARD_PADDING,
          y,
          text,
          fontSize: fontSize - 1,
          color: theme.muted,
        }),
        layer: 'overlay',
      });
    }
    return parts;
  },
  regions: (node, ctx): Region[] => (isOpen(node, ctx) ? [bodyRegion(previewCard.localBounds(node, ctx))] : []),
};

/** Chrome above a popover's children: its title and description. */
function popoverHeader(node: PopoverNode, ctx: LayoutContext): number {
  const fontSize = fontSizeOf(node.style, ctx.theme);
  let h = 0;
  if (node.title) h += ctx.font.lineHeight(fontSize + 1) + 4;
  if (node.description) {
    const width = (node.width ?? POPOVER_WIDTH) - POPOVER_PADDING * 2;
    h +=
      layoutText(ctx.font, wrapText(ctx.font, node.description, fontSize - 1, width), fontSize - 1).bounds.height + 6;
  }
  return h;
}

/** A panel opened by a click on its anchor; children are its content. */
export const popover: ComponentDef<PopoverNode> = {
  container: true,
  intrinsicSize: true,
  resizable: true,
  capabilities: { open: true },
  trigger: 'click',
  dismissOnOutside: true,
  layoutDependsOnState: true,
  anchor: (node) => ({ id: node.anchor, side: node.side ?? 'bottom', gap: SIDE_OFFSET + ARROW / 2 }),
  childVisible: (node) => !!node.open,
  localBounds: (node) => ({ x: 0, y: 0, width: node.width ?? POPOVER_WIDTH, height: node.height ?? 0 }),
  contentOffset: (node, ctx) => ({ x: 0, y: popoverHeader(node, ctx) }),
  expand: (node, ctx) => {
    if (!isOpen(node, ctx)) return [];
    const { theme, font } = ctx;
    const fontSize = fontSizeOf(node.style, theme);
    const box = popover.localBounds(node, ctx);
    const parts: Part[] = [
      ...panelParts('', theme, node, box),
      arrowPart('arrow', theme, node, box, node.side ?? 'bottom', theme.surface),
    ];
    let y = node.paddingTop ?? 0;
    if (node.title) {
      parts.push({
        ...textPart('title', theme, node, {
          x: node.paddingLeft ?? 0,
          y,
          text: node.title,
          fontSize: fontSize + 1,
          color: textColor(node.style, theme.text),
        }),
        layer: 'overlay',
      });
      y += font.lineHeight(fontSize + 1) + 4;
    }
    if (node.description) {
      const text = wrapText(font, node.description, fontSize - 1, box.width - POPOVER_PADDING * 2);
      parts.push({
        ...textPart('description', theme, node, {
          x: node.paddingLeft ?? 0,
          y,
          text,
          fontSize: fontSize - 1,
          color: theme.muted,
        }),
        layer: 'overlay',
      });
    }
    return parts;
  },
  regions: (node, ctx): Region[] => (isOpen(node, ctx) ? [bodyRegion(popover.localBounds(node, ctx))] : []),
};
