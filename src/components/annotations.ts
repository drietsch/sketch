import type {
  AnnotationBase,
  ArrowEnd,
  ArrowNode,
  Bounds,
  ArrowSide,
  CalloutNode,
  CalloutShape,
  EncircleNode,
  HighlightNode,
  NodeBase,
  Point,
  Theme,
  UnderlineNode,
} from '../core/types.js';
import type { ComponentDef, LayoutContext, Part, PartStyle } from './types.js';
import { fontSizeOf, resolvePartStyle, textColor } from './style.js';
import { resolvePaint } from '../core/paint.js';
import { textPart } from './common.js';
import { wrapText } from '../text/layout.js';

/**
 * Marks drawn over a finished interface. They are held in a hand rather than
 * drawn by a tool, so they wobble more than the controls beneath them, and
 * they are never hit-tested: a click goes through to the interface.
 */
const ROUGHNESS = 2.2;
const BOWING = 1.8;
/** A highlighter's ink when the node names no fill of its own. */
const MARKER_INK = '#ffd23f';
const MARKER_ALPHA = 0.45;
const DEFAULT_GAP = 6;
const DEFAULT_HEAD = 14;
const DEFAULT_BEND = 0.2;

/**
 * A mark's part style: the node's own paints and sketch settings first, then
 * the looser hand, which the node's own `sketch` still overrides. Marks ink
 * themselves in the theme's accent so they read as a pen over the interface.
 */
function markStyle(theme: Theme, node: NodeBase, overrides: Partial<PartStyle> = {}): PartStyle {
  const o: Partial<PartStyle> = {
    roughness: node.sketch?.roughness ?? theme.roughness * ROUGHNESS,
    bowing: node.sketch?.bowing ?? theme.bowing * BOWING,
    ...overrides,
  };
  if (node.strokes === undefined && o.stroke === undefined) o.stroke = theme.accent;
  return resolvePartStyle(theme, node, o);
}

/** A highlighter's colour and translucency: the node's fill when it has one, else marker yellow. */
function ink(node: NodeBase): { color: string; opacity: number } {
  const paint = resolvePaint(node.fills);
  if (paint === undefined || paint === 'none') return { color: MARKER_INK, opacity: MARKER_ALPHA };
  return { color: paint.color, opacity: paint.opacity ?? MARKER_ALPHA };
}

/** The box a mark covers: its target's, grown by `spread`, else the one it was given. */
const coverFit = {
  targets: (node: AnnotationBase): string[] => (node.target === undefined ? [] : [node.target]),
  box: (node: AnnotationBase, box: (id: string) => Bounds | undefined): Bounds => {
    const b = node.target === undefined ? undefined : box(node.target);
    if (b === undefined) return { x: node.x, y: node.y, width: node.width ?? 0, height: node.height ?? 0 };
    const p = node.spread ?? 0;
    return { x: b.x - p, y: b.y - p, width: b.width + 2 * p, height: b.height + 2 * p };
  },
  placed: (node: AnnotationBase) => node.target !== undefined,
};

const coverReferences = (node: AnnotationBase): string[] => (node.target === undefined ? [] : [node.target]);

/** A mark with no target has to be told how big it is. */
function needsSize(node: AnnotationBase, axes: 'both' | 'width'): string | undefined {
  if (node.target !== undefined) return undefined;
  if (typeof node.width !== 'number' || node.width <= 0) return 'width is required without a target';
  if (axes === 'both' && (typeof node.height !== 'number' || node.height <= 0)) {
    return 'height is required without a target';
  }
  return undefined;
}

const sizeOf = (node: AnnotationBase) => ({ width: node.width ?? 0, height: node.height ?? 0 });

// --- highlight -----------------------------------------------------------

