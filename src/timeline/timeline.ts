import type { NodePatch, Point } from '../core/types.js';
import type { Step, StepType, Target, TimelineJSON } from './types.js';

export interface StepOptions {
  key?: string;
  duration?: number;
}

const STEP_TYPES = new Set<StepType>([
  'moveCursor',
  'click',
  'press',
  'release',
  'type',
  'clear',
  'wait',
  'focus',
  'blur',
  'setValue',
  'set',
]);

function isPoint(v: unknown): v is Point {
  return (
    typeof v === 'object' && v !== null && typeof (v as Point).x === 'number' && typeof (v as Point).y === 'number'
  );
}

function isTarget(v: unknown): v is Target {
  return typeof v === 'string' || isPoint(v);
}

/** Structural check of one step; returns a message for the first problem found. */
export function validateStep(step: unknown): string | undefined {
  if (typeof step !== 'object' || step === null) return 'step must be an object';
  const s = step as Record<string, unknown>;
  if (typeof s.type !== 'string' || !STEP_TYPES.has(s.type as StepType))
    return `unknown step type ${JSON.stringify(s.type)}`;
  if (s.key !== undefined && typeof s.key !== 'string') return 'key must be a string';
  if (s.duration !== undefined && (typeof s.duration !== 'number' || s.duration < 0)) return 'duration must be >= 0';
  if (s.at !== undefined && (typeof s.at !== 'number' || s.at < 0)) return 'at must be >= 0';
  switch (s.type as StepType) {
    case 'moveCursor':
      return isTarget(s.target) ? undefined : 'moveCursor needs a target id or point';
    case 'click':
    case 'press':
      return s.target === undefined || isTarget(s.target) ? undefined : `${s.type} target must be an id or point`;
    case 'type':
      if (typeof s.target !== 'string') return 'type needs a target id';
      return typeof s.text === 'string' ? undefined : 'type needs text';
    case 'clear':
    case 'focus':
      return typeof s.target === 'string' ? undefined : `${s.type} needs a target id`;
    case 'wait':
      return typeof s.duration === 'number' && s.duration >= 0 ? undefined : 'wait needs a duration';
    case 'setValue':
      if (typeof s.target !== 'string') return 'setValue needs a target id';
      return typeof s.value === 'string' ? undefined : 'setValue needs a value';
    case 'set':
      if (typeof s.target !== 'string') return 'set needs a target id';
      return typeof s.patch === 'object' && s.patch !== null ? undefined : 'set needs a patch object';
    default:
      return undefined;
  }
}

/**
 * The timeline: what happens and when. A fluent builder over a plain list of
 * steps, which is all that `toJSON()` emits. Timing is decided at compile
 * time against the scene, so authoring never needs to know durations.
 */
export class Timeline {
  private list: Step[] = [];
  private version_ = 0;
  private cursorStart?: Point;
  private pendingAt?: number;

  /** Bumps on every mutation; a compiled timeline is stale when it differs. */
  get version(): number {
    return this.version_;
  }

  get steps(): readonly Step[] {
    return this.list;
  }

  /** Where the cursor rests before the first step. */
  get cursor(): Point | undefined {
    return this.cursorStart;
  }

  /** Sets where the cursor rests before the first step. */
  startAt(point: Point): this {
    this.cursorStart = { x: point.x, y: point.y };
    this.version_ += 1;
    return this;
  }

  /** Makes the next step start at an absolute time instead of right after the previous one. */
  at(time: number): this {
    this.pendingAt = time;
    return this;
  }

  /** Appends a raw step. The fluent methods all go through here. */
  add(step: Step): this {
    const problem = validateStep(step);
    if (problem) throw new Error(`Invalid step: ${problem}`);
    const copy: Step = { ...step };
    if (this.pendingAt !== undefined) {
      copy.at = this.pendingAt;
      this.pendingAt = undefined;
    }
    this.list.push(copy);
    this.version_ += 1;
    return this;
  }

  /** Moves the cursor to a node (a point inside it) or to a point. */
  moveCursor(target: Target, options: StepOptions = {}): this {
    return this.add({ type: 'moveCursor', target, ...options });
  }

  /** Clicks the target, moving there first if needed; with no target, clicks where the cursor is. */
  click(target?: Target, options: StepOptions = {}): this {
    return this.add(target === undefined ? { type: 'click', ...options } : { type: 'click', target, ...options });
  }

  press(target?: Target, options: StepOptions = {}): this {
    return this.add(target === undefined ? { type: 'press', ...options } : { type: 'press', target, ...options });
  }

  release(options: StepOptions = {}): this {
    return this.add({ type: 'release', ...options });
  }

  /** Types text into an input, focusing it first if it is not focused. "\b" deletes a character. */
  type(target: string, text: string, options: StepOptions = {}): this {
    return this.add({ type: 'type', target, text, ...options });
  }

  /** Empties an input. */
  clear(target: string, options: StepOptions = {}): this {
    return this.add({ type: 'clear', target, ...options });
  }

  wait(duration: number, options: Omit<StepOptions, 'duration'> = {}): this {
    return this.add({ type: 'wait', duration, ...options });
  }

  focus(target: string, options: Omit<StepOptions, 'duration'> = {}): this {
    return this.add({ type: 'focus', target, ...options });
  }

  blur(options: Omit<StepOptions, 'duration'> = {}): this {
    return this.add({ type: 'blur', ...options });
  }

  /** Sets an input's value instantly. */
  setValue(target: string, value: string, options: Omit<StepOptions, 'duration'> = {}): this {
    return this.add({ type: 'setValue', target, value, ...options });
  }

  /** Patches a scene node from this point on (show a dialog, change a label, move something). */
  set(target: string, patch: NodePatch, options: Omit<StepOptions, 'duration'> = {}): this {
    return this.add({ type: 'set', target, patch, ...options });
  }

  /** Removes every step. */
  reset(): this {
    this.list = [];
    this.pendingAt = undefined;
    this.version_ += 1;
    return this;
  }

  toJSON(): TimelineJSON {
    const json: TimelineJSON = { version: 1, steps: this.list.map((s) => ({ ...s })) };
    if (this.cursorStart) json.cursor = { ...this.cursorStart };
    return json;
  }

  /** Replaces the contents with a serialised timeline. */
  load(json: TimelineJSON | Step[]): this {
    const steps = Array.isArray(json) ? json : json.steps;
    if (!Array.isArray(steps)) throw new Error('Invalid timeline: steps must be an array');
    if (!Array.isArray(json) && json.version !== 1)
      throw new Error(`Invalid timeline: unsupported version ${json.version}`);
    steps.forEach((step, i) => {
      const problem = validateStep(step);
      if (problem) throw new Error(`Invalid timeline: steps[${i}]: ${problem}`);
    });
    this.reset();
    if (!Array.isArray(json) && json.cursor && isPoint(json.cursor)) this.cursorStart = { ...json.cursor };
    for (const step of steps) this.list.push({ ...step });
    this.version_ += 1;
    return this;
  }

  static fromJSON(json: TimelineJSON | Step[]): Timeline {
    return new Timeline().load(json);
  }
}
