import type { RoughGenerator } from '../sketch/index.js';
import type { Part } from '../components/types.js';
import { iconElementFilled, iconElementToPath, viewBoxSize } from '../icons/to-path.js';
import { deriveSeed } from '../core/ids.js';
import { fmt, h } from './frame.js';
import type { VElement } from './frame.js';
import { PRECISION } from './sketch-adapter.js';

type IconPart = Extract<Part, { kind: 'icon' }>;

/** Stroke width in icon units (the Lucide default). */
const ICON_STROKE = 2;
/** How far, in pixels, a halo reaches past an icon's stroke on each side. */
const ICON_HALO = 1.2;

/**
 * Draws an icon part. Built-in (sketchyicons) geometry is already hand-drawn
 * and is emitted as-is; `rough: true` runs clean geometry through the engine.
 * The icon is scaled from its viewBox to the requested size in a group, so
 * stroke width stays proportional. A `halo` lays the face colour under the
 * strokes first, so the icon reads over a hatched fill.
 */
export function renderIconPart(gen: RoughGenerator, part: IconPart, seed: number): VElement[] {
  const { icon, color } = part;
  const vb = viewBoxSize(icon.viewBox);
  const scale = part.size / vb.width;
  const strokes: { d: string; strokeWidth: number; filled: boolean }[] = [];
  icon.nodes.forEach((node, i) => {
    const d = iconElementToPath(node);
    if (!d) return;
    const filled = iconElementFilled(node);
    if (icon.rough) {
      const drawable = gen.path(d, {
        seed: deriveSeed(seed, i),
        fixedDecimalPlaceDigits: PRECISION,
        stroke: color,
        strokeWidth: ICON_STROKE,
        // Jitter is in icon units and gets scaled with the icon, so keep it modest.
        roughness: part.style.roughness * 0.5,
        bowing: part.style.bowing,
        disableMultiStroke: true,
        ...(filled ? { fill: color, fillStyle: 'solid' as const } : {}),
      });
      for (const p of gen.toPaths(drawable)) {
        strokes.push({ d: p.d, strokeWidth: p.strokeWidth, filled: p.fill !== undefined && p.fill !== 'none' });
      }
    } else {
      strokes.push({ d, strokeWidth: ICON_STROKE, filled });
    }
  });
  const children: VElement[] = [];
  if (part.halo) {
    // The halo is measured in pixels; the group's scale turns it into icon units.
    const reach = (2 * ICON_HALO) / scale;
    for (const s of strokes) {
      children.push(
        h('path', {
          d: s.d,
          stroke: part.halo,
          'stroke-width': fmt(s.strokeWidth + reach),
          fill: s.filled ? part.halo : 'none',
          'stroke-linecap': 'round',
          'stroke-linejoin': 'round',
        }),
      );
    }
  }
  for (const s of strokes) {
    children.push(
      h('path', {
        d: s.d,
        stroke: color,
        'stroke-width': s.strokeWidth,
        fill: s.filled ? color : 'none',
        'stroke-linecap': 'round',
        'stroke-linejoin': 'round',
      }),
    );
  }
  const attrs: VElement['attrs'] = { transform: `translate(${fmt(part.x)} ${fmt(part.y)}) scale(${fmt(scale)})` };
  if (part.style.opacity !== undefined) attrs.opacity = part.style.opacity;
  return [h('g', attrs, children)];
}
