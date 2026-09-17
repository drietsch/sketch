import { describe, expect, test } from 'vitest';
import { escapeAttr, escapeText, fmt, h, serialize } from '../../../src/render/frame.js';
import { group } from '../../../src/render/build-frame.js';

describe('frame serialisation', () => {
  test('fmt keeps two decimals, drops trailing zeros and negative zero', () => {
    expect(fmt(1)).toBe('1');
    expect(fmt(1.006)).toBe('1.01');
    expect(fmt(1.2)).toBe('1.2');
    expect(fmt(-0.001)).toBe('0');
    expect(fmt(-12.346)).toBe('-12.35');
  });

  test('escapes attributes and text', () => {
    expect(escapeAttr('a<b&"c"')).toBe('a&lt;b&amp;&quot;c&quot;');
    expect(escapeText('<b> & </b>')).toBe('&lt;b&gt; &amp; &lt;/b&gt;');
  });

  test('serialises in insertion order, omits undefined, self-closes empty elements', () => {
    const el = h('path', { d: 'M0 0', fill: undefined, 'stroke-width': 1.5 });
    expect(serialize(el)).toBe('<path d="M0 0" stroke-width="1.5"/>');
    expect(serialize(h('g', { id: 'x' }, [el], undefined))).toBe('<g id="x"><path d="M0 0" stroke-width="1.5"/></g>');
    expect(serialize(h('text', {}, undefined, 'a<b'))).toBe('<text>a&lt;b</text>');
  });

  test('group hash follows content, not identity', () => {
    const a = group('k', { transform: 'translate(1 2)' }, [h('path', { d: 'M0 0' })]);
    const b = group('k', { transform: 'translate(1 2)' }, [h('path', { d: 'M0 0' })]);
    const c = group('k', { transform: 'translate(1 3)' }, [h('path', { d: 'M0 0' })]);
    expect(a.hash).toBe(b.hash);
    expect(a.html).toBe(b.html);
    expect(a.hash).not.toBe(c.hash);
    expect(a.html).toBe(`<g data-key="k" data-h="${a.hash}" transform="translate(1 2)"><path d="M0 0"/></g>`);
    expect(serialize(a.el)).toBe(a.html);
  });
});
