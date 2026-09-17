import type { Color, ColorLike, Paint } from './types.js';

function channel(v: number): number {
  return Math.round(Math.min(1, Math.max(0, v)) * 255);
}

/** Whether a value is a Figma-style colour object. */
export function isColor(v: unknown): v is Color {
  return (
    typeof v === 'object' &&
    v !== null &&
    typeof (v as Color).r === 'number' &&
    typeof (v as Color).g === 'number' &&
    typeof (v as Color).b === 'number'
  );
}

/**
 * A CSS colour for a colour-like value. Figma colours become `#rrggbb` when
 * opaque and `rgba(r, g, b, a)` otherwise; strings pass through unchanged.
 */
export function cssColor(c: ColorLike): string {
  if (typeof c === 'string') return c;
  const a = c.a ?? 1;
  const r = channel(c.r);
  const g = channel(c.g);
  const b = channel(c.b);
  if (a >= 1) return '#' + [r, g, b].map((n) => n.toString(16).padStart(2, '0')).join('');
  return `rgba(${r}, ${g}, ${b}, ${Math.round(a * 1000) / 1000})`;
}

/** The first visible paint, or undefined when there is none. */
export function firstVisible(paints: readonly Paint[] | undefined): Paint | undefined {
  return paints?.find((p) => p.visible !== false);
}

export interface ResolvedPaint {
  color: string;
  /** Only present when the paint is not fully opaque. */
  opacity?: number;
}

/** CSS colour and opacity for a paint list: undefined when the list is absent, `none` when it is empty or all invisible. */
export function resolvePaint(paints: readonly Paint[] | undefined): ResolvedPaint | 'none' | undefined {
  if (paints === undefined) return undefined;
  const p = firstVisible(paints);
  if (!p) return 'none';
  const out: ResolvedPaint = { color: cssColor(p.color) };
  if (p.opacity !== undefined && p.opacity < 1) out.opacity = p.opacity;
  return out;
}

/** A solid paint from a colour, for callers that want to build node props in code. */
export function solid(color: ColorLike, opacity?: number): Paint {
  const paint: Paint = { type: 'SOLID', color };
  if (opacity !== undefined) paint.opacity = opacity;
  return paint;
}

/** Message describing what is wrong with a paint list, or undefined. */
export function validatePaints(paints: unknown, what: string): string | undefined {
  if (paints === undefined) return undefined;
  if (!Array.isArray(paints)) return `${what} must be an array of paints`;
  for (const [i, p] of paints.entries()) {
    if (typeof p !== 'object' || p === null) return `${what}[${i}] must be a paint object`;
    const paint = p as Record<string, unknown>;
    if (paint.type !== 'SOLID')
      return `${what}[${i}].type ${JSON.stringify(paint.type)} is not supported; only SOLID paints are`;
    if (typeof paint.color !== 'string' && !isColor(paint.color)) {
      return `${what}[${i}].color must be a CSS string or { r, g, b, a } in 0..1`;
    }
    if (isColor(paint.color)) {
      for (const k of ['r', 'g', 'b', 'a'] as const) {
        const v = paint.color[k];
        if (v !== undefined && (typeof v !== 'number' || v < 0 || v > 1))
          return `${what}[${i}].color.${k} must be in 0..1`;
      }
    }
    if (paint.opacity !== undefined && (typeof paint.opacity !== 'number' || paint.opacity < 0 || paint.opacity > 1)) {
      return `${what}[${i}].opacity must be in 0..1`;
    }
  }
  return undefined;
}
