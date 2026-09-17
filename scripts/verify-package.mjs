/**
 * Packs the tarball, installs it into a throwaway project, and exercises it the
 * way a real consumer would.
 *
 * This exists because the cheaper gates do not catch everything: publint and
 * attw both reported "no problems" on a build whose output still contained four
 * bare imports to packages that are not dependencies -- an uninstallable
 * package. Only installing and running it surfaces that class of mistake.
 *
 * Requires `pnpm build` first. Run with: pnpm run verify:package
 */
import { execFileSync } from 'node:child_process';
import { mkdtempSync, writeFileSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const run = (cmd, args, cwd) => execFileSync(cmd, args, { cwd, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] });

const dir = mkdtempSync(join(tmpdir(), 'sketchdemo-consumer-'));
let failed = false;
const check = (label, ok, detail = '') => {
  console.log(`  ${ok ? 'ok  ' : 'FAIL'}  ${label}${detail ? '  ' + detail : ''}`);
  if (!ok) failed = true;
};

try {
  // --ignore-scripts: prepack triggers the build, whose stdout would otherwise
  // be interleaved with the --json output this parses. The caller builds first.
  const packed = JSON.parse(
    run('npm', ['pack', '--json', '--ignore-scripts', '--pack-destination', dir], process.cwd()),
  );
  const tarball = join(dir, packed[0].filename);

  // Nothing beyond the build output and docs may ship.
  const forbidden = ['src/', 'test/', 'scripts/', 'examples/', 'docs/', 'vendor/', '.github/', 'tsconfig.json'];
  const leaked = packed[0].files.map((f) => f.path).filter((f) => forbidden.some((p) => f.startsWith(p)));
  check('tarball contains no source, tests or config', leaked.length === 0, leaked.join(', '));

  writeFileSync(join(dir, 'package.json'), JSON.stringify({ name: 'consumer', type: 'module', private: true }));
  run('npm', ['install', '--no-audit', '--no-fund', tarball], dir);

  writeFileSync(
    join(dir, 'esm.mjs'),
    `import { RoughGenerator, Random, SVGNS } from '@drietsch/sketchdemo';
     const g = new RoughGenerator({ seed: 42 });
     const d = g.rectangle(10, 10, 80, 60, { fill: 'red', fillStyle: 'dots' });
     const ok = [RoughGenerator, Random, SVGNS].every(Boolean)
       && d.sets.length > 0 && g.toPaths(d).length > 0 && d.options.seed === 42;
     if (!ok) { console.error('esm surface broken'); process.exit(1); }
     console.log('ESM_OK');`,
  );
  check('ESM import works', run('node', ['esm.mjs'], dir).includes('ESM_OK'));

  // Node has supported require() of an ES module since 22.12, so an ESM-only
  // package is still requireable on every version this package supports. The
  // README says so; this keeps that claim honest.
  writeFileSync(
    join(dir, 'cjs.cjs'),
    `const m = require('@drietsch/sketchdemo');
     const g = new m.RoughGenerator({ seed: 1 });
     if (!g.rectangle(0, 0, 10, 10).sets.length) { console.error('cjs broken'); process.exit(1); }
     console.log('CJS_OK:' + Object.keys(m).sort().join(','));`,
  );
  const cjs = run('node', ['cjs.cjs'], dir);
  check('require() works on this Node', cjs.includes('CJS_OK'));

  const types = readFileSync(join(dir, 'node_modules/@drietsch/sketchdemo/dist/index.d.ts'), 'utf8');
  check('type declarations ship', types.includes('RoughGenerator') && types.includes('FillStyle'));

  const bundle = readFileSync(join(dir, 'node_modules/@drietsch/sketchdemo/dist/index.js'), 'utf8');
  const bare = [...bundle.matchAll(/^import .* from ["']([^.][^"']*)["']/gm)].map((m) => m[1]);
  check('bundle has no unresolved bare imports', bare.length === 0, bare.join(', '));
  check(
    'package declares no runtime dependencies',
    !JSON.parse(readFileSync(join(dir, 'node_modules/@drietsch/sketchdemo/package.json'), 'utf8')).dependencies,
  );
} finally {
  rmSync(dir, { recursive: true, force: true });
}

if (failed) process.exitCode = 1;
else console.log('\ninstalled package verified');