export const highlight: ComponentDef<HighlightNode> = {
  resizable: true,
  fit: coverFit,
  references: coverReferences,
  validate: (node) =>
    node.variant !== undefined && node.variant !== 'marker' && node.variant !== 'block'
      ? 'variant must be marker or block'
      : needsSize(node, 'both'),
  localBounds: (node) => ({ x: 0, y: 0, ...sizeOf(node) }),
  expand: (node, ctx) => {
    const { width, height } = sizeOf(node);
    const { color, opacity } = ink(node);
    if (node.variant === 'block') {
      return [
        {
          key: 'band',
          kind: 'rect',
          x: 0,
          y: 0,
          width,
          height,
          style: markStyle(ctx.theme, node, {
            stroke: 'none',
            fill: color,
            fillOpacity: opacity,
            fillStyle: node.sketch?.fillStyle ?? 'solid',
          }),
        },
      ];
    }
    // One thick sweep, tilted a little, the way a marker is actually dragged.
    return [
      {
        key: 'band',
        kind: 'line',
        x1: width * 0.02,
        y1: height * 0.56,
        x2: width * 0.98,
        y2: height * 0.46,
        style: markStyle(ctx.theme, node, {
          stroke: color,
          strokeOpacity: opacity,
          strokeWeight: height * 0.82,
          fill: undefined,
        }),
      },
    ];
  },
};

// --- encircle ------------------------------------------------------------

export const encircle: ComponentDef<EncircleNode> = {
  resizable: true,
  fit: coverFit,
  references: coverReferences,
  validate: (node) => {
    if (node.shape !== undefined && node.shape !== 'oval' && node.shape !== 'rect') return 'shape must be oval or rect';
    if (node.passes !== undefined && (!Number.isInteger(node.passes) || node.passes < 1 || node.passes > 4)) {
      return 'passes must be a whole number from 1 to 4';
    }
    return needsSize(node, 'both');
  },
  localBounds: (node) => ({ x: 0, y: 0, ...sizeOf(node) }),
  expand: (node, ctx) => {
    const { width, height } = sizeOf(node);
    const passes = node.passes ?? 2;
    const parts: Part[] = [];
    for (let i = 0; i < passes; i++) {
      // Each pass has its own key, so it draws from its own stream: the rings
      // differ the way two turns of a pen do, instead of landing on each other.
      const grow = i * 1.6;
      const style = markStyle(ctx.theme, node, { fill: undefined });
      parts.push(
        node.shape === 'rect'
          ? {
              key: `ring-${i}`,
              kind: 'rect',
              x: -grow,
              y: -grow,
              width: width + grow * 2,
              height: height + grow * 2,
              cornerRadius: ctx.theme.radius,
              style,
            }
          : {
              key: `ring-${i}`,
              kind: 'ellipse',
              x: -grow,
              y: -grow,
              width: width + grow * 2,
              height: height + grow * 2,
              style,
            },
      );
    }
    return parts;
  },
};

// --- underline -----------------------------------------------------------

const UNDERLINE_VARIANTS = ['straight', 'double', 'wavy', 'zigzag', 'scribble', 'loop'];

/** Quadratic humps alternating side, along `width` at `y`. */
function wavePath(width: number, y: number, amplitude: number, wavelength: number): string {
  let d = `M 0 ${y}`;
  let x = 0;
  let up = true;
  while (x < width - 0.5) {
    const step = Math.min(wavelength, width - x);
    d += ` Q ${x + step / 2} ${y + (up ? -amplitude : amplitude)} ${x + step} ${y}`;
    x += step;
    up = !up;
  }
  return d;
}

function zigzagPath(width: number, y: number, amplitude: number, wavelength: number): string {
  let d = `M 0 ${y}`;
  let x = 0;
  let up = true;
  while (x < width - 0.5) {
    const step = Math.min(wavelength / 2, width - x);
    x += step;
    d += ` L ${x} ${y + (up ? -amplitude : amplitude)}`;
    up = !up;
  }
  return d;
}

/**
 * Two passes of a tight up-and-down scrawl, the second out of step with the
 * first: what scribbling something out actually leaves behind.
 */
