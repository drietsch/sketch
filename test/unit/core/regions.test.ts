import { beforeAll, describe, expect, test } from 'vitest';
import { createDemo } from '../../../src/index.js';
import { registerComponent } from '../../../src/components/index.js';
import type { ComponentDef, Region } from '../../../src/components/types.js';
import type { NodeBase, NodeType } from '../../../src/core/types.js';
import { CompileError } from '../../../src/timeline/compile.js';
import { stateAt } from '../../../src/timeline/state.js';
import { resolvePartStyle } from '../../../src/components/style.js';

/**
 * A stand-in widget that exercises every hook the machinery offers: two
 * in-place regions, an overlay region that exists only while open, a drag
 * axis, hidden children while closed, and a per-type validation rule.
 */
type Fake = NodeBase & { type: 'FAKE'; width: number; height: number; other?: string; label?: string };

const fake: ComponentDef<Fake> = {
  interactive: true,
  focusable: true,
  capabilities: { check: true, choose: true, open: true, drag: true, hover: true },
  localBounds: (n) => ({ x: 0, y: 0, width: n.width, height: n.height }),
  expand: (n, ctx) => {
    const parts = [
      {
        key: 'box',
        kind: 'rect' as const,
        x: 0,
        y: 0,
        width: n.width,
        height: n.height,
        style: resolvePartStyle(ctx.theme, n),
      },
    ];
    if (ctx.open ?? n.open) {
      parts.push({
        key: 'pop',
        kind: 'rect' as const,
        x: 0,
        y: n.height,
        width: n.width,
        height: 30,
        style: resolvePartStyle(ctx.theme, n),
        layer: 'overlay',
      } as never);
    }
    return parts;
  },
  regions: (n, ctx) => {
    const checked = ctx.checked ?? n.checked ?? false;
    const open = ctx.open ?? n.open ?? false;
    // Listed lowest-priority first: the hover region covers everything, the halves win where they overlap it.
    const out: Region[] = [
      { key: 'hover', bounds: { x: 0, y: 0, width: n.width, height: n.height }, action: { open: true } },
      { key: 'left', bounds: { x: 0, y: 0, width: n.width / 2, height: 30 }, action: { checked: !checked } },
      { key: 'right', bounds: { x: n.width / 2, y: 0, width: n.width / 2, height: 30 }, action: { open: !open } },
    ];
    if (n.other)
      out.push({
        key: 'foreign',
        bounds: { x: 0, y: 30, width: n.width, height: 10 },
        action: { target: n.other, value: 'B' },
      });
    if (open) {
      out.push({
        key: 'option:A',
        bounds: { x: 0, y: n.height, width: n.width, height: 15 },
        action: { value: 'A', open: false },
        layer: 'overlay',
      });
      out.push({
        key: 'option:Z',
        bounds: { x: 0, y: n.height + 15, width: n.width, height: 15 },
        action: { value: 'Z', open: false },
        layer: 'overlay',
      });
    }
    return out;
  },
  drag: {
    valueAt: (n, _ctx, p) => (p.x / n.width) * 100,
    pointFor: (n, _ctx, v) => ({ x: (v / 100) * n.width, y: n.height / 2 }),
  },
  childVisible: (n) => !!n.open,
  layoutDependsOnState: true,
  validate: (n) => (n.width > 0 ? undefined : 'width must be positive'),
};

beforeAll(() => registerComponent('FAKE' as NodeType, fake as never));

function make() {
  const demo = createDemo({ width: 400, height: 300, seed: 5 });
  demo.scene.add({ id: 'w', type: 'FAKE', x: 100, y: 100, width: 100, height: 40, other: 'v' } as never);
  demo.scene.add({ id: 'v', type: 'FAKE', x: 100, y: 200, width: 100, height: 40 } as never);
  return demo;
}
const byAuthored = (demo: ReturnType<typeof make>, i: number) => demo.compiled().steps.filter((s) => s.authored === i);

