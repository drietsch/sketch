import type { Bounds, NodePatch, Point, SceneNode } from './types.js';
import type { DocumentNode } from './json.js';
import { assertValidId } from './ids.js';
import { componentFor, hasComponent } from '../components/index.js';
import type { LayoutContext, Region, RenderContext } from '../components/types.js';

/** The result of a detailed hit-test: a node and, when the point fell on one, the region within it. */
export interface Hit {
  id: string;
  region?: Region;
}
import { computeLayout, stripLayoutDefaults, validateLayoutProps } from './layout.js';
import type { Layout, LayoutEntry } from './layout.js';

const ROOT = '';

export interface SceneHooks {
  /** Called once per remove() with the id of the removed node and all of its descendants. */
  onRemove?(ids: readonly string[]): void;
}

/**
 * The scene: what exists. A flat store of nodes addressed by id, with parent
 * references and a per-parent z-order. Coordinates of a child are relative to
 * its parent's content origin.
 *
 * The scene only ever holds authored state. Playback derives interaction
 * state from the timeline per frame and never writes it back here, which is
 * what makes rendering a pure function of (scene, timeline, seed, t).
 */
export class Scene {
  private readonly nodes = new Map<string, SceneNode>();
  /** Children per parent id (ROOT for top level), in z-order: last is topmost. */
  private readonly children = new Map<string, string[]>([[ROOT, []]]);
  private readonly versions = new Map<string, number>();
  private version_ = 0;
  private layoutCache?: { version: number; layout: Layout };

  constructor(
    private readonly ctx: LayoutContext,
    private readonly hooks: SceneHooks = {},
  ) {}

  /** Bumps on every mutation; consumers use it to invalidate compiled timelines. */
  get version(): number {
    return this.version_;
  }

  add<N extends SceneNode>(node: N): N {
    assertValidId(node.id);
    if (this.nodes.has(node.id)) {
      throw new Error(`Duplicate node id "${node.id}"`);
    }
    if (!hasComponent(node.type)) {
      throw new Error(`Unknown node type "${String(node.type)}"`);
    }
    const parent = node.parent ?? ROOT;
    if (parent !== ROOT && !this.nodes.has(parent)) {
      throw new Error(`Unknown parent "${parent}" for node "${node.id}"`);
    }
    const stored = { ...node };
    if (stored.parent === undefined) delete stored.parent;
    const problem = this.validateNode(stored);
    if (problem) throw new Error(`Node "${stored.id}": ${problem}`);
    stripLayoutDefaults(stored as unknown as Record<string, unknown>);
    this.nodes.set(stored.id, stored);
    this.children.get(parent)!.push(stored.id);
    this.children.set(stored.id, []);
    this.touch(stored.id);
    return stored;
  }

  has(id: string): boolean {
    return this.nodes.has(id);
  }

  get<N extends SceneNode = SceneNode>(id: string): N | undefined {
    return this.nodes.get(id) as N | undefined;
  }

  /** Like get(), but throws for unknown ids. */
  node<N extends SceneNode = SceneNode>(id: string): N {
    const node = this.nodes.get(id);
    if (!node) {
      throw new Error(`Unknown node "${id}"`);
    }
    return node as N;
  }

  /**
   * Shallow-merges a patch into the node. `style`, `sketch` and `state` are
   * merged one level deep so callers can set a single field or flag. Reparenting is
   * supported by patching `parent`.
   */
  update<N extends SceneNode = SceneNode>(id: string, patch: NodePatch<N>): N {
    const node = this.node<N>(id);
    const current = node as unknown as Record<string, unknown>;
    const next: Record<string, unknown> = { ...current };
    const p = patch as Record<string, unknown>;
    for (const key of Object.keys(p)) {
      const value = p[key];
      if ((key === 'style' || key === 'state' || key === 'sketch') && value && typeof value === 'object') {
        next[key] = { ...(current[key] as object | undefined), ...(value as object) };
      } else if (value === undefined) {
        delete next[key];
      } else {
        next[key] = value;
      }
    }
    if (p.parent !== undefined && p.parent !== node.parent) {
      this.reparent(id, p.parent as string);
    } else if ('parent' in p && p.parent === undefined && node.parent !== undefined) {
      this.reparent(id, ROOT);
    }
    const stored = next as unknown as N;
    const problem = this.validateNode(stored);
    if (problem) throw new Error(`Node "${id}": ${problem}`);
    stripLayoutDefaults(next);
    this.nodes.set(id, stored);
    this.touch(id);
    return stored;
  }

