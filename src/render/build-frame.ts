import type { Scene } from '../core/scene.js';
import type { ComponentState, ControlValue, SceneNode, Size } from '../core/types.js';
import { deriveSeed, fnv1a32 } from '../core/ids.js';
import { componentFor } from '../components/index.js';
import type { LayoutContext, RenderContext } from '../components/types.js';
import { fmt, serialize, serializeAttrs } from './frame.js';
import type { Frame, FrameGroup, VElement } from './frame.js';
import type { SketchAdapter } from './sketch-adapter.js';

/** What the timeline contributes to one node at time t. */
export interface NodeInteraction {
  state?: ComponentState;
  value?: ControlValue;
  checked?: boolean;
  open?: boolean;
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
  // Nodes that draw an overlay part, and everything beneath them, paint after
  // all ordinary nodes so a popup sits above later siblings of its ancestors.
  const overlay: FrameGroup[] = [];
  const overlaying = new Set<string>();
  let focused: SceneNode | undefined;
  const render = (node: SceneNode) => renderContext(scene, ctx, node);
  for (const node of scene.visible(render)) {
    const { group: g, state, hasOverlay } = nodeGroup(scene, node, ctx, render(node));
    const lifted = hasOverlay || (node.parent !== undefined && overlaying.has(node.parent));
    if (lifted) {
      overlaying.add(node.id);
      overlay.push(g);
    } else {
      groups.push(g);
    }
    if (state.focused && scene.isFocusable(node)) focused = node;
  }
  groups.push(...overlay);
  if (focused) groups.push(focusRing(scene, focused, ctx));
  if (ctx.chrome) groups.push(...ctx.chrome);
  const frame: Frame = { width: size.width, height: size.height, groups };
  if (background !== undefined) frame.background = background;
  return frame;
}

/** The render context for one node: theme and font, plus the timeline's live state for it. */
export function renderContext(scene: Scene, ctx: FrameContext, node: SceneNode): RenderContext {
  const authored = 'state' in node ? node.state : undefined;
  const live = ctx.interaction?.get(node.id);
  const state: ComponentState = { ...authored, ...live?.state };
  const rctx: RenderContext = {
    theme: ctx.theme,
    font: ctx.font,
    icons: ctx.icons,
    document: ctx.document,
    state,
    bounds: (id) => scene.bounds(id),
  };
  if (live?.value !== undefined) rctx.value = live.value;
  if (live?.checked !== undefined) rctx.checked = live.checked;
  if (live?.open !== undefined) rctx.open = live.open;
  if (live?.caretVisible !== undefined) rctx.caretVisible = live.caretVisible;
  return rctx;
}

function nodeGroup(
  scene: Scene,
  node: SceneNode,
  ctx: FrameContext,
  rctx: RenderContext,
): { group: FrameGroup; state: ComponentState; hasOverlay: boolean } {
  const def = componentFor(node);
  const state = rctx.state;
  const variant = node.sketchVariant ?? 0;
  const children: VElement[] = [];
  let hasOverlay = false;
  for (const part of def.expand(scene.resolved(node.id), rctx)) {
    if (part.layer === 'overlay') hasOverlay = true;
    const seed = deriveSeed(ctx.seed, 'sketch', node.id, part.key, variant);
    children.push(...ctx.adapter.render(node.id, part, seed));
  }
  const pos = scene.position(node.id);
  const attrs: VElement['attrs'] = {
    'data-type': node.type,
    transform: `translate(${fmt(pos.x)} ${fmt(pos.y)})`,
  };
  if (state.disabled) attrs.opacity = 0.45;
  return { group: group(node.id, attrs, children), state, hasOverlay };
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
  // Same form as serialize(): an empty group self-closes.
  const open = `<g data-key="${key}" data-h="${hash}"${rest}`;
  return { key, hash, el, html: inner ? `${open}>${inner}</g>` : `${open}/>` };
}
