import type { RoughGenerator, Options } from '../sketch/index.js';
import type { Point as EnginePoint } from '../sketch/index.js';
import type { Part } from '../components/types.js';
import type { StrokeFont } from '../text/font.js';
import { layoutText } from '../text/layout.js';
import { deriveSeed } from '../core/ids.js';
import { h } from './frame.js';
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
  let d = '';
  for (const g of layout.glyphs) {
    const glyph = font.glyph(g.ch);
    const ox = part.x + g.x;
    const oy = part.y + g.y;
    const code = g.ch.codePointAt(0) ?? 0;
    if (!glyph) {
      // Tofu: a small box on the baseline, so a missing glyph is visible, not silent.
      const o = strokeOptions(part, deriveSeed(seed, g.index, code, 0), strokeWidth);
      const w = font.advance(g.ch, fontSize);
      d += pathData(gen.rectangle(ox + w * 0.15, oy - capHeight, w * 0.7, capHeight, o), gen);
      continue;
    }
    glyph[1].forEach((stroke, strokeIndex) => {
      if (stroke.length < 4) return;
      const points: EnginePoint[] = [];
      for (let i = 0; i < stroke.length; i += 2) {
        points.push([ox + stroke[i] * scale, oy + stroke[i + 1] * scale]);
      }
      const o = strokeOptions(part, deriveSeed(seed, g.index, code, strokeIndex), strokeWidth);
      d += pathData(gen.linearPath(points, o), gen);
    });
  }
  const attrs: VElement['attrs'] = {
    d: d.trim(),
    stroke: color,
    'stroke-width': strokeWidth,
    fill: 'none',
    'stroke-linecap': 'round',
    'stroke-linejoin': 'round',
  };
  if (part.style.opacity !== undefined) attrs.opacity = part.style.opacity;
  return [h('path', attrs)];
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
