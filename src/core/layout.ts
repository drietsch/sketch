import type { Scene } from './scene.js';
import type { AutoLayoutProps, Bounds, LayoutMode, LayoutSizing, Point, SceneNode, Size } from './types.js';
import type { Anchoring, LayoutContext } from '../components/types.js';
import { componentFor } from '../components/index.js';

export interface LayoutEntry {
  /** The node as laid out: the stored object itself, or a shallow copy whose width/height the layout decided. */
  node: SceneNode;
  /** Absolute origin of the node's local space. */
  position: Point;
  /** Absolute box. */
  bounds: Bounds;
}

export type Layout = ReadonlyMap<string, LayoutEntry>;

type Container = SceneNode & AutoLayoutProps;

/** Any component that declares itself a container takes auto-layout props and may HUG. */
export function isContainer(node: SceneNode): node is Container {
  return !!componentFor(node).container;
}

export function layoutModeOf(node: SceneNode): LayoutMode {
  return isContainer(node) ? (node.layoutMode ?? 'NONE') : 'NONE';
}

/** The anchoring of a popup node, if its component declares one. */
export function anchoringOf(node: SceneNode): Anchoring | undefined {
  return componentFor(node).anchor?.(node);
}

/** Whether a node's box comes from other nodes' boxes (an annotation following what it marks). */
export function isFitted(node: SceneNode): boolean {
  return componentFor(node).fit !== undefined;
}

/** Whether a child is positioned by its parent's layout (as opposed to sitting at its own x/y, on its anchor, or on what it marks). */
export function isAutoChild(node: SceneNode): boolean {
  return (
    node.layoutPositioning !== 'ABSOLUTE' &&
    node.visible !== false &&
    anchoringOf(node) === undefined &&
    !isFitted(node)
  );
}

/** The top-left of a box of `size` placed by `a` against the anchor box (a node's bounds, or the document). */
export function placeAnchored(a: Anchoring, anchor: Bounds, size: Size, document: Size, inside: boolean): Point {
  const gap = a.gap ?? 0;
  const align = a.align ?? 'center';
  const along = (start: number, length: number, own: number) =>
    align === 'start' ? start : align === 'end' ? start + length - own : start + (length - own) / 2;
  let x: number;
  let y: number;
  if (inside) {
    // Against the document's edges, the gap is an inset.
    const ax = (edge: 'start' | 'end' | 'center') =>
      edge === 'start' ? gap : edge === 'end' ? anchor.width - size.width - gap : (anchor.width - size.width) / 2;
    const ay = (edge: 'start' | 'end' | 'center') =>
      edge === 'start' ? gap : edge === 'end' ? anchor.height - size.height - gap : (anchor.height - size.height) / 2;
    if (a.side === 'center') [x, y] = [ax('center'), ay('center')];
    else if (a.side === 'top' || a.side === 'bottom') {
      y = ay(a.side === 'top' ? 'start' : 'end');
      x = ax(align);
    } else {
      x = ax(a.side === 'left' ? 'start' : 'end');
      y = ay(align);
    }
  } else if (a.side === 'center') {
    x = anchor.x + (anchor.width - size.width) / 2;
    y = anchor.y + (anchor.height - size.height) / 2;
  } else if (a.side === 'top' || a.side === 'bottom') {
    y = a.side === 'top' ? anchor.y - gap - size.height : anchor.y + anchor.height + gap;
    x = along(anchor.x, anchor.width, size.width);
  } else {
    x = a.side === 'left' ? anchor.x - gap - size.width : anchor.x + anchor.width + gap;
    y = along(anchor.y, anchor.height, size.height);
  }
  if (!inside) {
    // Keep a popup on the page.
    x = Math.max(0, Math.min(document.width - size.width, x));
    y = Math.max(0, Math.min(document.height - size.height, y));
  }
  return { x: x + (a.offset?.x ?? 0), y: y + (a.offset?.y ?? 0) };
}

function sizing(node: SceneNode, axis: 'H' | 'V'): LayoutSizing {
  return (axis === 'H' ? node.layoutSizingHorizontal : node.layoutSizingVertical) ?? 'FIXED';
}

function pad(c: Container) {
  return { t: c.paddingTop ?? 0, r: c.paddingRight ?? 0, b: c.paddingBottom ?? 0, l: c.paddingLeft ?? 0 };
}

interface Measured extends Size {
  /** Intrinsic local bounds, kept for the origin offset of lines and centred text. */
  local: Bounds;
}

