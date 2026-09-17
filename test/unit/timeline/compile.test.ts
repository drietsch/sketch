import { describe, expect, test } from 'vitest';
import { createDemo } from '../../../src/index.js';
import { CompileError, defaultCursorStart } from '../../../src/timeline/compile.js';

function login() {
  const demo = createDemo({ width: 900, height: 600, seed: 42 });
  demo.input({ id: 'email', x: 250, y: 200, width: 350, placeholder: 'Email' });
  demo.button({ id: 'login', x: 470, y: 300, text: 'Sign in' });
  demo.panel({ id: 'side', x: 0, y: 0, width: 200, height: 600 });
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
    const [move, clickEmail, clickSide, clickLogin] = demo.compiled().steps;
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
    expect(clickSide.cursor).toBeDefined();
    expect(clickSide.click).toMatchObject({ hit: 'side' });
    expect(clickSide.click!.focus).toBeUndefined();
    expect(clickLogin.click).toMatchObject({ hit: 'login', focus: 'login' });
    expect(clickLogin.click!.pressAt).toBe(clickLogin.cursor!.duration);
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
    demo.rect({ id: 'ghost', x: 0, y: 0, width: 1, height: 1, hidden: true });
    demo.timeline.moveCursor('nope');
    expect(() => demo.compiled()).toThrow(/step 0: unknown target "nope"/);
    demo.timeline.reset().type('login', 'x');
    expect(() => demo.compiled()).toThrow(/step 0: target "login" is a button, not an input/);
    demo.timeline.reset().focus('side');
    expect(() => demo.compiled()).toThrow(/is not focusable/);
    demo.timeline.reset().set('missing', {});
    expect(() => demo.compiled()).toThrow(/unknown target "missing"/);
    demo.timeline.reset().moveCursor('ghost');
    expect(() => demo.compiled()).toThrow(/is hidden/);
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