  /** Removes the node and all of its descendants. */
  remove(id: string): void {
    this.node(id);
    const removed: string[] = [];
    this.removeSubtree(id, removed);
    this.version_ += 1;
    this.hooks.onRemove?.(removed);
  }

  private removeSubtree(id: string, removed: string[]): void {
    const node = this.nodes.get(id)!;
    // Copy: removing a child splices the very list being walked.
    for (const child of this.children.get(id)!.slice()) {
      this.removeSubtree(child, removed);
    }
    const siblings = this.children.get(node.parent ?? ROOT)!;
    siblings.splice(siblings.indexOf(id), 1);
    this.children.delete(id);
    this.nodes.delete(id);
    this.versions.delete(id);
    removed.push(id);
  }

  /** Direct children in z-order (last is topmost). */
  childrenOf(parent?: string): readonly string[] {
    const list = this.children.get(parent ?? ROOT);
    if (!list) {
      throw new Error(`Unknown node "${parent}"`);
    }
    return list;
  }

  /** Every node in paint order: parents before children, siblings in z-order. */
  all(): SceneNode[] {
    const out: SceneNode[] = [];
    const walk = (parent: string) => {
      for (const id of this.children.get(parent)!) {
        out.push(this.nodes.get(id)!);
        walk(id);
      }
    };
    walk(ROOT);
    return out;
  }

  /**
   * Paint order, skipping hidden nodes and everything beneath them, and the
   * children a parent's component hides (a closed collapsible, an inactive
   * tab panel).
   */
  visible(): SceneNode[] {
    const out: SceneNode[] = [];
    const walk = (parent: string) => {
      const ids = this.children.get(parent)!;
      const owner = parent === ROOT ? undefined : this.nodes.get(parent)!;
      const def = owner ? componentFor(owner) : undefined;
      ids.forEach((id, index) => {
        const node = this.nodes.get(id)!;
        if (node.visible === false) return;
        if (owner && def?.childVisible && !def.childVisible(owner, this.ctx, index)) return;
        out.push(node);
        walk(id);
      });
    };
    walk(ROOT);
    return out;
  }

  /**
   * Whether the child at `index` of `parent` is shown by its parent's
   * component. Reads the stored node (live state that affects this is
   * patched into it), so it is safe to call while the layout is computed.
   */
  childShown(parent: string, index: number): boolean {
    const owner = this.nodes.get(parent)!;
    const def = componentFor(owner);
    return !def.childVisible || def.childVisible(owner, this.ctx, index);
  }

  /** Layout and per-type validation shared by add() and update(). */
  private validateNode(node: SceneNode): string | undefined {
    const def = componentFor(node);
    const anchor = def.anchor?.(node)?.id;
    if (anchor === node.id) return 'a node cannot anchor to itself';
    if (anchor !== undefined && !this.nodes.has(anchor)) return `anchor "${anchor}" does not exist`;
    return (
      validateLayoutProps(
        node as unknown as Record<string, unknown>,
        !!def.resizable,
        !!def.container,
        !!def.container && !def.intrinsicSize,
      ) ?? def.validate?.(node)
    );
  }

  /** Whether the node's centre is inside every clipping ancestor's viewport (false when scrolled out of view). */
  isInView(id: string): boolean {
    const b = this.bounds(id);
    return !this.clippedOut(this.node(id), { x: b.x + b.width / 2, y: b.y + b.height / 2 });
  }

