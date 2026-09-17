import type { Style, Theme } from '../core/types.js';
import type { PartStyle } from './types.js';

/** Resolves a node's style over the theme, with component-specific overrides applied last. */
export function resolvePartStyle(
  theme: Theme,
  style: Style | undefined,
  overrides: Partial<PartStyle> = {},
): PartStyle {
  const out: PartStyle = {
    stroke: style?.stroke ?? theme.stroke,
    strokeWidth: style?.strokeWidth ?? theme.strokeWidth,
    fillStyle: style?.fillStyle ?? 'hachure',
    roughness: style?.roughness ?? theme.roughness,
    bowing: style?.bowing ?? theme.bowing,
  };
  if (style?.fill !== undefined) out.fill = style.fill;
  if (style?.hachureGap !== undefined) out.hachureGap = style.hachureGap;
  if (style?.hachureAngle !== undefined) out.hachureAngle = style.hachureAngle;
  if (style?.fillWeight !== undefined) out.fillWeight = style.fillWeight;
  if (style?.dash !== undefined) out.dash = style.dash;
  if (style?.opacity !== undefined) out.opacity = style.opacity;
  for (const key of Object.keys(overrides) as (keyof PartStyle)[]) {
    const value = overrides[key];
    if (value !== undefined) {
      (out as unknown as Record<string, unknown>)[key] = value;
    }
  }
  return out;
}
