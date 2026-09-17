import { describe, expect, test } from 'vitest';
import { Scene } from '../../../src/core/scene.js';
import { DEFAULT_THEME } from '../../../src/core/theme.js';
import type { RectNode } from '../../../src/core/types.js';

const make = () => new Scene({ theme: { ...DEFAULT_THEME } });
const rect = (id: string, extra: Partial<RectNode> = {}): RectNode => ({
  id,
  type: 'rect',
  x: 10,
  y: 20,
  width: 100,
  height: 50,
  ...extra,
});

describe('Scene', () => {
  test('add, get, has', () => {
    const s = make();
    const stored = s.add(rect('a'));
    expect(s.has('a')).toBe(true);
    expect(s.get('a')).toBe(stored);
    expect(s.get('missing')).toBeUndefined();
    expect(() => s.node('missing')).toThrow(/Unknown node "missing"/);
  });

  test('rejects duplicate, invalid and unknown-parent nodes', () => {
    const s = make();
    s.add(rect('a'));
    expect(() => s.add(rect('a'))).toThrow(/Duplicate node id "a"/);
    expect(() => s.add(rect('bad id'))).toThrow(/Invalid node id/);
    expect(() => s.add(rect('b', { parent: 'nope' }))).toThrow(/Unknown parent "nope"/);
    expect(() => s.add({ ...rect('c'), type: 'blob' } as unknown as RectNode)).toThrow(/Unknown node type "blob"/);
  });

  test('update merges shallowly, style one level deep, and bumps versions', () => {
    const s = make();
    s.add(rect('a', { style: { fill: 'red', stroke: 'blue' } }));
    const v0 = s.version;
    const n0 = s.nodeVersion('a')!;
    const next = s.update<RectNode>('a', { x: 99, style: { fill: 'green' } });
    expect(next.x).toBe(99);
    expect(next.style).toEqual({ fill: 'green', stroke: 'blue' });
    expect(s.get<RectNode>('a')!.width).toBe(100);
    expect(s.version).toBeGreaterThan(v0);
    expect(s.nodeVersion('a')).toBe(n0 + 1);
  });

  test('update with undefined removes a field', () => {
    const s = make();
    s.add(rect('a', { radius: 4 }));
    s.update<RectNode>('a', { radius: undefined });
    expect('radius' in s.get('a')!).toBe(false);
  });

  test('bounds compose parent positions', () => {
    const s = make();
    s.add(rect('outer', { x: 100, y: 100 }));
    s.add(rect('inner', { x: 5, y: 6, parent: 'outer' }));
    s.add(rect('deep', { x: 1, y: 1, parent: 'inner' }));
    expect(s.position('inner')).toEqual({ x: 105, y: 106 });
    expect(s.bounds('deep')).toEqual({ x: 106, y: 107, width: 100, height: 50 });
  });

  test('line and path bounds include negative extents', () => {
    const s = make();
    s.add({ id: 'l', type: 'line', x: 50, y: 50, x2: 10, y2: 80 });
    expect(s.bounds('l')).toEqual({ x: 10, y: 50, width: 40, height: 30 });
    s.add({ id: 'p', type: 'path', x: 100, y: 100, d: 'M-10 0 L30 0 L30 20 Z' });
    expect(s.bounds('p')).toEqual({ x: 90, y: 100, width: 40, height: 20 });
  });

  test('paint order is pre-order over z-order, with bringToFront and sendToBack', () => {
    const s = make();
    s.add(rect('a'));
    s.add(rect('b'));
    s.add(rect('a1', { parent: 'a' }));
    s.add(rect('c'));
    expect(s.all().map((n) => n.id)).toEqual(['a', 'a1', 'b', 'c']);
    s.bringToFront('a');
    expect(s.all().map((n) => n.id)).toEqual(['b', 'c', 'a', 'a1']);
    s.sendToBack('c');
    expect(s.all().map((n) => n.id)).toEqual(['c', 'b', 'a', 'a1']);
  });

  test('visible() skips hidden subtrees', () => {
    const s = make();
    s.add(rect('a', { hidden: true }));
    s.add(rect('a1', { parent: 'a' }));
    s.add(rect('b'));
    expect(s.visible().map((n) => n.id)).toEqual(['b']);
  });

  test('remove cascades to descendants', () => {
    const s = make();
    s.add(rect('a'));
    s.add(rect('a1', { parent: 'a' }));
    s.add(rect('a11', { parent: 'a1' }));
    s.add(rect('b'));
    s.remove('a');
    expect(s.all().map((n) => n.id)).toEqual(['b']);
    expect(s.has('a11')).toBe(false);
  });

  test('reparenting moves the node and rejects cycles', () => {
    const s = make();
    s.add(rect('a', { x: 0, y: 0 }));
    s.add(rect('b', { x: 200, y: 0 }));
    s.add(rect('c', { x: 1, y: 1, parent: 'a' }));
    s.update('c', { parent: 'b' });
    expect(s.position('c')).toEqual({ x: 201, y: 1 });
    expect(s.childrenOf('a')).toEqual([]);
    expect(() => s.update('b', { parent: 'c' })).toThrow(/descendant of itself/);
    s.update('c', { parent: undefined });
    expect(s.childrenOf()).toEqual(['a', 'b', 'c']);
  });

  test('hitTest returns the topmost interactive node and ignores hidden ones', () => {
    const s = make();
    s.add(rect('bottom', { x: 0, y: 0, width: 200, height: 200, interactive: true }));
    s.add(rect('top', { x: 50, y: 50, width: 50, height: 50, interactive: true }));
    s.add(rect('plain', { x: 50, y: 50, width: 50, height: 50 }));
    s.add(rect('ghost', { x: 50, y: 50, width: 50, height: 50, interactive: true, hidden: true }));
    expect(s.hitTest({ x: 60, y: 60 })).toBe('top');
    expect(s.hitTest({ x: 10, y: 10 })).toBe('bottom');
    expect(s.hitTest({ x: 500, y: 500 })).toBeUndefined();
  });

  test('toJSON yields plain copies in paint order', () => {
    const s = make();
    s.add(rect('a'));
    s.add(rect('b', { parent: 'a' }));
    const json = s.toJSON();
    expect(json.map((n) => n.id)).toEqual(['a', 'b']);
    expect(json[0]).not.toBe(s.get('a'));
    expect(json[1].parent).toBe('a');
  });
});