  /** Whether an ancestor's clip (a scroll area's viewport) excludes the point. */
  private clippedOut(node: SceneNode, point: Point): boolean {
    for (let p = node.parent; p !== undefined; p = this.nodes.get(p)?.parent) {
      const owner = this.nodes.get(p);
      if (!owner) break;
      const clip = componentFor(owner).clip?.(this.resolved(p), this.ctx);
      if (!clip) continue;
      const o = this.position(p);
      if (
        point.x < o.x + clip.x ||
        point.x > o.x + clip.x + clip.width ||
        point.y < o.y + clip.y ||
        point.y > o.y + clip.y + clip.height
      )
        return true;
    }
    return false;
  }

  bringToFront(id: string): void {
    this.reorder(id, (list, i) => {
      list.push(...list.splice(i, 1));
    });
  }

  sendToBack(id: string): void {
    this.reorder(id, (list, i) => {
      list.unshift(...list.splice(i, 1));
    });
  }

  /**
   * Laid-out geometry of every node: absolute position and bounds, and the
   * node view with any size the layout decided. Recomputed when `version`
   * changes; otherwise free.
   */
  layout(): Layout {
    const c = this.layoutCache;
    if (c && c.version === this.version_) return c.layout;
    const layout = computeLayout(this, this.ctx);
    this.layoutCache = { version: this.version_, layout };
    return layout;
  }

  private entry(id: string): LayoutEntry {
    const e = this.layout().get(id);
    if (!e) {
      throw new Error(`Unknown node "${id}"`);
    }
    return e;
  }

  /** The node with its laid-out width/height; what the renderer draws. Identical to `node(id)` unless layout resized it. */
  resolved<N extends SceneNode = SceneNode>(id: string): N {
    return this.entry(id).node as N;
  }

  /** Absolute position of the node's origin in document space. */
  position(id: string): Point {
    const p = this.entry(id).position;
    return { x: p.x, y: p.y };
  }

  /** Bounds in the node's own coordinate space. */
  localBounds(id: string): Bounds {
    const { position: p, bounds: b } = this.entry(id);
    return { x: b.x - p.x, y: b.y - p.y, width: b.width, height: b.height };
  }

  /**
   * Local bounds of a node that need not be in the scene: a pure function of
   * the node and the layout context, so a node can be measured before it is
   * added (relative placement needs the new node's size).
   */
  measure(node: SceneNode): Bounds {
    return componentFor(node).localBounds(node, this.ctx);
  }

  /** Absolute bounds in document space. */
  bounds(id: string): Bounds {
    return { ...this.entry(id).bounds };
  }

  /** Where children of this node are positioned from, in document space. */
  contentOrigin(id: string): Point {
    const { node, position: pos } = this.entry(id);
    const offset = componentFor(node).contentOffset?.(node, this.ctx) ?? { x: 0, y: 0 };
    return { x: pos.x + offset.x, y: pos.y + offset.y };
  }

  /** Whether the node takes part in hit-testing. */
  isInteractive(node: SceneNode): boolean {
    return node.interactive ?? componentFor(node).interactive ?? false;
  }

  isFocusable(node: SceneNode): boolean {
    return !!componentFor(node).focusable && node.visible !== false;
  }

  /** The topmost visible, interactive node containing the point, if any. */
  hitTest(point: Point, render?: (node: SceneNode) => RenderContext): string | undefined {
    return this.hitTestDetailed(point, render)?.id;
  }

