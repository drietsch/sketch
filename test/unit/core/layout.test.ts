import { describe, expect, test } from 'vitest';
import { createDemo, loadDemo } from '../../../src/index.js';
import { FRAME_TITLE_HEIGHT } from '../../../src/components/frame.js';
import { INPUT_HEIGHT } from '../../../src/components/input.js';
import { DEFAULT_FONT, layoutText } from '../../../src/text/index.js';
import type { FrameNode, InputNode } from '../../../src/core/types.js';

const make = () => createDemo({ width: 600, height: 600, seed: 3 });
const rectIn = (demo: ReturnType<typeof make>, id: string, parent: string, width: number, height: number, extra = {}) =>
  demo.rectangle({ id, parent, width, height, ...extra });

describe('auto-layout', () => {
  test('1. vertical stack with spacing and padding', () => {
    const demo = make();
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
    rectIn(demo, 'a', 'card', 100, 30);
    rectIn(demo, 'b', 'card', 100, 40);
    expect(demo.scene.bounds('a')).toEqual({ x: 120, y: 120, width: 100, height: 30 });
    expect(demo.scene.bounds('b').y).toBe(160);
    expect(demo.scene.get('a')).toMatchObject({ x: 0, y: 0 });
  });

  test('2. horizontal row', () => {
    const demo = make();
    demo.frame({
      id: 'card',
      x: 100,
      y: 100,
      width: 300,
      height: 300,
      layoutMode: 'HORIZONTAL',
      itemSpacing: 10,
      padding: 20,
    });
    rectIn(demo, 'a', 'card', 100, 30);
    rectIn(demo, 'b', 'card', 100, 40);
    expect(demo.scene.bounds('b')).toEqual({ x: 230, y: 120, width: 100, height: 40 });
  });

  test('3. padding shorthand expands to the four sides and never reaches the node', () => {
    const demo = make();
    const card = demo.frame({
      id: 'card',
      x: 100,
      y: 100,
      width: 300,
      height: 300,
      layoutMode: 'VERTICAL',
      padding: [10, 20],
    });
    expect(card).toMatchObject({ paddingTop: 10, paddingRight: 20, paddingBottom: 10, paddingLeft: 20 });
    expect('padding' in card).toBe(false);
    rectIn(demo, 'a', 'card', 50, 50);
    expect(demo.scene.bounds('a')).toMatchObject({ x: 120, y: 110 });
    const none = demo.frame({ id: 'plain', x: 0, y: 0, width: 10, height: 10, layoutMode: 'VERTICAL', padding: 0 });
    expect(Object.keys(none).some((k) => k.startsWith('padding'))).toBe(false);
    const four = demo.frame({ id: 'four', x: 0, y: 0, width: 10, height: 10, padding: [1, 2, 3, 4], paddingLeft: 9 });
    expect(four).toMatchObject({ paddingTop: 1, paddingRight: 2, paddingBottom: 3, paddingLeft: 9 });
    expect(() => demo.frame({ id: 'bad', x: 0, y: 0, width: 1, height: 1, padding: [1, 2, 3] as never })).toThrow(
      /padding must be/,
    );
  });

  test('4. primary CENTER and MAX', () => {
    for (const [align, y] of [
      ['CENTER', 235],
      ['MAX', 370],
    ] as const) {
      const demo = make();
      demo.frame({
        id: 'c',
        x: 100,
        y: 100,
        width: 300,
        height: 300,
        layoutMode: 'VERTICAL',
        primaryAxisAlignItems: align,
      });
      rectIn(demo, 'a', 'c', 100, 30);
      expect(demo.scene.bounds('a').y).toBe(y);
    }
  });

  test('5. SPACE_BETWEEN with three children and with one', () => {
    const demo = make();
    demo.frame({
      id: 'c',
      x: 100,
      y: 100,
      width: 300,
      height: 300,
      layoutMode: 'VERTICAL',
      primaryAxisAlignItems: 'SPACE_BETWEEN',
    });
    rectIn(demo, 'a', 'c', 100, 30);
    rectIn(demo, 'b', 'c', 100, 30);
    rectIn(demo, 'd', 'c', 100, 30);
    expect(['a', 'b', 'd'].map((id) => demo.scene.bounds(id).y)).toEqual([100, 235, 370]);
    const one = make();
    one.frame({
      id: 'c',
      x: 100,
      y: 100,
      width: 300,
      height: 300,
      layoutMode: 'VERTICAL',
      primaryAxisAlignItems: 'SPACE_BETWEEN',
    });
    rectIn(one, 'a', 'c', 100, 30);
    expect(one.scene.bounds('a').y).toBe(100);
  });

  test('6. counter CENTER and MAX', () => {
    for (const [align, x] of [
      ['CENTER', 200],
      ['MAX', 300],
    ] as const) {
      const demo = make();
      demo.frame({
        id: 'c',
        x: 100,
        y: 100,
        width: 300,
        height: 300,
        layoutMode: 'VERTICAL',
        counterAxisAlignItems: align,
      });
      rectIn(demo, 'a', 'c', 100, 30);
      expect(demo.scene.bounds('a').x).toBe(x);
    }
  });

  test('7. HUG wraps the children, including a title bar; stored size is untouched', () => {
    const demo = make();
    demo.frame({
      id: 'card',
      x: 100,
      y: 100,
      width: 300,
      title: 'Card',
      layoutMode: 'VERTICAL',
      itemSpacing: 10,
      padding: 20,
      layoutSizingHorizontal: 'HUG',
      layoutSizingVertical: 'HUG',
    });
    rectIn(demo, 'a', 'card', 150, 30);
    rectIn(demo, 'b', 'card', 100, 40);
    expect(demo.scene.bounds('card')).toEqual({
      x: 100,
      y: 100,
      width: 190,
      height: FRAME_TITLE_HEIGHT + 20 + 30 + 10 + 40 + 20,
    });
    expect(demo.scene.get<FrameNode>('card')!.width).toBe(300);
    expect('height' in demo.scene.get('card')!).toBe(false);
    expect(demo.scene.bounds('a').y).toBe(100 + FRAME_TITLE_HEIGHT + 20);
    expect(demo.scene.resolved('card')).toMatchObject({ width: 190 });
    expect(demo.scene.resolved('a')).toBe(demo.scene.get('a'));
  });

  test('8. FILL stretches on the counter axis and shares the primary axis', () => {
    const demo = make();
    demo.frame({ id: 'c', x: 100, y: 100, width: 300, height: 300, layoutMode: 'VERTICAL' });
    demo.input({ id: 'i', parent: 'c', width: 50, layoutSizingHorizontal: 'FILL' });
    expect(demo.scene.bounds('i')).toEqual({ x: 100, y: 100, width: 300, height: INPUT_HEIGHT });
    expect(demo.scene.resolved('i')).toMatchObject({ width: 300 });
    expect(demo.scene.get<InputNode>('i')!.width).toBe(50);

    const share = make();
    share.frame({ id: 'c', x: 100, y: 100, width: 300, height: 300, layoutMode: 'VERTICAL' });
    rectIn(share, 'fixed', 'c', 100, 100);
    rectIn(share, 'f1', 'c', 100, 1, { layoutSizingVertical: 'FILL' });
    rectIn(share, 'f2', 'c', 100, 1, { layoutSizingVertical: 'FILL' });
    expect(share.scene.bounds('f1')).toMatchObject({ y: 200, height: 100 });
    expect(share.scene.bounds('f2')).toMatchObject({ y: 300, height: 100 });
  });

  test('9. nested: a HUG row inside a FILL frame inside a fixed frame', () => {
    const demo = make();
    demo.frame({ id: 'outer', x: 0, y: 0, width: 400, height: 200, layoutMode: 'VERTICAL', padding: 10 });
    demo.frame({
      id: 'inner',
      parent: 'outer',
      layoutMode: 'VERTICAL',
      layoutSizingHorizontal: 'FILL',
      layoutSizingVertical: 'FILL',
    });
    demo.frame({
      id: 'row',
      parent: 'inner',
      layoutMode: 'HORIZONTAL',
      itemSpacing: 8,
      layoutSizingHorizontal: 'HUG',
      layoutSizingVertical: 'HUG',
    });
    const b1 = demo.button({ id: 'b1', parent: 'row', characters: 'Save' });
    const b2 = demo.button({ id: 'b2', parent: 'row', characters: 'Cancel' });
    expect(demo.scene.bounds('inner')).toEqual({ x: 10, y: 10, width: 380, height: 180 });
    const w1 = demo.scene.bounds(b1.id).width;
    const w2 = demo.scene.bounds(b2.id).width;
    expect(demo.scene.bounds('row').width).toBe(w1 + 8 + w2);
    expect(demo.scene.bounds(b2.id).x).toBe(demo.scene.bounds('row').x + w1 + 8);
  });

  test('10. an ABSOLUTE child keeps its coordinates and takes no space', () => {
    const demo = make();
    demo.frame({ id: 'c', x: 100, y: 100, width: 300, height: 300, layoutMode: 'VERTICAL' });
    rectIn(demo, 'abs', 'c', 10, 10, { x: 5, y: 7, layoutPositioning: 'ABSOLUTE' });
    rectIn(demo, 'auto', 'c', 100, 30);
    expect(demo.scene.bounds('abs')).toMatchObject({ x: 105, y: 107 });
    expect(demo.scene.bounds('auto').y).toBe(100);
  });

  test('12. placement into a layout frame throws; ABSOLUTE placement works', () => {
    const demo = make();
    demo.frame({ id: 'c', x: 100, y: 100, width: 300, height: 300, layoutMode: 'VERTICAL' });
    rectIn(demo, 'a', 'c', 100, 30);
    expect(() => demo.rectangle({ id: 'b', below: 'a', width: 10, height: 10 })).toThrow(/has layoutMode VERTICAL/);
    const b = demo.rectangle({ id: 'b', below: 'a', gap: 5, width: 10, height: 10, layoutPositioning: 'ABSOLUTE' });
    expect(demo.scene.bounds(b.id)).toMatchObject({ x: 100, y: 135 });
  });

  test('13. a TEXT child is measured intrinsically', () => {
    const demo = make();
    demo.frame({ id: 'c', x: 100, y: 100, width: 300, height: 300, layoutMode: 'VERTICAL', padding: 20 });
    const t = demo.text({ id: 't', parent: 'c', characters: 'Hello' });
    const l = layoutText(DEFAULT_FONT, 'Hello', demo.theme.fontSize);
    expect(demo.scene.bounds('t')).toEqual({ x: 120, y: 120, width: l.bounds.width, height: l.bounds.height });
    expect(t.x).toBe(0);
  });

  test('14. toJSON carries no computed sizes or defaults and reloads to the same layout', () => {
    const demo = make();
    demo.frame({
      id: 'card',
      x: 100,
      y: 100,
      layoutMode: 'VERTICAL',
      itemSpacing: 10,
      padding: 20,
      layoutSizingHorizontal: 'HUG',
      layoutSizingVertical: 'HUG',
      primaryAxisAlignItems: 'MIN',
      layoutPositioning: 'AUTO',
    });
    rectIn(demo, 'a', 'card', 150, 30);
    const json = demo.toJSON();
    expect(json.children[0]).toEqual({
      id: 'card',
      type: 'FRAME',
      x: 100,
      y: 100,
      layoutMode: 'VERTICAL',
      itemSpacing: 10,
      paddingTop: 20,
      paddingRight: 20,
      paddingBottom: 20,
      paddingLeft: 20,
      layoutSizingHorizontal: 'HUG',
      layoutSizingVertical: 'HUG',
      children: [{ id: 'a', type: 'RECTANGLE', x: 0, y: 0, width: 150, height: 30 }],
    });
    const back = loadDemo(json);
    expect(back.scene.bounds('card')).toEqual(demo.scene.bounds('card'));
    expect(back.toSVG()).toBe(demo.toSVG());
  });

  test('15. determinism: identical demos and clones lay out identically', () => {
    const build = () => {
      const demo = make();
      demo.frame({ id: 'c', x: 100, y: 100, width: 300, height: 300, layoutMode: 'HORIZONTAL', itemSpacing: 7 });
      rectIn(demo, 'a', 'c', 40, 30);
      rectIn(demo, 'b', 'c', 40, 30, { layoutSizingHorizontal: 'FILL' });
      rectIn(demo, 'd', 'c', 40, 30);
      demo.scene.bringToFront('a');
      return demo;
    };
    const x = build();
    const y = build();
    expect([...x.scene.layout()].map(([id, e]) => [id, e.bounds])).toEqual(
      [...y.scene.layout()].map(([id, e]) => [id, e.bounds]),
    );
    const clone = x.scene.clone();
    for (const [id, e] of x.scene.layout()) expect(clone.layout().get(id)!.bounds).toEqual(e.bounds);
  });

  test('16. hit-testing uses laid-out bounds', () => {
    const demo = make();
    demo.frame({ id: 'card', x: 100, y: 100, width: 300, height: 300, layoutMode: 'VERTICAL', padding: 50 });
    rectIn(demo, 'spacer', 'card', 10, 100);
    const btn = demo.button({ id: 'btn', parent: 'card', characters: 'Go' });
    const b = demo.scene.bounds(btn.id);
    expect(demo.scene.hitTest({ x: b.x + b.width / 2, y: b.y + b.height / 2 })).toBe('btn');
    expect(demo.scene.hitTest({ x: 101, y: 101 })).toBe('card');
  });

  test('17. invalid layout props are rejected at add, update and load', () => {
    const demo = make();
    demo.frame({ id: 'c', x: 0, y: 0, width: 100, height: 100, layoutMode: 'VERTICAL' });
    expect(() => demo.text({ id: 't', parent: 'c', characters: 'x', layoutSizingHorizontal: 'FILL' })).toThrow(
      /a TEXT cannot FILL/,
    );
    expect(() => demo.rectangle({ id: 'r', x: 0, y: 0, width: 1, height: 1, layoutMode: 'VERTICAL' } as never)).toThrow(
      /layoutMode only applies to container nodes/,
    );
    expect(() => demo.frame({ id: 'f', x: 0, y: 0, layoutMode: 'ROW' } as never)).toThrow(/layoutMode must be one of/);
    expect(() => demo.frame({ id: 'f', x: 0, y: 0, width: 10, height: 10, itemSpacing: -1 })).toThrow(
      /itemSpacing must be a finite number >= 0/,
    );
    expect(() => demo.frame({ id: 'f', x: 0, y: 0 } as never)).toThrow(
      /width is required unless layoutSizingHorizontal is HUG or FILL/,
    );
    expect(() => demo.scene.update('c', { layoutMode: 'GRID' as never })).toThrow(/layoutMode must be one of/);
    const json = demo.toJSON();
    (json.children[0] as { layoutMode?: string }).layoutMode = 'ROW';
    expect(() => loadDemo(json)).toThrow(/children\[0\] \("c"\): layoutMode must be one of/);
  });

  test('a child without coordinates needs an auto-layout parent', () => {
    const demo = make();
    demo.frame({ id: 'plain', x: 0, y: 0, width: 100, height: 100 });
    expect(() => demo.rectangle({ id: 'r', parent: 'plain', width: 1, height: 1 } as never)).toThrow(/needs x and y/);
    demo.frame({ id: 'c', x: 0, y: 0, width: 100, height: 100, layoutMode: 'VERTICAL' });
    expect(demo.rectangle({ id: 'ok', parent: 'c', width: 1, height: 1 })).toMatchObject({ x: 0, y: 0 });
  });

  test('a WINDOW lays out its content area below the chrome', () => {
    const demo = make();
    demo.window({ id: 'w', x: 0, y: 0, width: 400, height: 300, layoutMode: 'VERTICAL', padding: 10, itemSpacing: 5 });
    rectIn(demo, 'a', 'w', 50, 20);
    rectIn(demo, 'b', 'w', 50, 20);
    expect(demo.scene.bounds('a')).toMatchObject({ x: 10, y: 36 + 10 });
    expect(demo.scene.bounds('b').y).toBe(36 + 10 + 20 + 5);
  });
});
