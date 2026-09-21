/**
 * Writes an outline font as the strokes a pen made. A monoline handwriting
 * face is one where every letter is one or a few pen movements of roughly
 * even width, so the centreline of each filled shape is the path the pen
 * took. Each glyph is rasterised, thinned to that centreline, traced into
 * polylines, pruned of the spurs thinning leaves at stroke ends, smoothed,
 * simplified and split where the pen turned a corner. The renderer then draws
 * each stroke the way a hand writes it, as one smooth line, and emphasis is
 * the same stroke written over again.
 *
 * The package's own face, Handodle, is not monoline and is kept as outlines
 * (gen-outline-font.mjs); this is for a document that brings a monoline face
 * of its own. Run with:
 *   node scripts/gen-stroke-font.mjs --src some.ttf --out some.ts --name some [--caps] [--debug]
 * --caps writes the face in capitals; --debug also writes
 * samples/stroke-font-debug.html, every glyph's strokes over its outline.
 */
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import opentype from 'opentype.js';

const arg = (flag, fallback) => {
  const i = process.argv.indexOf(flag);
  return i === -1 ? fallback : process.argv[i + 1];
};
const SRC = arg('--src');
const OUT = arg('--out');
const NAME = arg('--name');
if (!SRC || !OUT || !NAME) {
  console.error('usage: node scripts/gen-stroke-font.mjs --src some.ttf --out some.ts --name some [--caps] [--debug]');
  process.exit(1);
}
const UPPERCASE = process.argv.includes('--caps');
const EXPORT = NAME.toUpperCase().replace(/[^A-Z0-9]+/g, '_');
const DEBUG = process.argv.includes('--debug');
const STATS = process.argv.includes('--stats');

/** Pixels per font unit when a glyph is rasterised. Higher is slower and finer. */
const SCALE = 0.5;
/** Blank border around the bitmap, so thinning never touches the edge. */
const PAD = 4;
/**
 * Douglas-Peucker tolerance for the traced centreline, in px. Coarse on
 * purpose: the renderer draws a smooth spline through the points, and the
 * fewer there are, the longer and calmer the hand's deviations come out.
 */
const SIMPLIFY = 4.5;
/** A branch to a stroke end shorter than this fraction of the pen width is thinning debris. */
const SPUR = 0.9;
/** After a split at a corner, a piece shorter than this fraction of the pen width is a hook, not a stroke. */
const STUB = 0.6;
/** A turn sharper than this, in degrees, ends one stroke and starts the next. */
const CORNER = 70;
/** Segments shorter than this, in px, are too short to judge a corner by. */
const CORNER_LEG = 4;
/** No pen in a handwriting face is wider than this, in px; a glyph that measures wider is a blob. */
const PEN_CAP = 40;

const font = opentype.parse(readFileSync(SRC).buffer.slice(0));
const upm = font.unitsPerEm;

/** Characters to include, before upper-case folding; the same set the outline generator used. */
const wanted = new Set();
for (let c = 32; c <= 126; c++) wanted.add(String.fromCharCode(c));
for (let c = 0xc0; c <= 0xff; c++) wanted.add(String.fromCharCode(c));
for (const ch of '¡¢£¥§©«®°±·»¿') wanted.add(ch);
for (const ch of '‘’‚“”„–—…•‹›™€←↑→↓✓ ') wanted.add(ch);

const fold = (ch) => {
  if (!UPPERCASE) return ch;
  const up = ch.toUpperCase();
  return [...up].length === 1 ? up : ch;
};

// ---------------------------------------------------------------------------
// Outline to polygons

