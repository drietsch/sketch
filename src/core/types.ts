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

/**
 * Per-node visual overrides. Every field is optional; unset fields fall back
 * to the theme (for colours and stroke) or the engine defaults (for sketching
 * parameters).
 */
export interface Style {
  stroke?: string;
  strokeWidth?: number;
  fill?: string;
  fillStyle?: FillStyle;
  roughness?: number;
  bowing?: number;
  hachureGap?: number;
  hachureAngle?: number;
  fillWeight?: number;
  /** Dash pattern for the outline, in user units. */
  dash?: number[];
  opacity?: number;
  /** Text colour; defaults to theme.text. */
  color?: string;
  fontSize?: number;
}

export interface Theme {
  stroke: string;
  text: string;
  accent: string;
  muted: string;
  surface: string;
  background: string;
  strokeWidth: number;
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
  checked?: boolean;
}

export interface NodeBase {
  id: string;
  /** Position relative to the parent's content origin, or the document. */
  x: number;
  y: number;
  parent?: string;
  style?: Style;
  hidden?: boolean;
  /** Whether the node takes part in hit-testing. Components default to true, primitives to false. */
  interactive?: boolean;
  /** Re-rolls this node's sketch jitter without changing the document seed. */
  sketchVariant?: number;
}

export interface RectNode extends NodeBase {
  type: 'rect';
  width: number;
  height: number;
  radius?: number;
}

export interface EllipseNode extends NodeBase {
  type: 'ellipse';
  width: number;
  height: number;
}

/** A line from (x, y) to (x2, y2), both in the parent's coordinate space. */
export interface LineNode extends NodeBase {
  type: 'line';
  x2: number;
  y2: number;
}

/** SVG path data in the node's local coordinate space (origin at x, y). */
export interface PathNode extends NodeBase {
  type: 'path';
  d: string;
}

export interface TextNode extends NodeBase {
  type: 'text';
  text: string;
  fontSize?: number;
  align?: 'start' | 'middle' | 'end';
}

export interface IconNode extends NodeBase {
  type: 'icon';
  /** A registered icon name, or an icon definition passed directly. */
  icon: string | IconDef;
  size?: number;
}

export interface ButtonNode extends NodeBase {
  type: 'button';
  text: string;
  icon?: string | IconDef;
  width?: number;
  height?: number;
  variant?: 'default' | 'primary';
  state?: ComponentState;
}

export interface InputNode extends NodeBase {
  type: 'input';
  width: number;
  height?: number;
  value?: string;
  placeholder?: string;
  state?: ComponentState;
}

export interface PanelNode extends NodeBase {
  type: 'panel';
  width: number;
  height: number;
  title?: string;
}

export interface WindowNode extends NodeBase {
  type: 'window';
  width: number;
  height: number;
  title?: string;
  chrome: 'window' | 'browser';
  url?: string;
}

export type SceneNode =
  RectNode | EllipseNode | LineNode | PathNode | TextNode | IconNode | ButtonNode | InputNode | PanelNode | WindowNode;

export type NodeType = SceneNode['type'];
export type NodeOf<T extends NodeType> = Extract<SceneNode, { type: T }>;
export type DistributiveOmit<T, K extends PropertyKey> = T extends unknown ? Omit<T, K> : never;

/** A partial update for a node. For the full union this accepts any node type's fields. */
export type NodePatch<N extends SceneNode = SceneNode> = Partial<DistributiveOmit<N, 'id' | 'type'>>;
