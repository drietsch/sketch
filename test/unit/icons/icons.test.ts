import { afterEach, describe, expect, test } from 'vitest';
import {
  BUILTIN_ICONS,
  clearRegisteredIcons,
  getIcon,
  hasIcon,
  iconElementFilled,
  iconElementToPath,
  iconNames,
  isBuiltinIcon,
  registerIcon,
  resolveIcon,
  viewBoxSize,
} from '../../../src/icons/index.js';
import { renderIconPart } from '../../../src/render/icons.js';
import { RoughGenerator } from '../../../src/sketch/index.js';
import type { Part } from '../../../src/components/types.js';

afterEach(() => clearRegisteredIcons());

describe('registry', () => {
  test('built-ins are path-only and resolvable', () => {
    expect(Object.keys(BUILTIN_ICONS).length).toBeGreaterThan(40);
    for (const [name, def] of Object.entries(BUILTIN_ICONS)) {
      expect(isBuiltinIcon(name)).toBe(true);
      for (const [tag, attrs] of def.nodes) {
        expect(tag).toBe('path');
        expect(typeof attrs.d).toBe('string');
      }
    }
    expect(getIcon('search')).toBe(BUILTIN_ICONS.search);
  });

  test('registered icons shadow built-ins and are listed', () => {
    const custom = { nodes: [['path', { d: 'M0 0L24 24' }]] as [string, Record<string, string>][] };
    registerIcon('search', custom);
    registerIcon('mine', custom);
    expect(getIcon('search')).toBe(custom);
    expect(hasIcon('mine')).toBe(true);
    expect(iconNames()).toContain('mine');
    const names = iconNames();
    expect(names).toEqual([...names].toSorted());
    clearRegisteredIcons();
    expect(getIcon('search')).toBe(BUILTIN_ICONS.search);
  });

  test('resolveIcon accepts definitions and rejects unknown names', () => {
    const def = { nodes: [] };
    expect(resolveIcon(def)).toBe(def);
    expect(() => resolveIcon('nope')).toThrow(/Unknown icon "nope"/);
    expect(() => registerIcon('', def)).toThrow();
  });
});

describe('to-path', () => {
  test('converts the basic shapes', () => {
    expect(iconElementToPath(['path', { d: 'M1 1' }])).toBe('M1 1');
    expect(iconElementToPath(['line', { x1: 1, y1: 2, x2: 3, y2: 4 }])).toBe('M1 2L3 4');
    expect(iconElementToPath(['polyline', { points: '1 2 3 4 5 6' }])).toBe('M1 2L3 4L5 6');
    expect(iconElementToPath(['polygon', { points: '1,2 3,4 5,6' }])).toBe('M1 2L3 4L5 6Z');
    expect(iconElementToPath(['rect', { x: 1, y: 1, width: 4, height: 2 }])).toBe('M1 1H5V3H1Z');
    expect(iconElementToPath(['rect', { x: 0, y: 0, width: 10, height: 10, rx: 2 }])).toMatch(/^M2 0H8C/);
    expect(iconElementToPath(['circle', { cx: 12, cy: 12, r: 10 }])).toMatch(/^M22 12C/);
    expect(iconElementToPath(['ellipse', { cx: 0, cy: 0, rx: 2, ry: 1 }])).toMatch(/^M2 0C/);
    expect(iconElementToPath(['text', {}])).toBeUndefined();
    expect(iconElementToPath(['polyline', { points: '1' }])).toBeUndefined();
  });

  test('fill and viewBox helpers', () => {
    expect(iconElementFilled(['path', { d: '', fill: 'currentColor' }])).toBe(true);
    expect(iconElementFilled(['path', { d: '', fill: 'none' }])).toBe(false);
    expect(iconElementFilled(['path', { d: '' }])).toBe(false);
    expect(viewBoxSize(undefined)).toEqual({ width: 24, height: 24 });
    expect(viewBoxSize('0 0 16 32')).toEqual({ width: 16, height: 32 });
    expect(viewBoxSize('garbage')).toEqual({ width: 24, height: 24 });
  });
});

describe('renderIconPart', () => {
  const gen = new RoughGenerator({ seed: 1 });
  const style = { stroke: '#000', strokeWidth: 1, fillStyle: 'hachure' as const, roughness: 1, bowing: 1 };
  const part = (icon: Part extends { kind: 'icon' } ? never : Extract<Part, { kind: 'icon' }>['icon']): Part => ({
    key: 'self',
    kind: 'icon',
    x: 3,
    y: 4,
    size: 48,
    icon,
    color: '#abc',
    style,
  });

  test('emits pre-drawn geometry verbatim inside a scaled group', () => {
    const [g] = renderIconPart(gen, part(BUILTIN_ICONS.x) as Extract<Part, { kind: 'icon' }>, 5);
    expect(g.tag).toBe('g');
    expect(g.attrs.transform).toBe('translate(3 4) scale(2)');
    expect(g.children!.map((c) => c.attrs.d)).toEqual(BUILTIN_ICONS.x.nodes.map(([, a]) => a.d));
    expect(g.children![0].attrs.stroke).toBe('#abc');
    expect(g.children![0].attrs.fill).toBe('none');
  });

  test('rough icons go through the engine and differ per seed', () => {
    const icon = { nodes: [['circle', { cx: 12, cy: 12, r: 10 }]] as [string, Record<string, number>][], rough: true };
    const a = renderIconPart(gen, part(icon) as Extract<Part, { kind: 'icon' }>, 5)[0];
    const b = renderIconPart(gen, part(icon) as Extract<Part, { kind: 'icon' }>, 6)[0];
    expect(a.children![0].attrs.d).not.toBe(b.children![0].attrs.d);
    expect(String(a.children![0].attrs.d)).toMatch(/^M/);
  });

  test('filled elements are filled with the icon colour', () => {
    const icon = { nodes: [['path', { d: 'M0 0L10 10', fill: 'currentColor' }]] as [string, Record<string, string>][] };
    const [g] = renderIconPart(gen, part(icon) as Extract<Part, { kind: 'icon' }>, 5);
    expect(g.children![0].attrs.fill).toBe('#abc');
  });
});
