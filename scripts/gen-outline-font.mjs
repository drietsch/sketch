/**
 * Converts an outline font (TTF/OTF) into the compact TypeScript module the
 * text renderer consumes as an outline face: one SVG path per glyph in font
 * units, baseline at y = 0, y down. The default face, Handodle, is made this
 * way: its letters are drawn with a scribbling pen and that drawing is the
 * look, so the outlines are kept as they are rather than reduced to strokes
 * (see gen-stroke-font.mjs for a monoline face).
 *
 * The Handodle file at hand is the studio's demo: its digits and a few marks
 * are a "personal use" tile. Those glyphs are recognised by the tile's
 * signature and replaced by the hand-written strokes below, as are the
 * characters the face has no glyph for at all. Drop the full font in and the
 * real glyphs take over.
 *
 * Run with: node scripts/gen-outline-font.mjs
 * Another face: --src some.ttf --out some.ts --name some [--mixed]
 * The face is written in capitals; --mixed keeps the lower case.
 */
import { readFileSync, writeFileSync } from 'node:fs';
import opentype from 'opentype.js';

const arg = (flag, fallback) => {
  const i = process.argv.indexOf(flag);
  return i === -1 ? fallback : process.argv[i + 1];
};
const SRC = arg('--src', 'vendor/handodle/Handodle-Regular.ttf');
const OUT = arg('--out', 'src/text/fonts/handodle.ts');
const NAME = arg('--name', 'handodle');
const UPPERCASE = !process.argv.includes('--mixed');
const EXPORT = NAME.toUpperCase().replace(/[^A-Z0-9]+/g, '_');
/** The pen the hand-written glyphs are drawn with, in font units: about the weight of the face's own line. */
const PEN_WIDTH = 58;

const font = opentype.parse(readFileSync(SRC).buffer.slice(0));
const upm = font.unitsPerEm;

/** Characters to include, before upper-case folding. */
const wanted = new Set();
for (let c = 32; c <= 126; c++) wanted.add(String.fromCharCode(c));
// Latin-1: the letters, plus the symbols UI copy uses; the rest (¤ ¦ ¨ ª ¬ ¯ ´ ¸ º ¹ ² ³ ¼ ½ ¾ µ ¶) is left out.
for (let c = 0xc0; c <= 0xff; c++) wanted.add(String.fromCharCode(c));
for (const ch of '\u00a1\u00a2\u00a3\u00a5\u00a7\u00a9\u00ab\u00ae\u00b0\u00b1\u00b7\u00bb\u00bf') wanted.add(ch);
for (const ch of '\u2018\u2019\u201a\u201c\u201d\u201e\u2013\u2014\u2026\u2022\u2039\u203a\u2122\u20ac\u2190\u2191\u2192\u2193\u2713\u2717\u00a0')
  wanted.add(ch);

/**
 * Distance of a point from the segment between two others, in font units.
 */
function offChord(ax, ay, bx, by, px, py) {
  const dx = bx - ax;
  const dy = by - ay;
  const len = Math.hypot(dx, dy);
  if (len === 0) return Math.hypot(px - ax, py - ay);
  const t = Math.max(0, Math.min(1, ((px - ax) * dx + (py - ay) * dy) / (len * len)));
  return Math.hypot(px - (ax + dx * t), py - (ay + dy * t));
}

/**
 * Thins an outline to what shows at any size the UI uses: a curve whose
 * control points sit within `tolerance` font units of its chord becomes a
 * line, and a line-to that sits within `tolerance` of the segment between its
 * neighbours is dropped. A scribbled face has these in abundance; at 1000
 * units to the em, 6 units is a third of a pixel at 56px.
 */