function scribblePath(width: number, y: number, amplitude: number, step: number): string {
  const pass = (from: number) => {
    let d = `M ${from} ${y + amplitude}`;
    let x = from;
    let up = true;
    while (x < width - 0.5) {
      x = Math.min(x + step / 2, width);
      d += ` L ${x} ${y + (up ? -amplitude : amplitude)}`;
      up = !up;
    }
    return d;
  };
  return `${pass(0)} ${pass(step / 3)}`;
}

/**
 * Loop-de-loops: control points crossed over each other close every hump into
 * a loop. They hang below the line, so they never cover what they underline.
 */
function loopPath(width: number, y: number, size: number, count: number): string {
  const step = width / count;
  let d = `M 0 ${y}`;
  for (let i = 0; i < count; i++) {
    const x = i * step;
    d += ` C ${x + step * 1.3} ${y + size} ${x - step * 0.3} ${y + size} ${x + step} ${y}`;
  }
  return d;
}

export const underline: ComponentDef<UnderlineNode> = {
  resizable: true,
  fit: coverFit,
  references: coverReferences,
  validate: (node) => {
    if (node.variant !== undefined && !UNDERLINE_VARIANTS.includes(node.variant)) {
      return `variant must be one of ${UNDERLINE_VARIANTS.join(', ')}`;
    }
    if (node.placement !== undefined && node.placement !== 'under' && node.placement !== 'through') {
      return 'placement must be under or through';
    }
    return needsSize(node, 'width');
  },
  localBounds: (node) => ({ x: 0, y: 0, width: node.width ?? 0, height: node.height ?? 0 }),
  expand: (node, ctx) => {
    const width = node.width ?? 0;
    const height = node.height ?? 0;
    // Just under the box, or across its middle, which is a strikethrough.
    const y = node.placement === 'through' ? height / 2 : height + 3;
    const straight = markStyle(ctx.theme, node, { fill: undefined });
    // A shaped line has to survive the drawing of it: at the hand's full
    // wobble a wave or a loop is just noise, so shaped variants use a steadier
    // hand and a shape big enough to read.
    const shaped = markStyle(ctx.theme, node, {
      fill: undefined,
      roughness: node.sketch?.roughness ?? ctx.theme.roughness * 1.1,
    });
    const style = straight;
    const amplitude = Math.max(5, Math.min(9, height * 0.24));
    switch (node.variant ?? 'straight') {
      case 'double':
        return [
          { key: 'line-0', kind: 'line', x1: 0, y1: y, x2: width, y2: y, style },
          { key: 'line-1', kind: 'line', x1: 0, y1: y + 3.5, x2: width, y2: y + 3.5, style },
        ];
      case 'wavy':
        return [{ key: 'wave', kind: 'path', d: wavePath(width, y, amplitude, 13), style: shaped }];
      case 'zigzag':
        return [{ key: 'zigzag', kind: 'path', d: zigzagPath(width, y, amplitude, 16), style: shaped }];
      case 'scribble': {
        // A scribble-out covers what it strikes, so it reaches across the box.
        const reach = Math.max(amplitude, height * 0.42);
        return [{ key: 'scribble', kind: 'path', d: scribblePath(width, y, reach, 17), style: shaped }];
      }
      case 'loop': {
        // A loop only closes when it is about as tall as it is wide, but it
        // still has to stay a loop rather than become a hoop.
        const count = Math.max(2, Math.round(width / 30));
        const size = Math.max(9, Math.min(16, (width / count) * 0.9));
        return [{ key: 'loop', kind: 'path', d: loopPath(width, y, size, count), style: shaped }];
      }
      default:
        return [{ key: 'line', kind: 'line', x1: 0, y1: y, x2: width, y2: y, style }];
    }
  },
};

// --- arrow ---------------------------------------------------------------

const ARROW_CURVES = ['straight', 'curved', 's', 'elbow'];
const ARROW_HEADS = ['end', 'start', 'both', 'none'];
const ARROW_SIDES = ['auto', 'top', 'right', 'bottom', 'left'];

const centreOf = (b: Bounds): Point => ({ x: b.x + b.width / 2, y: b.y + b.height / 2 });

