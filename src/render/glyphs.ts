import { DEFAULT_THEME } from '../core/theme.js';
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
 * Weight is writing over the word again, not a broader nib: one more pass per
 * step of weight, 700 being three and 900 four.
 */
const PASSES_PER_STEP = 150;
const MAX_PASSES = 6;
/**
 * How far a later pass lands from the first, as a fraction of the font size:
 * a hand going over a word misses its own line by a hair, and by a little
 * more the harder it presses.
 */
const SPREAD = 0.02;
const SPREAD_WEIGHT_GAIN = 0.015;
/**
 * A drawn letter (an outline face) is laid down again for weight, and the
 * shift has to show at label sizes too, so it is not held back as far as a
 * written stroke's: this fraction of the size per step, never under half a
 * pixel.
 */
const OVERLAY_SHIFT = 0.02;
const OVERLAY_MIN = 0.5;
/**
 * Small glyphs have small counters, so a written stroke's straying is held
 * back below 24px and is barely there at label sizes.
 */
const FULL_SIZE = 24;
const FLOOR_SIZE = 10;
const MIN_GAIN = 0.15;
/** A drawn letter's ink: a little short of solid, so a second pass builds tone where it overlaps the first. */
const FILL_TONE = 0.88;
/**
 * A stroke font is written: weight is the pen going over each stroke again,
 * and the pen itself grows only this much per step, the way a hand presses a
 * little harder when it goes back over a word.
 */
const BOLD_STROKE_GAIN = 0.15;
/** A written stroke's ink: a little short of solid, so the passes of a heavier weight build tone where they cross. */
const INK_TONE = 0.9;
/** How much wider than the face's own pen the strokes are written; a hand's line is a little fatter than the nib. */
const PEN_GAIN = 1.25;
/** The thinnest a pen gets on screen. */
const PEN_FLOOR = 0.9;
/**
 * The engine's wobble is measured in pixels, so on a written stroke it is
 * scaled with the font size: a label is written with a steadier hand than a
 * heading, within these bounds.
 */
const HAND_AT = 20;
const HAND_MIN = 0.5;
const HAND_MAX = 1.1;
/** A pass over an already written stroke follows it closely: its wobble is this fraction of the first's. */
const OVERWRITE_HAND = 0.6;
/**
 * Over a hatched face the hatch lines would cross the letters. A halo lays the
 * face colour under them first, this fraction of the font size wider than the
 * letter on each side, so the lines stop short of the ink.
 */
const HALO = 0.11;

/** How much of the hand a glyph this size can take without closing up. */
function sizeGain(fontSize: number): number {
  return Math.max(MIN_GAIN, Math.min(1, (fontSize - FLOOR_SIZE) / (FULL_SIZE - FLOOR_SIZE)));
}

/** Steps of weight above the plain letterform, 0 at 400. */
function steps(weight: number): number {
  return Math.max(0, (weight - REGULAR) / PASSES_PER_STEP);
}

/** How many times the word is written: the theme's base, plus one per step of weight. */
function passesOf(weight: number, base: number): number {
  return Math.min(MAX_PASSES, Math.max(0, Math.round(base + steps(weight))));
}

/** How far a written stroke's later pass lands from the first. */
function strokeSpread(weight: number, fontSize: number): number {
  return fontSize * (SPREAD + steps(weight) * SPREAD_WEIGHT_GAIN) * sizeGain(fontSize);
}

/** How far a drawn letter's later pass lands from the first. */
function overlayShift(weight: number, fontSize: number): number {
  return Math.max(OVERLAY_MIN, fontSize * OVERLAY_SHIFT * steps(weight));
}

/**
 * Draws a text part. A drawn letter (an outline glyph) is laid down as it is,
 * and for weight laid down again a hair off; a written one (a stroke glyph)
 * is one smooth engine line per movement of the pen, and for weight written
 * over again. Every glyph has its own seed keyed by character index and code,
 * so while text is being typed the glyphs already on screen keep their exact
 * jitter. Drawn letters go in one filled path, written ones (and tofu boxes)
 * in one stroked path.
 */
