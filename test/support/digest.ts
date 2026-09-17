import { createHash } from 'node:crypto';
import type { Drawable } from '../../src/sketch/core.js';
import { roundDrawable } from './round.js';

/**
 * Compact fingerprint of a Drawable.
 *
 * The full rounded structure of the 946-case matrix is ~226 MB of JSON (2.7M
 * ops; a single 700x700 ellipse with a dots fill is 45 MB on its own), which
 * overflows V8's max string length when Vitest writes a .snap file. So every
 * case is pinned by a digest -- set types, op counts and a hash of the whole
 * rounded coordinate stream -- which detects any geometry change at all, and
 * the cases small enough to read are additionally pinned structurally in
 * structure.test.ts.
 */
export function digestDrawable(d: Drawable) {
  const rounded = roundDrawable(d);
  const hash = createHash('sha256');
  let ops = 0;

  for (const set of rounded.sets) {
    hash.update(set.type);
    for (const op of set.ops) {
      hash.update(op.op);
      hash.update(op.data.join(','));
      ops++;
    }
  }

  return {
    shape: rounded.shape,
    sets: rounded.sets.map((s) => `${s.type}:${s.ops.length}`),
    ops,
    sha256: hash.digest('hex').slice(0, 16),
  };
}

export function digestPaths(paths: { d: string; stroke: string; strokeWidth: number; fill?: string }[]) {
  const hash = createHash('sha256');
  for (const p of paths) {
    hash.update(p.d);
    hash.update(String(p.stroke));
    hash.update(String(p.strokeWidth));
    hash.update(String(p.fill ?? ''));
  }
  return {
    count: paths.length,
    meta: paths.map((p) => ({ stroke: p.stroke, strokeWidth: p.strokeWidth, fill: p.fill })),
    sha256: hash.digest('hex').slice(0, 16),
  };
}