function simplify(commands, tolerance = 6) {
  let x = 0;
  let y = 0;
  const flat = [];
  for (const c of commands) {
    if (c.type === 'Q' && offChord(x, y, c.x, c.y, c.x1, c.y1) <= tolerance) flat.push({ type: 'L', x: c.x, y: c.y });
    else if (
      c.type === 'C' &&
      offChord(x, y, c.x, c.y, c.x1, c.y1) <= tolerance &&
      offChord(x, y, c.x, c.y, c.x2, c.y2) <= tolerance
    )
      flat.push({ type: 'L', x: c.x, y: c.y });
    else flat.push(c);
    if (c.type !== 'Z') {
      x = c.x;
      y = c.y;
    }
  }
  const out = [];
  for (let i = 0; i < flat.length; i++) {
    const c = flat[i];
    const prev = out.at(-1);
    const next = flat[i + 1];
    if (c.type === 'L' && prev && next && next.type === 'L' && prev.type !== 'Z') {
      if (offChord(prev.x, prev.y, next.x, next.y, c.x, c.y) <= tolerance) continue;
    }
    out.push(c);
  }
  return out;
}

/** Absolute commands as relative ones with integer coordinates: the shortest SVG path data for the same shape. */
function compactPath(commands) {
  let d = '';
  let x = 0;
  let y = 0;
  const n = (v) => Math.round(v);
  const rel = (...pairs) => pairs.map(([px, py]) => `${n(px - x)} ${n(py - y)}`).join(' ');
  for (const c of commands) {
    if (c.type === 'M') d += `M${n(c.x)} ${n(c.y)}`;
    else if (c.type === 'L') {
      if (n(c.x) === x && n(c.y) === y) continue;
      d += `l${rel([c.x, c.y])}`;
    } else if (c.type === 'Q') d += `q${rel([c.x1, c.y1], [c.x, c.y])}`;
    else if (c.type === 'C') d += `c${rel([c.x1, c.y1], [c.x2, c.y2], [c.x, c.y])}`;
    else if (c.type === 'Z') {
      d += 'z';
      continue;
    }
    x = n(c.x);
    y = n(c.y);
  }
  return d.replace(/ -/g, '-');
}

/** The character a glyph is stored under: capitals only. */
const fold = (ch) => {
  if (!UPPERCASE) return ch;
  const up = ch.toUpperCase();
  return [...up].length === 1 ? up : ch;
};

const glyphs = {};
let maxAscent = 0;
let maxDescent = 0;
/**
 * A demo build's placeholder: every tile has the same box and forty contours,
 * whatever character it stands in for. A real glyph is never that regular.
 */
const isTile = (path) => {
  const b = path.getBoundingBox();
  const contours = path.commands.filter((c) => c.type === 'M').length;
  return contours === 40 && Math.round(b.x1) === 22 && Math.round(b.x2) <= 465 && Math.round(b.x2) >= 450;
};

const capHeight = font.tables.os2.sCapHeight ?? -font.charToGlyph('H').getPath(0, 0, upm).getBoundingBox().y1;
const cap = Math.round(capHeight);

/**
 * Glyphs written by hand, as the pen strokes a hand makes, in the face's
 * units (y down, baseline 0). Each stroke is one movement; a corner is where
 * one stroke ends and the next begins. Digits stand a little short of the
 * capitals, as this hand writes them.
 */
