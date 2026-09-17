import { describe, expect, test, vi } from 'vitest';
import { createDemo } from '../../../src/index.js';
import { Scene } from '../../../src/core/scene.js';
import { DEFAULT_THEME } from '../../../src/core/theme.js';
import { DEFAULT_FONT } from '../../../src/text/index.js';
import { resolveIcon } from '../../../src/icons/index.js';
import type { SketchAdapter } from '../../../src/render/sketch-adapter.js';

/** Reaches the demo's private geometry cache; a test of a leak has to look at the leak. */
function cacheKeys(demo: ReturnType<typeof createDemo>): string[] {
  const adapter = (demo as unknown as { adapter: SketchAdapter }).adapter;
  return [...(adapter as unknown as { cache: Map<string, unknown> }).cache.keys()];
}

describe('removing through the scene', () => {
  test('frees the cached geometry of the node and its descendants', () => {
    const demo = createDemo({ width: 200, height: 200, seed: 1 });
    demo.panel({ id: 'p', x: 0, y: 0, width: 100, height: 100 });
    demo.button({ id: 'b', parent: 'p', x: 10, y: 10, text: 'Go' });
    demo.rect({ id: 'keep', x: 150, y: 150, width: 10, height: 10 });
    demo.toSVG();
    expect(cacheKeys(demo).some((k) => k.startsWith('p/'))).toBe(true);
    expect(cacheKeys(demo).some((k) => k.startsWith('b/'))).toBe(true);

    demo.scene.remove('p');
    const keys = cacheKeys(demo);
    expect(keys.some((k) => k.startsWith('p/') || k.startsWith('b/'))).toBe(false);
    expect(keys.some((k) => k.startsWith('keep/'))).toBe(true);
  });

  test('the hook fires once with the whole subtree, in removal order', () => {
    const onRemove = vi.fn();
    const scene = new Scene({ theme: { ...DEFAULT_THEME }, font: DEFAULT_FONT, icons: resolveIcon }, { onRemove });
    scene.add({ id: 'a', type: 'rect', x: 0, y: 0, width: 1, height: 1 });
    scene.add({ id: 'a1', type: 'rect', parent: 'a', x: 0, y: 0, width: 1, height: 1 });
    scene.add({ id: 'a11', type: 'rect', parent: 'a1', x: 0, y: 0, width: 1, height: 1 });
    scene.add({ id: 'b', type: 'rect', x: 0, y: 0, width: 1, height: 1 });
    scene.remove('a');
    expect(onRemove).toHaveBeenCalledTimes(1);
    expect(onRemove).toHaveBeenCalledWith(['a11', 'a1', 'a']);
    expect(scene.all().map((n) => n.id)).toEqual(['b']);
  });

  test('a clone does not carry the hook', () => {
    const onRemove = vi.fn();
    const scene = new Scene({ theme: { ...DEFAULT_THEME }, font: DEFAULT_FONT, icons: resolveIcon }, { onRemove });
    scene.add({ id: 'a', type: 'rect', x: 0, y: 0, width: 1, height: 1 });
    scene.clone().remove('a');
    expect(onRemove).not.toHaveBeenCalled();
    expect(scene.has('a')).toBe(true);
  });

  test("removing during playback does not disturb the compiled timeline's working copy", () => {
    const demo = createDemo({ width: 200, height: 200, seed: 1 });
    demo.button({ id: 'go', x: 10, y: 10, text: 'Go' });
    demo.rect({ id: 'extra', x: 100, y: 100, width: 10, height: 10 });
    demo.timeline.click('go');
    const before = demo.toSVG(demo.duration);
    demo.scene.remove('extra');
    const after = demo.toSVG(demo.duration);
    expect(after).not.toBe(before);
    expect(after).not.toContain('data-key="extra"');
    expect(after).toContain('data-key="go"');
  });
});
