import type { AutocompleteNode, ComboboxNode, SelectNode } from '../core/types.js';
import type { ComponentDef, Part, Region, RenderContext } from './types.js';
import { INPUT_HEIGHT, INPUT_PADDING_X, inputBoxParts } from './input.js';
import { ROW } from './controls.js';
import { ICON, POPUP_PADDING, SIDE_OFFSET, bodyRegion, panelParts } from './popups.js';
import { centredTextTop, rectPart, textPart } from './common.js';
import { fontSizeOf, resolvePartStyle, textColor } from './style.js';
import { validateOptions } from './controls.js';

const CHEVRON = 16;
const isOpen = (node: { open?: boolean }, ctx: { open?: boolean }) => ctx.open ?? node.open ?? false;

type Listy = SelectNode | ComboboxNode | AutocompleteNode;

function liveText(node: Listy, ctx: RenderContext): string {
  const v = ctx.value ?? node.value;
  return v === undefined ? '' : Array.isArray(v) ? v.join(', ') : String(v);
}

/** The options a list shows: all of them for a select, the ones matching the typed text otherwise. */
function shownOptions(node: Listy, ctx: RenderContext): string[] {
  if (node.type === 'SELECT') return node.options;
  const text = liveText(node, ctx).trim().toLowerCase();
  if (!text || node.options.some((o) => o.toLowerCase() === text)) return node.options;
  return node.options.filter((o) => o.toLowerCase().includes(text));
}

/** The dropdown of options under the box, node-local; the current one is marked. */
function list(
  node: Listy,
  ctx: RenderContext,
  options: readonly string[],
  current: string,
): { parts: Part[]; regions: Region[] } {
  const { theme, font } = ctx;
  const fontSize = fontSizeOf(node.style, theme);
  const y0 = INPUT_HEIGHT + SIDE_OFFSET;
  const rows = options.length ? options : ['No matches'];
  const bounds = { x: 0, y: y0, width: node.width, height: rows.length * ROW + POPUP_PADDING };
  const parts: Part[] = [...panelParts('list.', theme, node, bounds)];
  const regions: Region[] = [bodyRegion(bounds, 'list.body')];
  rows.forEach((option, i) => {
    const y = y0 + POPUP_PADDING / 2 + i * ROW;
    const empty = options.length === 0;
    const on = !empty && option === current;
    if (on) {
      parts.push({
        ...rectPart(`list.${i}.highlight`, theme, undefined, {
          x: 4,
          y: y + 2,
          width: node.width - 8,
          height: ROW - 4,
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
      parts.push({
        key: `list.${i}.check`,
        kind: 'icon',
        x: node.width - INPUT_PADDING_X - ICON,
        y: y + (ROW - ICON) / 2,
        size: ICON,
        icon: ctx.icons('check'),
        color: theme.accent,
        style: resolvePartStyle(theme, node),
        layer: 'overlay',
      });
    }
    parts.push({
      ...textPart(`list.${i}.label`, theme, node, {
        x: INPUT_PADDING_X,
        y: y + centredTextTop(font, fontSize, ROW),
        text: option,
        fontSize,
        color: empty ? theme.muted : textColor(node.style, theme.text),
      }),
      layer: 'overlay',
    });
    if (!empty) {
      regions.push({
        key: `option:${option}`,
        bounds: { x: 0, y, width: node.width, height: ROW },
        action: { value: option, open: false },
        layer: 'overlay',
      });
    }
  });
  return { parts, regions };
}

function chevronPart(node: Listy, ctx: RenderContext, open: boolean): Part {
  return {
    key: 'chevron',
    kind: 'icon',
    x: node.width - INPUT_PADDING_X - CHEVRON + 2,
    y: (INPUT_HEIGHT - CHEVRON) / 2,
    size: CHEVRON,
    icon: ctx.icons(open ? 'chevron-up' : 'chevron-down'),
    color: ctx.theme.muted,
    style: resolvePartStyle(ctx.theme, node),
  };
}

/** A box showing the chosen option; a click drops the list. */
export const select: ComponentDef<SelectNode> = {
  resizable: true,
  focusable: true,
  interactive: true,
  capabilities: { open: true, choose: true },
  dismissOnOutside: true,
  validate: (node) => validateOptions(node.options, node.value, false),
  localBounds: (node) => ({ x: 0, y: 0, width: node.width, height: INPUT_HEIGHT }),
  expand: (node, ctx) => {
    const open = isOpen(node, ctx);
    const text = liveText(node, ctx);
    const parts = inputBoxParts(
      node,
      { ...ctx, state: { ...ctx.state, focused: ctx.state.focused || open } },
      {
        width: node.width,
        height: INPUT_HEIGHT,
        value: text,
        placeholder: node.placeholder ?? 'Select…',
        trailing: CHEVRON + 4,
      },
    ).filter((p) => p.key !== 'caret');
    parts.push(chevronPart(node, ctx, open));
    if (open) parts.push(...list(node, ctx, node.options, text).parts);
    return parts;
  },
  regions: (node, ctx): Region[] => {
    const open = isOpen(node, ctx);
    const out: Region[] = [
      { key: 'trigger', bounds: { x: 0, y: 0, width: node.width, height: INPUT_HEIGHT }, action: { open: !open } },
    ];
    if (open) out.push(...list(node, ctx, node.options, liveText(node, ctx)).regions);
    return out;
  },
};

/** An input whose list filters as you type; COMBOBOX also has a chevron to open the full list. */
function typed<N extends ComboboxNode | AutocompleteNode>(withChevron: boolean): ComponentDef<N> {
  return {
    resizable: true,
    focusable: true,
    interactive: true,
    capabilities: { open: true, choose: true, text: true },
    dismissOnOutside: true,
    opensOnType: true,
    validate: (node) =>
      validateOptions(node.options, undefined, false) ??
      (node.value !== undefined && typeof node.value !== 'string' ? 'value must be a string' : undefined),
    localBounds: (node) => ({ x: 0, y: 0, width: node.width, height: INPUT_HEIGHT }),
    expand: (node, ctx) => {
      const open = isOpen(node, ctx);
      const text = liveText(node, ctx);
      const parts = inputBoxParts(node, ctx, {
        width: node.width,
        height: INPUT_HEIGHT,
        value: text,
        placeholder: node.placeholder,
        trailing: withChevron ? CHEVRON + 4 : 0,
      });
      if (withChevron) parts.push(chevronPart(node, ctx, open));
      if (open) parts.push(...list(node, ctx, shownOptions(node, ctx), text).parts);
      return parts;
    },
    regions: (node, ctx): Region[] => {
      const open = isOpen(node, ctx);
      const out: Region[] = [];
      if (withChevron) {
        const x = node.width - INPUT_PADDING_X - CHEVRON - 4;
        out.push({
          key: 'trigger',
          bounds: { x, y: 0, width: node.width - x, height: INPUT_HEIGHT },
          action: { open: !open, focus: true },
        });
      }
      if (open) out.push(...list(node, ctx, shownOptions(node, ctx), liveText(node, ctx)).regions);
      return out;
    },
  } as ComponentDef<N>;
}

export const combobox = typed<ComboboxNode>(true);
export const autocomplete = typed<AutocompleteNode>(false);
