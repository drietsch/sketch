import type { SceneNode, Theme } from './types.js';
import type { IconDef } from '../icons/types.js';
import { hasComponent } from '../components/index.js';
import { isValidId } from './ids.js';

/** The serialised form of a demo. Version 1. */
export interface DemoJSON {
  version: 1;
  width: number;
  height: number;
  seed: number;
  theme: Theme;
  background: string | null;
  /** Name of the stroke font; a custom font must be supplied again when loading. */
  font: string;
  /** Icon definitions the nodes refer to by name that are not built in, so the document is self-contained. */
  icons?: Record<string, IconDef>;
  /** In paint order: parents before children, siblings back to front. */
  nodes: SceneNode[];
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

/** Structural validation of the parts the Demo constructor does not check itself. */
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
  if (raw.version !== 1) throw new DemoJSONError(`unsupported version ${JSON.stringify(raw.version)}`);
  for (const key of ['width', 'height'] as const) {
    if (typeof raw[key] !== 'number' || !(raw[key] > 0)) throw new DemoJSONError(`${key} must be a positive number`);
  }
  if (typeof raw.seed !== 'number' || !Number.isInteger(raw.seed)) throw new DemoJSONError('seed must be an integer');
  if (raw.theme !== undefined && !isRecord(raw.theme)) throw new DemoJSONError('theme must be an object');
  if (raw.background !== undefined && raw.background !== null && typeof raw.background !== 'string') {
    throw new DemoJSONError('background must be a string or null');
  }
  if (raw.font !== undefined && typeof raw.font !== 'string') throw new DemoJSONError('font must be a string');
  if (raw.icons !== undefined) {
    if (!isRecord(raw.icons)) throw new DemoJSONError('icons must be an object');
    for (const [name, def] of Object.entries(raw.icons)) {
      if (!isRecord(def) || !Array.isArray(def.nodes)) throw new DemoJSONError(`icon "${name}" must have nodes`);
    }
  }
  if (!Array.isArray(raw.nodes)) throw new DemoJSONError('nodes must be an array');
  raw.nodes.forEach((node, i) => {
    if (!isRecord(node)) throw new DemoJSONError(`nodes[${i}] must be an object`);
    if (!isValidId(node.id)) throw new DemoJSONError(`nodes[${i}].id ${JSON.stringify(node.id)} is not a valid id`);
    if (typeof node.type !== 'string' || !hasComponent(node.type)) {
      throw new DemoJSONError(`nodes[${i}] ("${String(node.id)}") has unknown type ${JSON.stringify(node.type)}`);
    }
    for (const key of ['x', 'y'] as const) {
      if (typeof node[key] !== 'number' || !Number.isFinite(node[key])) {
        throw new DemoJSONError(`nodes[${i}] ("${String(node.id)}").${key} must be a finite number`);
      }
    }
  });
  if (raw.timeline !== undefined && !Array.isArray(raw.timeline)) throw new DemoJSONError('timeline must be an array');
  if (raw.cursor !== undefined) {
    const c = raw.cursor as Record<string, unknown> | null;
    if (!isRecord(c) || typeof c.x !== 'number' || typeof c.y !== 'number') {
      throw new DemoJSONError('cursor must be a point');
    }
  }
  return raw as unknown as DemoJSON;
}
