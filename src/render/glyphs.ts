import type { RoughGenerator, Options } from '../sketch/index.js';
import type { Point as EnginePoint } from '../sketch/index.js';
import type { Part } from '../components/types.js';
import type { StrokeFont } from '../text/font.js';
import { layoutText } from '../text/layout.js';
import { deriveSeed } from '../core/ids.js';
import { fmt, h } from './frame.js';
import type { VElement } from './frame.js';
import { PRECISION } from './sketch-adapter.js';

type TextPart = Extract<Part, { kind: 'text' }>;

/** Stroke width for glyphs, in px: thin at small sizes, growing with the font. */
export function glyphStrokeWidth(fontSize: number): number {
  return Math.max(0.9, fontSize / 12);
}

/**
 * Draws a text part as sketched strokes. Every glyph stroke is a separate
 * engine call with its own seed keyed by character index and code, so while
 * text is being typed the glyphs already on screen keep their exact jitter.
 * The result is a single path element per part.
 */
export function renderTextPart(gen: RoughGenerator, font: StrokeFont, part: TextPart, seed: number): VElement[] {
  const { fontSize, color } = part;
  const layout = layoutText(font, part.text, fontSize, part.align);
  const scale = font.scale(fontSize);
  const strokeWidth = glyphStrokeWidth(fontSize);
  const capHeight = font.capHeight(fontSize);
  // Sketched strokes (and tofu boxes) go in one stroked path; outline glyphs in one filled path.
  let stroked = '';
  let filled = '';
  for (const g of layout.glyphs) {
    const glyph = font.glyph(g.ch);
    const ox = part.x + g.x;
    const oy = part.y + g.y;
    const code = g.ch.codePointAt(0) ?? 0;
    if (!glyph) {
      // Tofu: a small box on the baseline, so a missing glyph is visible, not silent.
      const o = strokeOptions(part, deriveSeed(seed, g.index, code, 0), strokeWidth);
      const w = font.advance(g.ch, fontSize);
      stroked += pathData(gen.rectangle(ox + w * 0.15, oy - capHeight, w * 0.7, capHeight, o), gen);
      continue;
    }
    const shape = glyph[1];
    if (typeof shape === 'string') {
      filled += placeOutline(shape, scale, ox, oy);
      continue;
    }
    shape.forEach((stroke, strokeIndex) => {
      if (stroke.length < 4) return;
      const points: EnginePoint[] = [];
      for (let i = 0; i < stroke.length; i += 2) {
        points.push([ox + stroke[i] * scale, oy + stroke[i + 1] * scale]);
      }
      const o = strokeOptions(part, deriveSeed(seed, g.index, code, strokeIndex), strokeWidth);
      stroked += pathData(gen.linearPath(points, o), gen);
    });
  }
  const out: VElement[] = [];
  if (filled) {
    const attrs: VElement['attrs'] = { d: filled, fill: color };
    if (part.style.opacity !== undefined) attrs.opacity = part.style.opacity;
    out.push(h('path', attrs));
  }
  if (stroked || !filled) {
    const attrs: VElement['attrs'] = {
      d: stroked.trim(),
      stroke: color,
      'stroke-width': strokeWidth,
      fill: 'none',
      'stroke-linecap': 'round',
      'stroke-linejoin': 'round',
    };
    if (part.style.opacity !== undefined) attrs.opacity = part.style.opacity;
    out.push(h('path', attrs));
  }
  return out;
}

/**
 * Places a glyph outline: the path data is in font units with absolute
 * move-tos and relative curves, so every coordinate scales and only the
 * move-tos translate.
 */
function placeOutline(d: string, scale: number, ox: number, oy: number): string {
  let out = '';
  let absolute = false;
  let axis = 0;
  for (const token of d.match(/[A-Za-z]|-?\d+(?:\.\d+)?/g) ?? []) {
    if (/[A-Za-z]/.test(token)) {
      absolute = token === 'M';
      axis = 0;
      out += token;
      continue;
    }
    const v = Number(token) * scale + (absolute ? (axis % 2 === 0 ? ox : oy) : 0);
    const s = fmt(v);
    out += axis > 0 && !s.startsWith('-') ? ` ${s}` : s;
    axis += 1;
  }
  return out;
}

function strokeOptions(part: TextPart, seed: number, strokeWidth: number): Options {
  return {
    seed,
    fixedDecimalPlaceDigits: PRECISION,
    stroke: part.color,
    strokeWidth,
    roughness: part.style.roughness,
    bowing: part.style.bowing,
    // One clean stroke per glyph segment with exact endpoints, so segments
    // join up; the wobble lives in the control points.
    disableMultiStroke: true,
    preserveVertices: true,
  };
}

function pathData(drawable: ReturnType<RoughGenerator['line']>, gen: RoughGenerator): string {
  let out = '';
  for (const p of gen.toPaths(drawable)) out += p.d + ' ';
  return out;
}
