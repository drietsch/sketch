import type { AlertDialogNode, Bounds, DialogNode, DrawerNode, ToastNode, ToastVariant } from '../core/types.js';
import type { ComponentDef, LayoutContext, Part, Region, RenderContext } from './types.js';
import {
  DIALOG_WIDTH,
  DRAWER_WIDTH,
  ICON,
  TOAST_WIDTH,
  backdropPart,
  bodyRegion,
  closeParts,
  originOf,
  panelParts,
} from './popups.js';
import { textPart, TITLE_WEIGHT } from './common.js';
import { fontSizeOf, resolvePartStyle, textColor } from './style.js';
import { layoutText, wrapText } from '../text/layout.js';

const isOpen = (node: { open?: boolean }, ctx: { open?: boolean }) => ctx.open ?? node.open ?? false;
const TITLE_GAP = 6;
const TOAST_PADDING = 12;
const TOAST_STRIDE = 76;
const DRAWER_HEIGHT = 280;

type Modal = DialogNode | AlertDialogNode | DrawerNode;

/** Height of a modal's title and description block, which its children sit below. */
function header(node: Modal, ctx: LayoutContext, width: number): number {
  const fontSize = fontSizeOf(node.style, ctx.theme);
  let h = 0;
  if (node.title) h += ctx.font.lineHeight(fontSize + 3) + TITLE_GAP;
  const description = 'description' in node ? node.description : undefined;
  if (description) {
    const inner = width - (node.paddingLeft ?? 0) - (node.paddingRight ?? 0);
    h += layoutText(ctx.font, wrapText(ctx.font, description, fontSize, inner), fontSize).bounds.height + TITLE_GAP + 4;
  }
  return h;
}

/** Title and description parts inside the padding, then the close mark when the modal can be dismissed. */
function headerParts(
  node: Modal,
  ctx: RenderContext,
  box: Bounds,
  closable: boolean,
): { parts: Part[]; regions: Region[] } {
  const { theme, font } = ctx;
  const fontSize = fontSizeOf(node.style, theme);
  const parts: Part[] = [];
  const regions: Region[] = [];
  const left = box.x + (node.paddingLeft ?? 0);
  let y = box.y + (node.paddingTop ?? 0);
  const inner = box.width - (node.paddingLeft ?? 0) - (node.paddingRight ?? 0);
  if (node.title) {
    parts.push({
      ...textPart('title', theme, node, {
        x: left,
        y,
        text: node.title,
        fontSize: fontSize + 3,
        color: textColor(node.style, theme.text),
        weight: TITLE_WEIGHT,
      }),
      layer: 'overlay',
    });
    y += font.lineHeight(fontSize + 3) + TITLE_GAP;
  }
  const description = 'description' in node ? node.description : undefined;
  if (description) {
    const text = wrapText(font, description, fontSize, inner - (closable ? 0 : 0));
    parts.push({
      ...textPart('description', theme, node, { x: left, y, text, fontSize, color: theme.muted }),
      layer: 'overlay',
    });
  }
  if (closable) {
    const close = closeParts('', theme, node, ctx, box);
    parts.push(...close.parts);
    regions.push(close.region);
  }
  return { parts, regions };
}

const box = (node: DialogNode | AlertDialogNode): Bounds => ({
  x: 0,
  y: 0,
  width: node.width ?? DIALOG_WIDTH,
  height: node.height ?? 0,
});

function modal<N extends DialogNode | AlertDialogNode>(dismissible: boolean): ComponentDef<N> {
  return {
    container: true,
    intrinsicSize: true,
    resizable: true,
    capabilities: { open: true },
    layoutDependsOnState: true,
    validate: (node) => (node.title ? undefined : 'title is required'),
    anchor: () => ({ side: 'center' }),
    childVisible: (node) => !!node.open,
    localBounds: box,
    contentOffset: (node, ctx) => ({ x: 0, y: header(node, ctx, box(node).width) }),
    expand: (node, ctx) => {
      if (!isOpen(node, ctx)) return [];
      const b = box(node);
      const origin = originOf(ctx, node.id, b);
      const head = headerParts(node, ctx, b, dismissible);
      return [
        backdropPart('backdrop', ctx.theme, node, ctx, origin),
        ...panelParts('', ctx.theme, node, b, {}, true),
        ...head.parts,
      ];
    },
    regions: (node, ctx): Region[] => {
      if (!isOpen(node, ctx)) return [];
      const b = box(node);
      const origin = originOf(ctx, node.id, b);
      const backdrop: Region = {
        key: 'backdrop',
        bounds: { x: -origin.x, y: -origin.y, width: ctx.document.width, height: ctx.document.height },
        layer: 'overlay',
      };
      if (dismissible) backdrop.action = { open: false };
      return [backdrop, bodyRegion(b), ...headerParts(node, ctx, b, dismissible).regions];
    },
  } as ComponentDef<N>;
}

/** A modal panel over a dimmed page; a click on the backdrop or the close mark dismisses it. */
export const dialog = modal<DialogNode>(true);
/** A modal that only its own buttons can dismiss. */
export const alertDialog = modal<AlertDialogNode>(false);