/** The box an endpoint stands for: a node's, or a zero-sized box at a point. */
function endBox(end: ArrowEnd, box: (id: string) => Bounds | undefined): Bounds | undefined {
  return typeof end === 'string' ? box(end) : { x: end.x, y: end.y, width: 0, height: 0 };
}

/**
 * Where the shaft meets a node's box, `gap` clear of it: the middle of the
 * named edge, or, for `auto`, wherever the ray towards the other end leaves
 * the box, so the arrow takes the shortest way.
 */
function edgePoint(b: Bounds, toward: Point, gap: number, side: ArrowSide = 'auto'): Point {
  const c = centreOf(b);
  if (side !== 'auto') {
    switch (side) {
      case 'top':
        return { x: c.x, y: b.y - gap };
      case 'bottom':
        return { x: c.x, y: b.y + b.height + gap };
      case 'left':
        return { x: b.x - gap, y: c.y };
      default:
        return { x: b.x + b.width + gap, y: c.y };
    }
  }
  const dx = toward.x - c.x;
  const dy = toward.y - c.y;
  const len = Math.hypot(dx, dy);
  if (len < 1e-6) return c;
  const ux = dx / len;
  const uy = dy / len;
  const tx = ux === 0 ? Infinity : b.width / 2 / Math.abs(ux);
  const ty = uy === 0 ? Infinity : b.height / 2 / Math.abs(uy);
  return { x: c.x + ux * (Math.min(tx, ty) + gap), y: c.y + uy * (Math.min(tx, ty) + gap) };
}

/** The arrow's two absolute endpoints, each pulled back to the edge of the node it names. */
function endpoints(node: ArrowNode, box: (id: string) => Bounds | undefined): { from: Point; to: Point } {
  const a = endBox(node.from, box);
  const b = endBox(node.to, box);
  const fallback: Point = { x: node.x, y: node.y };
  const ca = a ? centreOf(a) : fallback;
  const cb = b ? centreOf(b) : fallback;
  const gap = node.gap ?? DEFAULT_GAP;
  return {
    from: a && a.width + a.height > 0 ? edgePoint(a, cb, gap, node.fromSide) : ca,
    to: b && b.width + b.height > 0 ? edgePoint(b, ca, gap, node.toSide) : cb,
  };
}

interface Shaft {
  /** Path data through the points below. */
  d: string;
  /** Every point the path visits, for the box that has to contain it. */
  points: Point[];
  /** Direction the shaft arrives at `to`, and leaves `from`, in radians. */
  endAngle: number;
  startAngle: number;
}

/** The shaft from `from` to `to`, in whatever coordinates it was given. */
function shaftOf(node: ArrowNode, from: Point, to: Point): Shaft {
  const dx = to.x - from.x;
  const dy = to.y - from.y;
  const len = Math.hypot(dx, dy) || 1;
  // Unit normal, so a bend pushes the shaft sideways rather than along itself.
  const nx = -dy / len;
  const ny = dx / len;
  const bend = (node.bend ?? DEFAULT_BEND) * len;
  const mid = { x: (from.x + to.x) / 2, y: (from.y + to.y) / 2 };
  switch (node.curve ?? 'straight') {
    case 'curved': {
      const c = { x: mid.x + nx * bend, y: mid.y + ny * bend };
      return {
        d: `M ${from.x} ${from.y} Q ${c.x} ${c.y} ${to.x} ${to.y}`,
        points: [from, c, to],
        startAngle: Math.atan2(c.y - from.y, c.x - from.x),
        endAngle: Math.atan2(to.y - c.y, to.x - c.x),
      };
    }
    case 's': {
      const c1 = { x: from.x + dx / 3 + nx * bend, y: from.y + dy / 3 + ny * bend };
      const c2 = { x: from.x + (dx * 2) / 3 - nx * bend, y: from.y + (dy * 2) / 3 - ny * bend };
      return {
        d: `M ${from.x} ${from.y} C ${c1.x} ${c1.y} ${c2.x} ${c2.y} ${to.x} ${to.y}`,
        points: [from, c1, c2, to],
        startAngle: Math.atan2(c1.y - from.y, c1.x - from.x),
        endAngle: Math.atan2(to.y - c2.y, to.x - c2.x),
      };
    }
    case 'elbow': {
      // Turn along the longer axis first, so the corner sits away from both ends.
      const corner = Math.abs(dx) >= Math.abs(dy) ? { x: to.x, y: from.y } : { x: from.x, y: to.y };
      return {
        d: `M ${from.x} ${from.y} L ${corner.x} ${corner.y} L ${to.x} ${to.y}`,
        points: [from, corner, to],
        startAngle: Math.atan2(corner.y - from.y, corner.x - from.x),
        endAngle: Math.atan2(to.y - corner.y, to.x - corner.x),
      };
    }
    default: {
      const angle = Math.atan2(dy, dx);
      return { d: `M ${from.x} ${from.y} L ${to.x} ${to.y}`, points: [from, to], startAngle: angle, endAngle: angle };
    }
  }
}

