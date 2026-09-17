import type { Drawable, Op } from '../../src/sketch/core.js';

/**
 * ECMAScript does not specify the results of Math.sin/cos/atan/pow -- only
 * Math.sqrt is required to be IEEE-exact. A V8 upgrade can therefore move the
 * last ULP of a coordinate. Rounding to 6 decimal places keeps the golden
 * snapshots stable across Node versions without hiding real geometry changes.
 */
export function round(n: number, dp = 6): number {
  return Object.is(n, -0) ? 0 : +n.toFixed(dp);
}

/**
 * Drawable.options is deliberately NOT snapshotted: renderer.ts attaches a live
 * Random instance to it, and serialising a class instance into a baseline is
 * brittle and leaks internal state.
 */
export function roundDrawable(d: Drawable) {
  return {
    shape: d.shape,
    sets: d.sets.map((s) => ({
      type: s.type,
      ops: s.ops.map((o: Op) => ({ op: o.op, data: o.data.map((n) => round(n)) })),
    })),
  };
}

/** toPaths() ignores fixedDecimalPlaceDigits today (bug 4), so round the string. */
export function roundPathD(d: string): string {
  return d.replace(/-?\d+\.\d+(e[+-]?\d+)?/gi, (m) => String(round(Number(m))));
}
