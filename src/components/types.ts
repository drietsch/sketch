import type { VElement } from '../render/frame.js';
import type { IconDef } from '../icons/types.js';
import type {
  Bounds,
  ComponentState,
  ControlValue,
  FillStyle,
  Point,
  SceneNode,
  Size,
  TextAlignHorizontal,
  Theme,
} from '../core/types.js';
import type { StrokeFont } from '../text/font.js';

/** Fully resolved sketch style for one part. */
export interface PartStyle {
  stroke: string;
  strokeWeight: number;
  strokeOpacity?: number;
  fill?: string;
  fillOpacity?: number;
  fillStyle: FillStyle;
  roughness: number;
  bowing: number;
  hachureGap?: number;
  hachureAngle?: number;
  fillWeight?: number;
  strokeDashes?: number[];
  opacity?: number;
  disableMultiStroke?: boolean;
  preserveVertices?: boolean;
}

/**
 * What a component is made of, in the node's local coordinate space. Parts
 * carry their own key so each gets an independent jitter stream and cache
 * entry: a button's box and its label never re-randomise each other.
 */
export type Part = { key: string; style: PartStyle; layer?: 'overlay' } & (
  | { kind: 'rect'; x: number; y: number; width: number; height: number; cornerRadius?: number }
  | { kind: 'ellipse'; x: number; y: number; width: number; height: number }
  | { kind: 'line'; x1: number; y1: number; x2: number; y2: number }
  | { kind: 'path'; d: string }
  | {
      kind: 'text';
      x: number;
      y: number;
      text: string;
      fontSize: number;
      align: TextAlignHorizontal;
      color: string;
    }
  | { kind: 'icon'; x: number; y: number; size: number; icon: IconDef; color: string }
  /** An element emitted as-is, for things that are deliberately not sketched (clip rects, carets). */
  | { kind: 'raw'; el: VElement }
);

export interface LayoutContext {
  theme: Theme;
  font: StrokeFont;
  /** Resolves an icon reference (per-demo registrations first, then global, then built-ins). Throws for unknown names. */
  icons: (icon: string | IconDef) => IconDef;
  /** The whole document's size, for centred popups and backdrops. */
  document: Size;
}

export interface RenderContext extends LayoutContext {
  /** Effective state: authored state merged with the interaction state at time t. */
  state: ComponentState;
  /** Live model state at time t, when the timeline changed it; components fall back to the node's own props. */
  value?: ControlValue;
  checked?: boolean;
  open?: boolean;
  /** Whether a focused input's caret is in its visible blink phase. Defaults to visible. */
  caretVisible?: boolean;
  /** Absolute laid-out bounds of any node, for anchoring popups. */
  bounds: (id: string) => Bounds;
}

/** What a click changes. `target` defaults to the node whose region was hit. */
export interface WidgetAction {
  target?: string;
  checked?: boolean;
  open?: boolean;
  value?: ControlValue;
  /** Move focus to the target (true) or clear it (false); unset leaves the default focus rule. */
  focus?: boolean;
}

/** A clickable area inside a node, in node-local coordinates. */
export interface Region {
  key: string;
  bounds: Bounds;
  action?: WidgetAction;
  layer?: 'overlay';
}

export interface Capabilities {
  check?: true;
  choose?: true;
  open?: true;
  drag?: true;
  text?: true;
  hover?: true;
}

export interface ComponentDef<N extends SceneNode = SceneNode> {
  /** Bounds in the node's local space (origin at the node's x, y). May have a negative origin, e.g. a line pointing up-left. */
  localBounds(node: N, ctx: LayoutContext): Bounds;
  expand(node: N, ctx: RenderContext): Part[];
  /** Where children of this node are positioned from, in local space. */
  contentOffset?(node: N, ctx: LayoutContext): Point;
  focusable?: boolean;
  interactive?: boolean;
  /** Reads width/height from the node it is given, so layout may set them (FILL). Unset: FILL is rejected. */
  resizable?: boolean;
  /** Clickable areas with their effects; the timeline aims at them. */
  regions?(node: N, ctx: RenderContext): Region[];
  /** The effect of a click that hits the node but no region. */
  click?(node: N, ctx: RenderContext): WidgetAction | undefined;
  /** For a `drag` step: the value at a cursor point in node-local space, and the point for a value. */
  drag?: {
    valueAt(node: N, ctx: RenderContext, point: Point): number;
    pointFor(node: N, ctx: RenderContext, value: number): Point;
  };
  /** Which semantic steps this component accepts. */
  capabilities?: Capabilities;
  /** Per-type validation of a node's props; a message means invalid. */
  validate?(node: N): string | undefined;
  /** A container: children are positioned from `contentOffset` and auto-layout applies. */
  container?: true;
  /** When true, the node's children are not rendered or hit-tested (a closed collapsible). */
  hidesChildren?(node: N, ctx: RenderContext): boolean;
}
