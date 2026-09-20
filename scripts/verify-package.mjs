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

const dir = mkdtempSync(join(tmpdir(), 'sketch-consumer-'));
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

  // Nothing beyond the build output and the two agent-facing docs may ship.
  const forbidden = ['src/', 'test/', 'scripts/', 'examples/', 'docs/', 'vendor/', '.github/', 'tsconfig.json'];
  const allowed = new Set(['docs/API.md', 'docs/for-agents.md']);
  const leaked = packed[0].files
    .map((f) => f.path)
    .filter((f) => !allowed.has(f) && forbidden.some((p) => f.startsWith(p)));
  check('tarball contains no source, tests or config', leaked.length === 0, leaked.join(', '));
  const shipped = packed[0].files.map((f) => f.path);
  check(
    'tarball ships the agent docs',
    [...allowed, 'llms.txt'].every((f) => shipped.includes(f)),
    [...allowed, 'llms.txt'].filter((f) => !shipped.includes(f)).join(', '),
  );

  writeFileSync(join(dir, 'package.json'), JSON.stringify({ name: 'consumer', type: 'module', private: true }));
  run('npm', ['install', '--no-audit', '--no-fund', tarball], dir);

  writeFileSync(
    join(dir, 'esm.mjs'),
    `import { createDemo, Scene, DEFAULT_THEME } from '@drietsch/sketch';
     const demo = createDemo({ width: 200, height: 100, seed: 42 });
     demo.rectangle({ id: 'box', x: 10, y: 10, width: 80, height: 60, fills: [{ type: 'SOLID', color: 'red' }], sketch: { fillStyle: 'dots' } });
     const svg = demo.toSVG();
     const ok = [createDemo, Scene, DEFAULT_THEME].every(Boolean)
       && svg.startsWith('<svg') && svg.includes('data-key="box"') && demo.seed === 42 && demo.toSVG() === svg;
     if (!ok) { console.error('esm surface broken'); process.exit(1); }
     console.log('ESM_OK');`,
  );
  check('ESM import works', run('node', ['esm.mjs'], dir).includes('ESM_OK'));

  // Node has supported require() of an ES module since 22.12, so an ESM-only
  // package is still requireable on every version this package supports. The
  // README says so; this keeps that claim honest.
  writeFileSync(
    join(dir, 'cjs.cjs'),
    `const m = require('@drietsch/sketch');
     const demo = m.createDemo({ width: 10, height: 10, seed: 1 });
     demo.rectangle({ x: 0, y: 0, width: 10, height: 10 });
     if (!demo.toSVG().includes('<path')) { console.error('cjs broken'); process.exit(1); }
     console.log('CJS_OK:' + Object.keys(m).sort().join(','));`,
  );
  const cjs = run('node', ['cjs.cjs'], dir);
  check('require() works on this Node', cjs.includes('CJS_OK'));

  // The public surface is a promise; an accidental re-export of an internal
  // must fail here, not surface as a breaking change later.
  const expectedExports = [
    'CompileError',
    'DEFAULT_FONT',
    'DEFAULT_THEME',
    'Demo',
    'DemoJSONError',
    'Player',
    'Scene',
    'StrokeFont',
    'Timeline',
    'createDemo',
    'iconNames',
    'loadDemo',
    'parseDemoJSON',
    'registerIcon',
  ];
  const actualExports = cjs.trim().split('CJS_OK:')[1]?.split(',') ?? [];
  check(
    'package exports exactly the documented surface',
    JSON.stringify(actualExports) === JSON.stringify(expectedExports),
    actualExports.length !== expectedExports.length
      ? `got ${actualExports.length}, expected ${expectedExports.length}`
      : '',
  );

  const types = readFileSync(join(dir, 'node_modules/@drietsch/sketch/dist/index.d.ts'), 'utf8');
  check('type declarations ship', types.includes('createDemo') && types.includes('SceneNode'));

  const bundle = readFileSync(join(dir, 'node_modules/@drietsch/sketch/dist/index.js'), 'utf8');
  const bare = [...bundle.matchAll(/^import .* from ["']([^.][^"']*)["']/gm)].map((m) => m[1]);
  check('bundle has no unresolved bare imports', bare.length === 0, bare.join(', '));
  check(
    'package declares no runtime dependencies',
    !JSON.parse(readFileSync(join(dir, 'node_modules/@drietsch/sketch/package.json'), 'utf8')).dependencies,
  );
} finally {
  rmSync(dir, { recursive: true, force: true });
}

if (failed) process.exitCode = 1;
else console.log('\ninstalled package verified');
