import { describe, expect, test } from 'vitest';
import { createDemo } from '../../../src/index.js';
import { CARET_PERIOD, caretVisible, stateAt } from '../../../src/timeline/state.js';

function login() {
  const demo = createDemo({ width: 900, height: 600, seed: 42 });
  demo.input({ id: 'email', x: 250, y: 200, width: 350, placeholder: 'Email' });
  demo.input({ id: 'password', x: 250, y: 260, width: 350 });
  demo.button({ id: 'login', x: 470, y: 300, characters: 'Sign in' });
  demo.frame({ id: 'side', x: 0, y: 0, width: 200, height: 600 });
  return demo;
}

describe('stateAt', () => {
  test('before, during and after the timeline', () => {
    const demo = login();
    demo.timeline.moveCursor('email').click().type('email', 'hi');
    const c = demo.compiled();
    const before = stateAt(c, -1);
    expect(before).toMatchObject({ cursor: c.initialCursor, pressed: false, activeStep: -1 });
    expect(before.focused).toBeUndefined();
    const end = stateAt(c, c.duration);
    expect(end).toMatchObject({ focused: 'email', pressed: false, activeStep: -1 });
    expect(end.values.get('email')).toBe('hi');
    expect(end.cursor).toEqual(c.steps[0].cursor!.to);
    const after = stateAt(c, c.duration + 5000);
    expect({ ...after, t: 0 }).toEqual({ ...end, t: 0 });
  });

  test('cursor follows the path and pressed spans exactly the hold', () => {
    const demo = login();
    demo.timeline.click('login');
    const c = demo.compiled();
    // click('login') compiles into a move and then the click itself.
    const [move, click] = c.steps;
    const pressAt = click.start + click.click!.pressAt;
    const releaseAt = click.start + click.click!.releaseAt;
    const mid = stateAt(c, move.end / 2);
    expect(mid.activeStep).toBe(0);
    expect(mid.pressed).toBe(false);
    expect(mid.cursor).not.toEqual(move.cursor!.to);
    expect(stateAt(c, pressAt).pressed).toBe(true);
    expect(stateAt(c, pressAt).pressedNode).toBe('login');
    expect(stateAt(c, releaseAt - 1).pressed).toBe(true);
    expect(stateAt(c, releaseAt).pressed).toBe(false);
    expect(stateAt(c, releaseAt).focused).toBe('login');
    expect(stateAt(c, releaseAt).lastRelease).toEqual({ at: move.cursor!.to, time: releaseAt });
  });

  test('typing reveals a prefix at every op boundary', () => {
    const demo = login();
    demo.timeline.type('email', 'abc');
    const c = demo.compiled();
    const { opEnds } = c.steps[0].typing!;
    expect(stateAt(c, 0).values.get('email')).toBe('');
    expect(stateAt(c, 0).focused).toBe('email');
    expect(stateAt(c, opEnds[0] - 1).values.get('email')).toBe('');
    expect(stateAt(c, opEnds[0]).values.get('email')).toBe('a');
    expect(stateAt(c, opEnds[1]).values.get('email')).toBe('ab');
    expect(stateAt(c, opEnds[2]).values.get('email')).toBe('abc');
    expect(stateAt(c, opEnds[1]).lastKeyAt).toBe(opEnds[1]);
  });

  test('clicking a panel blurs; focus and blur steps are instant', () => {
    const demo = login();
    demo.timeline.focus('email').wait(100).blur().wait(100).click('side').focus('password').click('side');
    const c = demo.compiled();
    expect(stateAt(c, 0).focused).toBe('email');
    expect(stateAt(c, 50).focused).toBe('email');
    expect(stateAt(c, 100).focused).toBeUndefined();
    const clickSide = c.steps.filter((s) => s.authored === 4).at(-1)!;
    expect(stateAt(c, clickSide.end - 1).focused).toBeUndefined();
    const focusPassword = c.steps.find((s) => s.authored === 5)!;
    expect(stateAt(c, focusPassword.start).focused).toBe('password');
    expect(stateAt(c, c.duration).focused).toBeUndefined();
  });

  test('set patches accumulate per node', () => {
    const demo = login();
    demo.timeline.set('login', { x: 1 }).wait(10).set('login', { y: 2 });
    const c = demo.compiled();
    expect(stateAt(c, 0).patches.get('login')).toEqual({ x: 1 });
    expect(stateAt(c, 10).patches.get('login')).toEqual({ x: 1, y: 2 });
    expect(demo.nodeAt('login', 10)).toMatchObject({ x: 1, y: 2, characters: 'Sign in' });
    expect(demo.nodeAt('login', -1)).toMatchObject({ x: 470, y: 300 });
  });

  test('caret is solid after a key, then blinks in phase with focus', () => {
    const demo = login();
    demo.timeline.focus('email').wait(5000);
    const c = demo.compiled();
    expect(caretVisible(stateAt(c, 0))).toBe(true);
    expect(caretVisible(stateAt(c, CARET_PERIOD - 1))).toBe(true);
    expect(caretVisible(stateAt(c, CARET_PERIOD))).toBe(false);
    expect(caretVisible(stateAt(c, CARET_PERIOD * 2))).toBe(true);
    const typed = login();
    typed.timeline.focus('email').wait(2000).type('email', 'x');
    const tc = typed.compiled();
    const keyAt = tc.steps[2].start + tc.steps[2].typing!.opEnds[0];
    expect(caretVisible(stateAt(tc, keyAt + 10))).toBe(true);
    expect(caretVisible(stateAt(tc, keyAt + CARET_PERIOD - 1))).toBe(true);
  });

  test('press and release are the raw halves of a click', () => {
    const demo = login();
    demo.timeline.press('login').wait(500).release();
    const c = demo.compiled();
    expect(stateAt(c, c.steps[0].end).pressed).toBe(true);
    expect(stateAt(c, c.steps[0].end).pressedNode).toBe('login');
    expect(stateAt(c, c.steps[0].end).focused).toBeUndefined();
    expect(stateAt(c, c.duration).pressed).toBe(false);
    expect(stateAt(c, c.duration).focused).toBe('login');
  });
});