/** Flattens path commands (y down) into rings of [x, y] in font units. */
function flatten(commands) {
  const rings = [];
  let ring = null;
  let cx = 0;
  let cy = 0;
  const bezier = (pts) => {
    const len = pts.slice(1).reduce((s, p, i) => s + Math.hypot(p[0] - pts[i][0], p[1] - pts[i][1]), 0);
    const n = Math.max(6, Math.min(48, Math.ceil((len * SCALE) / 2)));
    for (let i = 1; i <= n; i++) {
      const t = i / n;
      let p = pts;
      while (p.length > 1)
        p = p.slice(1).map((q, j) => [p[j][0] + (q[0] - p[j][0]) * t, p[j][1] + (q[1] - p[j][1]) * t]);
      ring.push(p[0]);
    }
  };
  for (const c of commands) {
    if (c.type === 'M') {
      ring = [[c.x, c.y]];
      rings.push(ring);
    } else if (c.type === 'L') ring.push([c.x, c.y]);
    else if (c.type === 'Q')
      bezier([
        [cx, cy],
        [c.x1, c.y1],
        [c.x, c.y],
      ]);
    else if (c.type === 'C')
      bezier([
        [cx, cy],
        [c.x1, c.y1],
        [c.x2, c.y2],
        [c.x, c.y],
      ]);
    if (c.type !== 'Z') {
      cx = c.x;
      cy = c.y;
    }
  }
  return rings.filter((r) => r.length > 2);
}

/** Fills the rings (non-zero winding) into a bitmap; returns it with its origin in font units. */
function rasterise(rings) {
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  for (const r of rings) {
    for (const [x, y] of r) {
      minX = Math.min(minX, x);
      minY = Math.min(minY, y);
      maxX = Math.max(maxX, x);
      maxY = Math.max(maxY, y);
    }
  }
  const w = Math.ceil((maxX - minX) * SCALE) + 2 * PAD;
  const h = Math.ceil((maxY - minY) * SCALE) + 2 * PAD;
  const px = (x) => (x - minX) * SCALE + PAD;
  const py = (y) => (y - minY) * SCALE + PAD;
  const bits = new Uint8Array(w * h);
  const edges = [];
  for (const r of rings) {
    for (let i = 0; i < r.length; i++) {
      const a = r[i];
      const b = r[(i + 1) % r.length];
      edges.push([px(a[0]), py(a[1]), px(b[0]), py(b[1])]);
    }
  }
  for (let row = 0; row < h; row++) {
    const y = row + 0.5;
    const xs = [];
    for (const [x1, y1, x2, y2] of edges) {
      if (y1 === y2) continue;
      const down = y2 > y1;
      const [ya, yb] = down ? [y1, y2] : [y2, y1];
      if (y < ya || y >= yb) continue;
      const t = (y - y1) / (y2 - y1);
      xs.push([x1 + (x2 - x1) * t, down ? 1 : -1]);
    }
    xs.sort((a, b) => a[0] - b[0]);
    let wind = 0;
    for (let i = 0; i < xs.length - 1; i++) {
      wind += xs[i][1];
      if (wind === 0) continue;
      const from = Math.max(0, Math.ceil(xs[i][0] - 0.5));
      const to = Math.min(w - 1, Math.floor(xs[i + 1][0] - 0.5));
      for (let col = from; col <= to; col++) bits[row * w + col] = 1;
    }
  }
  return { bits, w, h, minX, minY };
}

const N8 = [
  [-1, -1],
  [0, -1],
  [1, -1],
  [-1, 0],
  [1, 0],
  [-1, 1],
  [0, 1],
  [1, 1],
];

// ---------------------------------------------------------------------------
// Thinning (Zhang-Suen)

function thin(bm) {
  const { w, h } = bm;
  const bits = Uint8Array.from(bm.bits);
  const at = (x, y) => (x < 0 || y < 0 || x >= w || y >= h ? 0 : bits[y * w + x]);
  let changed = true;
  while (changed) {
    changed = false;
    for (const step of [0, 1]) {
      const kill = [];
      for (let y = 1; y < h - 1; y++) {
        for (let x = 1; x < w - 1; x++) {
          if (!bits[y * w + x]) continue;
          const p2 = at(x, y - 1);
          const p3 = at(x + 1, y - 1);
          const p4 = at(x + 1, y);
          const p5 = at(x + 1, y + 1);
          const p6 = at(x, y + 1);
          const p7 = at(x - 1, y + 1);
          const p8 = at(x - 1, y);
          const p9 = at(x - 1, y - 1);
          const ring = [p2, p3, p4, p5, p6, p7, p8, p9];
          const b = ring.reduce((s, v) => s + v, 0);
          if (b < 2 || b > 6) continue;
          let a = 0;
          for (let i = 0; i < 8; i++) if (ring[i] === 0 && ring[(i + 1) % 8] === 1) a++;
          if (a !== 1) continue;
          const c1 = step === 0 ? p2 * p4 * p6 : p2 * p4 * p8;
          const c2 = step === 0 ? p4 * p6 * p8 : p2 * p6 * p8;
          if (c1 !== 0 || c2 !== 0) continue;
          kill.push(y * w + x);
        }
      }
      for (const i of kill) bits[i] = 0;
      if (kill.length) changed = true;
    }
  }
  return tidy({ ...bm, bits });
}

