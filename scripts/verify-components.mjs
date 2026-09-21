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
 * It also checks that the API reference names every built-in icon, and only
 * those, and that every doc quotes the right count of them.
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

// The built-in icons are only usable by name, so the name has to be written
// down somewhere an agent will read it. The API reference's table is that
// place; it must list exactly the icons gen-icons.mjs copied in.
const builtin = [...read('src/icons/builtin.ts').matchAll(/^  "([^"]+)": \{ nodes:/gm)].map((m) => m[1]);
const iconSection = api.slice(api.indexOf('### Built-in icons'), api.indexOf('Any other icon'));
const documented = iconSection
  .split('\n')
  .filter((line) => line.startsWith('| ') && line.includes('`'))
  .flatMap((line) => [...line.matchAll(/`([^`]+)`/g)].map((m) => m[1]));
const missing = builtin.filter((n) => !documented.includes(n));
const extra = documented.filter((n) => !builtin.includes(n));
const twice = documented.filter((n, i) => documented.indexOf(n) !== i);
check(
  'API reference names every built-in icon',
  missing.length === 0,
  missing.length ? `missing ${missing.join(', ')}` : '',
);
check('API reference names no other icon', extra.length === 0, extra.length ? `extra ${extra.join(', ')}` : '');
check('API reference names each icon once', twice.length === 0, twice.length ? `twice ${twice.join(', ')}` : '');
const n = builtin.length;
for (const [file, text, phrase] of [
  ['API.md', api, `These ${n} names work`],
  ['API.md', api, `The ${n} built-in icon names`],
  ['README.md', readme, `${n} common icons are built in`],
  ['for-agents.md', read('docs/for-agents.md'), `${n} ship with the package`],
  ['llms.txt', read('llms.txt'), `${n} ship built in`],
]) {
  check(`${file} counts ${n} built-in icons`, text.includes(phrase), `expected "${phrase}"`);
}

if (failed) {
  console.error('\ncomponent catalogue is out of sync');
  process.exit(1);
}
console.log(`\n${types.length} component types and ${n} built-in icons verified`);
