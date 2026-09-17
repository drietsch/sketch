import type { SliderNode } from '../core/types.js';
import type { ComponentDef, Part, Region } from './types.js';
import { THUMB, TRACK } from './controls.js';
import { rectPart } from './common.js';
import { resolvePartStyle } from './style.js';

const HEIGHT = 24;
const THUMB_SIZE = THUMB + 4;

function range(node: SliderNode): { min: number; max: number; step: number } {
  return { min: node.min ?? 0, max: node.max ?? 100, step: node.step ?? 1 };
}

function clampToStep(node: SliderNode, v: number): number {
  const { min, max, step } = range(node);
  const snapped = min + Math.round((v - min) / step) * step;
  return Math.min(max, Math.max(min, snapped));
}

function valueOf(node: SliderNode, live: number | string | string[] | undefined): number {
  return typeof live === 'number' ? live : (node.value ?? range(node).min);
}

function xFor(node: SliderNode, v: number): number {
  const { min, max } = range(node);
  const usable = node.width - THUMB_SIZE;
  return THUMB_SIZE / 2 + (max > min ? ((v - min) / (max - min)) * usable : 0);
}

/** A track with a filled portion and a draggable thumb. */
export const slider: ComponentDef<SliderNode> = {
  focusable: true,
  interactive: true,
  resizable: true,
  capabilities: { drag: true, choose: true },
  validate: (node) => {
    const { min, max, step } = range(node);
    if (!(max > min)) return 'max must be greater than min';
    if (!(step > 0)) return 'step must be positive';
    if (node.value !== undefined && (node.value < min || node.value > max))
      return `value must be within ${min}..${max}`;
    return undefined;
  },
  localBounds: (node) => ({ x: 0, y: 0, width: node.width, height: HEIGHT }),
  expand: (node, ctx) => {
    const { theme } = ctx;
    const v = valueOf(node, ctx.value);
    const x = xFor(node, v);
    const trackY = (HEIGHT - TRACK) / 2;
    const parts: Part[] = [
      rectPart('track', theme, node, {
        x: THUMB_SIZE / 2,
        y: trackY,
        width: node.width - THUMB_SIZE,
        height: TRACK,
        cornerRadius: TRACK / 2,
        overrides: { fill: theme.surface, fillStyle: 'solid', stroke: theme.muted },
      }),
    ];
    if (x > THUMB_SIZE / 2 + 1) {
      parts.push(
        rectPart('fill', theme, node, {
          x: THUMB_SIZE / 2,
          y: trackY,
          width: x - THUMB_SIZE / 2,
          height: TRACK,
          cornerRadius: TRACK / 2,
          overrides: { fill: theme.accent, fillStyle: 'solid', stroke: 'none' },
        }),
      );
    }
    parts.push({
      key: 'thumb',
      kind: 'ellipse',
      x: x - THUMB_SIZE / 2,
      y: (HEIGHT - THUMB_SIZE) / 2,
      width: THUMB_SIZE,
      height: THUMB_SIZE,
      style: resolvePartStyle(theme, node, {
        fill: theme.surface,
        fillStyle: 'solid',
        stroke: ctx.state.pressed ? theme.accent : theme.stroke,
      }),
    });
    return parts;
  },
  regions: (node, ctx): Region[] => {
    const v = valueOf(node, ctx.value);
    const x = xFor(node, v);
    return [
      // Clicking the track jumps to that value; the thumb is the drag handle (no click effect).
      { key: 'track', bounds: { x: 0, y: 0, width: node.width, height: HEIGHT } },
      { key: 'thumb', bounds: { x: x - THUMB_SIZE / 2, y: 0, width: THUMB_SIZE, height: HEIGHT } },
    ];
  },
  drag: {
    valueAt: (node, _ctx, p) => {
      const { min, max } = range(node);
      const usable = node.width - THUMB_SIZE;
      return clampToStep(node, min + ((p.x - THUMB_SIZE / 2) / usable) * (max - min));
    },
    pointFor: (node, _ctx, v) => ({ x: xFor(node, clampToStep(node, v)), y: HEIGHT / 2 }),
  },
};