function drawerBox(node: DrawerNode, ctx: LayoutContext): Bounds {
  const side = node.side ?? 'right';
  const vertical = side === 'left' || side === 'right';
  return {
    x: 0,
    y: 0,
    width: vertical ? (node.width ?? DRAWER_WIDTH) : ctx.document.width,
    height: vertical ? ctx.document.height : (node.height ?? DRAWER_HEIGHT),
  };
}

/** A panel sliding in from a page edge, over a dimmed page. */
export const drawer: ComponentDef<DrawerNode> = {
  container: true,
  intrinsicSize: true,
  resizable: true,
  capabilities: { open: true },
  layoutDependsOnState: true,
  anchor: (node) => ({ side: node.side ?? 'right' }),
  childVisible: (node) => !!node.open,
  localBounds: drawerBox,
  contentOffset: (node, ctx) => ({ x: 0, y: header(node, ctx, drawerBox(node, ctx).width) }),
  expand: (node, ctx) => {
    if (!isOpen(node, ctx)) return [];
    const b = drawerBox(node, ctx);
    const origin = originOf(ctx, node.id, b);
    const [shadow, panel, ...frame] = panelParts('', ctx.theme, node, b, {}, true);
    const square = { ...panel, cornerRadius: 0 } as Part;
    return [
      backdropPart('backdrop', ctx.theme, node, ctx, origin),
      shadow,
      square,
      ...frame,
      ...headerParts(node, ctx, b, true).parts,
    ];
  },
  regions: (node, ctx): Region[] => {
    if (!isOpen(node, ctx)) return [];
    const b = drawerBox(node, ctx);
    const origin = originOf(ctx, node.id, b);
    return [
      {
        key: 'backdrop',
        bounds: { x: -origin.x, y: -origin.y, width: ctx.document.width, height: ctx.document.height },
        action: { open: false },
        layer: 'overlay',
      },
      bodyRegion(b),
      ...headerParts(node, ctx, b, true).regions,
    ];
  },
};

const VARIANTS: Record<ToastVariant, { icon: string; color: string }> = {
  info: { icon: 'info', color: '#2f6fed' },
  success: { icon: 'circle-check', color: '#1f9d55' },
  warning: { icon: 'triangle-alert', color: '#d9822b' },
  error: { icon: 'circle-x', color: '#c0392b' },
};

function toastBox(node: ToastNode, ctx: LayoutContext): Bounds {
  const fontSize = fontSizeOf(node.style, ctx.theme);
  const width = node.width ?? TOAST_WIDTH;
  const inner = width - TOAST_PADDING * 3 - ICON - 24;
  let h = TOAST_PADDING + ctx.font.lineHeight(fontSize);
  if (node.description)
    h +=
      layoutText(ctx.font, wrapText(ctx.font, node.description, fontSize - 1, inner), fontSize - 1).bounds.height + 2;
  return { x: 0, y: 0, width, height: Math.ceil(h + TOAST_PADDING) };
}

/** A brief notice in the page's corner; several stack upwards by `stack`. */
export const toast: ComponentDef<ToastNode> = {
  capabilities: { open: true },
  validate: (node) => (node.title ? undefined : 'title is required'),
  anchor: (node) => ({ side: 'bottom', align: 'end', gap: 16, offset: { x: 0, y: -(node.stack ?? 0) * TOAST_STRIDE } }),
  localBounds: toastBox,
  expand: (node, ctx) => {
    if (!isOpen(node, ctx)) return [];
    const { theme, font } = ctx;
    const fontSize = fontSizeOf(node.style, theme);
    const b = toastBox(node, ctx);
    const variant = VARIANTS[node.variant ?? 'info'];
    const parts: Part[] = [
      ...panelParts('', theme, node, b),
      {
        key: 'icon',
        kind: 'icon',
        x: TOAST_PADDING,
        y: TOAST_PADDING - 1,
        size: ICON + 2,
        icon: ctx.icons(variant.icon),
        color: variant.color,
        style: resolvePartStyle(theme, node),
        layer: 'overlay',
      },
      {
        ...textPart('title', theme, node, {
          x: TOAST_PADDING * 2 + ICON,
          y: TOAST_PADDING,
          text: node.title,
          fontSize,
          color: textColor(node.style, theme.text),
          weight: TITLE_WEIGHT,
        }),
        layer: 'overlay',
      },
    ];
    if (node.description) {
      const text = wrapText(font, node.description, fontSize - 1, b.width - TOAST_PADDING * 3 - ICON - 24);
      parts.push({
        ...textPart('description', theme, node, {
          x: TOAST_PADDING * 2 + ICON,
          y: TOAST_PADDING + font.lineHeight(fontSize) + 2,
          text,
          fontSize: fontSize - 1,
          color: theme.muted,
        }),
        layer: 'overlay',
      });
    }
    parts.push(...closeParts('', theme, node, ctx, b).parts);
    return parts;
  },
  regions: (node, ctx): Region[] =>
    isOpen(node, ctx)
      ? [bodyRegion(toastBox(node, ctx)), closeParts('', ctx.theme, node, ctx, toastBox(node, ctx)).region]
      : [],
};
