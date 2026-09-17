export type Point = [number, number];
export type Line = [Point, Point];

export function lineLength(line: Line): number {
  const p1 = line[0];
  const p2 = line[1];
  return Math.sqrt(Math.pow(p1[0] - p2[0], 2) + Math.pow(p1[1] - p2[1], 2));
}

/**
 * SVG path data for a rectangle with rounded corners, built from four lines
 * and four cubic quarter-arcs (kappa 0.5523). Cubics rather than arc commands
 * so the engine sketches each corner as one continuous curve; a polygonised
 * corner would be drawn as a fan of separately wobbled segments.
 */
export function roundedRectPath(x: number, y: number, width: number, height: number, radius: number): string {
  const r = Math.max(0, Math.min(radius, width / 2, height / 2));
  const k = 0.5522847498 * r;
  const x2 = x + width;
  const y2 = y + height;
  return [
    `M${x + r} ${y}`,
    `L${x2 - r} ${y}`,
    `C${x2 - r + k} ${y} ${x2} ${y + r - k} ${x2} ${y + r}`,
    `L${x2} ${y2 - r}`,
    `C${x2} ${y2 - r + k} ${x2 - r + k} ${y2} ${x2 - r} ${y2}`,
    `L${x + r} ${y2}`,
    `C${x + r - k} ${y2} ${x} ${y2 - r + k} ${x} ${y2 - r}`,
    `L${x} ${y + r}`,
    `C${x} ${y + r - k} ${x + r - k} ${y} ${x + r} ${y}`,
    'Z',
  ].join(' ');
}
