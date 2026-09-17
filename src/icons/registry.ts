import { BUILTIN_ICONS } from './builtin.js';
import type { IconDef } from './types.js';

const custom = new Map<string, IconDef>();

/** Registers (or replaces) an icon for use by name anywhere in this process. */
export function registerIcon(name: string, def: IconDef): void {
  if (!name || !Array.isArray(def.nodes)) {
    throw new Error(`registerIcon: expected a name and an icon definition with nodes; got "${name}"`);
  }
  custom.set(name, def);
}

/** Resolves a name against the custom registry first, then the built-ins. */
export function getIcon(name: string): IconDef | undefined {
  return custom.get(name) ?? BUILTIN_ICONS[name];
}

export function hasIcon(name: string): boolean {
  return custom.has(name) || Object.hasOwn(BUILTIN_ICONS, name);
}

export function isBuiltinIcon(name: string): boolean {
  return Object.hasOwn(BUILTIN_ICONS, name);
}

/** Names of every icon available by name: built-ins plus registered ones. */
export function iconNames(): string[] {
  const names = [...new Set([...Object.keys(BUILTIN_ICONS), ...custom.keys()])];
  names.sort();
  return names;
}

/** Resolves an icon reference to a definition, throwing for unknown names. */
export function resolveIcon(icon: string | IconDef): IconDef {
  if (typeof icon === 'string') {
    const def = getIcon(icon);
    if (!def) {
      throw new Error(`Unknown icon "${icon}". Register it with registerIcon() or pass the definition directly.`);
    }
    return def;
  }
  return icon;
}

/** Test hook: forget every registered icon. */
export function clearRegisteredIcons(): void {
  custom.clear();
}
