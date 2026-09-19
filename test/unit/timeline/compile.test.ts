import { describe, expect, test } from 'vitest';
import { createDemo } from '../../../src/index.js';
import { CompileError, defaultCursorStart } from '../../../src/timeline/compile.js';

function login() {
  const demo = createDemo({ width: 900, height: 600, seed: 42 });
  demo.input({ id: 'email', x: 250, y: 200, width: 350, placeholder: 'Email' });
  demo.button({ id: 'login', x: 470, y: 300, characters: 'Sign in' });
  demo.frame({ id: 'side', x: 0, y: 0, width: 200, height: 600 });
  return demo;
}

/** A toolbar button that opens a confirm dialog, whose Cancel button closes it again. */
function confirmDialog() {
  const demo = createDemo({ width: 420, height: 300, seed: 7 });
  demo.button({
    id: 'trash',
    x: 20,
    y: 20,
    characters: 'Delete',
    reactions: [{ trigger: 'ON_CLICK', action: { target: 'confirm', open: true } }],
  });
  demo.dialog({ id: 'confirm', title: 'Delete?', width: 240, height: 120, open: false });
  demo.button({
    id: 'cancel',
    parent: 'confirm',
    x: 20,
    y: 60,
    characters: 'Cancel',
    reactions: [{ trigger: 'ON_CLICK', action: { target: 'confirm', open: false } }],
  });
  return demo;
}

