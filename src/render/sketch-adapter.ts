import { RoughGenerator, fillRuleFor } from '../sketch/index.js';
import type { Drawable, Options, PathInfo } from '../sketch/index.js';
import type { Part, PartStyle } from '../components/types.js';
import type { StrokeFont } from '../text/font.js';
import { h } from './frame.js';
import type { VElement } from './frame.js';
import { renderTextPart } from './glyphs.js';
import { renderIconPart } from './icons.js';

/** Precision of every coordinate the engine emits. Fixed so output is byte-identical across JS engines. */
export const PRECISION = 2;

/**
 * Turns parts into sketched SVG elements through the engine, and remembers
 * the result per (node, part) so that a frame at 60 fps regenerates only what
 * changed. Parts are in node-local coordinates, so moving a node costs one
 * transform attribute and no geometry.
 */
export class SketchAdapter {
  // An explicit seed: the engine constructor otherwise materialises one from
  // Math.random. Every call below passes its own seed, so this one is unused.
  private readonly gen = new RoughGenerator({ seed: 1 });
  private readonly cache = new Map<string, { sig: string; els: VElement[] }>();

  constructor(private readonly font: StrokeFont) {}

  render(nodeId: string, part: Part, seed: number): VElement[] {
    if (part.kind === 'raw') return [part.el];
    const key = `${nodeId}/${part.key}`;
    const sig = signature(part, seed);
    const hit = this.cache.get(key);
    if (hit && hit.sig === sig) return hit.els;
    const els = this.draw(part, seed);
    this.cache.set(key, { sig, els });
    return els;
  }

  /** Drops cached geometry for a node; call when the node is removed. */
  forget(nodeId: string): void {
    const prefix = `${nodeId}/`;
    for (const key of this.cache.keys()) {
      if (key.startsWith(prefix)) this.cache.delete(key);
    }
  }

  /** Sketches a drawable directly; used for chrome that is not a scene node. */
  sketch(draw: (gen: RoughGenerator, options: Options) => Drawable, style: PartStyle, seed: number): VElement[] {
    const drawable = draw(this.gen, toOptions(style, seed));
    return this.toElements(drawable, style);
  }

  private draw(part: Exclude<Part, { kind: 'raw' }>, seed: number): VElement[] {
    if (part.kind === 'text') return renderTextPart(this.gen, this.font, part, seed);
    if (part.kind === 'icon') return renderIconPart(this.gen, part, seed);
    const o = toOptions(part.style, seed);
    let drawable: Drawable;
    switch (part.kind) {
      case 'rect':
        drawable =
          part.radius && part.radius > 0
            ? this.gen.roundedRectangle(part.x, part.y, part.width, part.height, part.radius, o)
            : this.gen.rectangle(part.x, part.y, part.width, part.height, o);
        break;
      case 'ellipse':
        drawable = this.gen.ellipse(part.x + part.width / 2, part.y + part.height / 2, part.width, part.height, o);
        break;
      case 'line':
        drawable = this.gen.line(part.x1, part.y1, part.x2, part.y2, o);
        break;
      case 'path':
        drawable = this.gen.path(part.d, o);
        break;
    }
    return this.toElements(drawable, part.style);
  }

  private toElements(drawable: Drawable, style: PartStyle): VElement[] {
    const rule = fillRuleFor(drawable.shape);
    return this.gen.toPaths(drawable).map((p) => pathElement(p, rule, style));
  }
}

function pathElement(p: PathInfo, rule: 'evenodd' | 'nonzero', style: PartStyle): VElement {
  const filled = p.fill !== undefined && p.fill !== 'none';
  const attrs: VElement['attrs'] = {
    d: p.d,
    stroke: p.stroke,
    'stroke-width': p.strokeWidth,
    fill: filled ? p.fill : 'none',
  };
  if (filled && rule === 'evenodd') attrs['fill-rule'] = 'evenodd';
  if (p.stroke !== 'none') {
    attrs['stroke-linecap'] = 'round';
    attrs['stroke-linejoin'] = 'round';
    if (style.dash && style.dash.length) attrs['stroke-dasharray'] = style.dash.join(' ');
  }
  if (style.opacity !== undefined) attrs.opacity = style.opacity;
  return h('path', attrs);
}

/** Engine options from a part style. Undefined fields are omitted so they do not clobber the engine defaults. */
export function toOptions(style: PartStyle, seed: number): Options {
  const o: Options = {
    seed,
    fixedDecimalPlaceDigits: PRECISION,
    stroke: style.stroke,
    strokeWidth: style.strokeWidth,
    fillStyle: style.fillStyle,
    roughness: style.roughness,
    bowing: style.bowing,
  };
  if (style.fill !== undefined) o.fill = style.fill;
  if (style.hachureGap !== undefined) o.hachureGap = style.hachureGap;
  if (style.hachureAngle !== undefined) o.hachureAngle = style.hachureAngle;
  if (style.fillWeight !== undefined) o.fillWeight = style.fillWeight;
  if (style.disableMultiStroke !== undefined) o.disableMultiStroke = style.disableMultiStroke;
  if (style.preserveVertices !== undefined) o.preserveVertices = style.preserveVertices;
  return o;
}

function signature(part: Part, seed: number): string {
  return `${seed}|${JSON.stringify(part)}`;
}
