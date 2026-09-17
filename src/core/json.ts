import type { DistributiveOmit, SceneNode, Theme } from './types.js';
import type { IconDef } from '../icons/types.js';
import { hasComponent } from '../components/index.js';
import { isValidId } from './ids.js';
import { validatePaints } from './paint.js';
import { validateLayoutProps } from './layout.js';
import { componentFor } from '../components/index.js';

/** A node in a document: a scene node without `parent`, with its children nested. */
export type DocumentNode = DistributiveOmit<SceneNode, 'parent'> & { children?: DocumentNode[] };

/** The serialised form of a demo. Version 2: nested, Figma-shaped. */
export interface DemoJSON {
  version: 2;
  width: number;
  height: number;
  seed: number;
  theme: Theme;
  background: string | null;
  /** Name of the stroke font; a custom font must be supplied again when loading. */
  font: string;
  /** Icon definitions the nodes refer to by name that are not built in, so the document is self-contained. */
  icons?: Record<string, IconDef>;
  /** Top-level nodes, back to front; each carries its own `children` in the same order. */
  children: DocumentNode[];
  /** Timeline steps; see the timeline module. Absent or empty for a static scene. */
  timeline?: unknown[];
  /** Where the cursor rests before the first step. */
  cursor?: { x: number; y: number };
}

export class DemoJSONError extends Error {
  constructor(message: string, options?: ErrorOptions) {
    super(`Invalid demo JSON: ${message}`, options);
    this.name = 'DemoJSONError';
  }
}

function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null && !Array.isArray(v);
}

const TEXT_ALIGNS = ['LEFT', 'CENTER', 'RIGHT'];

function validateNode(node: unknown, at: string): void {
  if (!isRecord(node)) throw new DemoJSONError(`${at} must be an object`);
  if (!isValidId(node.id)) throw new DemoJSONError(`${at}.id ${JSON.stringify(node.id)} is not a valid id`);
  const label = `${at} ("${String(node.id)}")`;
  if (typeof node.type !== 'string' || !hasComponent(node.type)) {
    throw new DemoJSONError(`${label} has unknown type ${JSON.stringify(node.type)}`);
  }
  for (const key of ['x', 'y'] as const) {
    // Optional for children a layout positions; must be a number when present.
    if (node[key] !== undefined && (typeof node[key] !== 'number' || !Number.isFinite(node[key]))) {
      throw new DemoJSONError(`${label}.${key} must be a finite number`);
    }
  }
  const layoutProblem = validateLayoutProps(node, !!componentFor(node as unknown as SceneNode).resizable);
  if (layoutProblem) throw new DemoJSONError(`${label}: ${layoutProblem}`);
  if ('parent' in node) throw new DemoJSONError(`${label} must nest under its parent instead of naming it`);
  for (const key of ['fills', 'strokes'] as const) {
    const problem = validatePaints(node[key], `${label}.${key}`);
    if (problem) throw new DemoJSONError(problem);
  }
  if (node.style !== undefined) {
    if (!isRecord(node.style)) throw new DemoJSONError(`${label}.style must be a TypeStyle object`);
    const problem = validatePaints(node.style.fills, `${label}.style.fills`);
    if (problem) throw new DemoJSONError(problem);
    const align = node.style.textAlignHorizontal;
    if (align !== undefined && !TEXT_ALIGNS.includes(align as string)) {
      throw new DemoJSONError(`${label}.style.textAlignHorizontal must be one of ${TEXT_ALIGNS.join(', ')}`);
    }
  }
  if (node.children !== undefined) {
    if (!Array.isArray(node.children)) throw new DemoJSONError(`${label}.children must be an array`);
    node.children.forEach((child, i) => validateNode(child, `${at}.children[${i}]`));
  }
}

/** Structural validation of the parts the Demo constructor does not check itself. Migrates older versions. */
export function parseDemoJSON(input: DemoJSON | string): DemoJSON {
  let raw: unknown = input;
  if (typeof input === 'string') {
    try {
      raw = JSON.parse(input);
    } catch (e) {
      throw new DemoJSONError(`not JSON (${(e as Error).message})`, { cause: e });
    }
  }
  if (!isRecord(raw)) throw new DemoJSONError('expected an object');
  const doc: Record<string, unknown> = raw.version === 1 ? migrateV1(raw) : raw;
  if (doc.version !== 2) throw new DemoJSONError(`unsupported version ${JSON.stringify(doc.version)}`);
  for (const key of ['width', 'height'] as const) {
    if (typeof doc[key] !== 'number' || !(doc[key] > 0)) throw new DemoJSONError(`${key} must be a positive number`);
  }
  if (typeof doc.seed !== 'number' || !Number.isInteger(doc.seed)) throw new DemoJSONError('seed must be an integer');
  if (doc.theme !== undefined && !isRecord(doc.theme)) throw new DemoJSONError('theme must be an object');
  if (doc.background !== undefined && doc.background !== null && typeof doc.background !== 'string') {
    throw new DemoJSONError('background must be a string or null');
  }
  if (doc.font !== undefined && typeof doc.font !== 'string') throw new DemoJSONError('font must be a string');
  if (doc.icons !== undefined) {
    if (!isRecord(doc.icons)) throw new DemoJSONError('icons must be an object');
    for (const [name, def] of Object.entries(doc.icons)) {
      if (!isRecord(def) || !Array.isArray(def.nodes)) throw new DemoJSONError(`icon "${name}" must have nodes`);
    }
  }
  if (!Array.isArray(doc.children)) throw new DemoJSONError('children must be an array');
  doc.children.forEach((node, i) => validateNode(node, `children[${i}]`));
  if (doc.timeline !== undefined && !Array.isArray(doc.timeline)) throw new DemoJSONError('timeline must be an array');
  if (doc.cursor !== undefined) {
    const c = doc.cursor as Record<string, unknown> | null;
    if (!isRecord(c) || typeof c.x !== 'number' || typeof c.y !== 'number') {
      throw new DemoJSONError('cursor must be a point');
    }
  }
  return doc as unknown as DemoJSON;
}

