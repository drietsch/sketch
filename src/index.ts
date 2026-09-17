// Public entry point.

export { createDemo, loadDemo, Demo } from './demo.js';
export type { DemoOptions, LoadOptions, Props } from './demo.js';
export { DemoJSONError, parseDemoJSON } from './core/json.js';
export { Timeline, validateStep } from './timeline/timeline.js';
export type { StepOptions } from './timeline/timeline.js';
export { CompileError } from './timeline/compile.js';
export { stateAt, caretVisible, CARET_PERIOD, RIPPLE_DURATION } from './timeline/state.js';
export { cursorAt, planCursorPath, samplePath, fittsDuration } from './timeline/cursor-path.js';
export type {
  Step,
  StepType,
  Target,
  TimelineJSON,
  CursorPath,
  TypingPlan,
  CompiledStep,
  CompiledTimeline,
  InteractionState,
} from './timeline/types.js';
export type { DemoJSON } from './core/json.js';
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
