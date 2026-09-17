import { describe, expect, test } from 'vitest';
import { cssColor, firstVisible, isColor, resolvePaint, solid, validatePaints } from '../../../src/core/paint.js';
import { createDemo } from '../../../src/index.js';

describe('paint', () => {
  test('Figma colours become CSS, strings pass through', () => {
    expect(cssColor({ r: 0, g: 0, b: 0 })).toBe('#000000');
    expect(cssColor({ r: 1, g: 1, b: 1, a: 1 })).toBe('#ffffff');
    expect(cssColor({ r: 0.18, g: 0.44, b: 0.93 })).toBe('#2e70ed');
    expect(cssColor({ r: 1, g: 0, b: 0, a: 0.5 })).toBe('rgba(255, 0, 0, 0.5)');
    expect(cssColor({ r: 2, g: -1, b: 0.5 })).toBe('#ff0080');
    expect(cssColor('rebeccapurple')).toBe('rebeccapurple');
    expect(isColor({ r: 0, g: 0, b: 0 })).toBe(true);
    expect(isColor('#fff')).toBe(false);
  });

  test('the first visible paint wins; absent and empty differ', () => {
    expect(resolvePaint(undefined)).toBeUndefined();
    expect(resolvePaint([])).toBe('none');
    expect(resolvePaint([{ type: 'SOLID', color: 'red', visible: false }])).toBe('none');
    expect(resolvePaint([{ type: 'SOLID', color: 'red', visible: false }, solid('blue')])).toEqual({ color: 'blue' });
    expect(resolvePaint([solid({ r: 0, g: 0, b: 1 }, 0.25)])).toEqual({ color: '#0000ff', opacity: 0.25 });
    expect(firstVisible([solid('a'), solid('b')])!.color).toBe('a');
  });

  test('validation names the problem', () => {
    expect(validatePaints(undefined, 'fills')).toBeUndefined();
    expect(validatePaints([solid('red'), solid({ r: 0.5, g: 0.5, b: 0.5, a: 0.5 })], 'fills')).toBeUndefined();
    expect(validatePaints('red', 'fills')).toMatch(/must be an array/);
    expect(validatePaints([{ type: 'IMAGE' }], 'fills')).toMatch(/fills\[0\].type "IMAGE" is not supported/);
    expect(validatePaints([{ type: 'SOLID', color: 5 }], 'fills')).toMatch(/color must be a CSS string or/);
    expect(validatePaints([{ type: 'SOLID', color: { r: 1, g: 1, b: 1.5 } }], 'strokes')).toMatch(
      /color.b must be in 0..1/,
    );
    expect(validatePaints([{ type: 'SOLID', color: 'red', opacity: 2 }], 'fills')).toMatch(/opacity must be in 0..1/);
  });

  test('paint opacity reaches the SVG as fill-opacity / stroke-opacity', () => {
    const demo = createDemo({ width: 100, height: 100, seed: 1 });
    demo.rectangle({
      id: 'r',
      x: 0,
      y: 0,
      width: 50,
      height: 50,
      fills: [{ type: 'SOLID', color: { r: 1, g: 0, b: 0 }, opacity: 0.5 }],
      strokes: [{ type: 'SOLID', color: '#00f', opacity: 0.25 }],
      sketch: { fillStyle: 'solid' },
    });
    const svg = demo.toSVG();
    expect(svg).toContain('fill="#ff0000"');
    expect(svg).toContain('fill-opacity="0.5"');
    expect(svg).toContain('stroke="#00f"');
    expect(svg).toContain('stroke-opacity="0.25"');
    demo.scene.update('r', { sketch: { fillStyle: 'hachure' } });
    // A hatched fill is drawn as strokes in the fill colour and carries the fill's opacity.
    expect(demo.toSVG()).toMatch(/stroke="#ff0000"[^>]*stroke-opacity="0.5"/);
  });

  test('empty strokes remove the outline; empty fills remove a component default', () => {
    const demo = createDemo({ width: 100, height: 100, seed: 1 });
    demo.rectangle({ id: 'a', x: 0, y: 0, width: 50, height: 50, strokes: [] });
    demo.button({ id: 'b', x: 0, y: 60, characters: 'Go', fills: [] });
    const a = demo.frameAt().groups[0].html;
    expect(a).not.toContain('<path');
    const b = demo.frameAt().groups[1].html;
    expect(b).not.toContain('fill="#ffffff"');
    expect(b).toContain('stroke="#1f2430"');
  });
});
