import type { VElement } from '../render/frame.js';
import type { IconDef } from '../icons/types.js';
import type { Bounds, ComponentState, FillStyle, Point, SceneNode, TextAlignHorizontal, Theme } from '../core/types.js';
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
export type Part = { key: string; style: PartStyle } & (
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
}

export interface RenderContext extends LayoutContext {
  /** Effective state: authored state merged with the interaction state at time t. */
  state: ComponentState;
  /** Live value of an input at time t, when the timeline has typed into it. */
  value?: string;
  /** Whether a focused input's caret is in its visible blink phase. Defaults to visible. */
  caretVisible?: boolean;
}

export interface ComponentDef<N extends SceneNode = SceneNode> {
  /** Bounds in the node's local space (origin at the node's x, y). May have a negative origin, e.g. a line pointing up-left. */
  localBounds(node: N, ctx: LayoutContext): Bounds;
  expand(node: N, ctx: RenderContext): Part[];
  /** Where children of this node are positioned from, in local space. */
  contentOffset?(node: N, ctx: LayoutContext): Point;
  focusable?: boolean;
  interactive?: boolean;
}
