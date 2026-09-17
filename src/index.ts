// Public entry point.
//
// Deliberately small: what is exported here is a compatibility promise. The
// internals (renderer, cursor maths, seeds, DOM patching) stay reachable to
// tests through their module paths, but are not part of the package surface.

export { createDemo, loadDemo, Demo } from './demo.js';
export type {
  DemoOptions,
  LoadOptions,
  Props,
  RelativeProps,
  LayoutChildProps,
  ContainerProps,
  NodeProps,
} from './demo.js';
export { Scene } from './core/scene.js';
export { Timeline } from './timeline/timeline.js';
export type { StepOptions } from './timeline/timeline.js';
export { Player } from './player/player.js';
export type { Clock, PlayerEvent, PlayerOptions } from './player/player.js';

export { registerIcon, iconNames } from './icons/index.js';
export { StrokeFont, DEFAULT_FONT } from './text/index.js';
export { DEFAULT_THEME } from './core/theme.js';

export { CompileError } from './timeline/compile.js';
export { DemoJSONError, parseDemoJSON } from './core/json.js';

export type { DemoJSON } from './core/json.js';
export type { Placement, Align, PlaceDirection } from './core/place.js';
export type { Padding, Layout, LayoutEntry } from './core/layout.js';
export type { Step, StepType, Target, TimelineJSON, InteractionState } from './timeline/types.js';
export type { IconDef, IconElement } from './icons/types.js';
export type { StrokeFontData, StrokeGlyph, TextAlign, TextLayout, PlacedGlyph } from './text/index.js';
export type { Frame, FrameGroup, VElement } from './render/frame.js';
export type {
  Bounds,
  ButtonNode,
  AutoLayoutProps,
  Color,
  ColorLike,
  ComponentState,
  CounterAxisAlignItems,
  LayoutMode,
  LayoutPositioning,
  LayoutSizing,
  PrimaryAxisAlignItems,
  EllipseNode,
  FillStyle,
  FrameNode,
  IconNode,
  InputNode,
  LineNode,
  NodeBase,
  NodeOf,
  NodePatch,
  NodeType,
  Paint,
  Point,
  RectangleNode,
  SceneNode,
  Size,
  SketchStyle,
  SolidPaint,
  TextAlignHorizontal,
  TextNode,
  Theme,
  TypeStyle,
  VectorNode,
  WindowNode,
} from './core/types.js';