/** Two strokes back from the tip: an arrowhead drawn in one stroke of a pen. */
function headPath(tip: Point, angle: number, size: number): string {
  const spread = 0.42;
  const a = { x: tip.x - size * Math.cos(angle - spread), y: tip.y - size * Math.sin(angle - spread) };
  const b = { x: tip.x - size * Math.cos(angle + spread), y: tip.y - size * Math.sin(angle + spread) };
  return `M ${a.x} ${a.y} L ${tip.x} ${tip.y} L ${b.x} ${b.y}`;
}

/** The box that contains the shaft and its heads, whatever direction they point. */
function arrowBox(node: ArrowNode, from: Point, to: Point): Bounds {
  const { points } = shaftOf(node, from, to);
  const margin = (node.headSize ?? DEFAULT_HEAD) + (node.strokeWeight ?? 2) * 2;
  const xs = points.map((p) => p.x);
  const ys = points.map((p) => p.y);
  const x = Math.min(...xs) - margin;
  const y = Math.min(...ys) - margin;
  return { x, y, width: Math.max(...xs) - x + margin, height: Math.max(...ys) - y + margin };
}

export const arrow: ComponentDef<ArrowNode> = {
  resizable: true,
  fit: {
    targets: (node) => [node.from, node.to].filter((e): e is string => typeof e === 'string'),
    box: (node, box) => {
      const { from, to } = endpoints(node, box);
      return arrowBox(node, from, to);
    },
    // Both ends are given, as nodes or as points, so an arrow is never placed by an x/y of its own.
    placed: () => true,
  },
  references: (node) => [node.from, node.to].filter((e): e is string => typeof e === 'string'),
  validate: (node) => {
    for (const [key, end] of [
      ['from', node.from],
      ['to', node.to],
    ] as const) {
      const ok =
        typeof end === 'string' ||
        (typeof end === 'object' && end !== null && typeof end.x === 'number' && typeof end.y === 'number');
      if (!ok) return `${key} must be a node id or a { x, y } point`;
    }
    if (node.curve !== undefined && !ARROW_CURVES.includes(node.curve)) {
      return `curve must be one of ${ARROW_CURVES.join(', ')}`;
    }
    if (node.head !== undefined && !ARROW_HEADS.includes(node.head)) {
      return `head must be one of ${ARROW_HEADS.join(', ')}`;
    }
    for (const key of ['fromSide', 'toSide'] as const) {
      const side = node[key];
      if (side !== undefined && !ARROW_SIDES.includes(side)) return `${key} must be one of ${ARROW_SIDES.join(', ')}`;
    }
    return undefined;
  },
  localBounds: (node) => ({ x: 0, y: 0, width: node.width ?? 0, height: node.height ?? 0 }),
  expand: (node, ctx) => {
    // The endpoints are absolute, so they are resolved again here and moved
    // into the node's own space; the layout sized the node from the same two.
    const origin = ctx.bounds(node.id);
    const { from, to } = endpoints(node, (id) => ctx.bounds(id));
    const local = (p: Point): Point => ({ x: p.x - origin.x, y: p.y - origin.y });
    const shaft = shaftOf(node, local(from), local(to));
    const style = markStyle(ctx.theme, node, { fill: undefined });
    const parts: Part[] = [{ key: 'shaft', kind: 'path', d: shaft.d, style }];
    const head = node.head ?? 'end';
    const size = node.headSize ?? DEFAULT_HEAD;
    if (head === 'end' || head === 'both') {
      parts.push({ key: 'head-end', kind: 'path', d: headPath(local(to), shaft.endAngle, size), style });
    }
    if (head === 'start' || head === 'both') {
      parts.push({
        key: 'head-start',
        kind: 'path',
        d: headPath(local(from), shaft.startAngle + Math.PI, size),
        style,
      });
    }
    return parts;
  },
};

