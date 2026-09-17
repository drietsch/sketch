import type { Point } from '../core/types.js';
import type { Random } from '../sketch/index.js';
import type { CursorPath } from './types.js';

// Fitts's law: T = a + b * log2(D / W + 1), clamped to something that reads as human.
const FITTS_A = 120;
const FITTS_B = 130;
const MIN_MOVE = 180;
const MAX_MOVE = 1400;
const OVERSHOOT_MIN_DISTANCE = 300;
const OVERSHOOT_CHANCE = 0.6;

function clamp(v: number, lo: number, hi: number): number {
  return Math.min(hi, Math.max(lo, v));
}

/** Movement time for a distance D towards a target of effective width W. */
export function fittsDuration(distance: number, width: number): number {
  const w = clamp(width, 8, 200);
  return clamp(FITTS_A + FITTS_B * Math.log2(distance / w + 1), MIN_MOVE, MAX_MOVE);
}

/** Fast to leave, slow to arrive: a smoothstep pulled slightly early. */
export function ease(u: number): number {
  const v = Math.pow(clamp(u, 0, 1), 0.92);
  return v * v * (3 - 2 * v);
}

function cubic(p0: Point, p1: Point, p2: Point, p3: Point, t: number): Point {
  const mt = 1 - t;
  const a = mt * mt * mt;
  const b = 3 * mt * mt * t;
  const c = 3 * mt * t * t;
  const d = t * t * t;
  return { x: a * p0.x + b * p1.x + c * p2.x + d * p3.x, y: a * p0.y + b * p1.y + c * p2.y + d * p3.y };
}

/**
 * Plans a natural-looking path from `from` to `to`: a cubic whose control
 * points are pushed sideways off the chord (an arc, or an S-curve), with an
 * optional overshoot-and-settle on long moves. Every random draw comes from
 * `rand`, so the same seed always gives the same path.
 */
export function planCursorPath(
  from: Point,
  to: Point,
  targetWidth: number,
  rand: Random,
  duration?: number,
): CursorPath {
  const dx = to.x - from.x;
  const dy = to.y - from.y;
  const distance = Math.hypot(dx, dy);
  if (distance < 2) {
    return { from, to, duration: duration ?? 0, c1: from, c2: to };
  }
  const nx = -dy / distance;
  const ny = dx / distance;
  const u1 = 0.2 + rand.next() * 0.2;
  const u2 = 0.6 + rand.next() * 0.2;
  const m1 = Math.min(120, distance * (0.08 + rand.next() * 0.14));
  const m2 = Math.min(120, distance * (0.08 + rand.next() * 0.14));
  const s1 = rand.next() < 0.5 ? -1 : 1;
  const s2 = rand.next() < 0.7 ? s1 : -s1;
  const c1 = { x: from.x + dx * u1 + nx * s1 * m1, y: from.y + dy * u1 + ny * s1 * m1 };
  const c2 = { x: from.x + dx * u2 + nx * s2 * m2, y: from.y + dy * u2 + ny * s2 * m2 };

  let time = fittsDuration(distance, targetWidth);
  let overshoot: CursorPath['overshoot'];
  if (distance > OVERSHOOT_MIN_DISTANCE && rand.next() < OVERSHOOT_CHANCE) {
    const along = clamp(distance * (0.03 + rand.next() * 0.05), 6, 30);
    const aside = distance * (rand.next() * 0.04 - 0.02);
    const point = { x: to.x + (dx / distance) * along + nx * aside, y: to.y + (dy / distance) * along + ny * aside };
    const back = { x: to.x - point.x, y: to.y - point.y };
    overshoot = {
      point,
      s1: {
        x: point.x + back.x * 0.3 + nx * (rand.next() * 8 - 4),
        y: point.y + back.y * 0.3 + ny * (rand.next() * 8 - 4),
      },
      s2: { x: point.x + back.x * 0.7, y: point.y + back.y * 0.7 },
      split: 0.82,
    };
    time *= 1.12;
  }
  const path: CursorPath = { from, to, duration: duration ?? Math.round(time), c1, c2 };
  if (overshoot) path.overshoot = overshoot;
  return path;
}

/** The cursor position `localT` ms into the path. Exactly `to` at or after the end. */
export function cursorAt(path: CursorPath, localT: number): Point {
  if (path.duration <= 0 || localT >= path.duration) return path.to;
  if (localT <= 0) return path.from;
  const e = ease(localT / path.duration);
  if (!path.overshoot) return cubic(path.from, path.c1, path.c2, path.to, e);
  const { point, s1, s2, split } = path.overshoot;
  if (e < split) return cubic(path.from, path.c1, path.c2, point, e / split);
  return cubic(point, s1, s2, path.to, (e - split) / (1 - split));
}

/** Evenly spaced samples along the path, for trails and tests. First is `from`, last is `to`. */
export function samplePath(path: CursorPath, count = 24): Point[] {
  const out: Point[] = [];
  const n = Math.max(2, count);
  for (let i = 0; i < n; i++) out.push(cursorAt(path, (path.duration * i) / (n - 1)));
  return out;
}