/**
 * Zhang-Suen leaves 8-connected staircases: along a diagonal, corner pixels
 * that touch three others, which read as junctions. A pixel whose foreground
 * neighbours stay one connected group without it, and which is not a stroke
 * end, adds nothing; removing those until none are left gives a skeleton that
 * is one pixel wide in every direction.
 */
function tidy(bm) {
  const { w, h, bits } = bm;
  const on = (x, y) => x >= 0 && y >= 0 && x < w && y < h && bits[y * w + x] === 1;
  const simple = (x, y) => {
    const ns = N8.map(([dx, dy]) => [x + dx, y + dy]).filter(([nx, ny]) => on(nx, ny));
    if (ns.length < 2) return false;
    // Components among the neighbours, by 8-adjacency between them.
    const seen = new Set([0]);
    const stack = [0];
    while (stack.length) {
      const i = stack.pop();
      ns.forEach((q, j) => {
        if (!seen.has(j) && Math.abs(q[0] - ns[i][0]) <= 1 && Math.abs(q[1] - ns[i][1]) <= 1) {
          seen.add(j);
          stack.push(j);
        }
      });
    }
    return seen.size === ns.length;
  };
  let changed = true;
  while (changed) {
    changed = false;
    for (let y = 1; y < h - 1; y++) {
      for (let x = 1; x < w - 1; x++) {
        if (on(x, y) && simple(x, y)) {
          bits[y * w + x] = 0;
          changed = true;
        }
      }
    }
  }
  return bm;
}

// ---------------------------------------------------------------------------
// Tracing the skeleton into strokes

/**
 * Turns a 1px skeleton into a graph: nodes are stroke ends and junctions (a
 * junction may be a small cluster of pixels), edges the pixel chains between
 * them. Closed loops with no node get one made at an arbitrary pixel.
 */
