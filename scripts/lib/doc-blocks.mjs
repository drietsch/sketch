/**
 * Finds and runs the TypeScript code blocks of a Markdown file against the
 * built package. Shared by verify-docs (does every block run?) and
 * render-docs (what does every marked block draw?).
 *
 * A block may be preceded by one HTML comment:
 *   <!-- no-run -->                 skipped entirely
 *   <!-- render: name key=value --> run, and its demo drawn to docs/images/name.svg
 */
import { readFileSync } from 'node:fs';
import { pathToFileURL } from 'node:url';

export const sketch = await import(pathToFileURL(`${process.cwd()}/dist/index.js`).href);

/** Every ```ts block of `file`, with the directive that precedes it, if any. */
export function docBlocks(file) {
  const text = readFileSync(file, 'utf8');
  const re = /(?:<!--\s*(no-run|render:[^>]*?)\s*-->\s*)?```ts\n([\s\S]*?)```/g;
  return [...text.matchAll(re)].map((m, i) => {
    const directive = m[1] ?? '';
    let render;
    if (directive.startsWith('render:')) {
      const [name, ...opts] = directive.slice('render:'.length).trim().split(/\s+/);
      render = { name, ...Object.fromEntries(opts.map((o) => o.split('='))) };
    }
    return { file, index: i + 1, code: m[2], skip: directive === 'no-run', render };
  });
}

/**
 * Runs a block and returns its demo (or undefined if it never makes one). A
 * block without its own `createDemo(` runs against a fresh demo, 900x600
 * unless the caller asks for another size;
 * lines touching `document` or `window` are dropped, as are imports and
 * type-only declarations.
 */
export function runBlock(block, { width = 900, height = 600 } = {}) {
  let code = block.code;
  code = code.replace(/^import\s.*$/gm, '').replace(/^\s*(export )?(type|interface)\s[\s\S]*?^}\s*$/gm, '');
  const preamble = /createDemo\(/.test(code)
    ? ''
    : `const demo = createDemo({ width: ${width}, height: ${height}, seed: 1 });\n`;
  const body = /document\.|window\./.test(code) ? code.replace(/^.*(document\.|window\.).*$/gm, '') : code;
  const fn = new Function(
    'sketch',
    `const { ${Object.keys(sketch).join(', ')} } = sketch;\n${preamble}${body}\nreturn typeof demo === 'undefined' ? undefined : demo;`,
  );
  return fn(sketch);
}
