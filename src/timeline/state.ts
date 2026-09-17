import type { NodePatch } from '../core/types.js';
import type { CompiledStep, CompiledTimeline, InteractionState } from './types.js';
import { cursorAt, ease } from './cursor-path.js';
import { applyOps, opsDone } from './typing.js';

/** Blink period of the caret, in ms; solid for this long after a key. */
export const CARET_PERIOD = 530;
/** How long the click ripple stays visible, in ms. */
export const RIPPLE_DURATION = 300;

function initialState(c: CompiledTimeline, t: number): InteractionState {
  const s: InteractionState = {
    t,
    cursor: { ...c.initialCursor },
    pressed: false,
    focusedAt: 0,
    lastKeyAt: -Infinity,
    values: new Map(),
    checked: new Map(),
    open: new Map(),
    patches: new Map(),
    activeStep: -1,
  };
  if (c.initialFocus !== undefined) s.focused = c.initialFocus;
  return s;
}

/**
 * The interaction state at time t, as a pure function of the compiled
 * timeline: completed steps are applied in full, then the step in progress
 * contributes its partial effect. Seeking backwards is just another call.
 */
export function stateAt(c: CompiledTimeline, t: number): InteractionState {
  const s = initialState(c, t);
  if (t < 0) return s;
  for (const step of c.steps) {
    if (step.end <= t) {
      applyComplete(s, step);
    } else if (step.start <= t) {
      applyPartial(s, step, t - step.start);
      s.activeStep = step.authored;
      break;
    } else {
      break;
    }
  }
  return s;
}

function setFocus(s: InteractionState, id: string | undefined, at: number): void {
  if (s.focused !== id) {
    s.focusedAt = at;
  }
  if (id === undefined) delete s.focused;
  else s.focused = id;
}

function applyEffects(s: InteractionState, cs: CompiledStep): void {
  for (const e of cs.effects ?? []) {
    if (e.checked !== undefined) s.checked.set(e.id, e.checked);
    if (e.open !== undefined) s.open.set(e.id, e.open);
    if (e.value !== undefined) s.values.set(e.id, e.value);
  }
}

function applyComplete(s: InteractionState, cs: CompiledStep): void {
  const { step } = cs;
  if (cs.cursor) s.cursor = { ...cs.cursor.to };
  if (cs.drag) s.values.set(cs.drag.target, cs.drag.to);
  applyEffects(s, cs);
  switch (step.type) {
    case 'click':
    case 'release':
      s.pressed = false;
      delete s.pressedNode;
      if (cs.click) {
        setFocus(s, cs.click.focus, cs.start + cs.click.releaseAt);
        s.lastRelease = { at: { ...s.cursor }, time: cs.start + cs.click.releaseAt };
      }
      break;
    case 'press':
      s.pressed = true;
      if (cs.click?.hit !== undefined) s.pressedNode = cs.click.hit;
      else delete s.pressedNode;
      break;
    case 'type': {
      const plan = cs.typing!;
      if (plan.focuses) setFocus(s, plan.target, cs.start);
      s.values.set(plan.target, applyOps(plan.base, plan.ops, plan.ops.length));
      if (plan.opEnds.length) s.lastKeyAt = cs.start + plan.opEnds[plan.opEnds.length - 1];
      break;
    }
    case 'clear':
      s.values.set(step.target, '');
      s.lastKeyAt = cs.end;
      break;
    case 'focus':
      setFocus(s, step.target, cs.start);
      break;
    case 'blur':
      setFocus(s, undefined, cs.start);
      break;
    case 'setValue':
      break;
    case 'set':
      s.patches.set(step.target, { ...s.patches.get(step.target), ...step.patch } as NodePatch);
      break;
    case 'moveCursor':
    case 'wait':
    case 'check':
    case 'uncheck':
    case 'toggle':
    case 'choose':
    case 'open':
    case 'close':
    case 'hover':
    case 'drag':
      break;
  }
}

function applyPartial(s: InteractionState, cs: CompiledStep, local: number): void {
  const { step } = cs;
  if (cs.cursor) s.cursor = cursorAt(cs.cursor, local);
  if (cs.drag && cs.cursor) {
    // The value follows the cursor's eased progress along its path.
    const progress = cs.cursor.duration > 0 ? ease(local / cs.cursor.duration) : 1;
    s.values.set(cs.drag.target, cs.drag.from + (cs.drag.to - cs.drag.from) * progress);
  }
  switch (step.type) {
    case 'click':
    case 'press':
      if (cs.click && local >= cs.click.pressAt) {
        s.pressed = true;
        if (cs.click.hit !== undefined) s.pressedNode = cs.click.hit;
      }
      break;
    case 'type': {
      const plan = cs.typing!;
      if (plan.focuses) setFocus(s, plan.target, cs.start);
      const done = opsDone(plan.opEnds, local);
      s.values.set(plan.target, applyOps(plan.base, plan.ops, done));
      if (done > 0) s.lastKeyAt = cs.start + plan.opEnds[done - 1];
      break;
    }
    default:
      break;
  }
}

/** Whether the caret is in its visible phase: solid right after a key, then blinking in step with focus. */
export function caretVisible(s: InteractionState): boolean {
  if (s.t - s.lastKeyAt < CARET_PERIOD) return true;
  return Math.floor((s.t - s.focusedAt) / CARET_PERIOD) % 2 === 0;
}
