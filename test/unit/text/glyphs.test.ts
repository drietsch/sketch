import { describe, expect, test } from 'vitest';
import { RoughGenerator } from '../../../src/sketch/index.js';
import { DEFAULT_FONT, HERSHEY_FONT } from '../../../src/text/index.js';
import { renderTextPart, glyphStrokeWidth } from '../../../src/render/glyphs.js';
import type { Part } from '../../../src/components/types.js';

const gen = new RoughGenerator({ seed: 1 });
const part = (text: string, extra: Partial<Extract<Part, { kind: 'text' }>> = {}): Extract<Part, { kind: 'text' }> => ({
  key: 'self',
  kind: 'text',
  x: 10,
  y: 5,
  text,
  fontSize: 16,
  align: 'LEFT',
  color: '#123',
  style: { stroke: '#123', strokeWeight: 1, fillStyle: 'hachure', roughness: 0.6, bowing: 1 },
  ...extra,
});

describe('renderTextPart with a stroke font', () => {
  test('emits one path with the text colour and rounded caps', () => {
    const [el] = renderTextPart(gen, HERSHEY_FONT, part('Hi'), 99);
    expect(el.tag).toBe('path');
    expect(el.attrs.stroke).toBe('#123');
    expect(el.attrs.fill).toBe('none');
    expect(el.attrs['stroke-linecap']).toBe('round');
    expect(el.attrs['stroke-width']).toBe(glyphStrokeWidth(16));
    expect(String(el.attrs.d)).toMatch(/^M/);
  });

  test('typing more characters leaves the earlier glyphs byte-identical', () => {
    const short = String(renderTextPart(gen, HERSHEY_FONT, part('hell'), 99)[0].attrs.d);
    const long = String(renderTextPart(gen, HERSHEY_FONT, part('hello'), 99)[0].attrs.d);
    expect(long.startsWith(short)).toBe(true);
    expect(long.length).toBeGreaterThan(short.length);
  });

  test('is deterministic per seed and differs across seeds', () => {
    const a = renderTextPart(gen, HERSHEY_FONT, part('abc'), 5)[0].attrs.d;
    expect(renderTextPart(gen, HERSHEY_FONT, part('abc'), 5)[0].attrs.d).toBe(a);
    expect(renderTextPart(gen, HERSHEY_FONT, part('abc'), 6)[0].attrs.d).not.toBe(a);
  });

  test('unknown characters draw a box rather than nothing', () => {
    const tofu = String(renderTextPart(gen, HERSHEY_FONT, part('é'), 5)[0].attrs.d);
    expect(tofu.length).toBeGreaterThan(20);
  });

  test('whitespace-only text yields an empty path', () => {
    expect(renderTextPart(gen, HERSHEY_FONT, part('  '), 5)[0].attrs.d).toBe('');
  });
});

/** The absolute move-to that starts a glyph outline. */
const first = (d: string) =>
  d
    .match(/^M([\d.]+) ([\d.]+)/)!
    .slice(1)
    .map(Number);

describe('renderTextPart with the default outline font', () => {
  test('emits one filled path, in capitals, that owes nothing to the seed', () => {
    const [el, ...rest] = renderTextPart(gen, DEFAULT_FONT, part('Hi'), 99);
    expect(rest).toEqual([]);
    expect(el.tag).toBe('path');
    expect(el.attrs.fill).toBe('#123');
    expect(el.attrs.stroke).toBeUndefined();
    expect(String(el.attrs.d)).toMatch(/^M[\d.]+ [\d.]+[lqc]/);
    expect(renderTextPart(gen, DEFAULT_FONT, part('hi'), 5)[0].attrs.d).toBe(el.attrs.d);
    expect(renderTextPart(gen, DEFAULT_FONT, part('HI'), 6)[0].attrs.d).toBe(el.attrs.d);
  });

  test('typing more characters leaves the earlier glyphs byte-identical; the outline is scaled and placed', () => {
    const short = String(renderTextPart(gen, DEFAULT_FONT, part('hell'), 99)[0].attrs.d);
    const long = String(renderTextPart(gen, DEFAULT_FONT, part('hello'), 99)[0].attrs.d);
    expect(long.startsWith(short)).toBe(true);
    const at32 = String(renderTextPart(gen, DEFAULT_FONT, part('H', { fontSize: 32 }), 1)[0].attrs.d);
    const at16 = String(renderTextPart(gen, DEFAULT_FONT, part('H'), 1)[0].attrs.d);
    // The move-to is translated by the part origin; relative segments only scale.
    expect(first(at16)[0]).toBeGreaterThanOrEqual(10);
    expect(first(at32)[1] - 5).toBeCloseTo(
      (first(at16)[1] - 5) * 2 + DEFAULT_FONT.ascent(32) - DEFAULT_FONT.ascent(16) * 2,
      0,
    );
  });

  test('a missing glyph still draws a sketched box, in a second stroked path', () => {
    const els = renderTextPart(gen, DEFAULT_FONT, part('AΩ'), 5);
    expect(els.map((e) => e.tag)).toEqual(['path', 'path']);
    expect(els[1].attrs.fill).toBe('none');
    expect(String(els[1].attrs.d).length).toBeGreaterThan(20);
  });

  test('whitespace-only text yields one empty stroked path', () => {
    const els = renderTextPart(gen, DEFAULT_FONT, part('  '), 5);
    expect(els).toHaveLength(1);
    expect(els[0].attrs.d).toBe('');
  });
});
