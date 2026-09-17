import type { FillStyle } from '../sketch/index.js';
import type { IconDef } from '../icons/types.js';

export type { FillStyle };

export interface Point {
  x: number;
  y: number;
}

export interface Size {
  width: number;
  height: number;
}

export interface Bounds extends Point, Size {}

/** An RGBA colour with components in 0..1, as Figma spells it. `a` defaults to 1. */
export interface Color {
  r: number;
  g: number;
  b: number;
  a?: number;
}

/** A Figma `Color`, or a CSS colour string for convenience. */
export type ColorLike = Color | string;

/** A solid paint. Only `SOLID` is supported; gradients and images are rejected at load. */
export interface SolidPaint {
  type: 'SOLID';
  color: ColorLike;
  /** 0..1, multiplied into the colour's alpha. */
  opacity?: number;
  /** Defaults to true; an invisible paint is skipped. */
  visible?: boolean;
}

export type Paint = SolidPaint;

/**
 * The hand-drawn look. Figma has no equivalent, so these live under their own
 * key. Unset fields fall back to the theme or the engine defaults.
 */
export interface SketchStyle {
  roughness?: number;
  bowing?: number;
  fillStyle?: FillStyle;
  hachureGap?: number;
  hachureAngle?: number;
  fillWeight?: number;
}

export type TextAlignHorizontal = 'LEFT' | 'CENTER' | 'RIGHT';

/** Text styling, a subset of Figma's TypeStyle. `fills` colours the glyphs. */
export interface TypeStyle {
  fontSize?: number;
  textAlignHorizontal?: TextAlignHorizontal;
  fills?: Paint[];
}

export interface Theme {
  stroke: string;
  text: string;
  accent: string;
  muted: string;
  surface: string;
  background: string;
  strokeWeight: number;
  roughness: number;
  bowing: number;
  radius: number;
  fontSize: number;
  /** Roughness applied to text strokes; text wants less wobble than boxes. */
  textRoughness: number;
}

/**
 * Authored component state. Interaction state (what the timeline does to a
 * component at time t) is derived per frame and is never written back here.
 */
export interface ComponentState {
  focused?: boolean;
  pressed?: boolean;
  hovered?: boolean;
  disabled?: boolean;
}

/** A model value a control carries: text, a number, a selection, or several selections. */
export type ControlValue = string | number | string[];

export type LayoutMode = 'NONE' | 'HORIZONTAL' | 'VERTICAL';
export type PrimaryAxisAlignItems = 'MIN' | 'CENTER' | 'MAX' | 'SPACE_BETWEEN';
export type CounterAxisAlignItems = 'MIN' | 'CENTER' | 'MAX';
export type LayoutSizing = 'FIXED' | 'HUG' | 'FILL';
export type LayoutPositioning = 'AUTO' | 'ABSOLUTE';

/**
 * Figma-style auto-layout of a container's content area. Every default is
 * omitted from the stored node. Children of a container with a `layoutMode`
 * are positioned by the layout unless they are `layoutPositioning: 'ABSOLUTE'`.
 */
export interface AutoLayoutProps {
  /** NONE (default): children sit at their own x/y. */
  layoutMode?: LayoutMode;
  /** Gap between children along the primary axis. */
  itemSpacing?: number;
  paddingLeft?: number;
  paddingRight?: number;
  paddingTop?: number;
  paddingBottom?: number;
  /** Where children sit along the primary axis when there is slack. */
  primaryAxisAlignItems?: PrimaryAxisAlignItems;
  /** Where each child sits across the primary axis. */
  counterAxisAlignItems?: CounterAxisAlignItems;
}

