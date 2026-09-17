import type { Scene } from '../core/scene.js';
import type { Point, Size } from '../core/types.js';
import { deriveSeed } from '../core/ids.js';
import { Random } from '../sketch/index.js';
import type { Timeline } from './timeline.js';
import type { CompiledStep, CompiledTimeline, Target } from './types.js';
import { planCursorPath } from './cursor-path.js';
import { planTyping } from './typing.js';

const HOLD_MIN = 60;
const HOLD_JITTER = 60;
const CLEAR_DURATION = 180;
/** A cursor already this close to its destination does not move. */
const SNAP_DISTANCE = 2;

export class CompileError extends Error {
  constructor(
    readonly stepIndex: number,
    message: string,
  ) {
    super(`Timeline step ${stepIndex}: ${message}`);
    this.name = 'CompileError';
  }
}

/** Where the cursor rests before the first step when the timeline does not say. */
export function defaultCursorStart(size: Size): Point {
  return { x: Math.round(size.width * 0.6), y: Math.round(size.height * 0.75) };
}

interface CompileState {
  cursor: Point;
  focused?: string;
  values: Map<string, string>;
}

/**
 * Resolves every step against the scene: where targets are, how long moves
 * and typing take, what a click hits. Works on a clone of the scene so `set`
 * steps can change layout for later steps without touching the document.
 */
export function compile(timeline: Timeline, scene: Scene, seed: number, size: Size): CompiledTimeline {
  const working = scene.clone();
  const state: CompileState = { cursor: timeline.cursor ?? defaultCursorStart(size), values: new Map() };
  const initialFocus = working.all().find((n) => 'state' in n && n.state?.focused && working.isFocusable(n))?.id;
  state.focused = initialFocus;

  const steps: CompiledStep[] = [];
  let clock = 0;
  timeline.steps.forEach((step, index) => {
    const key = step.key ?? String(index);
    const start = step.at ?? clock;
    if (start < clock) {
      throw new CompileError(index, `at=${step.at} is earlier than the end of the previous step (${clock})`);
    }
    const compiled: CompiledStep = { index, key, step, start, end: start };
    const stream = (kind: string) => new Random(deriveSeed(seed, 'timeline', kind, key));

    const resolve = (target: Target): { point: Point; width: number } => {
      if (typeof target !== 'string') return { point: { x: target.x, y: target.y }, width: 16 };
      const node = working.get(target);
      if (!node) throw new CompileError(index, `unknown target "${target}"`);
      if (node.visible === false) throw new CompileError(index, `target "${target}" is not visible`);
      const b = working.bounds(target);
      const r = stream('target');
      // Somewhere in the central half of the target, never the exact centre.
      const point = {
        x: b.x + b.width / 2 + (r.next() * 2 - 1) * b.width * 0.25,
        y: b.y + b.height / 2 + (r.next() * 2 - 1) * b.height * 0.25,
      };
      return { point, width: Math.min(b.width, b.height) };
    };

    const moveTo = (target: Target, duration?: number): number => {
      const { point, width } = resolve(target);
      const distance = Math.hypot(point.x - state.cursor.x, point.y - state.cursor.y);
      if (distance <= SNAP_DISTANCE && duration === undefined) {
        state.cursor = point;
        return 0;
      }
      compiled.cursor = planCursorPath(state.cursor, point, width, stream('cursor'), duration);
      state.cursor = point;
      return compiled.cursor.duration;
    };

    const requireInput = (target: string) => {
      const node = working.get(target);
      if (!node) throw new CompileError(index, `unknown target "${target}"`);
      if (node.type !== 'INPUT') throw new CompileError(index, `target "${target}" is a ${node.type}, not an INPUT`);
      return node;
    };

    /** Hit-tests the cursor and applies a release's focus change; returns the click record. */
    const release = (pressAt: number, releaseAt: number): NonNullable<CompiledStep['click']> => {
      const hit = working.hitTest(state.cursor);
      const node = hit ? working.node(hit) : undefined;
      state.focused = node && working.isFocusable(node) ? hit : undefined;
      const click: NonNullable<CompiledStep['click']> = { pressAt, releaseAt };
      if (hit !== undefined) click.hit = hit;
      if (state.focused !== undefined) click.focus = state.focused;
      return click;
    };

    let duration = 0;
    switch (step.type) {
      case 'moveCursor':
        duration = moveTo(step.target, step.duration);
        break;
      case 'click': {
        const moved = step.target !== undefined ? moveTo(step.target) : 0;
        const hold = Math.round(HOLD_MIN + stream('click').next() * HOLD_JITTER);
        compiled.click = release(moved, moved + hold);
        duration = step.duration ?? moved + hold;
        break;
      }
      case 'press': {
        const moved = step.target !== undefined ? moveTo(step.target) : 0;
        compiled.click = { pressAt: moved, releaseAt: moved };
        const hit = working.hitTest(state.cursor);
        if (hit !== undefined) compiled.click.hit = hit;
        duration = step.duration ?? moved;
        break;
      }
      case 'release':
        compiled.click = release(0, 0);
        duration = step.duration ?? 0;
        break;
      case 'type': {
        const node = requireInput(step.target);
        const base = state.values.get(step.target) ?? node.value ?? '';
        const focuses = state.focused !== step.target;
        compiled.typing = planTyping(step.target, base, step.text, stream('type'), focuses, step.duration);
        state.focused = step.target;
        state.values.set(step.target, applyAll(compiled.typing.base, compiled.typing.ops));
        duration = compiled.typing.opEnds.at(-1) ?? 0;
        break;
      }
      case 'clear':
        requireInput(step.target);
        state.values.set(step.target, '');
        duration = step.duration ?? CLEAR_DURATION;
        break;
      case 'wait':
        duration = step.duration;
        break;
      case 'focus': {
        const node = working.get(step.target);
        if (!node) throw new CompileError(index, `unknown target "${step.target}"`);
        if (!working.isFocusable(node)) throw new CompileError(index, `target "${step.target}" is not focusable`);
        state.focused = step.target;
        break;
      }
      case 'blur':
        state.focused = undefined;
        break;
      case 'setValue':
        requireInput(step.target);
        state.values.set(step.target, step.value);
        break;
      case 'set':
        if (!working.has(step.target)) throw new CompileError(index, `unknown target "${step.target}"`);
        working.update(step.target, step.patch);
        break;
    }
    compiled.end = start + duration;
    clock = compiled.end;
    steps.push(compiled);
  });

  const result: CompiledTimeline = {
    seed,
    sceneVersion: scene.version,
    timelineVersion: timeline.version,
    duration: clock,
    initialCursor: timeline.cursor ?? defaultCursorStart(size),
    steps,
  };
  if (initialFocus !== undefined) result.initialFocus = initialFocus;
  return result;
}

function applyAll(base: string, ops: (string | { del: true })[]): string {
  let value = base;
  for (const op of ops) value = typeof op === 'string' ? value + op : [...value].slice(0, -1).join('');
  return value;
}
