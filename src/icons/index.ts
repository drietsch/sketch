export { BUILTIN_ICONS } from './builtin.js';
export {
  registerIcon,
  getIcon,
  hasIcon,
  isBuiltinIcon,
  iconNames,
  resolveIcon,
  clearRegisteredIcons,
} from './registry.js';
export { iconElementToPath, iconElementFilled, viewBoxSize } from './to-path.js';
export type { IconDef, IconElement } from './types.js';
