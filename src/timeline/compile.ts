import type { Scene } from '../core/scene.js';
import type { ControlValue, Point, SceneNode, Size } from '../core/types.js';
import { deriveSeed } from '../core/ids.js';
import { Random } from '../sketch/index.js';
import { componentFor } from '../components/index.js';
import type { Capabilities, LayoutContext, Region, RenderContext, WidgetAction } from '../components/types.js';
import type { Timeline } from './timeline.js';
import type { CompiledStep, CompiledTimeline, Step, Target, WidgetEffect } from './types.js';
import { planCursorPath } from './cursor-path.js';
import { planTyping } from './typing.js';

const HOLD_MIN = 60;
const HOLD_JITTER = 60;
const CLEAR_DURATION = 180;
const HOVER_DELAY = 400;
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

/** The compiler's mirror of stateAt(): what the world looks like after the steps so far. */
interface CompileState {
  cursor: Point;
  focused?: string;
  pressed: boolean;
  values: Map<string, ControlValue>;
  checked: Map<string, boolean>;
  open: Map<string, boolean>;
}

type Emit = Omit<CompiledStep, 'index' | 'authored' | 'key' | 'start' | 'end'> & { duration: number };

/**
 * Resolves every step against the scene: where targets are, how long moves
 * and typing take, what a click hits and changes. Works on a clone of the
 * scene so `set` steps can change layout for later steps without touching
 * the document. A semantic step (`choose`, `drag`, …) expands into several
 * compiled steps, each an ordinary cursor move or click, so stateAt() needs
 * to know nothing about semantics.
 */
