/**
 * Smoke-checks every page under visual-tests/ in a real browser.
 *
 * These 50 pages are the project's only manual verification, and they were
 * broken long before this fork: each imported `bin/rough.js`, whose extensionless
 * relative imports 404 in a native module loader. They now load the built bundle
 * and use the v5 API.
 *
 * This is NOT visual regression -- it captures no baselines and compares no
 * pixels. It answers a narrower question: does every page load, execute without
 * a console or page error, and actually put something on the canvas or into the
 * SVG? That is enough to catch a broken build, a bad export, or an API change
 * that silently stops rendering.
 *
 * Requires `pnpm build` first. Run with: pnpm run verify:pages
 */
import { chromium } from '@playwright/test';
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { extname, join, normalize } from 'node:path';
import { execSync } from 'node:child_process';

const ROOT = process.cwd();
const TYPES = {
  '.html': 'text/html',
  '.js': 'text/javascript',
  '.json': 'application/json',
  '.map': 'application/json',
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

const pages = execSync('find visual-tests -name "*.html"').toString().trim().split('\n').sort();

// Interactive playgrounds that deliberately render nothing until driven.
const INTERACTIVE = new Set(['visual-tests/canvas/path5.html']);
const browser = await chromium.launch();
const ctx = await browser.newContext();

let ok = 0;
const failures = [];
for (const rel of pages) {
  const page = await ctx.newPage();
  const errors = [];
  page.on('pageerror', (e) => errors.push(String(e).split('\n')[0]));
  page.on('console', (m) => {
    if (m.type() === 'error') errors.push(m.text().slice(0, 120));
  });
  try {
    await page.goto(`http://localhost:${port}/${rel}`, { waitUntil: 'networkidle', timeout: 20000 });
    // Did anything actually get drawn?
    const drew = await page.evaluate(() => {
      // Some pages render into a custom element's shadow root, so a
      // document-level query is not enough.
      const findAll = (sel) => {
        const out = [];
        const walk = (root) => {
          out.push(...root.querySelectorAll(sel));
          for (const el of root.querySelectorAll('*')) if (el.shadowRoot) walk(el.shadowRoot);
        };
        walk(document);
        return out;
      };
      for (const c of findAll('canvas')) {
        const d = c.getContext('2d').getImageData(0, 0, c.width, c.height).data;
        for (let i = 3; i < d.length; i += 4) if (d[i] !== 0) return true;
      }
      return findAll('svg').some((s) => s.querySelectorAll('path').length > 0);
    });
    if (errors.length) failures.push(`${rel}: ${errors[0]}`);
    else if (!drew && !INTERACTIVE.has(rel)) failures.push(`${rel}: rendered nothing`);
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
