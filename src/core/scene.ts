import type { Bounds, NodePatch, Point, SceneNode } from './types.js';
import { assertValidId } from './ids.js';
import { componentFor, hasComponent } from '../components/index.js';
import type { LayoutContext } from '../components/types.js';

const ROOT = '';

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

  constructor(private readonly ctx: LayoutContext) {}

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
   * Shallow-merges a patch into the node. `style` and `state` are merged one
   * level deep so callers can set a single colour or flag. Reparenting is
   * supported by patching `parent`.
   */
  update<N extends SceneNode = SceneNode>(id: string, patch: NodePatch<N>): N {
    const node = this.node<N>(id);
    const current = node as unknown as Record<string, unknown>;
    const next: Record<string, unknown> = { ...current };
    const p = patch as Record<string, unknown>;
    for (const key of Object.keys(p)) {
      const value = p[key];
      if ((key === 'style' || key === 'state') && value && typeof value === 'object') {
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
    this.nodes.set(id, stored);
    this.touch(id);
    return stored;
  }

  /** Removes the node and all of its descendants. */
  remove(id: string): void {
    const node = this.node(id);
    // Copy: removing a child splices the very list being walked.
    for (const child of this.children.get(id)!.slice()) {
      this.remove(child);
    }
    const siblings = this.children.get(node.parent ?? ROOT)!;
    siblings.splice(siblings.indexOf(id), 1);
    this.children.delete(id);
    this.nodes.delete(id);
    this.versions.delete(id);
    this.version_ += 1;
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

  /** Paint order, skipping hidden nodes and everything beneath them. */
  visible(): SceneNode[] {
    const out: SceneNode[] = [];
    const walk = (parent: string) => {
      for (const id of this.children.get(parent)!) {
        const node = this.nodes.get(id)!;
        if (node.hidden) continue;
        out.push(node);
        walk(id);
      }
    };
    walk(ROOT);
    return out;
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

  /** Absolute position of the node's origin in document space. */
  position(id: string): Point {
    const node = this.node(id);
    let x = node.x;
    let y = node.y;
    let parentId = node.parent;
    while (parentId !== undefined) {
      const parent = this.node(parentId);
      const offset = componentFor(parent).contentOffset?.(parent, this.ctx) ?? { x: 0, y: 0 };
      x += parent.x + offset.x;
      y += parent.y + offset.y;
      parentId = parent.parent;
    }
    return { x, y };
  }

  /** Bounds in the node's own coordinate space. */
  localBounds(id: string): Bounds {
    const node = this.node(id);
    return componentFor(node).localBounds(node, this.ctx);
  }

  /** Absolute bounds in document space. */
  bounds(id: string): Bounds {
    const local = this.localBounds(id);
    const pos = this.position(id);
    return { x: pos.x + local.x, y: pos.y + local.y, width: local.width, height: local.height };
  }

  /** Where children of this node are positioned from, in document space. */
  contentOrigin(id: string): Point {
    const node = this.node(id);
    const pos = this.position(id);
    const offset = componentFor(node).contentOffset?.(node, this.ctx) ?? { x: 0, y: 0 };
    return { x: pos.x + offset.x, y: pos.y + offset.y };
  }

  /** Whether the node takes part in hit-testing. */
  isInteractive(node: SceneNode): boolean {
    return node.interactive ?? componentFor(node).interactive ?? false;
  }

  isFocusable(node: SceneNode): boolean {
    return !!componentFor(node).focusable && !node.hidden;
  }

  /** The topmost visible, interactive node containing the point, if any. */
  hitTest(point: Point): string | undefined {
    const nodes = this.visible();
    for (let i = nodes.length - 1; i >= 0; i--) {
      const node = nodes[i];
      if (!this.isInteractive(node)) continue;
      const b = this.bounds(node.id);
      if (point.x >= b.x && point.x <= b.x + b.width && point.y >= b.y && point.y <= b.y + b.height) {
        return node.id;
      }
    }
    return undefined;
  }

  /** Per-node version, bumped by update(); `undefined` for unknown ids. */
  nodeVersion(id: string): number | undefined {
    return this.versions.get(id);
  }

  /** An independent copy with the same nodes, order and context. */
  clone(): Scene {
    const copy = new Scene(this.ctx);
    for (const node of this.all()) copy.add(Object.assign({}, node));
    return copy;
  }

  /** Plain copies of every node in paint order. */
  toJSON(): SceneNode[] {
    return this.all().map((n) => Object.assign({}, n));
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