const D = -Math.round(cap * 0.96); // digit height
const M = -Math.round(cap * 0.5); // mid
const written = {
  0: [
    470,
    [
      [
        230,
        D,
        110,
        D * 0.88,
        50,
        D * 0.62,
        50,
        D * 0.38,
        110,
        D * 0.12,
        230,
        0,
        350,
        D * 0.12,
        410,
        D * 0.38,
        410,
        D * 0.62,
        350,
        D * 0.88,
        230,
        D,
      ],
    ],
  ],
  1: [470, [[110, D * 0.78, 250, D, 250, 0]]],
  2: [
    470,
    [
      [
        70,
        D * 0.76,
        130,
        D * 0.95,
        240,
        D,
        350,
        D * 0.94,
        400,
        D * 0.76,
        360,
        D * 0.56,
        250,
        D * 0.38,
        120,
        D * 0.18,
        60,
        0,
      ],
      [60, 0, 410, 0],
    ],
  ],
  3: [
    470,
    [
      [
        70,
        D * 0.88,
        180,
        D,
        320,
        D * 0.97,
        380,
        D * 0.8,
        330,
        D * 0.63,
        230,
        D * 0.56,
        350,
        D * 0.47,
        400,
        D * 0.3,
        350,
        D * 0.09,
        230,
        0,
        100,
        D * 0.06,
        50,
        D * 0.22,
      ],
    ],
  ],
  4: [
    470,
    [
      [300, D, 60, D * 0.32, 430, D * 0.32],
      [330, D * 0.9, 330, 0],
    ],
  ],
  5: [
    470,
    [
      [380, D, 120, D],
      [120, D, 90, D * 0.58],
      [
        90,
        D * 0.58,
        210,
        D * 0.66,
        330,
        D * 0.63,
        400,
        D * 0.47,
        400,
        D * 0.25,
        330,
        D * 0.06,
        200,
        0,
        90,
        D * 0.06,
        50,
        D * 0.19,
      ],
    ],
  ],
  6: [
    470,
    [
      [
        360,
        D * 0.97,
        240,
        D,
        120,
        D * 0.91,
        60,
        D * 0.66,
        50,
        D * 0.37,
        90,
        D * 0.13,
        200,
        0,
        320,
        D * 0.03,
        400,
        D * 0.21,
        400,
        D * 0.41,
        320,
        D * 0.57,
        200,
        D * 0.6,
        100,
        D * 0.53,
        60,
        D * 0.41,
      ],
    ],
  ],
  7: [
    470,
    [
      [60, D, 410, D],
      [410, D, 180, 0],
    ],
  ],
  8: [
    470,
    [
      [
        230,
        D * 0.53,
        120,
        D * 0.62,
        90,
        D * 0.82,
        150,
        D * 0.98,
        240,
        D,
        340,
        D * 0.95,
        370,
        D * 0.79,
        320,
        D * 0.63,
        230,
        D * 0.53,
        120,
        D * 0.43,
        60,
        D * 0.24,
        100,
        D * 0.06,
        230,
        0,
        350,
        D * 0.04,
        410,
        D * 0.22,
        360,
        D * 0.43,
        230,
        D * 0.53,
      ],
    ],
  ],
  9: [
    470,
    [
      [
        400,
        D * 0.66,
        320,
        D * 0.53,
        200,
        D * 0.49,
        90,
        D * 0.57,
        50,
        D * 0.76,
        100,
        D * 0.95,
        220,
        D,
        340,
        D * 0.95,
        400,
        D * 0.76,
        400,
        D * 0.44,
        370,
        D * 0.19,
        280,
        0,
        150,
        D * 0.01,
      ],
    ],
  ],
  '?': [
    440,
    [
      [80, D * 0.82, 150, D * 0.98, 260, D, 370, D * 0.95, 400, D * 0.79, 340, D * 0.63, 240, D * 0.5, 220, D * 0.35],
      [215, D * 0.09, 225, D * 0.03],
    ],
  ],
  '(': [320, [[290, D * 1.1, 180, D * 0.9, 130, D * 0.6, 130, D * 0.3, 180, D * 0.03, 290, -D * 0.17]]],
  ')': [320, [[110, D * 1.1, 220, D * 0.9, 270, D * 0.6, 270, D * 0.3, 220, D * 0.03, 110, -D * 0.17]]],
  '!': [
    240,
    [
      [125, D, 115, D * 0.32],
      [115, D * 0.09, 125, D * 0.03],
    ],
  ],
  '%': [
    560,
    [
      [430, D, 90, D * 0.03],
      [140, D * 0.82, 90, D * 0.9, 140, D * 1.0, 200, D * 0.9, 140, D * 0.82],
      [390, D * 0.04, 340, D * 0.13, 390, D * 0.23, 450, D * 0.13, 390, D * 0.04],
    ],
  ],
  '&': [
    520,
    [
      [
        420,
        D * 0.09,
        260,
        D * 0.36,
        120,
        D * 0.65,
        140,
        D * 0.87,
        240,
        D,
        330,
        D * 0.9,
        300,
        D * 0.7,
        180,
        D * 0.48,
        80,
        D * 0.25,
        110,
        D * 0.06,
        230,
        0,
        340,
        D * 0.09,
        440,
        D * 0.26,
      ],
    ],
  ],
  '@': [
    560,
    [
      [
        330,
        D * 0.6,
        240,
        D * 0.66,
        180,
        D * 0.57,
        180,
        D * 0.41,
        240,
        D * 0.33,
        320,
        D * 0.4,
        340,
        D * 0.57,
        330,
        D * 0.3,
        400,
        D * 0.26,
        440,
        D * 0.37,
        430,
        D * 0.56,
        380,
        D * 0.8,
        240,
        D * 0.93,
        100,
        D * 0.8,
        60,
        D * 0.52,
        120,
        D * 0.23,
        280,
        D * 0.09,
        420,
        D * 0.13,
      ],
    ],
  ],
  '#': [
    480,
    [
      [180, D, 120, 0],
      [340, D, 280, 0],
      [60, D * 0.65, 430, D * 0.65],
      [40, D * 0.32, 410, D * 0.32],
    ],
  ],
  $: [
    470,
    [
      [
        370,
        D * 0.8,
        260,
        D * 0.92,
        140,
        D * 0.86,
        120,
        D * 0.69,
        220,
        D * 0.57,
        330,
        D * 0.47,
        360,
        D * 0.29,
        260,
        D * 0.11,
        120,
        D * 0.14,
        60,
        D * 0.29,
      ],
      [230, D * 1.05, 230, -D * 0.06],
    ],
  ],
  '*': [
    380,
    [
      [190, D * 0.98, 190, D * 0.56],
      [95, D * 0.88, 285, D * 0.66],
      [285, D * 0.88, 95, D * 0.66],
    ],
  ],
  '<': [
    400,
    [
      [310, D * 0.8, 90, M],
      [90, M, 310, D * 0.2],
    ],
  ],
  '>': [
    400,
    [
      [90, D * 0.8, 310, M],
      [310, M, 90, D * 0.2],
    ],
  ],
  '^': [
    400,
    [
      [100, D * 0.6, 200, D],
      [200, D, 300, D * 0.6],
    ],
  ],
  '{': [
    340,
    [
      [
        260,
        D * 1.06,
        190,
        D * 0.99,
        160,
        D * 0.86,
        160,
        D * 0.62,
        115,
        D * 0.5,
        160,
        D * 0.38,
        160,
        D * 0.14,
        190,
        0,
        260,
        -D * 0.08,
      ],
    ],
  ],
  '}': [
    340,
    [
      [
        80,
        D * 1.06,
        150,
        D * 0.99,
        180,
        D * 0.86,
        180,
        D * 0.62,
        225,
        D * 0.5,
        180,
        D * 0.38,
        180,
        D * 0.14,
        150,
        0,
        80,
        -D * 0.08,
      ],
    ],
  ],
  '\u00b7': [200, [[85, M, 125, M]]],
  '\u00b1': [
    480,
    [
      [240, D * 0.78, 240, D * 0.28],
      [70, D * 0.53, 410, D * 0.53],
      [70, D * 0.08, 410, D * 0.08],
    ],
  ],
  '\u201a': [220, [[130, 30, 110, 130]]],
  '\u2039': [
    300,
    [
      [220, D * 0.62, 90, D * 0.35],
      [90, D * 0.35, 220, D * 0.08],
    ],
  ],
  '\u203a': [
    300,
    [
      [80, D * 0.62, 210, D * 0.35],
      [210, D * 0.35, 80, D * 0.08],
    ],
  ],
  '\u2122': [
    700,
    [
      [40, D, 300, D],
      [170, D, 170, D * 0.55],
      [340, D * 0.55, 340, D, 460, D * 0.7, 580, D, 580, D * 0.55],
    ],
  ],
  '\u00df': [
    520,
    [
      [
        110,
        0,
        110,
        D * 0.85,
        160,
        D * 0.98,
        270,
        D,
        350,
        D * 0.9,
        330,
        D * 0.76,
        250,
        D * 0.64,
        340,
        D * 0.58,
        400,
        D * 0.42,
        400,
        D * 0.2,
        330,
        D * 0.04,
        230,
        D * 0.03,
      ],
    ],
  ],
  '\u2192': [
    620,
    [
      [60, M, 560, M],
      [400, M - 150, 560, M, 400, M + 150],
    ],
  ],
  '\u2190': [
    620,
    [
      [560, M, 60, M],
      [220, M - 150, 60, M, 220, M + 150],
    ],
  ],
  '\u2191': [
    420,
    [
      [210, 0, 210, -cap],
      [60, -cap + 160, 210, -cap, 360, -cap + 160],
    ],
  ],
  '\u2193': [
    420,
    [
      [210, -cap, 210, 0],
      [60, -160, 210, 0, 360, -160],
    ],
  ],
  '\u2713': [560, [[70, -Math.round(cap * 0.42), 220, -40, 520, -cap]]],
  '\u2717': [
    520,
    [
      [70, -cap, 450, -20],
      [450, -cap, 70, -20],
    ],
  ],
};
const round = (strokes) => strokes.map((st) => st.map((v) => Math.round(v)));

