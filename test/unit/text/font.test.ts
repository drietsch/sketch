import { describe, expect, test } from 'vitest';
import { DEFAULT_FONT, HERSHEY_FONT, StrokeFont, layoutText } from '../../../src/text/index.js';
import { HERSHEY_SANS } from '../../../src/text/fonts/hershey-sans.js';
import { GRAPE_NUTS } from '../../../src/text/fonts/grape-nuts.js';

describe('StrokeFont', () => {
  test('both built-in fonts ship every printable ASCII glyph', () => {
    for (const font of [DEFAULT_FONT, HERSHEY_FONT]) {
      for (let c = 32; c <= 126; c++) {
        expect(font.glyph(String.fromCharCode(c)), `${font.name} glyph ${c}`).toBeDefined();
      }
    }
    expect(HERSHEY_FONT.glyph('é')).toBeUndefined();
    expect(HERSHEY_FONT.glyph('…')).toBeDefined();
    expect(DEFAULT_FONT.glyph('é')).toBeDefined();
    expect(DEFAULT_FONT.glyph('Ω')).toBeUndefined();
  });

  test('the default font is Grape Nuts in capitals: outlines, folded to upper case', () => {
    expect(DEFAULT_FONT.name).toBe('grape-nuts');
    expect(DEFAULT_FONT.outline).toBe(true);
    expect(HERSHEY_FONT.outline).toBe(false);
    expect(DEFAULT_FONT.fold('a')).toBe('A');
    expect(DEFAULT_FONT.fold('é')).toBe('É');
    expect(DEFAULT_FONT.fold('ß')).toBe('ß');
    expect(DEFAULT_FONT.glyph('a')).toBe(DEFAULT_FONT.glyph('A'));
    expect(typeof DEFAULT_FONT.glyph('A')![1]).toBe('string');
    expect(DEFAULT_FONT.measure('hello', 16)).toBe(DEFAULT_FONT.measure('HELLO', 16));
    expect(GRAPE_NUTS.glyphs.a).toBeUndefined();
    expect(HERSHEY_FONT.fold('a')).toBe('a');
  });

  test('metrics scale linearly with font size and come from glyph advances', () => {
    const at16 = HERSHEY_FONT.measure('Hello', 16);
    expect(HERSHEY_FONT.measure('Hello', 32)).toBeCloseTo(at16 * 2, 10);
    const sum = [...'Hello'].reduce((w, ch) => w + HERSHEY_SANS.glyphs[ch][0], 0);
    expect(at16).toBeCloseTo((sum * 16) / HERSHEY_SANS.unitsPerEm, 10);
    expect(HERSHEY_FONT.measure('', 16)).toBe(0);
    const caps = [...'HELLO'].reduce((w, ch) => w + GRAPE_NUTS.glyphs[ch][0], 0);
    expect(DEFAULT_FONT.measure('hello', 16)).toBeCloseTo((caps * 16) / GRAPE_NUTS.unitsPerEm, 10);
  });

  test('unknown characters advance by the tofu width', () => {
    expect(HERSHEY_FONT.advance('é', 20)).toBe(12);
    expect(HERSHEY_FONT.measure('aé', 20)).toBe(HERSHEY_FONT.advance('a', 20) + 12);
    expect(DEFAULT_FONT.advance('Ω', 20)).toBe(12);
  });

  test('caretX is the width of the prefix and is clamped', () => {
    expect(DEFAULT_FONT.caretX('abc', 0, 14)).toBe(0);
    expect(DEFAULT_FONT.caretX('abc', 2, 14)).toBe(DEFAULT_FONT.measure('ab', 14));
    expect(DEFAULT_FONT.caretX('abc', 99, 14)).toBe(DEFAULT_FONT.measure('abc', 14));
    expect(DEFAULT_FONT.caretX('abc', -1, 14)).toBe(0);
  });

  test('vertical metrics', () => {
    expect(HERSHEY_FONT.capHeight(32)).toBe(21);
    expect(HERSHEY_FONT.ascent(32)).toBe(HERSHEY_SANS.ascent);
    expect(HERSHEY_FONT.descent(32)).toBe(HERSHEY_SANS.descent);
    expect(HERSHEY_FONT.lineHeight(10)).toBe(14);
    expect(DEFAULT_FONT.capHeight(1000)).toBe(GRAPE_NUTS.capHeight);
    expect(DEFAULT_FONT.ascent(1000)).toBe(GRAPE_NUTS.ascent);
    expect(DEFAULT_FONT.lineHeight(10)).toBe(14);
  });

  test('a custom font is just data', () => {
    const font = new StrokeFont({
      name: 'mono',
      unitsPerEm: 10,
      ascent: 8,
      descent: 2,
      capHeight: 7,
      glyphs: { a: [5, [[0, 0, 5, -7]]] },
    });
    expect(font.measure('aa', 20)).toBe(20);
    expect(font.name).toBe('mono');
  });
});

describe('layoutText', () => {
  test('places glyphs on a baseline one ascent below the origin', () => {
    const l = layoutText(DEFAULT_FONT, 'ab', 16);
    expect(l.glyphs.map((g) => g.ch)).toEqual(['a', 'b']);
    expect(l.glyphs[0]).toMatchObject({ index: 0, x: 0, y: DEFAULT_FONT.ascent(16) });
    expect(l.glyphs[1].x).toBe(DEFAULT_FONT.advance('a', 16));
    expect(l.bounds).toEqual({
      x: 0,
      y: 0,
      width: DEFAULT_FONT.measure('ab', 16),
      height: DEFAULT_FONT.ascent(16) + DEFAULT_FONT.descent(16),
    });
  });

  test('aligns each line and keeps character indices across newlines', () => {
    const l = layoutText(DEFAULT_FONT, 'ab\ncd', 16, 'CENTER');
    expect(l.lineWidths).toHaveLength(2);
    expect(l.glyphs.map((g) => g.index)).toEqual([0, 1, 3, 4]);
    expect(l.glyphs[0].x).toBeCloseTo(-l.lineWidths[0] / 2, 10);
    expect(l.glyphs[2].y).toBe(DEFAULT_FONT.ascent(16) + DEFAULT_FONT.lineHeight(16));
    expect(l.bounds.x).toBeCloseTo(-Math.max(...l.lineWidths) / 2, 10);
    expect(l.bounds.height).toBe(DEFAULT_FONT.lineHeight(16) + DEFAULT_FONT.ascent(16) + DEFAULT_FONT.descent(16));

    const end = layoutText(DEFAULT_FONT, 'ab', 16, 'RIGHT');
    expect(end.bounds.x).toBeCloseTo(-end.lineWidths[0], 10);
    expect(end.glyphs[0].x).toBeCloseTo(-end.lineWidths[0], 10);
  });
});