/** Walks a document tree depth-first, yielding each node with its parent id, in paint order. */
export function* flatten(children: readonly DocumentNode[], parent?: string): Generator<SceneNode> {
  for (const doc of children) {
    const { children: nested, ...rest } = doc;
    const node = { ...rest } as SceneNode;
    node.x ??= 0;
    node.y ??= 0;
    if (parent !== undefined) node.parent = parent;
    yield node;
    if (nested) yield* flatten(nested, doc.id);
  }
}

// --- version 1 (0.1.0 / 0.2.0 documents) ---------------------------------

const V1_TYPES: Record<string, string> = {
  rect: 'RECTANGLE',
  ellipse: 'ELLIPSE',
  line: 'LINE',
  path: 'VECTOR',
  text: 'TEXT',
  icon: 'ICON',
  button: 'BUTTON',
  input: 'INPUT',
  panel: 'FRAME',
  window: 'WINDOW',
};
const V1_ALIGNS: Record<string, string> = { start: 'LEFT', middle: 'CENTER', end: 'RIGHT' };
const SKETCH_KEYS = ['roughness', 'bowing', 'fillStyle', 'hachureGap', 'hachureAngle', 'fillWeight'];

function migrateV1Node(v1: Record<string, unknown>, patch = false): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  const style = isRecord(v1.style) ? v1.style : {};
  const typeStyle: Record<string, unknown> = {};
  const sketch: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(v1)) {
    switch (key) {
      case 'type':
        out.type = V1_TYPES[value as string] ?? value;
        break;
      case 'radius':
        out.cornerRadius = value;
        break;
      case 'hidden':
        // A node stores only the non-default; a patch must carry either value.
        if (patch) out.visible = !value;
        else if (value === true) out.visible = false;
        break;
      case 'text':
        out.characters = value;
        break;
      case 'align':
        typeStyle.textAlignHorizontal = V1_ALIGNS[value as string] ?? value;
        break;
      case 'fontSize':
        typeStyle.fontSize = value;
        break;
      case 'style':
      case 'parent':
        break;
      default:
        out[key] = value;
    }
  }
  for (const [key, value] of Object.entries(style)) {
    switch (key) {
      case 'fill':
        out.fills = [{ type: 'SOLID', color: value }];
        break;
      case 'stroke':
        out.strokes = value === 'none' ? [] : [{ type: 'SOLID', color: value }];
        break;
      case 'strokeWidth':
        out.strokeWeight = value;
        break;
      case 'dash':
        out.strokeDashes = value;
        break;
      case 'opacity':
        out.opacity = value;
        break;
      case 'color':
        // An icon's colour was its stroke; text-bearing nodes keep it as their type style.
        if (v1.type === 'icon') out.strokes = [{ type: 'SOLID', color: value }];
        else typeStyle.fills = [{ type: 'SOLID', color: value }];
        break;
      case 'fontSize':
        typeStyle.fontSize = value;
        break;
      default:
        if (SKETCH_KEYS.includes(key)) sketch[key] = value;
    }
  }
  if (Object.keys(typeStyle).length) out.style = typeStyle;
  if (Object.keys(sketch).length) out.sketch = sketch;
  return out;
}

/** A 0.1.0/0.2.0 document: flat `nodes` with `parent`, lowercase types, a `style` bag. */
export function migrateV1(v1: Record<string, unknown>): Record<string, unknown> {
  const out: Record<string, unknown> = { ...v1, version: 2 };
  delete out.nodes;
  if (isRecord(v1.theme) && 'strokeWidth' in v1.theme) {
    const { strokeWidth, ...rest } = v1.theme;
    out.theme = { ...rest, strokeWeight: strokeWidth };
  }
  const nodes = Array.isArray(v1.nodes) ? (v1.nodes as Record<string, unknown>[]) : [];
  const byId = new Map<string, Record<string, unknown>>();
  const roots: Record<string, unknown>[] = [];
  for (const n of nodes) {
    if (!isRecord(n)) continue;
    const migrated = migrateV1Node(n);
    byId.set(String(n.id), migrated);
    const parent = typeof n.parent === 'string' ? byId.get(n.parent) : undefined;
    if (parent) {
      ((parent.children ??= []) as Record<string, unknown>[]).push(migrated);
    } else {
      roots.push(migrated);
    }
  }
  out.children = roots;
  if (Array.isArray(v1.timeline)) {
    out.timeline = v1.timeline.map((step) =>
      isRecord(step) && step.type === 'set' && isRecord(step.patch)
        ? { ...step, patch: migrateV1Node(step.patch, true) }
        : step,
    );
  }
  return out;
}