export function renderTextPart(gen: RoughGenerator, font: StrokeFont, part: TextPart, seed: number): VElement[] {
  const { fontSize, color } = part;
  const base = part.style.textPasses ?? DEFAULT_THEME.textPasses;
  const passes = passesOf(part.weight, base);
  // A face that draws its letters with a doubled line writes its strokes that way too.
  const strokePasses = base === 0 ? 0 : passesOf(part.weight, base + (font.data.penPasses ?? 1) - 1);
  const spread = strokeSpread(part.weight, fontSize);
  const shift = overlayShift(part.weight, fontSize);
  const layout = layoutText(font, part.text, fontSize, part.align);
  const scale = font.scale(fontSize);
  const nib = font.penWidth(fontSize);
  const strokeWidth =
    (nib === undefined ? glyphStrokeWidth(fontSize) : Math.max(PEN_FLOOR, nib * PEN_GAIN)) *
    (1 + steps(part.weight) * BOLD_STROKE_GAIN);
  const capHeight = font.capHeight(fontSize);
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
      // The letter as drawn, then for weight drawn again a hair off, each
      // pass from its own stream: the way a hand goes over a word, the
      // drawing thickens without a line being put round it.
      for (let pass = 0; pass < passes; pass += 1) {
        const passSeed = deriveSeed(seed, g.index, code, pass);
        const dx = pass === 0 ? 0 : jitter(passSeed, 1) * shift;
        const dy = pass === 0 ? 0 : jitter(passSeed, 2) * shift;
        filled += placeOutline(shape, scale, ox + dx, oy + dy);
      }
      continue;
    }
    shape.forEach((stroke, strokeIndex) => {
      if (stroke.length < 4) return;
      const points: EnginePoint[] = [];
      for (let i = 0; i < stroke.length; i += 2) {
        points.push([ox + stroke[i] * scale, oy + stroke[i + 1] * scale]);
      }
      // Each stroke is one movement of the pen, drawn as one smooth line. A
      // heavier weight is the pen going over the same stroke again, each time
      // from its own stream and off by a hair, the way a hand writes over a
      // word for emphasis.
      for (let pass = 0; pass < strokePasses; pass += 1) {
        const passSeed = deriveSeed(seed, g.index, code, strokeIndex, pass);
        const o = strokeOptions(part, passSeed, strokeWidth);
        o.disableMultiStroke = true;
        o.roughness =
          part.style.roughness *
          Math.max(HAND_MIN, Math.min(HAND_MAX, fontSize / HAND_AT)) *
          (pass === 0 ? 1 : OVERWRITE_HAND);
        const amp = pass === 0 ? 0 : spread;
        const pts: EnginePoint[] =
          amp === 0 ? points : points.map(([x, y]) => [x + jitter(passSeed, 1) * amp, y + jitter(passSeed, 2) * amp]);
        stroked += pathData(pts.length > 2 ? gen.curve(pts, o) : gen.linearPath(pts, o), gen);
      }
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
  if (part.halo) {
    // Drawn letters get the face colour filled and stroked round them; written
    // ones a wider stroke of it under theirs. A face may have both.
    const halos: VElement['attrs'][] = [];
    if (filled) halos.push({ d: filled, fill: part.halo, 'stroke-width': fmt(2 * (fontSize * HALO + shift)) });
    if (stroked.trim()) {
      halos.push({
        d: stroked.trim(),
        fill: 'none',
        'stroke-width': fmt(2 * (fontSize * HALO + spread + strokeWidth)),
      });
    }
    for (const attrs of halos) {
      attrs.stroke = part.halo;
      attrs['stroke-linecap'] = 'round';
      attrs['stroke-linejoin'] = 'round';
      if (part.style.opacity !== undefined) attrs.opacity = part.style.opacity;
      out.push(h('path', attrs));
    }
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
      'stroke-width': strokeWidth,
      fill: 'none',
      'stroke-linecap': 'round',
      'stroke-linejoin': 'round',
    };
    attrs['stroke-opacity'] = INK_TONE;
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