describe('compile', () => {
  test('steps are sequential with non-decreasing starts and the total is the last end', () => {
    const demo = login();
    demo.timeline.moveCursor('email').click().type('email', 'hello@example.com').moveCursor('login').click();
    const c = demo.compiled();
    expect(c.steps).toHaveLength(5);
    for (let i = 0; i < c.steps.length; i++) {
      expect(c.steps[i].end).toBeGreaterThanOrEqual(c.steps[i].start);
      if (i > 0) expect(c.steps[i].start).toBe(c.steps[i - 1].end);
    }
    expect(c.duration).toBe(c.steps[4].end);
    expect(demo.duration).toBe(c.duration);
    expect(c.initialCursor).toEqual(defaultCursorStart({ width: 900, height: 600 }));
  });

  test('a move lands inside the target and a click decides focus', () => {
    const demo = login();
    demo.timeline.moveCursor('email').click().click('side').click('login');
    // A click with a target expands into a move and a click; group by authored step.
    const steps = demo.compiled().steps;
    const of = (authored: number) => steps.filter((s) => s.authored === authored);
    const [move] = of(0);
    const [clickEmail] = of(1);
    const [moveSide, clickSide] = of(2);
    const [moveLogin, clickLogin] = of(3);
    const b = demo.scene.bounds('email');
    const p = move.cursor!.to;
    expect(p.x).toBeGreaterThan(b.x + b.width * 0.25);
    expect(p.x).toBeLessThan(b.x + b.width * 0.75);
    expect(p.y).toBeGreaterThan(b.y);
    expect(p.y).toBeLessThan(b.y + b.height);
    // Already there: no second movement, just the hold.
    expect(clickEmail.cursor).toBeUndefined();
    expect(clickEmail.click).toMatchObject({ hit: 'email', focus: 'email', pressAt: 0 });
    expect(clickEmail.end - clickEmail.start).toBeGreaterThanOrEqual(60);
    expect(clickEmail.end - clickEmail.start).toBeLessThanOrEqual(120);
    // A panel is hit but not focusable: focus clears.
    expect(moveSide.cursor).toBeDefined();
    expect(clickSide.click).toMatchObject({ hit: 'side' });
    expect(clickSide.click!.focus).toBeUndefined();
    expect(clickLogin.click).toMatchObject({ hit: 'login', focus: 'login' });
    expect(clickLogin.start).toBe(moveLogin.end);
  });

  test('typing focuses implicitly only when needed and chains values', () => {
    const demo = login();
    demo.timeline.type('email', 'ab').type('email', 'c').clear('email').setValue('email', 'z').type('email', '!');
    const [first, second, , , last] = demo.compiled().steps;
    expect(first.typing).toMatchObject({ base: '', focuses: true });
    expect(second.typing).toMatchObject({ base: 'ab', focuses: false });
    expect(last.typing).toMatchObject({ base: 'z', focuses: false });
  });

  test('authored focus is the starting point', () => {
    const demo = login();
    demo.scene.update('email', { state: { focused: true } });
    demo.timeline.type('email', 'x');
    const c = demo.compiled();
    expect(c.initialFocus).toBe('email');
    expect(c.steps[0].typing!.focuses).toBe(false);
  });

  test('at() schedules later; earlier is an error', () => {
    const demo = login();
    demo.timeline.wait(100).at(500).wait(50);
    const c = demo.compiled();
    expect(c.steps[1]).toMatchObject({ start: 500, end: 550 });
    expect(c.duration).toBe(550);
    demo.timeline.at(10).wait(1);
    expect(() => demo.compiled()).toThrow(CompileError);
    expect(() => demo.compiled()).toThrow(/step 2: at=10 is earlier/);
  });

  test('set patches change layout for later steps without touching the scene', () => {
    const demo = login();
    demo.timeline.set('login', { x: 100, y: 100 }).moveCursor('login');
    const c = demo.compiled();
    const p = c.steps[1].cursor!.to;
    expect(p.x).toBeLessThan(250);
    expect(demo.scene.node('login').x).toBe(470);
  });

  test('errors name the step and the problem', () => {
    const demo = login();
    demo.rectangle({ id: 'ghost', x: 0, y: 0, width: 1, height: 1, visible: false });
    demo.timeline.moveCursor('nope');
    expect(() => demo.compiled()).toThrow(/step 0: unknown target "nope"/);
    demo.timeline.reset().type('login', 'x');
    expect(() => demo.compiled()).toThrow(/step 0: target "login" is a BUTTON, which cannot be typed into/);
    demo.timeline.reset().focus('side');
    expect(() => demo.compiled()).toThrow(/is not focusable/);
    demo.timeline.reset().set('missing', {});
    expect(() => demo.compiled()).toThrow(/unknown target "missing"/);
    demo.timeline.reset().moveCursor('ghost');
    expect(() => demo.compiled()).toThrow(/is not visible/);
  });

  test('recompiles only when the scene or timeline changes', () => {
    const demo = login();
    demo.timeline.moveCursor('email');
    const a = demo.compiled();
    expect(demo.compiled()).toBe(a);
    demo.scene.update('email', { x: 260 });
    expect(demo.compiled()).not.toBe(a);
    const b = demo.compiled();
    demo.timeline.wait(1);
    expect(demo.compiled()).not.toBe(b);
  });

  test("a stable key pins a step's randomness across insertions", () => {
    const a = login();
    a.timeline.moveCursor('email', { key: 'go' });
    const b = login();
    b.timeline.wait(10).moveCursor('email', { key: 'go' });
    expect(a.compiled().steps[0].cursor!.c1).toEqual(b.compiled().steps[1].cursor!.c1);
    const c = login();
    c.timeline.wait(10).moveCursor('email');
    expect(c.compiled().steps[1].cursor!.c1).not.toEqual(a.compiled().steps[0].cursor!.c1);
  });
});

