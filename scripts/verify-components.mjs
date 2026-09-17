/**
 * Keeps the component catalogue in one piece. For every node type in the
 * registry (src/components/index.ts) it checks that:
 *
 *   - Demo has a factory that adds that type (src/demo.ts),
 *   - the node interface is exported from the package entry (src/index.ts),
 *   - the README lists the type in a component table,
 *   - at least one fixture in test/support/scenes.ts uses its factory, so a
 *     golden pins its look.
 *
 * Run with: pnpm run verify:components
 */
import { readFileSync } from 'node:fs';

const read = (path) => readFileSync(path, 'utf8');
const registry = read('src/components/index.ts');
const demo = read('src/demo.ts');
const entry = read('src/index.ts');
const readme = read('README.md');
const api = read('docs/API.md');
const scenes = read('test/support/scenes.ts');

const mapSource = registry.slice(
  registry.indexOf('const COMPONENTS'),
  registry.indexOf('};', registry.indexOf('const COMPONENTS')),
);
const types = [...mapSource.matchAll(/^\s+([A-Z_]+):/gm)].map((m) => m[1]);

const pascal = (type) => type.toLowerCase().replace(/(^|_)([a-z])/g, (_, __, c) => c.toUpperCase());
const camel = (type) => {
  const p = pascal(type);
  return p[0].toLowerCase() + p.slice(1);
};
/** Factories whose name is not the camel-cased type. */
const FACTORY_NAMES = { WINDOW: ['window', 'browser'] };

let failed = false;
const check = (label, ok, detail = '') => {
  console.log(`  ${ok ? 'ok  ' : 'FAIL'}  ${label}${detail ? '  ' + detail : ''}`);
  if (!ok) failed = true;
};

check('registry lists node types', types.length > 0, `${types.length} types`);
for (const type of types) {
  const factories = FACTORY_NAMES[type] ?? [camel(type)];
  check(`${type}: a factory adds it`, demo.includes(`this.add('${type}'`));
  check(`${type}: the node interface is exported`, new RegExp(`\\b${pascal(type)}Node\\b`).test(entry));
  check(`${type}: the README table lists it`, readme.includes(`| \`${type}\``));
  check(`${type}: the API reference lists it`, api.includes(`| \`${type}\``));
  check(
    `${type}: a fixture uses it`,
    factories.some((f) => scenes.includes(`demo.${f}(`)),
    `expected demo.${factories.join('( or demo.')}(`,
  );
}

// Every public method of Demo and Timeline is documented in the API reference.
const methodsOf = (source, className) => {
  const body = source.slice(source.indexOf(`export class ${className}`));
  return [...body.matchAll(/^  (?:get )?([a-zA-Z]\w*)\(/gm)].map((m) => m[1]).filter((n) => n !== 'constructor');
};
const demoMethods = methodsOf(demo, 'Demo').filter((n) => !/^(compiled)$/.test(n));
const timelineMethods = methodsOf(read('src/timeline/timeline.ts'), 'Timeline');
for (const name of new Set([...demoMethods, ...timelineMethods])) {
  check(
    `API reference documents ${name}()`,
    api.includes(`\`${name}(`) || api.includes(`\`${name}\``) || api.includes(`demo.${name}`),
  );
}

if (failed) {
  console.error('\ncomponent catalogue is out of sync');
  process.exit(1);
}
console.log(`\n${types.length} component types verified`);