// --- callout -------------------------------------------------------------

const CALLOUT_SHAPES = ['bubble', 'burst', 'cloud'];
const CALLOUT_SIDES = ['top', 'bottom', 'left', 'right'];
const CALLOUT_ALIGNS = ['start', 'center', 'end'];
const CALLOUT_WIDTH = 170;
const CALLOUT_PADDING = 12;
const CALLOUT_GAP = 22;
/** A burst's spikes and a cloud's bumps eat into the box, so their text sits further in. */
const SHAPE_INSET: Record<CalloutShape, number> = { bubble: 1, burst: 1.32, cloud: 1.26 };

function calloutFontSize(node: CalloutNode, theme: Theme): number {
  return fontSizeOf(node.style, theme) - 1;
}

/** The bubble's box: the wrapped text, padded, then opened up for a shape that is not a rectangle. */
function calloutBox(node: CalloutNode, ctx: LayoutContext): Bounds {
  const fontSize = calloutFontSize(node, ctx.theme);
  const inset = SHAPE_INSET[node.shape ?? 'bubble'];
  const width = node.width ?? CALLOUT_WIDTH;
  const lines = wrapText(ctx.font, node.characters, fontSize, width - CALLOUT_PADDING * 2).split('\n').length;
  const text = lines * ctx.font.lineHeight(fontSize);
  return {
    x: 0,
    y: 0,
    width: Math.ceil(width * inset),
    height: node.height ?? Math.ceil((text + CALLOUT_PADDING * 2) * inset),
  };
}

/** Alternating long and short spokes around the box: a burst drawn in one stroke. */
function burstPath(width: number, height: number, spikes = 13): string {
  const cx = width / 2;
  const cy = height / 2;
  const points: string[] = [];
  for (let i = 0; i < spikes * 2; i++) {
    const t = (i / (spikes * 2)) * Math.PI * 2 - Math.PI / 2;
    const reach = i % 2 === 0 ? 1 : 0.76;
    points.push(`${cx + Math.cos(t) * (width / 2) * reach} ${cy + Math.sin(t) * (height / 2) * reach}`);
  }
  return `M ${points.join(' L ')} Z`;
}

/** A ring of bumps: the outline of a thought cloud. */
function cloudPath(width: number, height: number, bumps = 11): string {
  const cx = width / 2;
  const cy = height / 2;
  const rx = width / 2;
  const ry = height / 2;
  const at = (t: number, reach: number) => ({ x: cx + Math.cos(t) * rx * reach, y: cy + Math.sin(t) * ry * reach });
  let d = '';
  for (let i = 0; i < bumps; i++) {
    const t0 = (i / bumps) * Math.PI * 2 - Math.PI / 2;
    const t1 = ((i + 1) / bumps) * Math.PI * 2 - Math.PI / 2;
    const a = at(t0, 0.84);
    const b = at(t1, 0.84);
    const c = at((t0 + t1) / 2, 1.3);
    if (i === 0) d += `M ${a.x} ${a.y}`;
    d += ` Q ${c.x} ${c.y} ${b.x} ${b.y}`;
  }
  return `${d} Z`;
}