function trace(sk) {
  const { bits, w, h } = sk;
  const on = (x, y) => x >= 0 && y >= 0 && x < w && y < h && bits[y * w + x] === 1;
  const neighbours = (x, y) => N8.map(([dx, dy]) => [x + dx, y + dy]).filter(([nx, ny]) => on(nx, ny));
  const degree = new Map();
  const pixels = [];
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      if (!on(x, y)) continue;
      pixels.push([x, y]);
      degree.set(y * w + x, neighbours(x, y).length);
    }
  }
  // Junction pixels that touch form one node.
  const nodeOf = new Map();
  const nodes = [];
  const addNode = (members) => {
    const id = nodes.length;
    nodes.push({ id, members, x: 0, y: 0, edges: [] });
    for (const [x, y] of members) nodeOf.set(y * w + x, id);
    const n = nodes[id];
    n.x = members.reduce((s, [x]) => s + x, 0) / members.length;
    n.y = members.reduce((s, [, y]) => s + y, 0) / members.length;
    return id;
  };
  for (const [x, y] of pixels) {
    const d = degree.get(y * w + x);
    if (d === 2 || nodeOf.has(y * w + x)) continue;
    if (d < 3) {
      addNode([[x, y]]);
      continue;
    }
    const members = [];
    const stack = [[x, y]];
    const seen = new Set([y * w + x]);
    while (stack.length) {
      const [px, py] = stack.pop();
      members.push([px, py]);
      for (const [nx, ny] of neighbours(px, py)) {
        const k = ny * w + nx;
        if (degree.get(k) >= 3 && !seen.has(k)) {
          seen.add(k);
          stack.push([nx, ny]);
        }
      }
    }
    addNode(members);
  }
  const edges = [];
  const visited = new Set();
  const walk = (fromNode, sx, sy) => {
    const points = [[nodes[fromNode].x, nodes[fromNode].y]];
    let prevKey = -1;
    let [x, y] = [sx, sy];
    for (;;) {
      const key = y * w + x;
      if (nodeOf.has(key)) {
        const to = nodeOf.get(key);
        points.push([nodes[to].x, nodes[to].y]);
        return { from: fromNode, to, points };
      }
      visited.add(key);
      points.push([x, y]);
      const next = neighbours(x, y).filter(([nx, ny]) => {
        const k = ny * w + nx;
        return k !== prevKey && !(visited.has(k) && !nodeOf.has(k));
      });
      // Prefer a node when one is adjacent, else the unvisited continuation;
      // from a node's own member back to itself is not a way out.
      const cand = next.filter(([nx, ny]) => nodeOf.get(ny * w + nx) !== fromNode || points.length > 2);
      if (!cand.length) return { from: fromNode, to: -1, points };
      prevKey = key;
      [x, y] = cand.find(([nx, ny]) => nodeOf.has(ny * w + nx)) ?? cand[0];
    }
  };
  for (const node of nodes) {
    const starts = [];
    for (const [mx, my] of node.members) {
      for (const [nx, ny] of neighbours(mx, my)) {
        const k = ny * w + nx;
        if (nodeOf.get(k) === node.id) continue;
        if (nodeOf.has(k)) {
          // Two nodes touching directly: a zero-length edge, worth keeping only between distinct nodes.
          const to = nodeOf.get(k);
          if (to > node.id)
            edges.push({
              from: node.id,
              to,
              points: [
                [node.x, node.y],
                [nodes[to].x, nodes[to].y],
              ],
            });
          continue;
        }
        if (!visited.has(k)) starts.push([nx, ny]);
      }
    }
    for (const [sx, sy] of starts) {
      if (visited.has(sy * w + sx)) continue;
      const e = walk(node.id, sx, sy);
      if (e.to === -1) e.to = node.id;
      edges.push(e);
    }
  }
  // Loops with no node at all: start one anywhere on the loop.
  for (const [x, y] of pixels) {
    const key = y * w + x;
    if (visited.has(key) || nodeOf.has(key)) continue;
    const id = addNode([[x, y]]);
    visited.add(key);
    const [sx, sy] = neighbours(x, y)[0];
    const e = walk(id, sx, sy);
    e.to = id;
    e.closed = true;
    edges.push(e);
  }
  for (const e of edges) {
    nodes[e.from].edges.push(e);
    if (e.to !== e.from) nodes[e.to].edges.push(e);
  }
  return { nodes, edges };
}

const length = (pts) => pts.slice(1).reduce((s, p, i) => s + Math.hypot(p[0] - pts[i][0], p[1] - pts[i][1]), 0);

/** Drops the short branches thinning grows at stroke ends, then joins what is left through any node with two edges. */
function prune(graph, pen) {
  const { nodes } = graph;
  let { edges } = graph;
  const isEnd = (n) => n.members.length === 1 && n.edges.length === 1;
  for (let round = 0; round < 3; round++) {
    const drop = new Set();
    for (const e of edges) {
      const a = nodes[e.from];
      const b = nodes[e.to];
      if (e.from === e.to) continue;
      const spur = (isEnd(a) && b.edges.length >= 3) || (isEnd(b) && a.edges.length >= 3);
      if (spur && length(e.points) < pen * SPUR) drop.add(e);
    }
    if (!drop.size) break;
    edges = edges.filter((e) => !drop.has(e));
    for (const n of nodes) n.edges = n.edges.filter((e) => !drop.has(e));
  }
  // Where the pen passed through a node it did not lift: two edges are joined
  // when one continues the other. With two edges that is always so (a turn is
  // split later, at the corner); with more, the straightest pair goes first
  // and only pairs that turn less than a corner are joined at all.
  const join = (n, a, b) => {
    const ap = a.to === n.id ? a.points : a.points.toReversed();
    const bp = b.from === n.id ? b.points : b.points.toReversed();
    const joined = {
      from: ap === a.points ? a.from : a.to,
      to: bp === b.points ? b.to : b.from,
      points: [...ap, ...bp.slice(1)],
    };
    edges = edges.filter((e) => e !== a && e !== b);
    edges.push(joined);
    for (const m of nodes) m.edges = m.edges.filter((e) => e !== a && e !== b);
    nodes[joined.from].edges.push(joined);
    if (joined.to !== joined.from) nodes[joined.to].edges.push(joined);
    if (joined.from === joined.to) joined.closed = true;
  };
  // The direction an edge leaves a node in, taken a pen's width along it.
  const heading = (n, e) => {
    const pts = e.from === n.id ? e.points : e.points.toReversed();
    let d = 0;
    for (let i = 1; i < pts.length; i++) {
      d += Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]);
      if (d >= pen * 1.5 || i === pts.length - 1) {
        const v = [pts[i][0] - pts[0][0], pts[i][1] - pts[0][1]];
        const l = Math.hypot(...v) || 1;
        return [v[0] / l, v[1] / l];
      }
    }
    return [1, 0];
  };
  for (const n of nodes) {
    for (;;) {
      const own = n.edges.filter((e) => e.from !== e.to);
      if (own.length < 2) break;
      if (own.length === 2 && n.edges.length === 2) {
        join(n, own[0], own[1]);
        break;
      }
      let best = null;
      for (let i = 0; i < own.length; i++) {
        for (let j = i + 1; j < own.length; j++) {
          const [a, b] = [heading(n, own[i]), heading(n, own[j])];
          // Straight through is a turn of 0: the headings point opposite ways.
          const turn = (Math.acos(Math.max(-1, Math.min(1, -(a[0] * b[0] + a[1] * b[1])))) * 180) / Math.PI;
          if (turn < CORNER && (!best || turn < best.turn)) best = { turn, a: own[i], b: own[j] };
        }
      }
      if (!best) break;
      join(n, best.a, best.b);
    }
  }
  return edges;
}

