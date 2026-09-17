import type { Random } from '../sketch/index.js';
import type { TypingPlan } from './types.js';

const REACTION_MIN = 120;
const REACTION_JITTER = 60;
const KEY_MIN = 60;
const KEY_JITTER = 80;
const AFTER_SPACE = 1.6;
const AFTER_PUNCTUATION = 2.2;
const PUNCTUATION = new Set(['.', ',', ';', ':', '!', '?']);

/**
 * Turns text into keystrokes with a human cadence: a reaction pause, then
 * 60–140 ms per key, longer after a space and longer still after
 * punctuation. A backspace character deletes the previous character.
 */
export function planTyping(
  target: string,
  base: string,
  text: string,
  rand: Random,
  focuses: boolean,
  totalDuration?: number,
): TypingPlan {
  const ops: TypingPlan['ops'] = [];
  const opEnds: number[] = [];
  let clock = 0;
  let previous = '';
  for (const ch of text) {
    let delay = ops.length === 0 ? REACTION_MIN + rand.next() * REACTION_JITTER : KEY_MIN + rand.next() * KEY_JITTER;
    if (previous === ' ') delay *= AFTER_SPACE;
    else if (PUNCTUATION.has(previous)) delay *= AFTER_PUNCTUATION;
    clock += delay;
    ops.push(ch === '\b' ? { del: true } : ch);
    opEnds.push(Math.round(clock));
    previous = ch;
  }
  const last = opEnds[opEnds.length - 1];
  if (totalDuration !== undefined && last > 0) {
    // Rescale so the last key lands exactly on the requested duration.
    const k = totalDuration / last;
    for (let i = 0; i < opEnds.length; i++) opEnds[i] = Math.round(opEnds[i] * k);
    opEnds[opEnds.length - 1] = totalDuration;
  }
  return { target, base, ops, opEnds, focuses };
}

/** The value after the first `count` ops. */
export function applyOps(base: string, ops: TypingPlan['ops'], count: number): string {
  let value = base;
  const n = Math.min(count, ops.length);
  for (let i = 0; i < n; i++) {
    const op = ops[i];
    value = typeof op === 'string' ? value + op : [...value].slice(0, -1).join('');
  }
  return value;
}

/** How many ops have completed `localT` ms into the step. */
export function opsDone(opEnds: number[], localT: number): number {
  let lo = 0;
  let hi = opEnds.length;
  while (lo < hi) {
    const mid = (lo + hi) >> 1;
    if (opEnds[mid] <= localT) lo = mid + 1;
    else hi = mid;
  }
  return lo;
}
