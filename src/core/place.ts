import type { Scene } from './scene.js';
import type { SceneNode } from './types.js';
import { layoutModeOf } from './layout.js';

export type Align = 'start' | 'center' | 'end';
export type PlaceDirection = 'below' | 'above' | 'rightOf' | 'leftOf';

interface PlacementCommon {
  /** Distance between the reference's edge and this node's edge, in px. Defaults to 0; may be negative. */
  gap?: number;
  /** Alignment on the cross axis: `below`/`above` align horizontally, `rightOf`/`leftOf` vertically. Defaults to `start`. */
  alignTo?: Align;
}

/**
 * Where a new node sits relative to an existing one. Exactly one direction.
 * Resolved once, when the node is added, into literal coordinates: the scene
 * never stores a placement, and later edits do not reflow neighbours.
 */
export type Placement =
  | ({ below: string; above?: never; rightOf?: never; leftOf?: never } & PlacementCommon)
  | ({ above: string; below?: never; rightOf?: never; leftOf?: never } & PlacementCommon)
  | ({ rightOf: string; below?: never; above?: never; leftOf?: never } & PlacementCommon)
  | ({ leftOf: string; below?: never; above?: never; rightOf?: never } & PlacementCommon);

const DIRECTIONS: readonly PlaceDirection[] = ['below', 'above', 'rightOf', 'leftOf'];
const ALIGNS: readonly Align[] = ['start', 'center', 'end'];
export const PLACEMENT_KEYS: readonly string[] = [...DIRECTIONS, 'gap', 'alignTo'];
/** Node types with a `gap` of their own: without a direction beside it, the key is the node's. */
const OWNS_GAP: ReadonlySet<string> = new Set(['ARROW', 'CALLOUT']);

/**
 * Separates placement props from node props. Placement keys must never reach
 * the stored node (they would leak into toJSON()), so callers spread `rest`.
 */
export function splitPlacement(
  id: string,
  type: string,
  props: Record<string, unknown>,
): { placement?: Placement; rest: Record<string, unknown> } {
  const rest: Record<string, unknown> = {};
  const taken: Record<string, unknown> = {};
  for (const key of Object.keys(props)) {
    if (PLACEMENT_KEYS.includes(key)) taken[key] = props[key];
    else rest[key] = props[key];
  }
  const directions = DIRECTIONS.filter((d) => taken[d] !== undefined);
  if (directions.length === 0) {
    if ('gap' in taken && OWNS_GAP.has(type)) {
      rest.gap = taken.gap;
      delete taken.gap;
    }
    if ('gap' in taken || 'alignTo' in taken) {
      throw new Error(`Cannot place "${id}": gap and alignTo need one of below, above, rightOf, leftOf.`);
    }
    return { rest };
  }
  if (directions.length > 1) {
    throw new Error(
      `Cannot place "${id}": use only one of below, above, rightOf, leftOf (got ${directions.join(', ')}).`,
    );
  }
  return { placement: taken as unknown as Placement, rest };
}

export interface Resolved {
  x: number;
  y: number;
  parent?: string;
}

export interface PlaceOptions {
  /** Whether the caller set `parent` at all (even to undefined). If not, the reference's parent is inherited. */
  parentGiven: boolean;
  /** The caller's explicit coordinate on the cross axis, if any; overrides the resolved value there. */
  x?: number;
  y?: number;
}

/**
 * Turns a placement into literal parent-relative coordinates for `node`.
 *
 * Works on boxes in absolute document space, never on raw origins: a `line`
 * or `path` can have a negative local origin and centred text starts left of
 * its origin, so the reference's bounds are compared with the new node's
 * measured bounds and the origin is backed out afterwards.
 *
 * `node` is the not-yet-added node with provisional `x: 0, y: 0`.
 */
export function resolvePlacement(scene: Scene, node: SceneNode, placement: Placement, opts: PlaceOptions): Resolved {
  const id = node.id;
  const direction = DIRECTIONS.find((d) => placement[d] !== undefined)!;
  const ref = placement[direction] as string;
  const refNode = scene.get(ref);
  if (!refNode) {
    throw new Error(
      `Cannot place "${id}" ${direction} "${ref}": unknown node "${ref}". A reference node must be added before the node that refers to it.`,
    );
  }
  const gap = placement.gap ?? 0;
  if (typeof gap !== 'number' || !Number.isFinite(gap)) {
    throw new Error(`Cannot place "${id}": gap must be a finite number; got ${String(placement.gap)}.`);
  }
  const alignTo = placement.alignTo ?? 'start';
  if (!ALIGNS.includes(alignTo)) {
    throw new Error(
      `Cannot place "${id}": alignTo must be "start", "center" or "end"; got ${JSON.stringify(placement.alignTo)}.`,
    );
  }
  const vertical = direction === 'below' || direction === 'above';
  const overrideX = opts.x !== undefined;
  const overrideY = opts.y !== undefined;
  if (vertical && overrideY) {
    throw new Error(
      `Cannot place "${id}": "${direction}" already sets y; drop y, or use x to override the other axis.`,
    );
  }
  if (!vertical && overrideX) {
    throw new Error(
      `Cannot place "${id}": "${direction}" already sets x; drop x, or use y to override the other axis.`,
    );
  }
  if (placement.alignTo !== undefined && ((vertical && overrideX) || (!vertical && overrideY))) {
    const axis = vertical ? 'x' : 'y';
    throw new Error(
      `Cannot place "${id}": "alignTo" and "${axis}" both set the ${vertical ? 'horizontal' : 'vertical'} position.`,
    );
  }

  const R = scene.bounds(ref);
  const L = scene.measure({ ...node, x: 0, y: 0 } as SceneNode);

  // Absolute top-left of the new node's box.
  let bx: number;
  let by: number;
  if (vertical) {
    by = direction === 'below' ? R.y + R.height + gap : R.y - gap - L.height;
    bx = alignTo === 'start' ? R.x : alignTo === 'center' ? R.x + (R.width - L.width) / 2 : R.x + R.width - L.width;
  } else {
    bx = direction === 'rightOf' ? R.x + R.width + gap : R.x - gap - L.width;
    by = alignTo === 'start' ? R.y : alignTo === 'center' ? R.y + (R.height - L.height) / 2 : R.y + R.height - L.height;
  }
  // Back out the node's own local origin, then convert to the parent's content space.
  const ax = bx - L.x;
  const ay = by - L.y;
  const parent = opts.parentGiven ? node.parent : refNode.parent;
  if (parent !== undefined && !scene.has(parent)) {
    throw new Error(`Unknown parent "${parent}" for node "${id}"`);
  }
  if (parent !== undefined) {
    const mode = layoutModeOf(scene.node(parent));
    if (mode !== 'NONE' && node.layoutPositioning !== 'ABSOLUTE') {
      throw new Error(
        `Cannot place "${id}" ${direction} "${ref}": parent "${parent}" has layoutMode ${mode} and positions its children itself. Drop the placement, or set layoutPositioning: 'ABSOLUTE'.`,
      );
    }
  }
  const origin = parent === undefined ? { x: 0, y: 0 } : scene.contentOrigin(parent);
  const resolved: Resolved = {
    x: opts.x ?? ax - origin.x,
    y: opts.y ?? ay - origin.y,
  };
  if (parent !== undefined) resolved.parent = parent;
  return resolved;
}