// ---------------------------------------------------------------------------
// Polyline clean-up

function smooth(pts) {
  if (pts.length < 5) return pts;
  const out = [pts[0]];
  for (let i = 1; i < pts.length - 1; i++) {
    const a = pts[i - 1];
    const b = pts[i];
    const c = pts[i + 1];
    out.push([(a[0] + 2 * b[0] + c[0]) / 4, (a[1] + 2 * b[1] + c[1]) / 4]);
  }
  out.push(pts.at(-1));
  return out;
}

function simplify(pts, tol) {
  if (pts.length < 3) return pts;
  const [a, b] = [pts[0], pts.at(-1)];
  let maxD = 0;
  let idx = 0;
  const dx = b[0] - a[0];
  const dy = b[1] - a[1];
  const len = Math.hypot(dx, dy);
  for (let i = 1; i < pts.length - 1; i++) {
    const d =
      len === 0
        ? Math.hypot(pts[i][0] - a[0], pts[i][1] - a[1])
        : Math.abs((pts[i][0] - a[0]) * dy - (pts[i][1] - a[1]) * dx) / len;
    if (d > maxD) {
      maxD = d;
      idx = i;
    }
  }
  if (maxD <= tol) return [a, b];
  return [...simplify(pts.slice(0, idx + 1), tol).slice(0, -1), ...simplify(pts.slice(idx), tol)];
}

/** Splits a polyline where the pen turned sharply; a hand lifts, or at least stops, at a corner. */
function splitCorners(pts) {
  const out = [];
  let cur = [pts[0]];
  for (let i = 1; i < pts.length - 1; i++) {
    const a = pts[i - 1];
    const b = pts[i];
    const c = pts[i + 1];
    cur.push(b);
    const v1 = [b[0] - a[0], b[1] - a[1]];
    const v2 = [c[0] - b[0], c[1] - b[1]];
    const l1 = Math.hypot(...v1);
    const l2 = Math.hypot(...v2);
    if (l1 < CORNER_LEG || l2 < CORNER_LEG) continue;
    const cos = (v1[0] * v2[0] + v1[1] * v2[1]) / (l1 * l2);
    const turn = (Math.acos(Math.max(-1, Math.min(1, cos))) * 180) / Math.PI;
    if (turn > CORNER) {
      out.push(cur);
      cur = [b];
    }
  }
  cur.push(pts.at(-1));
  out.push(cur);
  return out;
}

// ---------------------------------------------------------------------------

