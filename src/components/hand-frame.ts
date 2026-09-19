import type { NodeBase, Theme } from '../core/types.js';
import type { Part, PartStyle } from './types.js';
import { resolvePartStyle } from './style.js';

/**
 * The outline of a big box, drawn the way a hand draws one: a light marker
 * band laid down first, then four straight edges that run past their corners,
 * gone over a second time with a thinner pen, and finally two short strokes
 * re-inking each corner.
 *
 * A rounded rectangle from the engine closes its corners neatly however rough
 * the line is, which is what made containers read as printed rather than
 * drawn. These parts replace that outline; the box itself stays for the fill.
 */

/** Multipliers on the theme's own hand, so a calm theme stays calm. */
const INK_ROUGHNESS = 2.2;
const SECOND_ROUGHNESS = 2.8;
const BAND_ROUGHNESS = 1.2;
const BOWING = 1.2;
const BAND_BOWING = 0.35;
/** The second pass is thinner than the first, and runs less far past the corner. */
const SECOND_WEIGHT = 0.7;
const SECOND_OVERSHOOT = 0.5;
/** Length of a corner's re-inking strokes, and how far they start back along the edge. */
const TICK = 16;
const TICK_BACK = 5;
/** Overshoot and band never take more than this fraction of the shorter side, so small boxes stay legible. */
const MAX_OVERSHOOT_RATIO = 0.25;
const MAX_BAND_RATIO = 0.12;
/** A strip this shallow is all edge: a marker band under it would swamp it, so it gets the ink alone. */
const BAND_MIN_SIDE = 56;
/** Below this, even the ink has no room to wander: the plain rectangle reads better. */
const MIN_SIDE = 28;

export interface HandFrameBox {
  x: number;
  y: number;
  width: number;
  height: number;
  /** Style overrides for the ink, matching the ones the box itself was given. */
  overrides?: Partial<PartStyle>;
  layer?: Part['layer'];
  /** A raised panel already carries a shadow, so it asks for the ink without the marker band. */
  band?: boolean;
}

/** Four edges as one path, each running `over` past both of its corners. */
function edgePath(box: HandFrameBox, over: number): string {
  const { x, y, width: w, height: h } = box;
  const [x1, y1, x2, y2] = [x, y, x + w, y + h];
  return [
    `M${x1 - over} ${y1}L${x2 + over} ${y1}`,
    `M${x2} ${y1 - over}L${x2} ${y2 + over}`,
    `M${x2 + over} ${y2}L${x1 - over} ${y2}`,
    `M${x1} ${y2 + over}L${x1} ${y1 - over}`,
  ].join('');
}

/** Two short strokes per corner, as if the pen went back over the turn. */
function cornerPath(box: HandFrameBox, len: number): string {
  const { x, y, width: w, height: h } = box;
  const corners: [number, number, number, number][] = [
    [x, y, 1, 1],
    [x + w, y, -1, 1],
    [x + w, y + h, -1, -1],
    [x, y + h, 1, -1],
  ];
  return corners
    .map(([cx, cy, sx, sy]) =>
      [
        `M${cx - sx * TICK_BACK} ${cy - sy * 3}L${cx + sx * len} ${cy + sy}`,
        `M${cx - sx * 3} ${cy - sy * TICK_BACK}L${cx + sx} ${cy + sy * len}`,
      ].join(''),
    )
    .join('');
}

/**
 * Parts for one container's outline, bottom to top. Empty when the theme turns
 * the treatment off (`frameOvershoot: 0`) or the box carries no stroke, in
 * which case the caller's own rect is the whole outline.
 */
