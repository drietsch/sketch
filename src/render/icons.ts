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

/**
 * Draws an icon part. Built-in (sketchyicons) geometry is already hand-drawn
 * and is emitted as-is; `rough: true` runs clean geometry through the engine.
 * The icon is scaled from its viewBox to the requested size in a group, so
 * stroke width stays proportional.
 */
export function renderIconPart(gen: RoughGenerator, part: IconPart, seed: number): VElement[] {
  const { icon, color } = part;
  const vb = viewBoxSize(icon.viewBox);
  const scale = part.size / vb.width;
  const children: VElement[] = [];
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
        children.push(
          h('path', {
            d: p.d,
            stroke: p.stroke,
            'stroke-width': p.strokeWidth,
            fill: p.fill ?? 'none',
            'stroke-linecap': 'round',
            'stroke-linejoin': 'round',
          }),
        );
      }
    } else {
      children.push(
        h('path', {
          d,
          stroke: color,
          'stroke-width': ICON_STROKE,
          fill: filled ? color : 'none',
          'stroke-linecap': 'round',
          'stroke-linejoin': 'round',
        }),
      );
    }
  });
  const attrs: VElement['attrs'] = { transform: `translate(${fmt(part.x)} ${fmt(part.y)}) scale(${fmt(scale)})` };
  if (part.style.opacity !== undefined) attrs.opacity = part.style.opacity;
  return [h('g', attrs, children)];
}