/** All of the above for one glyph: its strokes in font units, and the pen width it was written with. */
function strokesOf(commands) {
  const rings = flatten(commands);
  if (!rings.length) return { strokes: [], pen: 0, area: 0 };
  const bm = rasterise(rings);
  const sk = thin(bm);
  const graph = trace(sk);
  const area = bm.bits.reduce((s, v) => s + v, 0);
  const skeleton = graph.edges.reduce((s, e) => s + length(e.points), 0) || 1;
  const pen = area / skeleton;
  // A blob's skeleton is a pixel or two, which makes its pen look enormous; the font's pen is what a dot is measured by.
  const penRef = Math.min(pen, PEN_CAP);
  if (STATS) {
    const px = sk.bits.reduce((s, v) => s + v, 0);
    const degrees = {};
    for (const n of graph.nodes) degrees[n.members.length] = (degrees[n.members.length] ?? 0) + 1;
    console.log(
      `  bitmap ${bm.w}x${bm.h} area ${area} skeleton px ${px} traced ${skeleton.toFixed(0)} nodes ${graph.nodes.length} (cluster sizes ${JSON.stringify(degrees)}) edges ${graph.edges.length} pen ${pen.toFixed(1)}px`,
    );
  }
  const edges = prune(graph, pen);
  const toUnits = ([x, y]) => [Math.round((x - PAD) / SCALE + bm.minX), Math.round((y - PAD) / SCALE + bm.minY)];
  const strokes = [];
  for (const e of edges) {
    let pts = simplify(smooth(e.points), SIMPLIFY);
    if (e.closed && pts.length > 2) pts = [...pts, pts[0]];
    if (length(pts) < penRef * 0.4 && !e.closed) {
      const [cx, cy] = [pts.reduce((s, p) => s + p[0], 0) / pts.length, pts.reduce((s, p) => s + p[1], 0) / pts.length];
      const extent = Math.min(bm.w, bm.h) - 2 * PAD;
      if (edges.length === 1 && extent > 2.5 * penRef) {
        // A blob wider than the pen (a bullet): a small ring, the way a hand makes one.
        const r = extent / 2 - penRef / 2;
        const ring = [];
        for (let i = 0; i <= 8; i++)
          ring.push([cx + r * Math.cos((i / 8) * 2 * Math.PI), cy + r * Math.sin((i / 8) * 2 * Math.PI)]);
        strokes.push(ring.flatMap(toUnits));
      } else {
        // A dot: too short to be a line, drawn as a tick the pen's own width.
        strokes.push([...toUnits([cx - penRef / 4, cy]), ...toUnits([cx + penRef / 4, cy])]);
      }
      continue;
    }
    const pieces = splitCorners(pts);
    for (const piece of pieces) {
      if (piece.length < 2) continue;
      // A stub at a corner is the thinning's rounding of the stroke end, not a movement of the pen.
      if (pieces.length > 1 && length(piece) < penRef * STUB) continue;
      const flat = piece.flatMap(toUnits);
      // Drop repeated points left by rounding.
      const clean = [];
      for (let i = 0; i < flat.length; i += 2) {
        if (clean.length && clean.at(-2) === flat[i] && clean.at(-1) === flat[i + 1]) continue;
        clean.push(flat[i], flat[i + 1]);
      }
      if (clean.length >= 4) strokes.push(clean);
    }
  }
  return { strokes, pen: pen / SCALE, area };
}

const glyphs = {};
const outlines = {};
let maxAscent = 0;
let maxDescent = 0;
/** Per-glyph pen estimates; the median over the letters is the font's. */
const pens = [];
for (const raw of [...wanted].toSorted()) {
  const ch = raw === ' ' ? ' ' : fold(raw);
  if (glyphs[ch]) continue;
  const glyph = font.charToGlyph(ch);
  if (!glyph || glyph.index === 0 || glyph.unicode === undefined) continue;
  const path = glyph.getPath(0, 0, upm);
  if (STATS) {
    if (!'IOH'.includes(ch)) continue;
    console.log(ch);
  }
  const { strokes, pen } = strokesOf(path.commands);
  const box = path.getBoundingBox();
  if (strokes.length) {
    maxAscent = Math.max(maxAscent, -box.y1);
    maxDescent = Math.max(maxDescent, box.y2);
    if (/^[A-Za-z]$/.test(ch)) pens.push(pen);
  }
  glyphs[ch] = [Math.round(glyph.advanceWidth), strokes];
  if (DEBUG) outlines[ch] = path.toPathData(1);
}
const penWidth = Math.round(pens.toSorted((a, b) => a - b)[Math.floor(pens.length / 2)]);
const capHeight = font.tables.os2.sCapHeight ?? -font.charToGlyph('H').getPath(0, 0, upm).getBoundingBox().y1;