let tiles = 0;
let hand = 0;
for (const raw of [...wanted].toSorted()) {
  const ch = raw === '\u00a0' ? ' ' : fold(raw);
  if (glyphs[ch]) continue;
  const glyph = font.charToGlyph(ch);
  const path = glyph && glyph.index !== 0 && glyph.unicode !== undefined ? glyph.getPath(0, 0, upm) : undefined;
  if (path && !isTile(path)) {
    const d = compactPath(simplify(path.commands));
    const box = path.getBoundingBox();
    if (d) {
      maxAscent = Math.max(maxAscent, -box.y1);
      maxDescent = Math.max(maxDescent, box.y2);
    }
    glyphs[ch] = [Math.round(glyph.advanceWidth), d];
    continue;
  }
  if (path) tiles += 1;
  if (written[ch]) {
    glyphs[ch] = [written[ch][0], round(written[ch][1])];
    hand += 1;
  }
}

const entries = Object.entries(glyphs)
  .map(([ch, [advance, d]]) => `  ${JSON.stringify(ch)}: [${advance}, ${JSON.stringify(d)}],`)
  .join('\n');

writeFileSync(
  OUT,
  `// GENERATED by scripts/gen-outline-font.mjs from ${SRC}. Do not edit.
//
${
  NAME === 'handodle'
    ? `// Handodle, copyright 2019 Putracetol Studio (Putra Novembria Candra Kusuma).
// See THIRD-PARTY-NOTICES.md for the licence. The letters are the face's
// own outlines; ${hand} glyphs the file lacks (${tiles} of them a demo tile) are
// written by hand as pen strokes.
import type { StrokeFontData } from '../font.js';`
    : `// The outlines of ${font.names.windows?.fullName?.en ?? NAME}. Check the face's licence before shipping this anywhere.
import type { StrokeFontData } from '@drietsch/sketch';`
}

export const ${EXPORT}: StrokeFontData = {
  name: '${NAME}',
  kind: 'outline',
  uppercase: ${UPPERCASE},
  unitsPerEm: ${upm},
  ascent: ${Math.round(maxAscent)},
  descent: ${Math.round(maxDescent)},
  capHeight: ${cap},
  penWidth: ${PEN_WIDTH},
  penPasses: 2,
  glyphs: {
${entries}
  },
};
`,
);
console.log(
  `wrote ${OUT}: ${Object.keys(glyphs).length} glyphs (${hand} written by hand, ${tiles} tiles replaced), ascent ${Math.round(maxAscent)}, descent ${Math.round(maxDescent)}, capHeight ${cap}`,
);