/**
 * Lays out every node of the scene into absolute geometry. Two passes over
 * the `childrenOf` arrays (never the node map, so the order is the paint
 * order and a clone lays out identically):
 *
 * 1. measure, bottom-up: what each node wants; a HUG container wraps its
 *    AUTO children, a FILL child contributes its intrinsic size here.
 * 2. arrange, top-down: the parent decides each child's size (FILL shares
 *    leftover primary space and stretches on the counter axis) and position
 *    (spacing, padding, alignment), then recurses.
 *
 * Nodes outside any layout container come out exactly as position() +
 * localBounds() did before layout existed.
 */
export function computeLayout(scene: Scene, ctx: LayoutContext): Layout {
  const measured = new Map<string, Measured>();
  const entries = new Map<string, LayoutEntry>();
  // Popups are placed against their anchors, and marks over what they annotate,
  // once those have geometry.
  const anchored: string[] = [];

  const measure = (id: string): Measured => {
    const hit = measured.get(id);
    if (hit) return hit;
    const node = scene.node(id);
    const local = componentFor(node).localBounds(node, ctx);
    const m: Measured = { width: local.width, height: local.height, local };
    const mode = layoutModeOf(node);
    if (mode !== 'NONE') {
      const c = node as Container;
      const row = mode === 'HORIZONTAL';
      const p = pad(c);
      const def = componentFor(node);
      const chrome = def.contentOffset?.(node, ctx) ?? { x: 0, y: 0 };
      const trailing = def.contentTrailing?.(node, ctx) ?? { x: 0, y: 0 };
      const kids = scene
        .childrenOf(id)
        .map((k, i) => (scene.childShown(id, i) ? scene.node(k) : undefined))
        .filter((k): k is SceneNode => k !== undefined && isAutoChild(k))
        .map((k) => measure(k.id));
      const gaps = Math.max(0, kids.length - 1) * (c.itemSpacing ?? 0);
      const main = kids.reduce((s, k) => s + (row ? k.width : k.height), 0) + gaps;
      const cross = kids.reduce((s, k) => Math.max(s, row ? k.height : k.width), 0);
      // A component that hides all its children (a closed collapsible) hugs to its chrome alone.
      const collapsed = kids.length === 0 && def.childVisible !== undefined && scene.childrenOf(id).length > 0;
      if (sizing(c, 'H') === 'HUG')
        m.width = collapsed ? chrome.x : chrome.x + p.l + (row ? main : cross) + p.r + trailing.x;
      if (sizing(c, 'V') === 'HUG')
        m.height = collapsed ? chrome.y : chrome.y + p.t + (row ? cross : main) + p.b + trailing.y;
    }
    measured.set(id, m);
    return m;
  };

  const arrange = (id: string, origin: Point, size: Size): void => {
    const stored = scene.node(id);
    const m = measure(id);
    // Keep the stored object's identity when the layout did not change its size.
    const node =
      size.width === m.local.width && size.height === m.local.height
        ? stored
        : ({ ...stored, width: size.width, height: size.height } as SceneNode);
    const def = componentFor(node);
    const local = def.localBounds(node, ctx);
    entries.set(id, {
      node,
      position: origin,
      bounds: { x: origin.x + local.x, y: origin.y + local.y, width: local.width, height: local.height },
    });
    const chrome = def.contentOffset?.(node, ctx) ?? { x: 0, y: 0 };
    const trailing = def.contentTrailing?.(node, ctx) ?? { x: 0, y: 0 };
    const content = { x: origin.x + chrome.x, y: origin.y + chrome.y };
    const children = scene.childrenOf(id).map((k) => scene.node(k));
    const shown = new Set(children.filter((_, i) => scene.childShown(id, i)));
    const mode = layoutModeOf(node);
    const auto = new Set(mode === 'NONE' ? [] : children.filter((k) => shown.has(k) && isAutoChild(k)));
    for (const k of children) {
      if (anchoringOf(k) || isFitted(k)) anchored.push(k.id);
      else if (!auto.has(k)) arrange(k.id, { x: content.x + k.x, y: content.y + k.y }, measure(k.id));
    }
    if (auto.size === 0) return;

    const c = node as Container;
    const row = mode === 'HORIZONTAL';
    const p = pad(c);
    const spacing = c.itemSpacing ?? 0;
    const innerW = size.width - chrome.x - trailing.x - p.l - p.r;
    const innerH = size.height - chrome.y - trailing.y - p.t - p.b;
    const innerMain = row ? innerW : innerH;
    const innerCross = row ? innerH : innerW;
    const items = [...auto].map((k) => ({ k, km: measure(k.id), fill: sizing(k, row ? 'H' : 'V') === 'FILL' }));
    const gaps = (items.length - 1) * spacing;
    const fixedSum = items.reduce((s, i) => s + (i.fill ? 0 : row ? i.km.width : i.km.height), 0);
    const fills = items.filter((i) => i.fill).length;
    const share = fills ? Math.max(0, innerMain - fixedSum - gaps) / fills : 0;
    const sizes = items.map(({ k, km, fill }) => {
      const main = fill ? share : row ? km.width : km.height;
      const cross = sizing(k, row ? 'V' : 'H') === 'FILL' ? innerCross : row ? km.height : km.width;
      return row ? { width: main, height: cross } : { width: cross, height: main };
    });
    const used = sizes.reduce((s, z) => s + (row ? z.width : z.height), 0) + gaps;
    const free = innerMain - used;
    const pa = c.primaryAxisAlignItems ?? 'MIN';
    const ca = c.counterAxisAlignItems ?? 'MIN';
    let cursor = pa === 'CENTER' ? free / 2 : pa === 'MAX' ? free : 0;
    const gap = spacing + (pa === 'SPACE_BETWEEN' && items.length > 1 ? Math.max(0, free) / (items.length - 1) : 0);
    items.forEach(({ k, km }, i) => {
      const z = sizes[i];
      const crossSize = row ? z.height : z.width;
      const off = ca === 'CENTER' ? (innerCross - crossSize) / 2 : ca === 'MAX' ? innerCross - crossSize : 0;
      const boxX = content.x + p.l + (row ? cursor : off);
      const boxY = content.y + p.t + (row ? off : cursor);
      // Back out a negative local origin (a line, centred text), as placement does.
      arrange(k.id, { x: boxX - km.local.x, y: boxY - km.local.y }, z);
      cursor += (row ? z.width : z.height) + gap;
    });
  };

  for (const id of scene.childrenOf()) {
    const n = scene.node(id);
    if (anchoringOf(n) || isFitted(n)) anchored.push(id);
    else arrange(id, { x: n.x, y: n.y }, measure(id));
  }
  // A popup anchored to another popup waits for it; an unknown anchor falls back to the node's own x, y.
  const deferred = anchored;
  let pending = anchored;
  while (pending.length) {
    const later: string[] = [];
    for (const id of pending) {
      const node = scene.node(id);
      const fit = componentFor(node).fit;
      if (fit) {
        // Wait for anything it follows that is itself still waiting.
        if (fit.targets(node).some((t) => !entries.has(t) && scene.has(t) && deferred.includes(t))) {
          later.push(id);
          continue;
        }
        const box = fit.box(node, (t) => entries.get(t)?.bounds, ctx);
        arrange(id, { x: box.x, y: box.y }, { width: box.width, height: box.height });
        continue;
      }
      const a = anchoringOf(node)!;
      const m = measure(id);
      if (a.id !== undefined && !entries.has(a.id) && scene.has(a.id) && anchored.includes(a.id)) {
        later.push(id);
        continue;
      }
      const target = a.id !== undefined ? entries.get(a.id)?.bounds : undefined;
      let origin: Point;
      if (a.id !== undefined && target === undefined) origin = { x: node.x, y: node.y };
      else {
        const box = placeAnchored(
          a,
          target ?? { x: 0, y: 0, width: ctx.document.width, height: ctx.document.height },
          m,
          ctx.document,
          a.id === undefined,
        );
        origin = { x: box.x - m.local.x, y: box.y - m.local.y };
      }
      arrange(id, origin, m);
    }
    if (later.length === pending.length) {
      for (const id of later) {
        const node = scene.node(id);
        const fit = componentFor(node).fit;
        const box = fit?.box(node, (t) => entries.get(t)?.bounds, ctx);
        if (box) arrange(id, { x: box.x, y: box.y }, { width: box.width, height: box.height });
        else arrange(id, { x: node.x, y: node.y }, measure(id));
      }
      break;
    }
    pending = later;
  }
  return entries;
}