export interface NodeBase {
  id: string;
  /** Position relative to the parent's content origin, or the document. Ignored for AUTO children of a layout container. */
  x: number;
  y: number;
  parent?: string;
  /** ABSOLUTE children of a layout container keep their x/y and are skipped by the layout. */
  layoutPositioning?: LayoutPositioning;
  /** FIXED (default) uses the stored size; HUG wraps content (containers); FILL takes the parent's available space. */
  layoutSizingHorizontal?: LayoutSizing;
  layoutSizingVertical?: LayoutSizing;
  /** Defaults to true. An invisible node and its children are not rendered, hit-tested or targetable. */
  visible?: boolean;
  /** Fill paints, bottom to top; the first visible one is drawn. Absent: the component's default; empty: no fill. */
  fills?: Paint[];
  /** Stroke paints; the first visible one outlines the node. Absent: the theme stroke; empty: no outline. */
  strokes?: Paint[];
  strokeWeight?: number;
  /** Dash pattern for the outline, in user units. */
  strokeDashes?: number[];
  /** Whole-node opacity, 0..1. */
  opacity?: number;
  /** The hand-drawn look of this node. */
  sketch?: SketchStyle;
  /** Whether the node takes part in hit-testing. Components default to true, primitives to false. */
  interactive?: boolean;
  /** Re-rolls this node's sketch jitter without changing the document seed. */
  sketchVariant?: number;
  /**
   * Model state, Base UI's names. Authored here; the timeline overrides it live
   * (a click toggles `checked`, `choose` sets `value`) without writing back.
   */
  checked?: boolean;
  open?: boolean;
  value?: ControlValue;
  pressed?: boolean;
}

export interface RectangleNode extends NodeBase {
  type: 'RECTANGLE';
  width: number;
  height: number;
  cornerRadius?: number;
}

export interface EllipseNode extends NodeBase {
  type: 'ELLIPSE';
  width: number;
  height: number;
}

/** A line from (x, y) to (x2, y2), both in the parent's coordinate space. */
export interface LineNode extends NodeBase {
  type: 'LINE';
  x2: number;
  y2: number;
}

/** SVG path data in the node's local coordinate space (origin at x, y). */
export interface VectorNode extends NodeBase {
  type: 'VECTOR';
  d: string;
}

export interface TextNode extends NodeBase {
  type: 'TEXT';
  characters: string;
  style?: TypeStyle;
}

export interface IconNode extends NodeBase {
  type: 'ICON';
  /** A registered icon name, or an icon definition passed directly. */
  icon: string | IconDef;
  size?: number;
}

export interface ButtonNode extends NodeBase {
  type: 'BUTTON';
  characters: string;
  /** Styling of the label. */
  style?: TypeStyle;
  icon?: string | IconDef;
  width?: number;
  height?: number;
  variant?: 'default' | 'primary';
  state?: ComponentState;
}

export interface InputNode extends NodeBase {
  type: 'INPUT';
  width: number;
  height?: number;
  value?: string;
  placeholder?: string;
  /** Styling of the value and placeholder text. */
  style?: TypeStyle;
  state?: ComponentState;
}

/** A container, optionally with a title bar and auto-layout. Children are positioned from below the bar. */
export interface FrameNode extends NodeBase, AutoLayoutProps {
  type: 'FRAME';
  /** Required unless the horizontal sizing is HUG or FILL. */
  width?: number;
  /** Required unless the vertical sizing is HUG or FILL. */
  height?: number;
  title?: string;
  /** Styling of the title. */
  style?: TypeStyle;
}

export interface WindowNode extends NodeBase, AutoLayoutProps {
  type: 'WINDOW';
  width: number;
  height: number;
  title?: string;
  chrome: 'window' | 'browser';
  url?: string;
  /** Styling of the title and url text. */
  style?: TypeStyle;
}

export type SceneNode =
  | RectangleNode
  | EllipseNode
  | LineNode
  | VectorNode
  | TextNode
  | IconNode
  | ButtonNode
  | InputNode
  | FrameNode
  | WindowNode;

export type NodeType = SceneNode['type'];
export type NodeOf<T extends NodeType> = Extract<SceneNode, { type: T }>;
export type DistributiveOmit<T, K extends PropertyKey> = T extends unknown ? Omit<T, K> : never;

/** A partial update for a node. For the full union this accepts any node type's fields. */
export type NodePatch<N extends SceneNode = SceneNode> = Partial<DistributiveOmit<N, 'id' | 'type'>>;
