import { describe, expect, test } from 'vitest';
import { createDemo, loadDemo } from '../../../src/index.js';
import { INPUT_HEIGHT } from '../../../src/components/input.js';
import { FRAME_TITLE_HEIGHT } from '../../../src/components/frame.js';
import { DEFAULT_FONT } from '../../../src/text/index.js';

const make = () => {
  const demo = createDemo({ width: 400, height: 400, seed: 3 });
  demo.input({ id: 'email', x: 24, y: 24, width: 320 });
  return demo;
};
const EMAIL_BOTTOM = 24 + INPUT_HEIGHT;

describe('relative placement', () => {
  test('the target snippet stores literal coordinates', () => {
    const demo = make();
    demo.input({ id: 'pw', below: 'email', gap: 12, width: 320 });
    expect(demo.scene.get('pw')).toEqual({ id: 'pw', type: 'INPUT', x: 24, y: EMAIL_BOTTOM + 12, width: 320 });
    const button = demo.button({ below: 'pw', gap: 20, characters: 'Sign in' });
    expect(button).toMatchObject({ x: 24, y: EMAIL_BOTTOM + 12 + INPUT_HEIGHT + 20 });
    expect('width' in button).toBe(false);
    expect('below' in button).toBe(false);
  });

  test('every direction, default gap 0', () => {
    const demo = make();
    const b = demo.rectangle({ id: 'b', below: 'email', width: 50, height: 30 });
    const a = demo.rectangle({ id: 'a', above: 'email', width: 50, height: 30 });
    const r = demo.rectangle({ id: 'r', rightOf: 'email', width: 50, height: 30 });
    const l = demo.rectangle({ id: 'l', leftOf: 'email', width: 50, height: 30 });
    expect([b.x, b.y]).toEqual([24, EMAIL_BOTTOM]);
    expect([a.x, a.y]).toEqual([24, 24 - 30]);
    expect([r.x, r.y]).toEqual([24 + 320, 24]);
    expect([l.x, l.y]).toEqual([24 - 50, 24]);
  });

  test("above and leftOf use the new node's own size, plus gap", () => {
    const demo = make();
    expect(demo.rectangle({ above: 'email', gap: 10, width: 50, height: 30 }).y).toBe(24 - 10 - 30);
    expect(demo.rectangle({ leftOf: 'email', gap: 10, width: 50, height: 30 }).x).toBe(24 - 10 - 50);
  });

  test('alignTo on the cross axis, both orientations', () => {
    const demo = make();
    expect(demo.rectangle({ below: 'email', alignTo: 'center', width: 100, height: 10 }).x).toBe(24 + (320 - 100) / 2);
    expect(demo.rectangle({ below: 'email', alignTo: 'end', width: 100, height: 10 }).x).toBe(24 + 320 - 100);
    expect(demo.rectangle({ rightOf: 'email', alignTo: 'center', width: 10, height: 30 }).y).toBe(
      24 + (INPUT_HEIGHT - 30) / 2,
    );
    expect(demo.rectangle({ rightOf: 'email', alignTo: 'end', width: 10, height: 30 }).y).toBe(24 + INPUT_HEIGHT - 30);
  });

  test('an auto-sized button is measured before it exists', () => {
    const demo = make();
    const button = demo.button({ below: 'email', alignTo: 'end', characters: 'Go' });
    const width = demo.scene.bounds(button.id).width;
    expect(width).toBe(Math.ceil(32 + DEFAULT_FONT.measure('Go', demo.theme.fontSize)));
    expect(button.x).toBe(24 + 320 - width);
  });

  test('the parent is inherited from the reference, and coordinates stay parent-relative', () => {
    const demo = createDemo({ width: 400, height: 400, seed: 1 });
    demo.frame({ id: 'card', x: 100, y: 100, width: 200, height: 200, title: 'Card' });
    demo.input({ id: 'a', parent: 'card', x: 10, y: 10, width: 100 });
    const b = demo.input({ id: 'b', below: 'a', gap: 5, width: 100 });
    expect(b.parent).toBe('card');
    expect([b.x, b.y]).toEqual([10, 10 + INPUT_HEIGHT + 5]);
    expect(demo.scene.bounds('b')).toEqual({
      x: 110,
      y: 100 + FRAME_TITLE_HEIGHT + 10 + INPUT_HEIGHT + 5,
      width: 100,
      height: INPUT_HEIGHT,
    });
  });

  test('an explicit parent converts across content origins to the same absolute box', () => {
    const demo = createDemo({ width: 400, height: 400, seed: 1 });
    demo.frame({ id: 'card', x: 100, y: 100, width: 200, height: 200, title: 'Card' });
    demo.input({ id: 'a', parent: 'card', x: 10, y: 10, width: 100 });
    demo.frame({ id: 'other', x: 0, y: 300, width: 50, height: 50 });
    const inCard = demo.input({ id: 'b', below: 'a', gap: 5, width: 100 });
    const atRoot = demo.input({ id: 'c', below: 'a', gap: 5, width: 100, parent: undefined });
    const inOther = demo.input({ id: 'd', below: 'a', gap: 5, width: 100, parent: 'other' });
    expect(atRoot.parent).toBeUndefined();
    expect(inOther.parent).toBe('other');
    expect(atRoot.x).not.toBe(inCard.x);
    expect(inOther.y).toBe(atRoot.y - 300);
    const box = demo.scene.bounds('b');
    expect(demo.scene.bounds('c')).toEqual(box);
    expect(demo.scene.bounds('d')).toEqual(box);
  });

  test('a cross-axis coordinate overrides; a main-axis one is a contradiction', () => {
    const demo = make();
    expect(demo.rectangle({ below: 'email', x: 0, width: 10, height: 10 })).toMatchObject({ x: 0, y: EMAIL_BOTTOM });
    expect(demo.rectangle({ rightOf: 'email', y: 5, width: 10, height: 10 })).toMatchObject({ x: 344, y: 5 });
    expect(() => demo.rectangle({ below: 'email', y: 5, width: 10, height: 10 })).toThrow(/"below" already sets y/);
    expect(() => demo.rectangle({ rightOf: 'email', x: 5, width: 10, height: 10 })).toThrow(/"rightOf" already sets x/);
    expect(() => demo.rectangle({ below: 'email', x: 0, alignTo: 'center', width: 10, height: 10 })).toThrow(
      /"alignTo" and "x" both set the horizontal position/,
    );
  });

  test('errors name the node and the problem', () => {
    const demo = make();
    expect(() => demo.rectangle({ id: 'r', below: 'nope', width: 1, height: 1 })).toThrow(
      /Cannot place "r" below "nope": unknown node "nope"\. A reference node must be added before/,
    );
    expect(() => demo.rectangle({ id: 'r', below: 'later', width: 1, height: 1 })).toThrow(/unknown node "later"/);
    expect(() => demo.rectangle({ id: 'r', below: 'email', rightOf: 'email', width: 1, height: 1 } as never)).toThrow(
      /use only one of below, above, rightOf, leftOf \(got below, rightOf\)/,
    );
    expect(() => demo.rectangle({ id: 'r', below: 'email', gap: NaN, width: 1, height: 1 })).toThrow(
      /gap must be a finite number/,
    );
    expect(() => demo.rectangle({ id: 'r', below: 'email', alignTo: 'middle', width: 1, height: 1 } as never)).toThrow(
      /alignTo must be "start", "center" or "end"; got "middle"/,
    );
    expect(() => demo.rectangle({ id: 'r', gap: 4, x: 0, y: 0, width: 1, height: 1 } as never)).toThrow(
      /gap and alignTo need one of below/,
    );
    expect(() => demo.rectangle({ id: 'r', width: 1, height: 1 } as never)).toThrow(/needs x and y, a placement/);
    expect(() => demo.rectangle({ id: 'r', below: 'email', parent: 'ghost', width: 1, height: 1 })).toThrow(
      /Unknown parent "ghost" for node "r"/,
    );
  });

  test('a mark keeps its own gap when no direction claims it', () => {
    // ARROW and CALLOUT have a `gap` of their own (shaft and tail clearance);
    // without below/above/rightOf/leftOf beside it, the key is the node's.
    const demo = make();
    demo.button({ id: 'pay', below: 'email', characters: 'Pay' });
    const arrow = demo.arrow({ id: 'ar', from: 'email', to: 'pay', gap: 12 });
    expect(arrow.gap).toBe(12);
    const note = demo.callout({ id: 'note', target: 'pay', characters: 'here', gap: 40 });
    expect(note.gap).toBe(40);
    // The clearance is real: a wider gap moves the bubble.
    demo.callout({ id: 'near', target: 'pay', characters: 'here', gap: 10 });
    expect(demo.scene.bounds('note').y).toBeLessThan(demo.scene.bounds('near').y);
    // Beside a direction the key is still the placement's, and never stored.
    const placed = demo.callout({ id: 'placed', below: 'pay', gap: 5, characters: 'free' } as never);
    expect(placed.gap).toBeUndefined();
    expect(placed.y).toBe(demo.scene.bounds('pay').y + demo.scene.bounds('pay').height + 5);
    // Everything else still needs a direction for it.
    expect(() => demo.rectangle({ id: 'r', gap: 4, x: 0, y: 0, width: 1, height: 1 } as never)).toThrow(
      /gap and alignTo need one of below/,
    );
    expect(() => demo.arrow({ id: 'ar2', from: 'email', to: 'pay', alignTo: 'start' } as never)).toThrow(
      /gap and alignTo need one of below/,
    );
  });

  test('centred text and lines are placed by their boxes, not their origins', () => {
    const demo = make();
    const t = demo.text({ id: 't', below: 'email', characters: 'hello', style: { textAlignHorizontal: 'CENTER' } });
    const width = DEFAULT_FONT.measure('hello', demo.theme.fontSize);
    expect(t.x).toBeCloseTo(24 + width / 2, 10);
    expect(demo.scene.bounds('t').x).toBeCloseTo(24, 10);
    expect(t.style?.textAlignHorizontal).toBe('CENTER');

    const line = demo.line({ id: 'ln', below: 'email', gap: 4, x2: 100, y2: 0 });
    expect(line).toMatchObject({ x: 24, y: EMAIL_BOTTOM + 4, x2: 124, y2: EMAIL_BOTTOM + 4 });
    const up = demo.line({ id: 'up', rightOf: 'email', x2: 0, y2: -20 });
    // Pointing up: the box starts 20 above the origin, so the origin lands 20 below the reference top.
    expect(up).toMatchObject({ x: 344, y: 44, x2: 344, y2: 24 });
  });

  test('placement never reaches the document', () => {
    const demo = make();
    demo.input({ id: 'pw', below: 'email', gap: 12, alignTo: 'start', width: 320 });
    const json = demo.toJSON();
    for (const node of json.children) {
      for (const key of Object.keys(node))
        expect(['below', 'above', 'rightOf', 'leftOf', 'gap', 'alignTo']).not.toContain(key);
    }
    expect(loadDemo(json).toSVG()).toBe(demo.toSVG());
  });

  test('a placed scene renders byte-identically to the same scene written with literals', () => {
    const literal = createDemo({ width: 400, height: 300, seed: 9 });
    literal.text({ id: 'l1', x: 24, y: 24, characters: 'Email' });
    // The label's box is its ascent plus descent, summed as the layout sums them.
    const labelHeight = DEFAULT_FONT.ascent(14) + DEFAULT_FONT.descent(14);
    literal.input({ id: 'i1', x: 24, y: 24 + labelHeight + 4, width: 200 });
    literal.button({ id: 'b1', x: 24, y: 24 + labelHeight + 4 + INPUT_HEIGHT + 12, characters: 'Go' });

    const placed = createDemo({ width: 400, height: 300, seed: 9 });
    placed.text({ id: 'l1', x: 24, y: 24, characters: 'Email' });
    placed.input({ id: 'i1', below: 'l1', gap: 4, width: 200 });
    placed.button({ id: 'b1', below: 'i1', gap: 12, characters: 'Go' });

    expect(placed.toJSON()).toEqual(literal.toJSON());
    expect(placed.toSVG()).toBe(literal.toSVG());
  });
});
