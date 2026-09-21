import { describe, expect, test } from 'vitest';
import { RoughGenerator } from '../../../src/sketch/index.js';
import { DEFAULT_FONT, StrokeFont } from '../../../src/text/index.js';
import { HERSHEY_SANS } from '../../support/hershey-sans.js';

const HERSHEY_FONT = new StrokeFont(HERSHEY_SANS);
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
  weight: 400,
  style: { stroke: '#123', strokeWeight: 1, fillStyle: 'hachure', roughness: 0.6, bowing: 1 },
  ...extra,
});

const pen = (els: ReturnType<typeof renderTextPart>) => Number(els.at(-1)!.attrs['stroke-width']);
/** Every number in a path. */
const nums = (d: string) => [...d.matchAll(/-?[\d.]+/g)].map((m) => Number(m[0]));
/** The x of every move-to in a path. */
const xs = (d: string) => [...d.matchAll(/M(-?[\d.]+)/g)].map((m) => Number(m[1]));

describe('the default face is drawn', () => {
  test('a letter is its outline, filled once as drawn, with no line put round it', () => {
    const els = renderTextPart(gen, DEFAULT_FONT, part('Hi'), 99);
    expect(els).toHaveLength(1);
    const [el] = els;
    expect(el.tag).toBe('path');
    expect(el.attrs.fill).toBe('#123');
    expect(el.attrs.stroke).toBeUndefined();
    expect(String(el.attrs.d)).toMatch(/^M[\d.]+ [\d.]+[lqc]/);
    // A drawn letter is the same whatever the seed, and whatever case it was written in.
    expect(renderTextPart(gen, DEFAULT_FONT, part('Hi'), 5)[0].attrs.d).toBe(el.attrs.d);
    expect(renderTextPart(gen, DEFAULT_FONT, part('HI'), 99)[0].attrs.d).toBe(el.attrs.d);
    // Ink, a little short of solid, so a second pass builds tone.
    expect(Number(el.attrs['fill-opacity'])).toBeLessThan(1);
  });

  test('weight is the letter laid down again a hair off: 700 three times, 900 four', () => {
    const plain = String(renderTextPart(gen, DEFAULT_FONT, part('o', { fontSize: 32 }), 3)[0].attrs.d);
    const bold = String(renderTextPart(gen, DEFAULT_FONT, part('o', { weight: 700, fontSize: 32 }), 3)[0].attrs.d);
    const heavy = String(renderTextPart(gen, DEFAULT_FONT, part('o', { weight: 900, fontSize: 32 }), 3)[0].attrs.d);
    const n = xs(plain).length;
    expect(xs(bold)).toHaveLength(n * 3);
    expect(xs(heavy)).toHaveLength(n * 4);
    // The first pass is the letter as drawn; the later ones land off it, but not far: no ghost of the word.
    expect(bold.startsWith(plain)).toBe(true);
    const shift = Math.abs(xs(bold)[n] - xs(plain)[0]);
    expect(shift).toBeGreaterThan(0);
    expect(shift).toBeLessThan(32 * 0.05);
    // A label still thickens: the passes land off the letter, within half a pixel.
    const small = String(renderTextPart(gen, DEFAULT_FONT, part('o', { weight: 700, fontSize: 12 }), 3)[0].attrs.d);
    const m = xs(small).length / 3;
    const off = Math.abs(xs(small)[m] - xs(small)[0]);
    expect(off).toBeGreaterThan(0);
    expect(off).toBeLessThanOrEqual(0.5);
  });

  test('textPasses 0 draws nothing; a marker goes under the letters and a halo under the ink', () => {
    const none = renderTextPart(gen, DEFAULT_FONT, part('Hi', { style: { ...part('Hi').style, textPasses: 0 } }), 3);
    expect(none).toHaveLength(1);
    expect(none[0].attrs.d).toBe('');
    const els = renderTextPart(
      gen,
      DEFAULT_FONT,
      part('Hi', { halo: '#fff', marker: { color: '#ccc', opacity: 0.3 } }),
      3,
    );
    expect(els.map((e) => [e.attrs.stroke, e.attrs.fill])).toEqual([
      ['#ccc', 'none'],
      ['#fff', '#fff'],
      [undefined, '#123'],
    ]);
    expect(els[1].attrs.d).toBe(els[2].attrs.d);
  });

  test('the digits the file lacks are written by hand, twice like the drawn lines, in the same part', () => {
    const els = renderTextPart(gen, DEFAULT_FONT, part('EUR 49', { fontSize: 32 }), 3);
    // Letters in the filled path, the digits' strokes in a stroked path after it.
    expect(els.map((e) => e.attrs.fill)).toEqual(['#123', 'none']);
    const [, strokes] = els;
    expect(strokes.attrs.stroke).toBe('#123');
    expect(strokes.attrs['stroke-linecap']).toBe('round');
    // The face's pen, scaled; written twice at a plain weight: a 4 is two strokes, so four move-tos.
    const nib = DEFAULT_FONT.penWidth(32)!;
    expect(Number(strokes.attrs['stroke-width'])).toBeGreaterThan(nib);
    const four = String(renderTextPart(gen, DEFAULT_FONT, part('4', { fontSize: 32 }), 3)[0].attrs.d);
    expect(xs(four)).toHaveLength(4);
    // A halo covers both halves of a mixed part.
    const haloed = renderTextPart(gen, DEFAULT_FONT, part('EUR 49', { halo: '#fff' }), 3);
    expect(haloed.map((e) => e.attrs.stroke)).toEqual(['#fff', '#fff', undefined, '#123']);
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

/** The absolute move-to that starts a glyph outline. */
const first = (d: string) =>
  d
    .match(/^M([\d.]+) ([\d.]+)/)!
    .slice(1)
    .map(Number);

describe('a written face (strokes)', () => {
  test('a glyph is its pen strokes, each one smooth line, once at a plain weight', () => {
    const [el, ...rest] = renderTextPart(gen, HERSHEY_FONT, part('O', { fontSize: 32 }), 3);
    expect(rest).toEqual([]);
    expect(el.attrs.fill).toBe('none');
    expect(el.attrs.stroke).toBe('#123');
    expect(el.attrs['stroke-linecap']).toBe('round');
    expect(String(el.attrs.d)).toMatch(/C/);
    expect(Number(el.attrs['stroke-opacity'])).toBeLessThan(1);
  });

  test('weight is the pen going over each stroke again, pressing only a little harder', () => {
    const plain = renderTextPart(gen, HERSHEY_FONT, part('I', { fontSize: 32 }), 3);
    const bold = renderTextPart(gen, HERSHEY_FONT, part('I', { weight: 700, fontSize: 32 }), 3);
    const heavy = renderTextPart(gen, HERSHEY_FONT, part('I', { weight: 900, fontSize: 32 }), 3);
    const n = xs(String(plain[0].attrs.d)).length;
    expect(xs(String(bold[0].attrs.d))).toHaveLength(n * 3);
    expect(xs(String(heavy[0].attrs.d))).toHaveLength(n * 4);
    expect(String(bold[0].attrs.d).startsWith(String(plain[0].attrs.d))).toBe(true);
    expect(pen(bold)).toBeGreaterThan(pen(plain));
    expect(pen(bold)).toBeLessThan(pen(plain) * 1.5);
  });

  test('theme.textPasses sets how often a plain weight is written; 0 writes nothing', () => {
    const plain = renderTextPart(gen, HERSHEY_FONT, part('I'), 3);
    const twice = renderTextPart(gen, HERSHEY_FONT, part('I', { style: { ...part('I').style, textPasses: 2 } }), 3);
    expect(xs(String(twice[0].attrs.d))).toHaveLength(xs(String(plain[0].attrs.d)).length * 2);
    const none = renderTextPart(gen, HERSHEY_FONT, part('I', { style: { ...part('I').style, textPasses: 0 } }), 3);
    expect(none[0].attrs.d).toBe('');
  });

  test('the wobble grows with the size, but slower: a heading is written more freely, a label less shakily', () => {
    const stray = (fontSize: number) => {
      const written = nums(String(renderTextPart(gen, HERSHEY_FONT, part('C', { fontSize }), 3)[0].attrs.d));
      const steady = nums(
        String(
          renderTextPart(gen, HERSHEY_FONT, part('C', { fontSize, style: { ...part('C').style, roughness: 0 } }), 3)[0]
            .attrs.d,
        ),
      );
      expect(steady).toHaveLength(written.length);
      return written.reduce((s, v, i) => s + Math.abs(v - steady[i]), 0) / written.length;
    };
    expect(stray(48)).toBeGreaterThan(stray(12));
    expect(stray(48) / 48).toBeLessThan(stray(12) / 12);
  });

  test('a marker goes under the words and a halo under the ink', () => {
    const els = renderTextPart(
      gen,
      HERSHEY_FONT,
      part('O', { halo: '#fff', marker: { color: '#ccc', opacity: 0.3 } }),
      3,
    );
    expect(els.map((e) => e.attrs.stroke)).toEqual(['#ccc', '#fff', '#123']);
    expect(els[1].attrs.d).toBe(els[2].attrs.d);
    expect(Number(els[1].attrs['stroke-width'])).toBeGreaterThan(Number(els[2].attrs['stroke-width']));
  });

  test('a face with no pen of its own is written with one picked from the size', () => {
    const [el] = renderTextPart(gen, HERSHEY_FONT, part('Hi'), 99);
    expect(el.attrs['stroke-width']).toBe(glyphStrokeWidth(16));
  });
});

describe('renderTextPart with a stroke font', () => {
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