// --- validation and defaults --------------------------------------------

const ENUMS = {
  layoutMode: ['NONE', 'HORIZONTAL', 'VERTICAL'],
  primaryAxisAlignItems: ['MIN', 'CENTER', 'MAX', 'SPACE_BETWEEN'],
  counterAxisAlignItems: ['MIN', 'CENTER', 'MAX'],
  layoutSizingHorizontal: ['FIXED', 'HUG', 'FILL'],
  layoutSizingVertical: ['FIXED', 'HUG', 'FILL'],
  layoutPositioning: ['AUTO', 'ABSOLUTE'],
} as const;
const CONTAINER_ONLY = [
  'layoutMode',
  'itemSpacing',
  'paddingLeft',
  'paddingRight',
  'paddingTop',
  'paddingBottom',
  'primaryAxisAlignItems',
  'counterAxisAlignItems',
] as const;
const NUMBERS = ['itemSpacing', 'paddingLeft', 'paddingRight', 'paddingTop', 'paddingBottom'] as const;
const DEFAULTS: Record<string, unknown> = {
  layoutMode: 'NONE',
  itemSpacing: 0,
  paddingLeft: 0,
  paddingRight: 0,
  paddingTop: 0,
  paddingBottom: 0,
  primaryAxisAlignItems: 'MIN',
  counterAxisAlignItems: 'MIN',
  layoutSizingHorizontal: 'FIXED',
  layoutSizingVertical: 'FIXED',
  layoutPositioning: 'AUTO',
};

