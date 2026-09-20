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

/** The plain letterform. */
const REGULAR = 400;
/**
 * Weight is contour strokes, not a broader pen. A hand writes a heavier word
 * by going round it again, each time missing its own line by a hair; widening
 * the nib instead erodes the counters and stops looking written at all.
 */
const PASSES_PER_STEP = 150;
const MAX_PASSES = 6;
/** The pen itself, as a fraction of the font size: a hairline that barely grows with weight. */
const PEN = 0.018;
const PEN_WEIGHT_GAIN = 0.35;
/** How far a later contour strays from the letterform, and how much further at heavier weights. */
const SPREAD = 0.014;
const SPREAD_WEIGHT_GAIN = 0.03;
/**
 * Small glyphs have small counters, so both the pen and the straying are held
 * back below 24px and are barely there at label sizes.
 */
const FULL_SIZE = 24;
const FLOOR_SIZE = 10;
const MIN_GAIN = 0.15;
/**
 * Graphite, not ink: the letterform is laid down a little short of solid and
 * each contour is lighter still, so tone builds where the strokes overlap
 * rather than arriving flat and black.
 */
const FILL_TONE = 0.86;
const CONTOUR_TONE = 0.55;
/** A stroke font has no contour to go round, so its own stroke thickens instead. */
const BOLD_STROKE_GAIN = 0.9;

/** How much of the hand a glyph this size can take without closing up. */
function sizeGain(fontSize: number): number {
  return Math.max(MIN_GAIN, Math.min(1, (fontSize - FLOOR_SIZE) / (FULL_SIZE - FLOOR_SIZE)));
}

/** Steps of weight above the plain letterform, 0 at 400. */
function steps(weight: number): number {
  return Math.max(0, (weight - REGULAR) / PASSES_PER_STEP);
}

/** How many times the contour is gone round: the theme's base, plus one per step of weight. */
function contours(weight: number, base: number): number {
  return Math.min(MAX_PASSES, Math.max(0, Math.round(base + steps(weight))));
}

/** The pen that goes round a contour. */
function contourPen(weight: number, fontSize: number): number {
  return fontSize * PEN * (1 + steps(weight) * PEN_WEIGHT_GAIN) * sizeGain(fontSize);
}

/** How far a contour after the first strays from the letterform. */
function contourSpread(weight: number, fontSize: number): number {
  return fontSize * (SPREAD + steps(weight) * SPREAD_WEIGHT_GAIN) * sizeGain(fontSize);
}

/**
 * Draws a text part as sketched strokes. Every glyph stroke is a separate
 * engine call with its own seed keyed by character index and code, so while
 * text is being typed the glyphs already on screen keep their exact jitter.
 * The result is a single path element per part.
 */
export function renderTextPart(gen: RoughGenerator, font: StrokeFont, part: TextPart, seed: number): VElement[] {
  const { fontSize, color } = part;
  const pen = contourPen(part.weight, fontSize);
  const passes = contours(part.weight, part.style.textPasses ?? 1);
  const spread = contourSpread(part.weight, fontSize);
  const layout = layoutText(font, part.text, fontSize, part.align);
  const scale = font.scale(fontSize);
  const strokeWidth = glyphStrokeWidth(fontSize) * (1 + steps(part.weight) * BOLD_STROKE_GAIN);
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
      const d = placeOutline(shape, scale, ox, oy);
      filled += d;
      // The letter is gone round again with a pen, once per pass and each from
      // its own stream, so the lines differ the way a hand's would. A heavier
      // weight is the same thing with a broader pen.
      for (let pass = 0; pass < passes; pass += 1) {
        const passSeed = deriveSeed(seed, g.index, code, pass + 1);
        const o = strokeOptions(part, passSeed, pen);
        o.disableMultiStroke = true;
        o.preserveVertices = false;
        // The first contour traces the letter; each one after it misses by a hair.
        const amp = pass === 0 ? 0 : spread;
        const line =
          amp === 0 ? d : placeOutline(shape, scale, ox + jitter(passSeed, 1) * amp, oy + jitter(passSeed, 2) * amp);
        stroked += pathData(gen.path(line, o), gen);
      }
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
  // The marker goes down before the words do, so the ink reads over it.
  if (part.marker) {
    const b = layout.bounds;
    const band = gen.line(
      part.x + b.x + b.width * 0.02,
      part.y + b.y + b.height * 0.58,
      part.x + b.x + b.width * 0.98,
      part.y + b.y + b.height * 0.46,
      {
        seed: deriveSeed(seed, 0, 0, 7),
        fixedDecimalPlaceDigits: PRECISION,
        stroke: part.marker.color,
        strokeWidth: b.height * 0.8,
        roughness: part.style.roughness * 2,
        bowing: part.style.bowing,
        disableMultiStroke: true,
      },
    );
    out.push(
      h('path', {
        d: pathData(band, gen).trim(),
        stroke: part.marker.color,
        'stroke-width': fmt(b.height * 0.8),
        'stroke-linecap': 'round',
        fill: 'none',
        opacity: part.marker.opacity,
      }),
    );
  }
  if (filled) {
    const attrs: VElement['attrs'] = { d: filled, fill: color, 'fill-opacity': FILL_TONE };
    if (part.style.opacity !== undefined) attrs.opacity = part.style.opacity;
    out.push(h('path', attrs));
  }
  if (stroked || !filled) {
    const attrs: VElement['attrs'] = {
      d: stroked.trim(),
      stroke: color,
      'stroke-width': filled ? pen : strokeWidth,
      fill: 'none',
      'stroke-linecap': 'round',
      'stroke-linejoin': 'round',
    };
    if (filled) attrs['stroke-opacity'] = CONTOUR_TONE;
    if (part.style.opacity !== undefined) attrs.opacity = part.style.opacity;
    out.push(h('path', attrs));
  }
  return out;
}

/** A repeatable -1..1 from a seed, so a pass lands in the same wrong place every time. */
function jitter(seed: number, salt: number): number {
  const n = Math.imul(seed ^ (salt * 0x9e3779b1), 0x85ebca6b) >>> 0;
  return (n % 2001) / 1000 - 1;
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
