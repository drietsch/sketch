/**
 * Draws the documentation's pictures from the documentation's own code.
 *
 * Every ```ts block in the README and docs/for-agents.md that is preceded by
 *
 *   <!-- render: name [size=WxH] [crop=x,y,w,h] [at=end|end-<ms>|<ms>] [animate] [fps=15] [hold=2000] -->
 *
 * is run against the built package and its demo written to
 * docs/images/<name>.svg: one frame (at `at`, default the end of the
 * timeline), or with `animate` every frame of the timeline as one looping,
 * self-contained animated SVG. `size` sets the page of a block that does
 * not call createDemo itself (default 900x600); `crop` trims the document to
 * a region.
 *
 * Output is deterministic, so `--check` regenerates in memory and fails if a
 * picture on disk no longer matches the code beside it, or if the page does
 * not show the picture. Requires `pnpm build` first.
 *
 *   pnpm run docs:images          write docs/images/*.svg
 *   pnpm run verify:images        fail if any of them is stale
 */
import { existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { docBlocks, runBlock } from './lib/doc-blocks.mjs';

const OUT = 'docs/images';
const FILES = ['README.md', 'docs/for-agents.md'];
const check = process.argv.includes('--check');
const problems = [];
const written = new Set();

/** Splits an SVG document into its root's opening tag and its top-level children. */
function topLevel(svg) {
  const open = svg.slice(0, svg.indexOf('>') + 1);
  const inner = svg.slice(open.length, svg.lastIndexOf('</svg>'));
  const out = [];
  let depth = 0;
  let start = 0;
  for (const m of inner.matchAll(/<(\/?)[a-zA-Z][^>]*?(\/?)>/g)) {
    if (m[1]) depth -= 1;
    else if (!m[2]) depth += 1;
    if (depth === 0) {
      out.push(inner.slice(start, m.index + m[0].length));
      start = m.index + m[0].length;
    }
  }
  return { open, children: out };
}

const keyOf = (el) => /data-key="([^"]*)"/.exec(el)?.[1] ?? el.slice(0, el.indexOf(' '));

/** Gives every element id inside `el` a suffix, so two versions of one group never share an id. */
const suffixIds = (el, suffix) => el.replace(/(id="|url\(#)(clip-[a-z0-9]+)/g, `$1$2${suffix}`);

/** The root tag, cropped to `crop` when given. */
function root(open, crop) {
  if (!crop) return open;
  const [x, y, w, h] = crop.split(',').map(Number);
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="${x} ${y} ${w} ${h}">`;
}

function still(demo, opts) {
  // `end`, `end-80` or a time in ms.
  const m = /^end(-\d+)?$/.exec(opts.at ?? 'end');
  const at = m ? demo.duration + Number(m[1] ?? 0) : Number(opts.at);
  const { open, children } = topLevel(demo.toSVG(at));
  return `${root(open, opts.crop)}${children.join('')}</svg>\n`;
}

/**
 * Every frame of the timeline in one SVG. Each distinct top-level group is
 * written once, in z-order, and shown only while some frame contains it, by a
 * discrete SMIL animation on its visibility. The loop holds the last frame for
 * `hold` ms before starting over.
 */
function animated(demo, opts) {
  const fps = Number(opts.fps ?? 15);
  const hold = Number(opts.hold ?? 2000);
  const step = 1000 / fps;
  const times = [];
  for (let t = 0; t < demo.duration; t += step) times.push(t);
  times.push(demo.duration);
  const shown = times.map((t, i) => (i === times.length - 1 ? hold : Math.min(step, times[i + 1] - t)));
  const total = shown.reduce((a, b) => a + b, 0);
  const starts = shown.map((_, i) => shown.slice(0, i).reduce((a, b) => a + b, 0) / total);

  let open = '';
  const order = []; // keys, back to front
  const versions = new Map(); // key -> Map(element -> Set(frame index))
  times.forEach((t, f) => {
    const frame = topLevel(demo.toSVG(t));
    open = frame.open;
    let prev = -1;
    for (const el of frame.children) {
      const key = keyOf(el);
      let at = order.indexOf(key);
      if (at === -1) {
        order.splice(prev + 1, 0, key);
        at = prev + 1;
        versions.set(key, new Map());
      }
      prev = Math.max(prev, at);
      const v = versions.get(key);
      if (!v.has(el)) v.set(el, new Set());
      v.get(el).add(f);
    }
  });

  const dur = `${(total / 1000).toFixed(3)}s`;
  const parts = [];
  for (const key of order) {
    [...versions.get(key)].forEach(([el, frames], n) => {
      const body = suffixIds(el, `-v${n}`);
      if (frames.size === times.length) return parts.push(body);
      const values = [];
      const keyTimes = [];
      times.forEach((_, f) => {
        const v = frames.has(f) ? 'visible' : 'hidden';
        if (values.at(-1) !== v) {
          values.push(v);
          keyTimes.push(+starts[f].toFixed(5));
        }
      });
      parts.push(
        `<g visibility="hidden"><animate attributeName="visibility" values="${values.join(';')}" keyTimes="${keyTimes.join(';')}" calcMode="discrete" dur="${dur}" repeatCount="indefinite"/>${body}</g>`,
      );
    });
  }
  return `${root(open, opts.crop)}${parts.join('')}</svg>\n`;
}

for (const file of FILES) {
  const page = readFileSync(file, 'utf8');
  for (const block of docBlocks(file)) {
    if (!block.render) continue;
    const { name } = block.render;
    const path = `${OUT}/${name}.svg`;
    const label = `${file} block ${block.index} -> ${path}`;
    if (written.has(name)) {
      problems.push(`${label}: name used twice`);
      continue;
    }
    written.add(name);
    let svg;
    try {
      const [width, height] = (block.render.size ?? '900x600').split('x').map(Number);
      const demo = runBlock(block, { width, height });
      svg = 'animate' in block.render ? animated(demo, block.render) : still(demo, block.render);
      // A demo created without a seed gets a random one, and its picture would
      // change on every run. Running the block again shows it.
      if (runBlock(block, { width, height }).toSVG(0) !== demo.toSVG(0)) {
        throw new Error('draws differently on every run; give createDemo a seed');
      }
    } catch (e) {
      problems.push(`${label}: ${e.message}`);
      continue;
    }
    if (!page.includes(`${name}.svg)`)) problems.push(`${label}: ${file} does not show the picture`);
    if (check) {
      const current = existsSync(path) ? readFileSync(path, 'utf8') : '';
      if (current !== svg) problems.push(`${label}: stale, run pnpm run docs:images`);
      else console.log(`  ok    ${label}`);
    } else {
      mkdirSync(OUT, { recursive: true });
      writeFileSync(path, svg);
      console.log(`  wrote ${label} (${(svg.length / 1024).toFixed(0)} KB)`);
    }
  }
}

// A picture nothing draws any more is dead weight.
if (existsSync(OUT)) {
  for (const f of readdirSync(OUT)) {
    if (f.endsWith('.svg') && !written.has(f.slice(0, -4))) problems.push(`${OUT}/${f}: no block renders it`);
  }
}

if (problems.length) {
  problems.forEach((p) => console.log(`  FAIL  ${p}`));
  process.exit(1);
}
console.log(`\n${written.size} documentation pictures ${check ? 'up to date' : 'written'}`);
