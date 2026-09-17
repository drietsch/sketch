import { describe, expect, test } from 'vitest';
import { SketchAdapter, toOptions } from '../../../src/render/sketch-adapter.js';
import type { Part, PartStyle } from '../../../src/components/types.js';

const style: PartStyle = { stroke: '#000', strokeWidth: 1, fillStyle: 'hachure', roughness: 1, bowing: 1 };
const rect = (extra: Partial<PartStyle> = {}): Part => ({
  key: 'self',
  kind: 'rect',
  x: 0,
  y: 0,
  width: 80,
  height: 40,
  style: { ...style, ...extra },
});

describe('SketchAdapter', () => {
  test('returns the cached array for an unchanged part and seed', () => {
    const a = new SketchAdapter();
    const first = a.render('n', rect(), 7);
    expect(a.render('n', rect(), 7)).toBe(first);
    expect(a.render('n', rect(), 9)).not.toBe(first);
    expect(a.render('n', rect({ stroke: 'red' }), 7)).not.toBe(first);
  });

  test('forget() drops a node without touching others', () => {
    const a = new SketchAdapter();
    const n = a.render('n', rect(), 7);
    const m = a.render('m', rect(), 7);
    a.forget('n');
    expect(a.render('n', rect(), 7)).not.toBe(n);
    expect(a.render('m', rect(), 7)).toBe(m);
  });

  test('emits stroke, fill and rounded caps; fill-rule only for self-intersecting shapes', () => {
    const a = new SketchAdapter();
    const [outline] = a.render('n', rect(), 7);
    expect(outline.tag).toBe('path');
    expect(outline.attrs.stroke).toBe('#000');
    expect(outline.attrs.fill).toBe('none');
    expect(outline.attrs['stroke-linecap']).toBe('round');
    expect(outline.attrs['fill-rule']).toBeUndefined();

    const solid = a.render('s', rect({ fill: 'red', fillStyle: 'solid' }), 7);
    expect(solid.map((e) => [e.attrs.fill, e.attrs.stroke])).toEqual([
      ['red', 'none'],
      ['none', '#000'],
    ]);
    expect(solid[0].attrs['fill-rule']).toBeUndefined();

    const path: Part = {
      key: 'p',
      kind: 'path',
      d: 'M0 0 L40 0 L20 30 Z',
      style: { ...style, fill: 'red', fillStyle: 'solid' },
    };
    const [fill] = a.render('p', path, 7);
    expect(fill.attrs['fill-rule']).toBe('evenodd');
  });

  test('dash and opacity land on the outline', () => {
    const a = new SketchAdapter();
    const [outline] = a.render('n', rect({ dash: [4, 2], opacity: 0.5 }), 7);
    expect(outline.attrs['stroke-dasharray']).toBe('4 2');
    expect(outline.attrs.opacity).toBe(0.5);
  });

  test('every emitted number has at most two decimals', () => {
    const a = new SketchAdapter();
    for (const el of a.render('n', rect({ fill: 'red' }), 7)) {
      for (const n of String(el.attrs.d).match(/-?\d+\.\d+/g) ?? []) {
        expect(n.split('.')[1].length).toBeLessThanOrEqual(2);
      }
    }
  });

  test('toOptions omits unset fields so engine defaults survive', () => {
    const o = toOptions(style, 5);
    expect(o).toEqual({
      seed: 5,
      fixedDecimalPlaceDigits: 2,
      stroke: '#000',
      strokeWidth: 1,
      fillStyle: 'hachure',
      roughness: 1,
      bowing: 1,
    });
    expect('fill' in o).toBe(false);
  });
});
