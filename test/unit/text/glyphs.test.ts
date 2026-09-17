import { describe, expect, test } from 'vitest';
import { RoughGenerator } from '../../../src/sketch/index.js';
import { DEFAULT_FONT } from '../../../src/text/index.js';
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
  align: 'start',
  color: '#123',
  style: { stroke: '#123', strokeWidth: 1, fillStyle: 'hachure', roughness: 0.6, bowing: 1 },
  ...extra,
});

describe('renderTextPart', () => {
  test('emits one path with the text colour and rounded caps', () => {
    const [el] = renderTextPart(gen, DEFAULT_FONT, part('Hi'), 99);
    expect(el.tag).toBe('path');
    expect(el.attrs.stroke).toBe('#123');
    expect(el.attrs.fill).toBe('none');
    expect(el.attrs['stroke-linecap']).toBe('round');
    expect(el.attrs['stroke-width']).toBe(glyphStrokeWidth(16));
    expect(String(el.attrs.d)).toMatch(/^M/);
  });

  test('typing more characters leaves the earlier glyphs byte-identical', () => {
    const short = String(renderTextPart(gen, DEFAULT_FONT, part('hell'), 99)[0].attrs.d);
    const long = String(renderTextPart(gen, DEFAULT_FONT, part('hello'), 99)[0].attrs.d);
    expect(long.startsWith(short)).toBe(true);
    expect(long.length).toBeGreaterThan(short.length);
  });

  test('is deterministic per seed and differs across seeds', () => {
    const a = renderTextPart(gen, DEFAULT_FONT, part('abc'), 5)[0].attrs.d;
    expect(renderTextPart(gen, DEFAULT_FONT, part('abc'), 5)[0].attrs.d).toBe(a);
    expect(renderTextPart(gen, DEFAULT_FONT, part('abc'), 6)[0].attrs.d).not.toBe(a);
  });

  test('unknown characters draw a box rather than nothing', () => {
    const tofu = String(renderTextPart(gen, DEFAULT_FONT, part('é'), 5)[0].attrs.d);
    expect(tofu.length).toBeGreaterThan(20);
  });

  test('whitespace-only text yields an empty path', () => {
    expect(renderTextPart(gen, DEFAULT_FONT, part('  '), 5)[0].attrs.d).toBe('');
  });
});