// Glyphs the face has no outline for, written by hand in its units: the
// arrows and check mark UI copy reaches for. Sized to the capitals.
const cap = Math.round(capHeight);
const mid = -Math.round(cap * 0.45);
const arrows = {
  '\u2192': [
    620,
    [
      [60, mid, 560, mid],
      [400, mid - 150, 560, mid, 400, mid + 150],
    ],
  ],
  '\u2190': [
    620,
    [
      [560, mid, 60, mid],
      [220, mid - 150, 60, mid, 220, mid + 150],
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
for (const [ch, glyph] of Object.entries(arrows)) if (!glyphs[ch]?.[1].length) glyphs[ch] = glyph;

const entries = Object.entries(glyphs)
  .map(([ch, [advance, strokes]]) => `  ${JSON.stringify(ch)}: [${advance}, ${JSON.stringify(strokes)}],`)
  .join('\n');

writeFileSync(
  OUT,
  `// GENERATED by scripts/gen-stroke-font.mjs from ${SRC}. Do not edit.
//
// The outlines of ${font.names.windows?.fullName?.en ?? NAME} reduced to the strokes the pen made.
// Check the face's licence before shipping this anywhere.
import type { StrokeFontData } from '@drietsch/sketch';

export const ${EXPORT}: StrokeFontData = {
  name: '${NAME}',
  kind: 'stroke',
  uppercase: ${UPPERCASE},
  unitsPerEm: ${upm},
  ascent: ${Math.round(maxAscent)},
  descent: ${Math.round(maxDescent)},
  capHeight: ${Math.round(capHeight)},
  penWidth: ${penWidth},
  glyphs: {
${entries}
  },
};
`,
);
const strokeCount = Object.values(glyphs).reduce((s, [, st]) => s + st.length, 0);
const pointCount = Object.values(glyphs).reduce((s, [, st]) => s + st.reduce((t, p) => t + p.length / 2, 0), 0);
console.log(
  `wrote ${OUT}: ${Object.keys(glyphs).length} glyphs, ${strokeCount} strokes, ${pointCount} points, pen ${penWidth} units, ascent ${Math.round(maxAscent)}, descent ${Math.round(maxDescent)}, capHeight ${capHeight}`,
);

if (DEBUG) {
  const cell = 220;
  const cols = 12;
  const keys = Object.keys(glyphs);
  const rows = Math.ceil(keys.length / cols);
  const s = cell / (upm * 1.3);
  let svg = '';
  keys.forEach((ch, i) => {
    const [advance, strokes] = glyphs[ch];
    const ox = (i % cols) * cell + 20;
    const oy = Math.floor(i / cols) * cell + cell * 0.72;
    svg += `<g transform="translate(${ox} ${oy}) scale(${s})">`;
    svg += `<path d="${outlines[ch]}" fill="#dfe3ea"/>`;
    for (const st of strokes) {
      const pts = [];
      for (let j = 0; j < st.length; j += 2) pts.push(`${st[j]},${st[j + 1]}`);
      svg += `<polyline points="${pts.join(' ')}" fill="none" stroke="#d33" stroke-width="${penWidth * 0.35}" stroke-linecap="round" stroke-linejoin="round"/>`;
      svg += `<circle cx="${st[0]}" cy="${st[1]}" r="${penWidth * 0.3}" fill="#25a"/>`;
    }
    svg += `<line x1="0" y1="0" x2="${advance}" y2="0" stroke="#bbb" stroke-width="4"/></g>`;
    svg += `<text x="${ox}" y="${oy + cell * 0.22}" font-size="12" font-family="monospace" fill="#888">${ch === '<' ? '&lt;' : ch === '&' ? '&amp;' : ch} ${strokes.length}s ${strokes.reduce((t, p) => t + p.length / 2, 0)}p</text>`;
  });
  mkdirSync('samples', { recursive: true });
  writeFileSync(
    'samples/stroke-font-debug.html',
    `<!doctype html><meta charset="utf-8"><title>stroke font debug</title><body style="margin:0;background:#fff"><svg width="${cols * cell + 40}" height="${rows * cell + 40}" xmlns="http://www.w3.org/2000/svg">${svg}</svg>`,
  );
  console.log('wrote samples/stroke-font-debug.html');
}
