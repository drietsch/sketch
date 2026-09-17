import type { IconElement } from './types.js';

const KAPPA = 0.5522847498;

function num(attrs: Record<string, string | number>, key: string, fallback = 0): number {
  const v = attrs[key];
  const n = typeof v === 'number' ? v : parseFloat(String(v ?? ''));
  return Number.isFinite(n) ? n : fallback;
}

function ellipsePath(cx: number, cy: number, rx: number, ry: number): string {
  const kx = KAPPA * rx;
  const ky = KAPPA * ry;
  return (
    `M${cx + rx} ${cy}` +
    `C${cx + rx} ${cy + ky} ${cx + kx} ${cy + ry} ${cx} ${cy + ry}` +
    `C${cx - kx} ${cy + ry} ${cx - rx} ${cy + ky} ${cx - rx} ${cy}` +
    `C${cx - rx} ${cy - ky} ${cx - kx} ${cy - ry} ${cx} ${cy - ry}` +
    `C${cx + kx} ${cy - ry} ${cx + rx} ${cy - ky} ${cx + rx} ${cy}Z`
  );
}

/**
 * Path data for one icon element. Sketchyicons only emits paths, but plain
 * Lucide/Feather-style icons also use the basic shapes, so those are accepted
 * too. Returns undefined for anything else.
 */
export function iconElementToPath([tag, attrs]: IconElement): string | undefined {
  switch (tag) {
    case 'path':
      return typeof attrs.d === 'string' ? attrs.d : undefined;
    case 'circle': {
      const r = num(attrs, 'r');
      return ellipsePath(num(attrs, 'cx'), num(attrs, 'cy'), r, r);
    }
    case 'ellipse':
      return ellipsePath(num(attrs, 'cx'), num(attrs, 'cy'), num(attrs, 'rx'), num(attrs, 'ry'));
    case 'line':
      return `M${num(attrs, 'x1')} ${num(attrs, 'y1')}L${num(attrs, 'x2')} ${num(attrs, 'y2')}`;
    case 'polyline':
    case 'polygon': {
      const pts = String(attrs.points ?? '')
        .trim()
        .split(/[\s,]+/)
        .map(Number);
      if (pts.length < 4) return undefined;
      let d = `M${pts[0]} ${pts[1]}`;
      for (let i = 2; i + 1 < pts.length; i += 2) d += `L${pts[i]} ${pts[i + 1]}`;
      return tag === 'polygon' ? d + 'Z' : d;
    }
    case 'rect': {
      const x = num(attrs, 'x');
      const y = num(attrs, 'y');
      const w = num(attrs, 'width');
      const h = num(attrs, 'height');
      const rx = Math.min(num(attrs, 'rx', num(attrs, 'ry')), w / 2, h / 2);
      if (!(rx > 0)) return `M${x} ${y}H${x + w}V${y + h}H${x}Z`;
      const k = KAPPA * rx;
      return (
        `M${x + rx} ${y}H${x + w - rx}` +
        `C${x + w - rx + k} ${y} ${x + w} ${y + rx - k} ${x + w} ${y + rx}` +
        `V${y + h - rx}C${x + w} ${y + h - rx + k} ${x + w - rx + k} ${y + h} ${x + w - rx} ${y + h}` +
        `H${x + rx}C${x + rx - k} ${y + h} ${x} ${y + h - rx + k} ${x} ${y + h - rx}` +
        `V${y + rx}C${x} ${y + rx - k} ${x + rx - k} ${y} ${x + rx} ${y}Z`
      );
    }
    default:
      return undefined;
  }
}

/** Whether the element asks to be filled (Lucide uses fill="currentColor" for solid parts). */
export function iconElementFilled([, attrs]: IconElement): boolean {
  const fill = attrs.fill;
  return fill !== undefined && fill !== 'none';
}

/** Parses a viewBox into its size, defaulting to the 24-unit grid. */
export function viewBoxSize(viewBox: string | undefined): { width: number; height: number } {
  const parts = (viewBox ?? '0 0 24 24')
    .trim()
    .split(/[\s,]+/)
    .map(Number);
  const width = parts.length === 4 && parts[2] > 0 ? parts[2] : 24;
  const height = parts.length === 4 && parts[3] > 0 ? parts[3] : 24;
  return { width, height };
}