/** Message describing what is wrong with a node's layout props, or undefined. `resizable` says whether FILL is allowed. */
export function validateLayoutProps(
  node: Record<string, unknown>,
  resizable: boolean,
  container: boolean,
  sizeRequired = container,
): string | undefined {
  for (const [key, values] of Object.entries(ENUMS)) {
    const v = node[key];
    if (v !== undefined && !(values as readonly string[]).includes(v as string)) {
      return `${key} must be one of ${values.join(', ')}; got ${JSON.stringify(v)}`;
    }
  }
  for (const key of NUMBERS) {
    const v = node[key];
    if (v !== undefined && (typeof v !== 'number' || !Number.isFinite(v) || v < 0)) {
      return `${key} must be a finite number >= 0; got ${JSON.stringify(v)}`;
    }
  }
  if (!container) {
    for (const key of CONTAINER_ONLY) {
      if (node[key] !== undefined) return `${key} only applies to container nodes, not ${String(node.type)}`;
    }
  }
  for (const key of ['layoutSizingHorizontal', 'layoutSizingVertical'] as const) {
    if (node[key] === 'HUG' && !container) return `${key}: only a container can HUG its content`;
    if (node[key] === 'FILL' && !resizable) return `${key}: a ${String(node.type)} cannot FILL; its size is intrinsic`;
  }
  if (container && sizeRequired) {
    // The layout decides a HUG or FILL axis; only a FIXED axis needs a stored size.
    const fixedH = node.layoutSizingHorizontal === undefined || node.layoutSizingHorizontal === 'FIXED';
    const fixedV = node.layoutSizingVertical === undefined || node.layoutSizingVertical === 'FIXED';
    if (fixedH && typeof node.width !== 'number')
      return 'width is required unless layoutSizingHorizontal is HUG or FILL';
    if (fixedV && typeof node.height !== 'number')
      return 'height is required unless layoutSizingVertical is HUG or FILL';
  }
  return undefined;
}

/** Removes layout keys that equal their default, so stored nodes and documents stay minimal. */
export function stripLayoutDefaults(node: Record<string, unknown>): void {
  for (const [key, def] of Object.entries(DEFAULTS)) {
    if (node[key] === def) delete node[key];
  }
}

export type Padding =
  number | [vertical: number, horizontal: number] | [top: number, right: number, bottom: number, left: number];

/** Expands a `padding` shorthand into the four sides (explicit sides win) and removes the shorthand key. */
export function expandPadding(id: string, props: Record<string, unknown>): void {
  if (!('padding' in props)) return;
  const p = props.padding as Padding | undefined;
  delete props.padding;
  if (p === undefined) return;
  let sides: [number, number, number, number];
  if (typeof p === 'number') sides = [p, p, p, p];
  else if (Array.isArray(p) && p.length === 2) sides = [p[0], p[1], p[0], p[1]];
  else if (Array.isArray(p) && p.length === 4) sides = p;
  else throw new Error(`Node "${id}": padding must be a number, [vertical, horizontal] or [top, right, bottom, left]`);
  const keys = ['paddingTop', 'paddingRight', 'paddingBottom', 'paddingLeft'] as const;
  keys.forEach((key, i) => {
    if (props[key] === undefined) props[key] = sides[i];
  });
}
