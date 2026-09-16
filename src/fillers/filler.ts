import type { ResolvedOptions } from '../core.js';
import type { PatternFiller, RenderHelper } from './filler-interface.js';
import { HachureFiller } from './hachure-filler.js';
import { ZigZagFiller } from './zigzag-filler.js';
import { HatchFiller } from './hatch-filler.js';
import { DotFiller } from './dot-filler.js';
import { DashedFiller } from './dashed-filler.js';
import { ZigZagLineFiller } from './zigzag-line-filler.js';

const FILLERS = {
  hachure: HachureFiller,
  zigzag: ZigZagFiller,
  'cross-hatch': HatchFiller,
  dots: DotFiller,
  dashed: DashedFiller,
  'zigzag-line': ZigZagLineFiller,
} as const satisfies Record<string, new (helper: RenderHelper) => PatternFiller>;

/**
 * Resolves a fillStyle to a filler.
 *
 * This used to memoise instances in a module-level map, which made every filler
 * a process-wide singleton: the RenderHelper captured by whichever
 * RoughGenerator constructed it first was retained for the lifetime of the
 * module, and every later generator silently drew through that first helper.
 *
 * Fillers hold no state beyond the injected helper, so constructing one per call
 * is behaviour-identical and removes the shared mutable state. 'solid' is not
 * listed: generator.ts branches on it before reaching a filler.
 */
export function getFiller(o: ResolvedOptions, helper: RenderHelper): PatternFiller {
  const Filler = FILLERS[o.fillStyle as keyof typeof FILLERS] ?? HachureFiller;
  return new Filler(helper);
}
