import { describe, expect, test, vi } from 'vitest';
import { createDemo, loadDemo } from '../../src/index.js';

function build(seed = 42) {
  const demo = createDemo({ width: 900, height: 600, seed });
  demo.input({ id: 'email', x: 250, y: 200, width: 350, placeholder: 'Email' });
  demo.button({ id: 'login', x: 470, y: 300, characters: 'Sign in' });
  demo.timeline.moveCursor('email').click().type('email', 'hello@example.com').moveCursor('login').click();
  return demo;
}

describe('timeline determinism (real Math.random)', () => {
  test('seeking straight to t equals stepping to t, in any order', () => {
    const stepped = build();
    const direct = build();
    const ts = [0, 137, 512, 999, 1500, 2100, 2600, stepped.duration];
    const frames = ts.map((t) => stepped.toSVG(t));
    for (let i = ts.length - 1; i >= 0; i--) expect(direct.toSVG(ts[i])).toBe(frames[i]);
    for (let t = 0; t < 700; t += 16) stepped.toSVG(t);
    expect(stepped.toSVG(2100)).toBe(frames[5]);
  });

  test('rendering any frame never reaches Math.random', () => {
    const demo = build();
    const spy = vi.spyOn(Math, 'random').mockImplementation(() => {
      throw new Error('Math.random');
    });
    try {
      for (const t of [0, 500, 1500, demo.duration]) expect(() => demo.toSVG(t)).not.toThrow();
    } finally {
      spy.mockRestore();
    }
  });

  test('different seeds give different cursor paths and cadences', () => {
    const a = build(1).compiled();
    const b = build(2).compiled();
    expect(a.steps[0].cursor!.c1).not.toEqual(b.steps[0].cursor!.c1);
    expect(a.steps[2].typing!.opEnds).not.toEqual(b.steps[2].typing!.opEnds);
    expect(a.steps.map((s) => s.step)).toEqual(b.steps.map((s) => s.step));
  });

  test('JSON round trip renders every frame identically', () => {
    const demo = build();
    const back = loadDemo(demo.toJSON());
    expect(back.duration).toBe(demo.duration);
    for (const t of [0, 800, 1900, demo.duration]) expect(back.toSVG(t)).toBe(demo.toSVG(t));
    expect(back.toJSON()).toEqual(demo.toJSON());
  });
});
