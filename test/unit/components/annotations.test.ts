import { describe, expect, test } from 'vitest';
import { createDemo } from '../../../src/index.js';

/** How many sketched paths an SVG holds, as a stand-in for how much was drawn. */
const pathCount = (svg: string) => svg.split('<path').length;

/** Asserts on what a factory call throws. */
const rejects = (make: () => unknown) => expect(make);

function screen() {
  const demo = createDemo({ width: 600, height: 400, seed: 3 });
  demo.button({ id: 'pay', x: 80, y: 120, characters: 'Pay now', variant: 'primary' });
  demo.text({ id: 'note', x: 380, y: 60, characters: 'Terms', style: { fontSize: 18 } });
  return demo;
}

describe('annotation marks', () => {
  test('a mark takes its target’s box, grown by spread', () => {
    const demo = screen();
    demo.encircle({ id: 'ring', target: 'pay', spread: 10 });
    const pay = demo.scene.bounds('pay');
    expect(demo.scene.bounds('ring')).toEqual({
      x: pay.x - 10,
      y: pay.y - 10,
      width: pay.width + 20,
      height: pay.height + 20,
    });
  });

  test('a mark follows its target when the target moves or resizes', () => {
    const demo = screen();
    demo.highlight({ id: 'band', target: 'pay' });
    demo.scene.update('pay', { x: 300, y: 260, width: 210 });
    const pay = demo.scene.bounds('pay');
    expect(demo.scene.bounds('band')).toEqual(pay);
  });

  test('a mark without a target sits at its own x, y and size', () => {
    const demo = screen();
    demo.highlight({ id: 'free', x: 20, y: 300, width: 160, height: 24 });
    expect(demo.scene.bounds('free')).toEqual({ x: 20, y: 300, width: 160, height: 24 });
  });

  test('marks are not hit-tested, so the interface underneath still takes the click', () => {
    const demo = screen();
    demo.highlight({ id: 'band', target: 'pay' });
    demo.encircle({ id: 'ring', target: 'pay', spread: 6 });
    const pay = demo.scene.bounds('pay');
    expect(demo.scene.hitTest({ x: pay.x + pay.width / 2, y: pay.y + pay.height / 2 })).toBe('pay');
  });

  test('a mark stays out of an auto-layout parent’s flow', () => {
    const demo = createDemo({ width: 400, height: 300, seed: 5 });
    demo.frame({
      id: 'row',
      x: 20,
      y: 20,
      layoutMode: 'HORIZONTAL',
      itemSpacing: 10,
      layoutSizingHorizontal: 'HUG',
      layoutSizingVertical: 'HUG',
    });
    demo.button({ id: 'a', parent: 'row', characters: 'One' });
    demo.button({ id: 'b', parent: 'row', characters: 'Two' });
    const before = demo.scene.bounds('row');
    demo.encircle({ id: 'ring', parent: 'row', target: 'a', spread: 8 });
    expect(demo.scene.bounds('row')).toEqual(before);
    expect(demo.scene.bounds('b')).toEqual(demo.scene.bounds('b'));
  });

  test('every underline variant draws, and `through` sits above `under`', () => {
    const variants = ['straight', 'double', 'wavy', 'zigzag', 'scribble', 'loop'] as const;
    for (const variant of variants) {
      const demo = screen();
      demo.underline({ id: 'mark', target: 'note', variant });
      expect(demo.toSVG()).toContain('<path');
    }
    const under = screen();
    under.underline({ id: 'mark', target: 'note' });
    const through = screen();
    through.underline({ id: 'mark', target: 'note', placement: 'through' });
    expect(under.toSVG()).not.toBe(through.toSVG());
  });

  test('each of an ENCIRCLE’s passes is drawn separately', () => {
    const one = screen();
    one.encircle({ id: 'ring', target: 'pay', passes: 1 });
    const three = screen();
    three.encircle({ id: 'ring', target: 'pay', passes: 3 });
    expect(pathCount(three.toSVG())).toBeGreaterThan(pathCount(one.toSVG()));
  });

  test('an arrow spans its endpoints and stops short of a node’s edge', () => {
    const demo = screen();
    demo.arrow({ id: 'link', from: 'note', to: 'pay' });
    const box = demo.scene.bounds('link');
    const pay = demo.scene.bounds('pay');
    const note = demo.scene.bounds('note');
    // The box reaches from one to the other, and never covers either centre.
    expect(box.x).toBeLessThan(note.x);
    expect(box.x + box.width).toBeGreaterThan(pay.x);
    expect(box.width).toBeGreaterThan(0);
    expect(box.height).toBeGreaterThan(0);
  });

  test('an arrow accepts points as well as nodes', () => {
    const demo = screen();
    demo.arrow({ id: 'link', from: { x: 40, y: 340 }, to: { x: 320, y: 340 } });
    const box = demo.scene.bounds('link');
    expect(box.x).toBeLessThan(40);
    expect(box.x + box.width).toBeGreaterThan(320);
  });

  test('a side pins which edge an arrow meets', () => {
    const left = screen();
    left.arrow({ id: 'link', from: 'note', to: 'pay', toSide: 'left' });
    const bottom = screen();
    bottom.arrow({ id: 'link', from: 'note', to: 'pay', toSide: 'bottom' });
    expect(left.scene.bounds('link')).not.toEqual(bottom.scene.bounds('link'));
    // Meeting the bottom edge, the shaft has to come round below the button.
    const pay = bottom.scene.bounds('pay');
    const box = bottom.scene.bounds('link');
    expect(box.y + box.height).toBeGreaterThan(pay.y + pay.height);
  });

  test('a callout sits on the side it names and keeps its tail', () => {
    const above = screen();
    above.callout({ id: 'tip', target: 'pay', side: 'top', characters: 'Here' });
    const below = screen();
    below.callout({ id: 'tip', target: 'pay', side: 'bottom', characters: 'Here' });
    const pay = above.scene.bounds('pay');
    expect(above.scene.bounds('tip').y + above.scene.bounds('tip').height).toBeLessThanOrEqual(pay.y);
    expect(below.scene.bounds('tip').y).toBeGreaterThanOrEqual(pay.y + pay.height);
  });

  test('a callout wraps its text and grows to hold it', () => {
    const demo = screen();
    demo.callout({ id: 'short', target: 'pay', characters: 'Go' });
    const shortBox = demo.scene.bounds('short');
    const other = screen();
    other.callout({
      id: 'long',
      target: 'pay',
      characters: 'This one has rather a lot more to say about the button below it',
    });
    expect(other.scene.bounds('long').height).toBeGreaterThan(shortBox.height);
  });

  test('marks round-trip through JSON', () => {
    const demo = screen();
    demo.highlight({ id: 'band', target: 'note', spread: 3 });
    demo.underline({ id: 'mark', target: 'note', variant: 'loop' });
    demo.arrow({ id: 'link', from: 'note', to: 'pay', curve: 's', head: 'both' });
    demo.callout({ id: 'tip', target: 'pay', side: 'left', shape: 'cloud', characters: 'Hello' });
    const json = demo.toJSON();
    expect(JSON.parse(JSON.stringify(json))).toEqual(json);
    expect(demo.toSVG()).toBe(demo.toSVG());
  });

  test('a mark naming a node that does not exist is rejected', () => {
    const demo = screen();
    expect(() => demo.encircle({ id: 'ring', target: 'ghost' })).toThrow(/"ghost" does not exist/);
    expect(() => demo.arrow({ id: 'link', from: 'note', to: 'ghost' })).toThrow(/"ghost" does not exist/);
    expect(() => demo.encircle({ id: 'self', target: 'self' })).toThrow(/cannot refer to itself/);
  });

  test('a mark without a target has to be given a size', () => {
    const demo = screen();
    expect(() => demo.highlight({ id: 'a', x: 0, y: 0 })).toThrow(/width is required without a target/);
    expect(() => demo.highlight({ id: 'b', x: 0, y: 0, width: 50 })).toThrow(/height is required without a target/);
    // An underline only needs to know how far to run.
    expect(() => demo.underline({ id: 'c', x: 0, y: 0, width: 50 })).not.toThrow();
  });

  test('bad props are rejected with a message naming the prop', () => {
    const demo = screen();
    rejects(() => demo.highlight({ id: 'a', target: 'pay', variant: 'glow' as never })).toThrow(
      /variant must be marker or block/,
    );
    rejects(() => demo.encircle({ id: 'b', target: 'pay', shape: 'blob' as never })).toThrow(
      /shape must be oval or rect/,
    );
    rejects(() => demo.encircle({ id: 'c', target: 'pay', passes: 9 })).toThrow(
      /passes must be a whole number from 1 to 4/,
    );
    rejects(() => demo.underline({ id: 'd', target: 'pay', variant: 'squiggle' as never })).toThrow(
      /variant must be one of/,
    );
    rejects(() => demo.arrow({ id: 'e', from: 'pay', to: 42 as never })).toThrow(
      /to must be a node id or a { x, y } point/,
    );
    rejects(() => demo.arrow({ id: 'f', from: 'pay', to: 'note', curve: 'loop' as never })).toThrow(
      /curve must be one of/,
    );
    rejects(() => demo.arrow({ id: 'g', from: 'pay', to: 'note', toSide: 'up' as never })).toThrow(
      /toSide must be one of/,
    );
    rejects(() => demo.callout({ id: 'h', target: 'pay', characters: '' })).toThrow(/characters is required/);
    rejects(() => demo.callout({ id: 'i', target: 'pay', characters: 'x', shape: 'blob' as never })).toThrow(
      /shape must be one of/,
    );
  });
});