export function compile(
  timeline: Timeline,
  scene: Scene,
  seed: number,
  size: Size,
  layout: LayoutContext,
): CompiledTimeline {
  const working = scene.clone();
  const state: CompileState = {
    cursor: timeline.cursor ?? defaultCursorStart(size),
    pressed: false,
    values: new Map(),
    checked: new Map(),
    open: new Map(),
  };
  const initialFocus = working.all().find((n) => 'state' in n && n.state?.focused && working.isFocusable(n))?.id;
  state.focused = initialFocus;

  /** The live render context the compiler sees for a node, mirroring Demo.frameAt(). */
  const render = (node: SceneNode): RenderContext => {
    const authored = 'state' in node ? node.state : undefined;
    const ctx: RenderContext = {
      ...layout,
      state: { ...authored, focused: state.focused === node.id },
      bounds: (id) => working.bounds(id),
    };
    const value = state.values.get(node.id);
    if (value !== undefined) ctx.value = value;
    const checked = state.checked.get(node.id);
    if (checked !== undefined) ctx.checked = checked;
    const open = state.open.get(node.id);
    if (open !== undefined) ctx.open = open;
    return ctx;
  };
  const liveChecked = (node: SceneNode) => state.checked.get(node.id) ?? node.checked ?? false;
  const liveOpen = (node: SceneNode) => state.open.get(node.id) ?? node.open ?? false;
  const liveValue = (node: SceneNode) => state.values.get(node.id) ?? node.value;
  const regionsOf = (node: SceneNode): Region[] =>
    componentFor(node).regions?.(working.resolved(node.id), render(node)) ?? [];

  const steps: CompiledStep[] = [];
  let clock = 0;
  timeline.steps.forEach((step, authored) => {
    const key = step.key ?? String(authored);
    const start = step.at ?? clock;
    if (start < clock) {
      throw new CompileError(authored, `at=${step.at} is earlier than the end of the previous step (${clock})`);
    }
    clock = start;
    let sub = 0;
    // The first compiled step of an authored step keeps the pre-expansion
    // stream key, so timelines written before semantic steps existed keep
    // their exact timing; later sub-steps get their own streams.
    const stream = (kind: string) =>
      new Random(sub === 0 ? deriveSeed(seed, 'timeline', kind, key) : deriveSeed(seed, 'timeline', kind, key, sub));

    const emit = (fields: Emit): CompiledStep => {
      const { duration, ...rest } = fields;
      const compiled: CompiledStep = {
        ...rest,
        index: steps.length,
        authored,
        key,
        start: clock,
        end: clock + duration,
      };
      clock = compiled.end;
      steps.push(compiled);
      sub += 1;
      return compiled;
    };

    const nodeOf = (target: string): SceneNode => {
      const node = working.get(target);
      if (!node) throw new CompileError(authored, `unknown target "${target}"`);
      if (node.visible === false) throw new CompileError(authored, `target "${target}" is not visible`);
      return node;
    };

    const require = (target: string, cap: keyof Capabilities, verb: string): SceneNode => {
      const node = nodeOf(target);
      if (!componentFor(node).capabilities?.[cap]) {
        throw new CompileError(authored, `target "${target}" is a ${node.type}, which cannot be ${verb}`);
      }
      return node;
    };

    /** A seeded point inside a box: the central half, never the exact centre. */
    const pointIn = (b: { x: number; y: number; width: number; height: number }): { point: Point; width: number } => {
      const r = stream('target');
      return {
        point: {
          x: b.x + b.width / 2 + (r.next() * 2 - 1) * b.width * 0.25,
          y: b.y + b.height / 2 + (r.next() * 2 - 1) * b.height * 0.25,
        },
        width: Math.min(b.width, b.height),
      };
    };

    const resolve = (target: Target): { point: Point; width: number } => {
      if (typeof target !== 'string') return { point: { x: target.x, y: target.y }, width: 16 };
      nodeOf(target);
      return pointIn(working.bounds(target));
    };

    /** Absolute box of a region of a node. */
    const regionBox = (node: SceneNode, region: Region) => {
      const origin = working.position(node.id);
      const b = region.bounds;
      return { x: origin.x + b.x, y: origin.y + b.y, width: b.width, height: b.height };
    };

    /** Emits a cursor move to a point unless the cursor is already there; returns whether it moved. */
    const moveTo = (dest: { point: Point; width: number }, stepLabel: Step, duration?: number): boolean => {
      const distance = Math.hypot(dest.point.x - state.cursor.x, dest.point.y - state.cursor.y);
      if (distance <= SNAP_DISTANCE && duration === undefined) {
        state.cursor = dest.point;
        return false;
      }
      const cursor = planCursorPath(state.cursor, dest.point, dest.width, stream('cursor'), duration);
      state.cursor = dest.point;
      emit({ step: stepLabel, cursor, duration: cursor.duration });
      return true;
    };

    /** Applies an action to the compile state and returns the effects to replay. */
    const applyAction = (action: WidgetAction | undefined, hitId: string | undefined): WidgetEffect[] => {
      if (!action) return [];
      const id = action.target ?? hitId;
      if (id === undefined || !working.has(id)) return [];
      const effect: WidgetEffect = { id };
      if (action.checked !== undefined) {
        state.checked.set(id, action.checked);
        effect.checked = action.checked;
      }
      if (action.open !== undefined) {
        state.open.set(id, action.open);
        effect.open = action.open;
      }
      if (action.value !== undefined) {
        state.values.set(id, action.value);
        effect.value = action.value;
      }
      if (action.focus === true) state.focused = id;
      else if (action.focus === false) state.focused = undefined;
      if (Object.keys(effect).length > 1 && componentFor(working.node(id)).layoutDependsOnState) {
        const { id: _id, ...patch } = effect;
        void _id;
        working.update(id, patch);
      }
      return Object.keys(effect).length > 1 ? [effect] : [];
    };

    /** A click at the current cursor: hit-test, the hit's action, the focus rule. */
    const click = (holdKind = 'click'): CompiledStep => {
      const hold = Math.round(HOLD_MIN + stream(holdKind).next() * HOLD_JITTER);
      const hit = working.hitTestDetailed(state.cursor, render);
      const node = hit ? working.node(hit.id) : undefined;
      const def = node ? componentFor(node) : undefined;
      const action =
        hit?.region?.action ?? (node && def?.click ? def.click(working.resolved(node.id), render(node)) : undefined);
      state.focused = node && working.isFocusable(node) ? hit!.id : undefined;
      const effects = applyAction(action, hit?.id);
      const c: NonNullable<CompiledStep['click']> = { pressAt: 0, releaseAt: hold };
      if (hit) c.hit = hit.id;
      if (state.focused !== undefined) c.focus = state.focused;
      const compiled: Emit = { step: { type: 'click' }, click: c, duration: hold };
      if (effects.length) compiled.effects = effects;
      return emit(compiled);
    };

    const clickAt = (dest: { point: Point; width: number }) => {
      moveTo(dest, { type: 'moveCursor', target: dest.point });
      return click();
    };

    /** The topmost region of a node whose action satisfies `pred`; undefined when none does in the current state. */
    const findRegion = (node: SceneNode, pred: (a: WidgetAction) => boolean): Region | undefined => {
      const regions = regionsOf(node);
      for (let i = regions.length - 1; i >= 0; i--) {
        const r = regions[i];
        if (r.action !== undefined && pred(r.action)) return r;
      }
      return undefined;
    };

    /**
     * A point to click so that this region, and not one drawn over it,
     * receives the click. The seeded aim point is used when it resolves to
     * the region; otherwise the region is scanned on a grid for the first
     * point that does. Both are deterministic.
     */
    const aimAt = (node: SceneNode, region: Region): { point: Point; width: number } => {
      const box = regionBox(node, region);
      const resolvesHere = (p: Point) => {
        const hit = working.hitTestDetailed(p, render);
        return hit?.id === node.id && hit.region?.key === region.key;
      };
      const seeded = pointIn(box);
      if (resolvesHere(seeded.point)) return seeded;
      const n = 7;
      for (let j = 0; j < n; j++) {
        for (let i = 0; i < n; i++) {
          const p = { x: box.x + ((i + 0.5) / n) * box.width, y: box.y + ((j + 0.5) / n) * box.height };
          if (resolvesHere(p)) return { point: p, width: seeded.width };
        }
      }
      throw new CompileError(authored, `region "${region.key}" of "${node.id}" is covered and cannot be clicked`);
    };

    /** Ensures a node is open (or closed) by clicking the region that does it, or applying it directly. */
    const setOpen = (node: SceneNode, open: boolean): void => {
      if (liveOpen(node) === open) return;
      const region = findRegion(node, (a) => a.open === open && (a.target === undefined || a.target === node.id));
      if (region) {
        clickAt(aimAt(node, region));
        return;
      }
      const def = componentFor(node);
      const own = def.click?.(working.resolved(node.id), render(node));
      if (own && own.open === open) {
        clickAt(pointIn(working.bounds(node.id)));
        return;
      }
      // No trigger to click (a dialog closed by "escape"): apply the change instantly.
      emit({ step, duration: 0, effects: applyAction({ target: node.id, open }, node.id) });
    };

    const requireInput = (target: string) => require(target, 'text', 'typed into');

    let emitted = steps.length;
    switch (step.type) {
      case 'moveCursor':
        moveTo(resolve(step.target), step, step.duration);
        break;
      case 'click': {
        if (step.target !== undefined) moveTo(resolve(step.target), { type: 'moveCursor', target: step.target });
        const c = click();
        if (step.duration !== undefined) {
          c.end = c.start + step.duration;
          c.click!.releaseAt = step.duration;
          clock = c.end;
        }
        break;
      }
      case 'press': {
        if (step.target !== undefined) moveTo(resolve(step.target), { type: 'moveCursor', target: step.target });
        const hit = working.hitTestDetailed(state.cursor, render);
        state.pressed = true;
        const c: NonNullable<CompiledStep['click']> = { pressAt: 0, releaseAt: 0 };
        if (hit) c.hit = hit.id;
        emit({ step, click: c, duration: step.duration ?? 0 });
        break;
      }
      case 'release': {
        state.pressed = false;
        const hit = working.hitTestDetailed(state.cursor, render);
        const node = hit ? working.node(hit.id) : undefined;
        state.focused = node && working.isFocusable(node) ? hit!.id : undefined;
        const c: NonNullable<CompiledStep['click']> = { pressAt: 0, releaseAt: 0 };
        if (hit) c.hit = hit.id;
        if (state.focused !== undefined) c.focus = state.focused;
        emit({ step, click: c, duration: step.duration ?? 0 });
        break;
      }
      case 'type': {
        const node = requireInput(step.target);
        const current = liveValue(node);
        const base = typeof current === 'string' ? current : current === undefined ? '' : String(current);
        const focuses = state.focused !== step.target;
        const typing = planTyping(step.target, base, step.text, stream('type'), focuses, step.duration);
        state.focused = step.target;
        state.values.set(step.target, applyAll(typing.base, typing.ops));
        emit({ step, typing, duration: typing.opEnds.at(-1) ?? 0 });
        break;
      }
      case 'clear':
        requireInput(step.target);
        state.values.set(step.target, '');
        emit({ step, duration: step.duration ?? CLEAR_DURATION });
        break;
      case 'wait':
        emit({ step, duration: step.duration });
        break;
      case 'focus': {
        const node = nodeOf(step.target);
        if (!working.isFocusable(node)) throw new CompileError(authored, `target "${step.target}" is not focusable`);
        state.focused = step.target;
        emit({ step, duration: 0 });
        break;
      }
      case 'blur':
        state.focused = undefined;
        emit({ step, duration: 0 });
        break;
      case 'setValue':
        nodeOf(step.target);
        state.values.set(step.target, step.value);
        emit({ step, duration: 0, effects: [{ id: step.target, value: step.value }] });
        break;
      case 'set':
        if (!working.has(step.target)) throw new CompileError(authored, `unknown target "${step.target}"`);
        working.update(step.target, step.patch);
        emit({ step, duration: 0 });
        break;
      case 'check':
      case 'uncheck': {
        const want = step.type === 'check';
        const node = require(step.target, 'check', want ? 'checked' : 'unchecked');
        if (step.option !== undefined) {
          const value = liveValue(node);
          const selected = Array.isArray(value) ? value : [];
          const has = selected.includes(step.option);
          if (has !== want) {
            const r = regionsOf(node).find((x) => x.key === `option:${step.option}`);
            if (!r) throw new CompileError(authored, `target "${step.target}" has no option "${step.option}"`);
            clickAt(aimAt(node, r));
          } else {
            moveTo(pointIn(working.bounds(node.id)), { type: 'moveCursor', target: node.id });
          }
        } else if (liveChecked(node) !== want) {
          const r = findRegion(node, (a) => a.checked === want && (a.target === undefined || a.target === node.id));
          clickAt(r ? aimAt(node, r) : pointIn(working.bounds(node.id)));
        } else {
          moveTo(pointIn(working.bounds(node.id)), { type: 'moveCursor', target: node.id });
        }
        break;
      }
      case 'toggle': {
        const node = require(step.target, 'check', 'toggled');
        const r = findRegion(node, (a) => a.checked !== undefined && (a.target === undefined || a.target === node.id));
        clickAt(r ? aimAt(node, r) : pointIn(working.bounds(node.id)));
        break;
      }
      case 'choose': {
        const node = require(step.target, 'choose', 'chosen from');
        const matches = (a: WidgetAction) =>
          a.value === step.value || (Array.isArray(a.value) && a.value.includes(String(step.value)));
        let region = findRegion(node, matches);
        if (!region && componentFor(node).capabilities?.open) {
          setOpen(node, true);
          region = findRegion(node, matches);
        }
        if (!region)
          throw new CompileError(authored, `target "${step.target}" has no option ${JSON.stringify(step.value)}`);
        clickAt(aimAt(node, region));
        break;
      }
      case 'open':
      case 'close': {
        const node = require(step.target, 'open', step.type === 'open' ? 'opened' : 'closed');
        setOpen(node, step.type === 'open');
        break;
      }
      case 'hover': {
        const node = nodeOf(step.target);
        moveTo(pointIn(working.bounds(node.id)), { type: 'moveCursor', target: node.id });
        const def = componentFor(node);
        if (def.capabilities?.hover) {
          const delay = (node as { delay?: number }).delay ?? HOVER_DELAY;
          const hoverRegion = regionsOf(node).find((r) => r.key === 'hover');
          const action = hoverRegion?.action ?? def.click?.(working.resolved(node.id), render(node));
          emit({ step, duration: step.duration ?? delay, effects: applyAction(action, node.id) });
        } else {
          emit({ step, duration: step.duration ?? 0 });
        }
        break;
      }
      case 'drag': {
        const node = require(step.target, 'drag', 'dragged');
        const def = componentFor(node);
        const resolved = working.resolved(node.id);
        const ctx = render(node);
        const current = liveValue(node);
        const from = typeof current === 'number' ? current : Number((node as { min?: number }).min ?? 0);
        const origin = working.position(node.id);
        const local0 = def.drag!.pointFor(resolved, ctx, from);
        const local1 = def.drag!.pointFor(resolved, ctx, step.value);
        const p0 = { x: origin.x + local0.x, y: origin.y + local0.y };
        const p1 = { x: origin.x + local1.x, y: origin.y + local1.y };
        moveTo({ point: p0, width: 16 }, { type: 'moveCursor', target: node.id });
        state.pressed = true;
        emit({ step: { type: 'press' }, click: { pressAt: 0, releaseAt: 0, hit: node.id }, duration: 0 });
        const cursor = planCursorPath(state.cursor, p1, 16, stream('cursor'), step.duration);
        state.cursor = p1;
        emit({
          step: { type: 'moveCursor', target: p1 },
          cursor,
          drag: { target: node.id, from, to: step.value },
          duration: cursor.duration,
        });
        state.pressed = false;
        state.values.set(node.id, step.value);
        const c: NonNullable<CompiledStep['click']> = { pressAt: 0, releaseAt: 0, hit: node.id };
        if (working.isFocusable(node)) {
          state.focused = node.id;
          c.focus = node.id;
        }
        emit({ step: { type: 'release' }, click: c, duration: 0, effects: [{ id: node.id, value: step.value }] });
        break;
      }
    }
    // A step that turned out to need nothing still occupies its slot, so activeStep can name it.
    if (steps.length === emitted) emit({ step, duration: step.type === 'wait' ? step.duration : 0 });
    emitted = steps.length;
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
