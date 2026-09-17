/**
 * Smoke-checks every page under examples/ in a real browser.
 *
 * This is NOT visual regression -- it captures no baselines and compares no
 * pixels. It answers a narrower question: does every page load, execute without
 * a console or page error, and actually put something into the SVG? And for
 * pages that expose their demo on `window.__demo`, does every scene node get a
 * group, is the cursor drawn when there is a timeline, and does seeking change
 * the DOM while seeking back restores it byte-for-byte? That is enough to catch
 * a broken build, a bad export, a silent render failure or a leak of
 * non-determinism into the renderer.
 *
 * Requires `pnpm build` first. Run with: pnpm run verify:pages
 */
import { chromium } from '@playwright/test';
import { createServer } from 'node:http';
import { readFile, readdir } from 'node:fs/promises';
import { extname, join, normalize, relative } from 'node:path';

const ROOT = process.cwd();
const TYPES = {
  '.html': 'text/html',
  '.js': 'text/javascript',
  '.css': 'text/css',
  '.json': 'application/json',
  '.map': 'application/json',
  '.svg': 'image/svg+xml',
};

const server = createServer(async (req, res) => {
  try {
    const p = join(ROOT, normalize(decodeURIComponent(req.url.split('?')[0])));
    const body = await readFile(p);
    res.writeHead(200, { 'content-type': TYPES[extname(p)] ?? 'application/octet-stream' });
    res.end(body);
  } catch {
    res.writeHead(404).end('nope');
  }
});
await new Promise((r) => server.listen(0, r));
const port = server.address().port;

const pages = (await readdir(join(ROOT, 'examples'), { recursive: true }))
  .filter((f) => f.endsWith('.html'))
  .map((f) => relative(ROOT, join(ROOT, 'examples', f)))
  .toSorted();

if (pages.length === 0) {
  console.log('no pages found under examples/');
  process.exit(1);
}

const browser = await chromium.launch();
const ctx = await browser.newContext();

let ok = 0;
const failures = [];
// Pages load sequentially on purpose: parallel tabs would distort render timing
// and interleave console output.
for (const rel of pages) {
  const page = await ctx.newPage();
  const errors = [];
  page.on('pageerror', (e) => errors.push(String(e).split('\n')[0]));
  page.on('console', (m) => {
    if (m.type() === 'error') errors.push(m.text().slice(0, 120));
  });
  try {
    await page.goto(`http://localhost:${port}/${rel}`, { waitUntil: 'networkidle', timeout: 20000 });
    const problems = await page.evaluate(() => {
      const out = [];
      const svgs = [...document.querySelectorAll('svg')];
      if (!svgs.some((s) => s.querySelectorAll('path').length > 0)) out.push('rendered nothing');

      const demo = window.__demo;
      if (demo) {
        // Re-query after every seek: a page may replace the whole element.
        const svg = () => document.querySelector('svg');
        // Reserved keys (__focus, __cursor) are chrome, not scene nodes.
        const groups = [...svg().querySelectorAll('g[data-key]')].filter((g) => !g.dataset.key.startsWith('__')).length;
        if (groups !== demo.nodeIds.length) out.push(`expected ${demo.nodeIds.length} node groups, found ${groups}`);
        if (demo.duration > 0) {
          if (!svg().querySelector('g[data-key="__cursor"]')) out.push('no cursor group');
          const a = svg().innerHTML;
          demo.seek(demo.duration / 2);
          const b = svg().innerHTML;
          demo.seek(0);
          const c = svg().innerHTML;
          if (a === b) out.push('seeking did not change the DOM');
          if (a !== c) out.push('seeking back did not restore the DOM');
        }
      }
      return out;
    });
    if (errors.length) failures.push(`${rel}: ${errors[0]}`);
    else if (problems.length) failures.push(`${rel}: ${problems.join('; ')}`);
    else ok++;
  } catch (e) {
    failures.push(`${rel}: ${String(e).split('\n')[0]}`);
  }
  await page.close();
}
await browser.close();
server.close();

console.log(`rendered without error: ${ok}/${pages.length}`);
if (failures.length) {
  console.log('failures:');
  failures.forEach((f) => console.log('  ' + f));
  process.exitCode = 1;
}
