/**
 * Shared option/shape helpers used by both rendering backends.
 *
 * These exist so that canvas.ts and svg.ts cannot drift apart again: the
 * fill-rule decision used to be duplicated in both and had already diverged --
 * canvas applied `evenodd` to 'path' while svg did not, so the same Drawable
 * rendered differently depending on the backend.
 */

/** Shapes whose self-intersecting outlines must be filled with the even-odd rule. */
const EVENODD_SHAPES = new Set(['curve', 'polygon', 'path']);

export function fillRuleFor(shape: string): 'evenodd' | 'nonzero' {
  return EVENODD_SHAPES.has(shape) ? 'evenodd' : 'nonzero';
}
