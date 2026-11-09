/**
 * Runs every TypeScript code block in docs/for-agents.md and the README
 * against the built package, so the documentation cannot drift from the API.
 *
 * A block that does not create its own demo runs against a fresh 900x600
 * one; a block is expected to run without throwing, compile its timeline and
 * render its final frame. Blocks marked `<!-- no-run -->` on the line before
 * are skipped. Requires `pnpm build` first. Run with: pnpm run verify:docs
 */
import { docBlocks, runBlock, sketch } from './lib/doc-blocks.mjs';

const files = ['docs/for-agents.md', 'README.md'];
let failed = false;
let ran = 0;

for (const file of files) {
  for (const block of docBlocks(file)) {
    if (block.skip) continue;
    const label = `${file} block ${block.index}`;
    try {
      const demo = runBlock(block);
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
  }
}

if (failed) {
  console.error('\ndocumentation examples do not run');
  process.exit(1);
}
console.log(`\n${ran} documentation examples ran`);