describe('regions and actions', () => {
  test('hitTestDetailed finds the region under the point; outside any node it finds nothing', () => {
    const demo = make();
    const render = () =>
      ({
        theme: demo.theme,
        font: demo.font,
        icons: (i: never) => demo.resolveIcon(i),
        document: { width: 400, height: 300 },
        state: {},
        bounds: (id: string) => demo.scene.bounds(id),
      }) as never;
    expect(demo.scene.hitTestDetailed({ x: 110, y: 120 }, render)).toMatchObject({ id: 'w', region: { key: 'left' } });
    expect(demo.scene.hitTestDetailed({ x: 190, y: 120 }, render)).toMatchObject({ id: 'w', region: { key: 'right' } });
    expect(demo.scene.hitTestDetailed({ x: 10, y: 10 }, render)).toBeUndefined();
    expect(demo.scene.hitTest({ x: 110, y: 120 })).toBe('w');
  });

  test('a click applies the region action, records it, and stateAt replays it', () => {
    const demo = make();
    demo.timeline.click({ x: 110, y: 120 });
    const [move, click] = demo.compiled().steps;
    expect(move.step.type).toBe('moveCursor');
    expect(click.effects).toEqual([{ id: 'w', checked: true }]);
    expect(demo.stateAt(demo.duration).checked.get('w')).toBe(true);
    expect(demo.stateAt(move.end - 1).checked.get('w')).toBeUndefined();
    expect(demo.nodeAt('w', demo.duration)).toMatchObject({ checked: true });
  });

  test('an action may target another node', () => {
    const demo = make();
    demo.timeline.click({ x: 150, y: 135 });
    expect(demo.stateAt(demo.duration).values.get('v')).toBe('B');
    expect(demo.stateAt(demo.duration).values.get('w')).toBeUndefined();
  });

  test('check clicks only when needed; uncheck likewise; toggle always clicks', () => {
    const demo = make();
    demo.timeline.check('w').check('w').uncheck('w').toggle('w').toggle('w');
    const types = (i: number) => byAuthored(demo, i).map((s) => s.step.type);
    // Aim points are seeded per step, so the cursor may shift a little inside the target before a click.
    expect(types(0)).toEqual(['moveCursor', 'click']);
    expect(types(1)).not.toContain('click');
    expect(types(2).at(-1)).toBe('click');
    expect(types(3).at(-1)).toBe('click');
    expect(types(4).at(-1)).toBe('click');
    const after = (i: number) => demo.stateAt(byAuthored(demo, i).at(-1)!.end).checked.get('w');
    expect([after(0), after(1), after(2), after(3), after(4)]).toEqual([true, true, false, true, false]);
  });

  test('choose opens first when the option is only available while open, then clicks it', () => {
    const demo = make();
    demo.timeline.choose('w', 'Z');
    const steps = byAuthored(demo, 0).map((s) => s.step.type);
    expect(steps).toEqual(['moveCursor', 'click', 'moveCursor', 'click']);
    const end = demo.stateAt(demo.duration);
    expect(end.values.get('w')).toBe('Z');
    expect(end.open.get('w')).toBe(false);
    const midway = byAuthored(demo, 0)[1].end;
    expect(demo.stateAt(midway).open.get('w')).toBe(true);
    expect(() => {
      const d = make();
      d.timeline.choose('w', 'nope');
      d.compiled();
    }).toThrow(/has no option "nope"/);
  });

  test('open and close use the region that does it, or apply instantly when there is none', () => {
    const demo = make();
    demo.timeline.open('w').open('w').close('w');
    expect(byAuthored(demo, 0).map((s) => s.step.type)).toEqual(['moveCursor', 'click']);
    // Already open: the cursor visits it, nothing is clicked.
    expect(byAuthored(demo, 1).map((s) => s.step.type)).toEqual(['moveCursor']);
    expect(byAuthored(demo, 2).map((s) => s.step.type)).toEqual(['moveCursor', 'click']);
    expect(demo.stateAt(demo.duration).open.get('w')).toBe(false);
    const direct = make();
    direct.scene.update('w', { open: true } as never);
    direct.scene.add({ id: 'plain', type: 'RECTANGLE', x: 0, y: 0, width: 10, height: 10 });
    // A node with no closing region: close() applies the effect without a click.
    const noRegion: ComponentDef<Fake> = { ...fake, regions: () => [] };
    registerComponent('FAKE2' as NodeType, noRegion as never);
    direct.scene.add({ id: 'q', type: 'FAKE2', x: 0, y: 50, width: 50, height: 20, open: true } as never);
    direct.timeline.close('q');
    expect(direct.compiled().steps.map((s) => s.step.type)).toEqual(['close']);
    expect(direct.stateAt(direct.duration).open.get('q')).toBe(false);
  });

  test('a capability mismatch names the step and the type', () => {
    const demo = make();
    demo.rectangle({ id: 'r', x: 0, y: 0, width: 10, height: 10, interactive: true });
    demo.timeline.wait(1).check('r');
    expect(() => demo.compiled()).toThrow(CompileError);
    expect(() => demo.compiled()).toThrow(/step 1: target "r" is a RECTANGLE, which cannot be checked/);
    for (const bad of [
      (d: ReturnType<typeof make>) => d.timeline.choose('r', 'x'),
      (d: ReturnType<typeof make>) => d.timeline.open('r'),
      (d: ReturnType<typeof make>) => d.timeline.drag('r', 5),
      (d: ReturnType<typeof make>) => d.timeline.type('r', 'x'),
    ]) {
      const d = make();
      d.rectangle({ id: 'r', x: 0, y: 0, width: 10, height: 10 });
      bad(d);
      expect(() => d.compiled()).toThrow(/cannot be/);
    }
  });

  test('drag presses on the handle, moves, interpolates the value, and snaps at the end', () => {
    const demo = make();
    demo.timeline.drag('w', 70);
    const [move, press, dragMove, release] = demo.compiled().steps;
    expect([move.step.type, press.step.type, dragMove.step.type, release.step.type]).toEqual([
      'moveCursor',
      'press',
      'moveCursor',
      'release',
    ]);
    expect(dragMove.drag).toEqual({ target: 'w', from: 0, to: 70 });
    expect(move.cursor!.to).toEqual({ x: 100, y: 120 });
    expect(dragMove.cursor!.to).toEqual({ x: 170, y: 120 });
    const mid = stateAt(demo.compiled(), dragMove.start + dragMove.cursor!.duration / 2);
    expect(mid.pressed).toBe(true);
    expect(mid.values.get('w') as number).toBeGreaterThan(0);
    expect(mid.values.get('w') as number).toBeLessThan(70);
    const end = demo.stateAt(demo.duration);
    expect(end.values.get('w')).toBe(70);
    expect(end.pressed).toBe(false);
    expect(end.focused).toBe('w');
    // A second drag starts from the current value.
    demo.timeline.drag('w', 20);
    const second = byAuthored(demo, 1).find((s) => s.drag);
    expect(second!.drag).toEqual({ target: 'w', from: 70, to: 20 });
  });

  test('hover moves onto the node and, for hoverable components, applies the effect after the delay', () => {
    const demo = make();
    demo.timeline.hover('w');
    const steps = byAuthored(demo, 0);
    // The delay, then a rest so what opened can be seen.
    expect(steps.map((s) => s.step.type)).toEqual(['moveCursor', 'hover', 'hover']);
    expect(steps[1].end - steps[1].start).toBe(400);
    expect(steps[2].end - steps[2].start).toBe(700);
    expect(demo.stateAt(steps[1].end - 1).open.get('w')).toBeUndefined();
    expect(steps[1].effects).toEqual([{ id: 'w', open: true }]);
    expect(demo.stateAt(steps[1].end).open.get('w')).toBe(true);
    expect(demo.stateAt(demo.duration).open.get('w')).toBe(true);
  });

  test('an overlay region wins over a later sibling drawn on top of it', () => {
    const demo = make();
    demo.scene.update('w', { open: true } as never);
    demo.scene.add({ id: 'cover', type: 'FAKE', x: 100, y: 140, width: 100, height: 40 } as never);
    demo.timeline.click({ x: 150, y: 148 });
    const click = demo.compiled().steps.find((s) => s.step.type === 'click')!;
    expect(click.click!.hit).toBe('w');
    expect(click.effects).toEqual([{ id: 'w', open: false, value: 'A' }]);
  });

  test('overlay parts and their owner paint after every ordinary node; children of a closed node are hidden', () => {
    const demo = make();
    demo.scene.add({ id: 'child', type: 'RECTANGLE', parent: 'w', x: 0, y: 0, width: 5, height: 5 });
    demo.scene.add({ id: 'later', type: 'RECTANGLE', x: 0, y: 0, width: 5, height: 5 });
    expect(demo.frameAt().groups.map((g) => g.key)).toEqual(['w', 'v', 'later']);
    demo.scene.update('w', { open: true } as never);
    expect(demo.frameAt().groups.map((g) => g.key)).toEqual(['v', 'later', 'w', 'child']);
  });

  test('validation runs at add and update', () => {
    const demo = make();
    expect(() => demo.scene.add({ id: 'bad', type: 'FAKE', x: 0, y: 0, width: 0, height: 1 } as never)).toThrow(
      /width must be positive/,
    );
    expect(() => demo.scene.update('w', { width: -1 } as never)).toThrow(/width must be positive/);
  });

  test('seeking straight to t still equals stepping to t with semantic steps', () => {
    const build = () => {
      const d = make();
      d.timeline.check('w').choose('w', 'A').drag('w', 40).hover('w');
      return d;
    };
    const stepped = build();
    const direct = build();
    for (let t = 0; t < stepped.duration; t += 37) stepped.toSVG(t);
    for (const t of [0, 300, 900, stepped.duration]) expect(direct.toSVG(t)).toBe(stepped.toSVG(t));
  });
});