export function handFrameParts(key: string, theme: Theme, node: NodeBase | undefined, box: HandFrameBox): Part[] {
  const base = resolvePartStyle(theme, node, { ...box.overrides, fill: undefined, fillStyle: 'solid' });
  if (theme.frameOvershoot <= 0 || base.stroke === 'none') return [];
  const shorter = Math.min(box.width, box.height);
  if (shorter < MIN_SIDE) return [];
  const over = Math.min(theme.frameOvershoot, shorter * MAX_OVERSHOOT_RATIO);
  const band = box.band === false || shorter < BAND_MIN_SIDE ? 0 : Math.min(theme.frameBand, shorter * MAX_BAND_RATIO);
  const roughness = node?.sketch?.roughness ?? theme.roughness;
  const bowing = node?.sketch?.bowing ?? theme.bowing;
  const layer = box.layer;
  const parts: Part[] = [];
  if (band > 0) {
    parts.push({
      key: `${key}band`,
      kind: 'path',
      d: edgePath(box, over * 0.25),
      layer,
      style: {
        ...base,
        stroke: theme.muted,
        strokeWeight: band,
        opacity: theme.frameBandOpacity,
        roughness: roughness * BAND_ROUGHNESS,
        bowing: bowing * BAND_BOWING,
      },
    });
  }
  parts.push(
    {
      key: `${key}ink`,
      kind: 'path',
      d: edgePath(box, over),
      layer,
      style: { ...base, roughness: roughness * INK_ROUGHNESS, bowing: bowing * BOWING },
    },
    {
      key: `${key}ink2`,
      kind: 'path',
      d: edgePath(box, over * SECOND_OVERSHOOT),
      layer,
      style: {
        ...base,
        strokeWeight: base.strokeWeight * SECOND_WEIGHT,
        roughness: roughness * SECOND_ROUGHNESS,
        bowing: bowing * BOWING,
      },
    },
    {
      key: `${key}corners`,
      kind: 'path',
      d: cornerPath(box, Math.min(TICK, shorter * MAX_OVERSHOOT_RATIO * 2)),
      layer,
      style: {
        ...base,
        strokeWeight: base.strokeWeight * SECOND_WEIGHT,
        roughness: roughness * INK_ROUGHNESS,
        bowing: bowing * BOWING,
      },
    },
  );
  return parts;
}

/**
 * A dominant line inside a container — a window's chrome divider, a frame's
 * title rule — drawn with the same hand: a marker band, then two passes that
 * run past both ends.
 */
export function handRuleParts(
  key: string,
  theme: Theme,
  node: NodeBase | undefined,
  rule: { x1: number; y1: number; x2: number; y2: number; overrides?: Partial<PartStyle>; layer?: Part['layer'] },
): Part[] {
  const base = resolvePartStyle(theme, node, { ...rule.overrides, fill: undefined });
  if (theme.frameOvershoot <= 0 || base.stroke === 'none') return [];
  const over = theme.frameOvershoot * 0.5;
  const dx = Math.sign(rule.x2 - rule.x1) * over;
  const dy = Math.sign(rule.y2 - rule.y1) * over;
  const roughness = node?.sketch?.roughness ?? theme.roughness;
  const bowing = node?.sketch?.bowing ?? theme.bowing;
  const line = (o: number) => `M${rule.x1 - dx * o} ${rule.y1 - dy * o}L${rule.x2 + dx * o} ${rule.y2 + dy * o}`;
  const parts: Part[] = [];
  const band = Math.min(theme.frameBand * 0.7, 6);
  if (band > 0) {
    parts.push({
      key: `${key}band`,
      kind: 'path',
      d: line(0.2),
      layer: rule.layer,
      style: {
        ...base,
        stroke: theme.muted,
        strokeWeight: band,
        opacity: theme.frameBandOpacity,
        roughness: roughness * BAND_ROUGHNESS,
        bowing: bowing * BAND_BOWING,
      },
    });
  }
  parts.push(
    {
      key: `${key}ink`,
      kind: 'path',
      d: line(1),
      layer: rule.layer,
      style: { ...base, roughness: roughness * INK_ROUGHNESS, bowing: bowing * BOWING },
    },
    {
      key: `${key}ink2`,
      kind: 'path',
      d: line(0.4),
      layer: rule.layer,
      style: {
        ...base,
        strokeWeight: base.strokeWeight * SECOND_WEIGHT,
        roughness: roughness * SECOND_ROUGHNESS,
        bowing: bowing * BOWING,
      },
    },
  );
  return parts;
}
