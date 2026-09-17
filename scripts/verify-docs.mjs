/**
 * Runs every TypeScript code block in docs/for-agents.md and the README
 * against the built package, so the documentation cannot drift from the API.
 *
 * A block that does not create its own demo runs against a fresh 900x600
 * one; a block is expected to run without throwing, compile its timeline and
 * render its final frame. Blocks marked `<!-- no-run -->` on the line before
 * are skipped. Requires `pnpm build` first. Run with: pnpm run verify:docs
 */
import { readFileSync } from 'node:fs';
import { pathToFileURL } from 'node:url';

const sketch = await import(pathToFileURL(`${process.cwd()}/dist/index.js`).href);
const files = ['docs/for-agents.md', 'README.md'];
let failed = false;
let ran = 0;

for (const file of files) {
  const text = readFileSync(file, 'utf8');
  const blocks = [...text.matchAll(/(<!-- no-run -->\s*)?```ts\n([\s\S]*?)```/g)];
  blocks.forEach((m, i) => {
    if (m[1]) return;
    let code = m[2];
    // Imports resolve to the built package; type-only lines are dropped.
    code = code.replace(/^import\s.*$/gm, '').replace(/^\s*(export )?(type|interface)\s[\s\S]*?^}\s*$/gm, '');
    const preamble = /createDemo\(/.test(code)
      ? ''
      : 'const demo = createDemo({ width: 900, height: 600, seed: 1 });\n';
    const usesDom = /document\.|window\./.test(code);
    const body = usesDom ? code.replace(/^.*(document\.|window\.).*$/gm, '') : code;
    const label = `${file} block ${i + 1}`;
    try {
      const fn = new Function(
        'sketch',
        `const { ${Object.keys(sketch).join(', ')} } = sketch;\n${preamble}${body}\nreturn typeof demo === 'undefined' ? undefined : demo;`,
      );
      const demo = fn(sketch);
      if (demo) {
        demo.toSVG(0);
        demo.toSVG(demo.duration);
        sketch.loadDemo(demo.toJSON());
      }
      ran += 1;
      console.log(`  ok    ${label}`);
    } catch (e) {
      failed = true;
      console.log(`  FAIL  ${label}: ${e.message}`);
    }
  });
}

if (failed) {
  console.error('\ndocumentation examples do not run');
  process.exit(1);
}
console.log(`\n${ran} documentation examples ran`);