/** Group html without the two attributes that legitimately follow position. */
const strip = (h: string) => h.replace(/ data-h="[^"]*"/, '').replace(/ transform="[^"]*"/, '');

describe('frames', () => {
  test('frame(t) renders the cursor, the live value and the focus ring; a static scene has no cursor', () => {
    const demo = login();
    expect(demo.toSVG()).not.toContain('__cursor');
    demo.timeline.moveCursor('email').click().type('email', 'hey');
    const end = demo.toSVG(demo.duration);
    expect(end).toContain('data-key="__cursor"');
    expect(end).toContain('data-key="__focus"');
    expect(end).toContain('data-for="email"');
    const mid = demo.frameAt(demo.duration - 1).groups.find((g) => g.key === 'email')!.html;
    expect(mid).not.toBe(demo.frameAt(demo.duration).groups.find((g) => g.key === 'email')!.html);
  });

  test('frames() covers the whole timeline and ends exactly at the end', () => {
    const demo = login();
    demo.timeline.wait(100);
    const list = [...demo.frames(50)];
    expect(list.map((f) => f.t)).toEqual([0, 20, 40, 60, 80, 100]);
    expect(list[5].svg).toBe(demo.toSVG(100));
  });

  test('a moved node keeps its geometry across a set patch and back', () => {
    const demo = login();
    demo.timeline.wait(100).set('login', { x: 100 }).wait(100);
    const before = demo.frameAt(0).groups.find((g) => g.key === 'login')!.html;
    const moved = demo.frameAt(150).groups.find((g) => g.key === 'login')!.html;
    expect(strip(moved)).toBe(strip(before));
    expect(moved).toContain('translate(100 300)');
    expect(demo.frameAt(0).groups.find((g) => g.key === 'login')!.html).toBe(before);
  });
});

describe('auto-layout under the timeline', () => {
  test('a set step changing itemSpacing reflows at that time and not before; the authored scene is untouched', () => {
    const demo = createDemo({ width: 600, height: 600, seed: 3 });
    demo.frame({
      id: 'card',
      x: 100,
      y: 100,
      width: 300,
      height: 300,
      layoutMode: 'VERTICAL',
      itemSpacing: 10,
      padding: 20,
    });
    demo.rectangle({ id: 'a', parent: 'card', width: 100, height: 30 });
    demo.rectangle({ id: 'b', parent: 'card', width: 100, height: 40 });
    demo.timeline.wait(100).set('card', { itemSpacing: 50 }).wait(100);
    const at = (t: number) =>
      demo
        .frameAt(t)
        .groups.find((g) => g.key === 'b')!
        .html.match(/transform="([^"]*)"/)![1];
    expect(at(0)).toBe('translate(120 160)');
    expect(at(99)).toBe('translate(120 160)');
    expect(at(100)).toBe('translate(120 200)');
    expect(demo.scene.bounds('b').y).toBe(160);
    // The patched scene is cached per patch state: two frames in the same state share it.
    expect(demo.frameAt(150).groups.find((g) => g.key === 'b')!.html).toBe(
      demo.frameAt(120).groups.find((g) => g.key === 'b')!.html,
    );
  });

  test('a set step that grows a label reflows a HUG frame', () => {
    const demo = createDemo({ width: 600, height: 600, seed: 3 });
    demo.frame({
      id: 'card',
      x: 100,
      y: 100,
      layoutMode: 'VERTICAL',
      layoutSizingHorizontal: 'HUG',
      layoutSizingVertical: 'HUG',
      padding: 10,
    });
    demo.button({ id: 'go', parent: 'card', characters: 'Go' });
    demo.timeline.wait(50).set('go', { characters: 'Go to the dashboard' });
    const before = demo.frameAt(0).groups.find((g) => g.key === 'card')!.html;
    const after = demo.frameAt(50).groups.find((g) => g.key === 'card')!.html;
    expect(after).not.toBe(before);
    expect(demo.nodeAt('go', 50)).toMatchObject({ characters: 'Go to the dashboard' });
  });
});
