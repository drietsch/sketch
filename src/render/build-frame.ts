import type { Scene } from '../core/scene.js';
import type { ComponentState, SceneNode, Size } from '../core/types.js';
import { deriveSeed, fnv1a32 } from '../core/ids.js';
import { componentFor } from '../components/index.js';
import type { LayoutContext, RenderContext } from '../components/types.js';
import { fmt, serialize, serializeAttrs } from './frame.js';
import type { Frame, FrameGroup, VElement } from './frame.js';
import type { SketchAdapter } from './sketch-adapter.js';

/** What the timeline contributes to one node at time t. */
export interface NodeInteraction {
  state?: ComponentState;
  value?: string;
  caretVisible?: boolean;
}

export interface FrameContext extends LayoutContext {
  seed: number;
  adapter: SketchAdapter;
  /** Interaction per node at the frame's time; absent when there is no timeline. */
  interaction?: ReadonlyMap<string, NodeInteraction>;
  /** Extra groups appended after the scene (focus ring, cursor). */
  chrome?: FrameGroup[];
}

export const FOCUS_RING_KEY = '__focus';

/**
 * Builds the frame for a scene: one keyed group per visible node in paint
 * order, each positioned by a transform so its sketched geometry (generated
 * at the node's local origin) never depends on where the node sits.
 */
export function buildFrame(scene: Scene, size: Size, ctx: FrameContext, background?: string): Frame {
  const groups: FrameGroup[] = [];
  let focused: SceneNode | undefined;
  for (const node of scene.visible()) {
    const { group: g, state } = nodeGroup(scene, node, ctx);
    groups.push(g);
    if (state.focused && scene.isFocusable(node)) focused = node;
  }
  if (focused) groups.push(focusRing(scene, focused, ctx));
  if (ctx.chrome) groups.push(...ctx.chrome);
  const frame: Frame = { width: size.width, height: size.height, groups };
  if (background !== undefined) frame.background = background;
  return frame;
}

function nodeGroup(scene: Scene, node: SceneNode, ctx: FrameContext): { group: FrameGroup; state: ComponentState } {
  const def = componentFor(node);
  const authored = 'state' in node ? node.state : undefined;
  const live = ctx.interaction?.get(node.id);
  const state: ComponentState = { ...authored, ...live?.state };
  const rctx: RenderContext = { theme: ctx.theme, font: ctx.font, icons: ctx.icons, state };
  if (live?.value !== undefined) rctx.value = live.value;
  if (live?.caretVisible !== undefined) rctx.caretVisible = live.caretVisible;
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
  return { group: group(node.id, attrs, children), state };
}

/** A dashed, lightly sketched ring around the focused node's bounds. */
function focusRing(scene: Scene, node: SceneNode, ctx: FrameContext): FrameGroup {
  const b = scene.bounds(node.id);
  const pad = 3;
  const els = ctx.adapter.sketch(
    (gen, o) => gen.roundedRectangle(0, 0, b.width + pad * 2, b.height + pad * 2, ctx.theme.radius + pad, o),
    {
      stroke: ctx.theme.accent,
      strokeWeight: 1,
      fillStyle: 'hachure',
      roughness: 0.8,
      bowing: 0.5,
      strokeDashes: [5, 4],
      disableMultiStroke: true,
    },
    deriveSeed(ctx.seed, 'focus', node.id, Math.round(b.width), Math.round(b.height)),
  );
  return group(
    FOCUS_RING_KEY,
    { 'data-for': node.id, transform: `translate(${fmt(b.x - pad)} ${fmt(b.y - pad)})` },
    els,
  );
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
