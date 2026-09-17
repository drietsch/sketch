import { createDemo } from '../../src/index.js';
import type { Demo } from '../../src/index.js';

/**
 * Fixture demos shared by the golden, determinism and dist tests. Each is a
 * function so every test gets a fresh instance; a fixture must be a pure
 * function of its seed.
 */
export const SCENES: Record<string, (seed?: number) => Demo> = {
  /** Small enough for its full SVG to be snapshotted and read in a diff. */
  minimal(seed = 7) {
    const demo = createDemo({ width: 200, height: 120, seed, background: null });
    demo.rect({ id: 'box', x: 20, y: 20, width: 100, height: 60, radius: 6 });
    demo.line({ id: 'underline', x: 20, y: 100, x2: 180, y2: 100 });
    return demo;
  },

  primitives(seed = 42) {
    const demo = createDemo({ width: 640, height: 360, seed });
    const styles = ['hachure', 'solid', 'zigzag', 'cross-hatch', 'dots', 'dashed', 'zigzag-line'] as const;
    styles.forEach((fillStyle, i) => {
      demo.rect({
        id: `fill-${fillStyle}`,
        x: 20 + i * 85,
        y: 20,
        width: 70,
        height: 50,
        style: { fill: '#7aa2f7', fillStyle },
      });
    });
    demo.rect({
      id: 'rounded',
      x: 20,
      y: 100,
      width: 160,
      height: 70,
      radius: 12,
      style: { stroke: '#b00', strokeWidth: 2 },
    });
    demo.ellipse({
      id: 'ellipse',
      x: 200,
      y: 100,
      width: 120,
      height: 70,
      style: { fill: '#ffd166', fillStyle: 'solid' },
    });
    demo.line({ id: 'line', x: 340, y: 100, x2: 600, y2: 170, style: { dash: [6, 4] } });
    demo.path({ id: 'triangle', x: 20, y: 200, d: 'M0 60 L40 0 L80 60 Z', style: { fill: '#06d6a0' } });
    demo.rect({ id: 'group', x: 140, y: 200, width: 300, height: 130, style: { roughness: 0.5 } });
    demo.rect({ id: 'child', parent: 'group', x: 10, y: 10, width: 60, height: 40 });
    demo.ellipse({ id: 'grandchild', parent: 'child', x: 5, y: 5, width: 20, height: 20, sketchVariant: 3 });
    demo.rect({ id: 'ghost', x: 500, y: 250, width: 40, height: 40, hidden: true });
    return demo;
  },
};