describe('reactions', () => {
  test('a click fires the node’s reactions, so opening and closing take one step each', () => {
    const demo = confirmDialog();
    demo.timeline.click('trash').wait(300).click('cancel');
    const c = demo.compiled();
    const open = (t: number) => demo.stateAt(t).open.get('confirm');
    const opens = c.steps.find((s) => s.effects?.some((e) => e.id === 'confirm' && e.open === true));
    const closes = c.steps.find((s) => s.effects?.some((e) => e.id === 'confirm' && e.open === false));
    expect(opens!.step.type).toBe('click');
    expect(closes!.step.type).toBe('click');
    expect(open(opens!.end)).toBe(true);
    expect(open(c.duration)).toBe(false);
  });

  test('a reaction runs on top of the component’s own effect', () => {
    const demo = createDemo({ width: 300, height: 200, seed: 3 });
    demo.checkbox({
      id: 'cb',
      x: 20,
      y: 20,
      characters: 'Advanced',
      reactions: [{ trigger: 'ON_CLICK', action: { target: 'panel', open: true } }],
    });
    demo.popover({ id: 'panel', anchor: 'cb', open: false });
    demo.timeline.click('cb');
    const state = demo.stateAt(demo.duration);
    expect(state.checked.get('cb')).toBe(true);
    expect(state.open.get('panel')).toBe(true);
  });

  test('the author’s reaction wins over the effect it contradicts', () => {
    const demo = createDemo({ width: 300, height: 200, seed: 3 });
    demo.checkbox({
      id: 'cb',
      x: 20,
      y: 20,
      characters: 'Stay on',
      checked: true,
      reactions: [{ trigger: 'ON_CLICK', action: { checked: true } }],
    });
    demo.timeline.click('cb').click('cb');
    expect(demo.stateAt(demo.duration).checked.get('cb')).toBe(true);
  });

  test('a semantic step that clicks fires the reaction too', () => {
    const demo = createDemo({ width: 300, height: 200, seed: 3 });
    demo.checkbox({
      id: 'cb',
      x: 20,
      y: 20,
      characters: 'Advanced',
      reactions: [{ trigger: 'ON_CLICK', action: { target: 'note', value: 'on' } }],
    });
    demo.input({ id: 'note', x: 20, y: 60, width: 120 });
    demo.timeline.check('cb');
    const state = demo.stateAt(demo.duration);
    expect(state.checked.get('cb')).toBe(true);
    expect(state.values.get('note')).toBe('on');
  });

  test('an action without a target applies to the node carrying it', () => {
    const demo = createDemo({ width: 300, height: 200, seed: 3 });
    demo.button({
      id: 'mark',
      x: 20,
      y: 20,
      characters: 'Mark',
      reactions: [{ trigger: 'ON_CLICK', action: { checked: true } }],
    });
    demo.timeline.click('mark');
    expect(demo.stateAt(demo.duration).checked.get('mark')).toBe(true);
  });

  test('a reaction may name a node added after it', () => {
    const demo = createDemo({ width: 300, height: 200, seed: 3 });
    demo.button({
      id: 'go',
      x: 20,
      y: 20,
      characters: 'Go',
      reactions: [{ trigger: 'ON_CLICK', action: { target: 'later', open: true } }],
    });
    demo.dialog({ id: 'later', title: 'Later', width: 200, height: 100, open: false });
    demo.timeline.click('go');
    expect(demo.stateAt(demo.duration).open.get('later')).toBe(true);
  });

  test('a reaction naming a node that never exists fails the step that fires it', () => {
    const demo = createDemo({ width: 300, height: 200, seed: 3 });
    demo.button({
      id: 'go',
      x: 20,
      y: 20,
      characters: 'Go',
      reactions: [{ trigger: 'ON_CLICK', action: { target: 'nope', open: true } }],
    });
    demo.timeline.click('go');
    expect(() => demo.compiled()).toThrow(CompileError);
    expect(() => demo.compiled()).toThrow(/reaction on "go" targets unknown node "nope"/);
  });

  test('a malformed reaction is rejected when the node is added', () => {
    const demo = createDemo({ width: 300, height: 200, seed: 3 });
    const button = (id: string, reactions: unknown) =>
      demo.button({ id, x: 20, y: 20, characters: 'Go', reactions } as never);
    expect(() => button('a', {})).toThrow(/reactions must be an array/);
    expect(() => button('b', [{ trigger: 'ON_TAP', action: { open: true } }])).toThrow(
      /reactions\[0\]\.trigger must be one of "ON_CLICK"/,
    );
    expect(() => button('c', [{ trigger: 'ON_CLICK' }])).toThrow(/reactions\[0\]\.action must be an action object/);
    expect(() => button('d', [{ trigger: 'ON_CLICK', action: {} }])).toThrow(/reactions\[0\]\.action changes nothing/);
    expect(() => button('e', [{ trigger: 'ON_CLICK', action: { target: 'no spaces', open: true } }])).toThrow(
      /is not a valid id/,
    );
    expect(() => button('f', [{ trigger: 'ON_CLICK', action: { open: 'yes' } }])).toThrow(
      /reactions\[0\]\.action\.open must be a boolean/,
    );
    expect(() => button('g', [{ trigger: 'ON_CLICK', action: { value: {} } }])).toThrow(
      /reactions\[0\]\.action\.value must be a string, a finite number, or an array of strings/,
    );
  });
});
