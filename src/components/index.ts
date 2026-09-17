import type { NodeOf, NodeType, SceneNode } from '../core/types.js';
import type { ComponentDef } from './types.js';
import { ellipse, icon, line, path, rect, text } from './primitives.js';
import { button } from './button.js';
import { input } from './input.js';
import { panel } from './panel.js';
import { window } from './window.js';

const COMPONENTS: { [T in NodeType]?: ComponentDef<NodeOf<T>> } = {
  rect,
  ellipse,
  line,
  path,
  text,
  icon,
  button,
  input,
  panel,
  window,
};

export function hasComponent(type: string): type is NodeType {
  return Object.hasOwn(COMPONENTS, type);
}

export function componentFor<N extends SceneNode>(node: N): ComponentDef<N> {
  const def = COMPONENTS[node.type];
  if (!def) {
    throw new Error(`Unknown node type "${node.type}"`);
  }
  return def as unknown as ComponentDef<N>;
}

export function registerComponent<T extends NodeType>(type: T, def: ComponentDef<NodeOf<T>>): void {
  (COMPONENTS as Record<string, ComponentDef<SceneNode>>)[type] = def as unknown as ComponentDef<SceneNode>;
}

export type { ComponentDef, LayoutContext, Part, PartStyle, RenderContext } from './types.js';
