import { describe, expect, test, vi } from 'vitest';
import { SCENES } from '../support/scenes.js';
import { createDemo } from '../../src/index.js';

/**
 * The determinism contract, tested against the real Math.random (this project
 * has no setup file): the same document and seed always render to the same
 * bytes, and rendering never consults anything but seeded streams.
 */
describe.each(Object.keys(SCENES))('%s', (name) => {
  test('renders identically twice, and from a fresh instance', () => {
    const a = SCENES[name]();
    const svg = a.toSVG();
    expect(a.toSVG()).toBe(svg);
    expect(SCENES[name]().toSVG()).toBe(svg);
  });

  test('never reaches Math.random while rendering', () => {
    const demo = SCENES[name]();
    const spy = vi.spyOn(Math, 'random').mockImplementation(() => {
      throw new Error('Math.random');
    });
    try {
      expect(() => demo.toSVG()).not.toThrow();
    } finally {
      spy.mockRestore();
    }
  });

  test('a different seed gives different output', () => {
    expect(SCENES[name](1).toSVG()).not.toBe(SCENES[name](2).toSVG());
  });

  test('a fresh module instance agrees', async () => {
    vi.resetModules();
    const fresh = await import('../support/scenes.js');
    expect(fresh.SCENES[name]().toSVG()).toBe(SCENES[name]().toSVG());
  });
});

/** A group's html without the two attributes that legitimately follow position. */
const geometry = (html: string) => html.replace(/ data-h="[^"]*"/, '').replace(/ transform="[^"]*"/, '');

describe('isolation', () => {
  test('editing one node leaves every other group byte-identical', () => {
    const demo = SCENES.primitives();
    const before = new Map(demo.frame().groups.map((g) => [g.key, g.html]));
    demo.scene.update('rounded', { x: 30, radius: 20 });
    const after = demo.frame().groups;
    for (const g of after) {
      if (g.key === 'rounded') expect(g.html).not.toBe(before.get(g.key));
      else expect(g.html).toBe(before.get(g.key));
    }
  });

  test('sketchVariant re-rolls only that node', () => {
    const a = createDemo({ width: 100, height: 100, seed: 5 });
    a.rect({ id: 'x', x: 0, y: 0, width: 50, height: 50 });
    a.rect({ id: 'y', x: 50, y: 50, width: 50, height: 50 });
    const b = createDemo({ width: 100, height: 100, seed: 5 });
    b.rect({ id: 'x', x: 0, y: 0, width: 50, height: 50, sketchVariant: 1 });
    b.rect({ id: 'y', x: 50, y: 50, width: 50, height: 50 });
    const ga = a.frame().groups;
    const gb = b.frame().groups;
    expect(ga[0].html).not.toBe(gb[0].html);
    expect(ga[1].html).toBe(gb[1].html);
  });

  test('a node moved by its parent keeps its geometry and changes only its transform', () => {
    const demo = createDemo({ width: 200, height: 200, seed: 9 });
    demo.rect({ id: 'p', x: 0, y: 0, width: 100, height: 100 });
    demo.rect({ id: 'c', parent: 'p', x: 10, y: 10, width: 20, height: 20 });
    const before = demo.frame().groups[1].html;
    demo.scene.update('p', { x: 50 });
    const after = demo.frame().groups[1].html;
    expect(geometry(after)).toBe(geometry(before));
    expect(after).toContain('translate(60 10)');
  });
});
