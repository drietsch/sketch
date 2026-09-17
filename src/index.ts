// Public entry point.

export { createDemo, Demo } from './demo.js';
export type { DemoOptions, Props } from './demo.js';
export { Scene } from './core/scene.js';
export { DEFAULT_THEME } from './core/theme.js';
export { deriveSeed } from './core/ids.js';
export { frameToSVG } from './render/svg-string.js';
export { registerIcon, iconNames, BUILTIN_ICONS } from './icons/index.js';
export { StrokeFont, DEFAULT_FONT, layoutText } from './text/index.js';
export type { StrokeFontData, StrokeGlyph, TextAlign, TextLayout, PlacedGlyph } from './text/index.js';

export type {
  Bounds,
  ButtonNode,
  ComponentState,
  EllipseNode,
  FillStyle,
  IconNode,
  InputNode,
  LineNode,
  NodeBase,
  NodeOf,
  NodePatch,
  NodeType,
  PanelNode,
  PathNode,
  Point,
  RectNode,
  SceneNode,
  Size,
  Style,
  TextNode,
  Theme,
  WindowNode,
} from './core/types.js';
export type { IconDef, IconElement } from './icons/types.js';
export type { Frame, FrameGroup, VElement } from './render/frame.js';