export const callout: ComponentDef<CalloutNode> = {
  references: (node) => (node.target === undefined ? [] : [node.target]),
  anchor: (node) =>
    node.target === undefined
      ? undefined
      : { id: node.target, side: node.side ?? 'top', align: node.align, gap: node.gap ?? CALLOUT_GAP },
  validate: (node) => {
    if (!node.characters) return 'characters is required';
    if (node.shape !== undefined && !CALLOUT_SHAPES.includes(node.shape)) {
      return `shape must be one of ${CALLOUT_SHAPES.join(', ')}`;
    }
    if (node.side !== undefined && !CALLOUT_SIDES.includes(node.side)) {
      return `side must be one of ${CALLOUT_SIDES.join(', ')}`;
    }
    if (node.align !== undefined && !CALLOUT_ALIGNS.includes(node.align)) {
      return `align must be one of ${CALLOUT_ALIGNS.join(', ')}`;
    }
    return undefined;
  },
  localBounds: (node, ctx) => calloutBox(node, ctx),
  expand: (node, ctx) => {
    const { theme, font } = ctx;
    const box = calloutBox(node, ctx);
    const shape = node.shape ?? 'bubble';
    const fontSize = calloutFontSize(node, theme);
    const style = markStyle(theme, node, { fill: theme.surface, fillStyle: node.sketch?.fillStyle ?? 'solid' });
    const parts: Part[] = [];
    if (shape === 'bubble') {
      parts.push({
        key: 'bubble',
        kind: 'rect',
        x: 0,
        y: 0,
        width: box.width,
        height: box.height,
        cornerRadius: theme.radius * 2,
        style,
      });
    } else {
      parts.push({
        key: shape,
        kind: 'path',
        d: shape === 'burst' ? burstPath(box.width, box.height) : cloudPath(box.width, box.height),
        style,
      });
    }

    // The tail is drawn from the bubble's own edge to the target's, so it
    // re-aims itself whenever either of them moves.
    if (node.target !== undefined) {
      const self = ctx.bounds(node.id);
      const aim = ctx.bounds(node.target);
      const local = (p: Point): Point => ({ x: p.x - self.x, y: p.y - self.y });
      const here: Bounds = { x: 0, y: 0, width: box.width, height: box.height };
      const there = { ...local({ x: aim.x, y: aim.y }), width: aim.width, height: aim.height };
      const tip = edgePoint(there, centreOf(here), 0);
      const root = edgePoint(here, centreOf(there), 0);
      const dx = tip.x - root.x;
      const dy = tip.y - root.y;
      const len = Math.hypot(dx, dy) || 1;
      const nx = -dy / len;
      const ny = dx / len;
      if (shape === 'cloud') {
        // A thought cloud trails puffs instead of a tail.
        [0.45, 0.78].forEach((t, i) => {
          const r = 7 - i * 2.5;
          parts.push({
            key: `puff-${i}`,
            kind: 'ellipse',
            x: root.x + dx * t - r,
            y: root.y + dy * t - r,
            width: r * 2,
            height: r * 2,
            style,
          });
        });
      } else {
        const spread = 7;
        const a = { x: root.x + nx * spread, y: root.y + ny * spread };
        const b = { x: root.x - nx * spread, y: root.y - ny * spread };
        parts.push({
          key: 'tail',
          kind: 'path',
          d: `M ${a.x} ${a.y} L ${tip.x} ${tip.y} L ${b.x} ${b.y} Z`,
          style,
        });
      }
    }

    const inset = (box.width - (node.width ?? CALLOUT_WIDTH)) / 2 + CALLOUT_PADDING;
    const lines = wrapText(font, node.characters, fontSize, (node.width ?? CALLOUT_WIDTH) - CALLOUT_PADDING * 2).split(
      '\n',
    );
    const top = (box.height - lines.length * font.lineHeight(fontSize)) / 2;
    lines.forEach((line, i) => {
      parts.push({
        ...textPart(`line-${i}`, theme, node, {
          x: inset,
          y: top + i * font.lineHeight(fontSize),
          text: line,
          fontSize,
          color: textColor(node.style, theme.text),
        }),
        layer: 'overlay',
      });
    });
    return parts;
  },
};
