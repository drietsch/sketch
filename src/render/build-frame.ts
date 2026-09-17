import type { Scene } from '../core/scene.js';
import type { ComponentState, SceneNode, Size, Theme } from '../core/types.js';
import { deriveSeed, fnv1a32 } from '../core/ids.js';
import { componentFor } from '../components/index.js';
import type { RenderContext } from '../components/types.js';
import { fmt, serialize, serializeAttrs } from './frame.js';
import type { Frame, FrameGroup, VElement } from './frame.js';
import type { SketchAdapter } from './sketch-adapter.js';
import type { StrokeFont } from '../text/font.js';

export interface FrameContext {
  seed: number;
  theme: Theme;
  font: StrokeFont;
  adapter: SketchAdapter;
  /** Interaction state per node at the frame's time; empty when there is no timeline. */
  states?: ReadonlyMap<string, ComponentState>;
}

/**
 * Builds the frame for a scene: one keyed group per visible node in paint
 * order, each positioned by a transform so its sketched geometry (generated
 * at the node's local origin) never depends on where the node sits.
 */
export function buildFrame(scene: Scene, size: Size, ctx: FrameContext, background?: string): Frame {
  const groups: FrameGroup[] = [];
  for (const node of scene.visible()) {
    groups.push(nodeGroup(scene, node, ctx));
  }
  const frame: Frame = { width: size.width, height: size.height, groups };
  if (background !== undefined) frame.background = background;
  return frame;
}

function nodeGroup(scene: Scene, node: SceneNode, ctx: FrameContext): FrameGroup {
  const def = componentFor(node);
  const authored = 'state' in node ? node.state : undefined;
  const state: ComponentState = { ...authored, ...ctx.states?.get(node.id) };
  const rctx: RenderContext = { theme: ctx.theme, font: ctx.font, state };
  const variant = node.sketchVariant ?? 0;
  const children: VElement[] = [];
  for (const part of def.expand(node, rctx)) {
    const seed = deriveSeed(ctx.seed, 'sketch', node.id, part.key, variant);
    children.push(...ctx.adapter.render(node.id, part, seed));
  }
  const pos = scene.position(node.id);
  const attrs: VElement['attrs'] = {
    'data-type': node.type,
    transform: `translate(${fmt(pos.x)} ${fmt(pos.y)})`,
  };
  if (state.disabled) attrs.opacity = 0.45;
  return group(node.id, attrs, children);
}

/**
 * Wraps children in a keyed group whose `data-h` attribute is a hash of its
 * own content. The hash is content-derived (never a version counter), so two
 * demos that describe the same thing produce the same bytes. `attrs` must not
 * contain `data-key` or `data-h`.
 */
export function group(key: string, attrs: VElement['attrs'], children: VElement[]): FrameGroup {
  const inner = children.map(serialize).join('');
  const rest = serializeAttrs(attrs);
  const hash = fnv1a32(rest + inner).toString(36);
  const el: VElement = { tag: 'g', attrs: { 'data-key': key, 'data-h': hash, ...attrs } };
  if (children.length) el.children = children;
  return { key, hash, el, html: `<g data-key="${key}" data-h="${hash}"${rest}>${inner}</g>` };
}
