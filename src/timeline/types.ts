import type { NodePatch, Point } from '../core/types.js';

/** A node id, or a point in document coordinates. */
export type Target = string | Point;

export interface StepBase {
  /**
   * Stable key for this step's random streams. Defaults to the step's index,
   * which means inserting a step re-rolls the jitter of every later step
   * (never their semantics). Set a key to pin a step's randomness.
   */
  key?: string;
  /** Overrides the computed duration, in ms. */
  duration?: number;
  /** Absolute start time, in ms. Must not be earlier than the end of the previous step. */
  at?: number;
}

export type Step = StepBase &
  (
    | { type: 'moveCursor'; target: Target }
    | { type: 'click'; target?: Target }
    | { type: 'press'; target?: Target }
    | { type: 'release' }
    | { type: 'type'; target: string; text: string }
    | { type: 'clear'; target: string }
    | { type: 'wait'; duration: number }
    | { type: 'focus'; target: string }
    | { type: 'blur' }
    | { type: 'setValue'; target: string; value: string }
    | { type: 'set'; target: string; patch: NodePatch }
  );

export type StepType = Step['type'];

export interface TimelineJSON {
  version: 1;
  /** Where the cursor rests before the first step. Defaults to a point in the lower half of the document. */
  cursor?: Point;
  steps: Step[];
}

export interface CursorPath {
  from: Point;
  to: Point;
  /** ms */
  duration: number;
  /** Control points of the main cubic. */
  c1: Point;
  c2: Point;
  /** When set, the cursor overshoots to `point` and settles onto `to`. */
  overshoot?: {
    point: Point;
    /** Control points of the settle cubic (point -> to). */
    s1: Point;
    s2: Point;
    /** Fraction of eased progress spent on the main cubic. */
    split: number;
  };
}

export interface TypingPlan {
  target: string;
  /** Value before the step. */
  base: string;
  /** Insert a character, or delete the last one. */
  ops: (string | { del: true })[];
  /** Local ms at which each op completes. */
  opEnds: number[];
  /** True when this step focuses the input itself (it was not focused before). */
  focuses: boolean;
}

export interface CompiledStep {
  index: number;
  key: string;
  step: Step;
  /** Absolute ms. */
  start: number;
  end: number;
  cursor?: CursorPath;
  click?: {
    /** Node under the cursor at release, if any. */
    hit?: string;
    /** Node that takes focus at release; unset means focus is cleared. */
    focus?: string;
    /** Local ms. */
    pressAt: number;
    releaseAt: number;
  };
  typing?: TypingPlan;
}

export interface CompiledTimeline {
  seed: number;
  sceneVersion: number;
  timelineVersion: number;
  duration: number;
  initialCursor: Point;
  /** The node focused before the first step, from authored state. */
  initialFocus?: string;
  steps: CompiledStep[];
}

export interface InteractionState {
  t: number;
  cursor: Point;
  pressed: boolean;
  /** Node pressed by the current press, while pressed. */
  pressedNode?: string;
  focused?: string;
  /** Absolute ms when focus last changed; drives the caret blink phase. */
  focusedAt: number;
  /** Absolute ms of the last typed character. */
  lastKeyAt: number;
  /** Live input values, by node id. */
  values: Map<string, string>;
  lastRelease?: { at: Point; time: number };
  /** Accumulated scene patches from completed `set` steps. */
  patches: Map<string, NodePatch>;
  /** Index of the step in progress, or -1. */
  activeStep: number;
}
