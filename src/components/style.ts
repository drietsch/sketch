import type { NodeBase, Theme, TypeStyle } from '../core/types.js';
import { resolvePaint } from '../core/paint.js';
import type { PartStyle } from './types.js';

/**
 * Resolves a node's Figma-shaped visual props (fills, strokes, strokeWeight,
 * strokeDashes, sketch) over the theme into the engine-facing part style.
 * `overrides` are the component's own choices and win over everything; a
 * component passes `fill: undefined` to mean "no fill".
 */
export function resolvePartStyle(
  theme: Theme,
  node: NodeBase | undefined,
  overrides: Partial<PartStyle> = {},
): PartStyle {
  const sketch = node?.sketch;
  const out: PartStyle = {
    stroke: theme.stroke,
    strokeWeight: node?.strokeWeight ?? theme.strokeWeight,
    fillStyle: sketch?.fillStyle ?? 'hachure',
    roughness: sketch?.roughness ?? theme.roughness,
    bowing: sketch?.bowing ?? theme.bowing,
    textPasses: theme.textPasses,
  };
  const stroke = resolvePaint(node?.strokes);
  if (stroke === 'none') out.stroke = 'none';
  else if (stroke) {
    out.stroke = stroke.color;
    if (stroke.opacity !== undefined) out.strokeOpacity = stroke.opacity;
  }
  const fill = resolvePaint(node?.fills);
  if (fill && fill !== 'none') {
    out.fill = fill.color;
    if (fill.opacity !== undefined) out.fillOpacity = fill.opacity;
  }
  if (sketch?.hachureGap !== undefined) out.hachureGap = sketch.hachureGap;
  if (sketch?.hachureAngle !== undefined) out.hachureAngle = sketch.hachureAngle;
  if (sketch?.fillWeight !== undefined) out.fillWeight = sketch.fillWeight;
  if (node?.strokeDashes !== undefined) out.strokeDashes = node.strokeDashes;
  for (const key of Object.keys(overrides) as (keyof PartStyle)[]) {
    const value = overrides[key];
    if (value === undefined) {
      if (key in overrides) delete (out as unknown as Record<string, unknown>)[key];
    } else {
      (out as unknown as Record<string, unknown>)[key] = value;
    }
  }
  return out;
}

/** Whether the node sets its own fill (present and non-empty), so a component default should not apply. */
export function hasOwnFill(node: NodeBase): boolean {
  return resolvePaint(node.fills) !== undefined;
}

/** The colour for a node's text: its TypeStyle fills, else the given default. */
const REGULAR = 400;
/** How strongly the marker under a heading shows when the style does not say. */
const MARKER_OPACITY = 0.3;

export function textColor(style: TypeStyle | undefined, fallback: string): string {
  const paint = resolvePaint(style?.fills);
  if (paint === undefined || paint === 'none') return fallback;
  return paint.color;
}

/** The marker swept under a heading: the theme's grey unless the style names a paint. */
export function markerOf(style: TypeStyle | undefined, theme: Theme): { color: string; opacity: number } | undefined {
  const marker = style?.marker;
  if (!marker) return undefined;
  if (marker === true) return { color: theme.muted, opacity: MARKER_OPACITY };
  const paint = resolvePaint([marker]);
  if (paint === undefined || paint === 'none') return undefined;
  return { color: paint.color, opacity: paint.opacity ?? MARKER_OPACITY };
}

/** Font weight from a TypeStyle; 400 is the plain letterform. */
export function fontWeightOf(style: TypeStyle | undefined): number {
  return style?.fontWeight ?? REGULAR;
}

/** Font size from a TypeStyle, else the theme's. */
export function fontSizeOf(style: TypeStyle | undefined, theme: Theme): number {
  return style?.fontSize ?? theme.fontSize;
}