  /**
   * Like hitTest, but also the topmost region of the hit node under the point.
   * Overlay regions (an open popup) are checked first, across all nodes in
   * reverse paint order, so a popup takes clicks from whatever is beneath it.
   */
  hitTestDetailed(point: Point, render?: (node: SceneNode) => RenderContext): Hit | undefined {
    const nodes = this.visible();
    const inside = (b: Bounds, origin: Point) =>
      point.x >= origin.x + b.x &&
      point.x <= origin.x + b.x + b.width &&
      point.y >= origin.y + b.y &&
      point.y <= origin.y + b.y + b.height;
    /** The topmost interactive node among `candidates` under the point, with its in-place region. */
    const ordinary = (candidates: SceneNode[]): Hit | undefined => {
      for (let i = candidates.length - 1; i >= 0; i--) {
        const node = candidates[i];
        if (!this.isInteractive(node)) continue;
        if (!inside(this.localBounds(node.id), this.position(node.id))) continue;
        if (this.clippedOut(node, point)) continue;
        const def = componentFor(node);
        if (render && def.regions) {
          const origin = this.position(node.id);
          const regions = def.regions(this.resolved(node.id), render(node));
          for (let r = regions.length - 1; r >= 0; r--) {
            if (regions[r].layer !== 'overlay' && inside(regions[r].bounds, origin))
              return { id: node.id, region: regions[r] };
          }
        }
        return { id: node.id };
      }
      return undefined;
    };
    if (render) {
      for (let i = nodes.length - 1; i >= 0; i--) {
        const node = nodes[i];
        const def = componentFor(node);
        if (!def.regions) continue;
        const origin = this.position(node.id);
        const regions = def.regions(this.resolved(node.id), render(node));
        for (let r = regions.length - 1; r >= 0; r--) {
          if (regions[r].layer === 'overlay' && inside(regions[r].bounds, origin)) {
            // The popup's own children (a dialog's buttons) sit above its body.
            const descendants = nodes.filter((n) => this.isDescendant(n.id, node.id));
            return ordinary(descendants) ?? { id: node.id, region: regions[r] };
          }
        }
      }
    }
    return ordinary(nodes);
  }

  /** Whether `id` is below `ancestor` in the tree. */
  isDescendant(id: string, ancestor: string): boolean {
    for (let p = this.nodes.get(id)?.parent; p !== undefined; p = this.nodes.get(p)?.parent) {
      if (p === ancestor) return true;
    }
    return false;
  }

  /** Per-node version, bumped by update(); `undefined` for unknown ids. */
  nodeVersion(id: string): number | undefined {
    return this.versions.get(id);
  }

  /** An independent copy with the same nodes, order and context. Hooks are not copied: a clone is a throwaway working copy. */
  clone(): Scene {
    const copy = new Scene(this.ctx);
    for (const node of this.all()) copy.add(Object.assign({}, node));
    return copy;
  }

  /** The document tree: top-level nodes back to front, each with its `children` nested, and no `parent` keys. */
  toJSON(): DocumentNode[] {
    const build = (parent: string): DocumentNode[] =>
      this.children.get(parent)!.map((id) => {
        const { parent: _omit, ...rest } = this.nodes.get(id)!;
        void _omit;
        const doc = rest as DocumentNode;
        const kids = build(id);
        if (kids.length) doc.children = kids;
        return doc;
      });
    return build(ROOT);
  }

  private reparent(id: string, parent: string): void {
    if (parent !== ROOT) {
      if (!this.nodes.has(parent)) {
        throw new Error(`Unknown parent "${parent}" for node "${id}"`);
      }
      for (let p: string | undefined = parent; p !== undefined; p = this.nodes.get(p)?.parent) {
        if (p === id) {
          throw new Error(`Cannot make "${id}" a descendant of itself`);
        }
      }
    }
    const node = this.nodes.get(id)!;
    const from = this.children.get(node.parent ?? ROOT)!;
    from.splice(from.indexOf(id), 1);
    this.children.get(parent)!.push(id);
  }

  private reorder(id: string, move: (list: string[], index: number) => void): void {
    const node = this.node(id);
    const list = this.children.get(node.parent ?? ROOT)!;
    move(list, list.indexOf(id));
    this.version_ += 1;
  }

  private touch(id: string): void {
    this.versions.set(id, (this.versions.get(id) ?? 0) + 1);
    this.version_ += 1;
  }
}
