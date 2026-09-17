import type { Theme } from '../core/types.js';
import { deriveSeed } from '../core/ids.js';
import type { InteractionState } from '../timeline/types.js';
import { RIPPLE_DURATION } from '../timeline/state.js';
import { fmt, h } from './frame.js';
import type { FrameGroup, VElement } from './frame.js';
import { group } from './build-frame.js';
import type { SketchAdapter } from './sketch-adapter.js';

export const CURSOR_KEY = '__cursor';

/** A classic arrow pointer, tip at the origin, about 12 x 19 px. */
export const CURSOR_ARROW_PATH = 'M0 0 L0 16.5 L4.3 12.6 L7.1 18.8 L9.9 17.6 L7.1 11.5 L12.4 11.5 Z';

/** Sketches the pointer once per (seed, theme); the group is re-keyed every frame by position only. */
export class CursorRenderer {
  private arrow?: VElement[];

  constructor(
    private readonly adapter: SketchAdapter,
    private readonly seed: number,
    private readonly theme: Theme,
  ) {}

  private arrowElements(): VElement[] {
    this.arrow ??= this.adapter.sketch(
      (gen, o) => gen.path(CURSOR_ARROW_PATH, o),
      {
        stroke: this.theme.stroke,
        strokeWidth: 1.2,
        fill: '#ffffff',
        fillStyle: 'solid',
        roughness: 0.5,
        bowing: 0.6,
        disableMultiStroke: true,
      },
      deriveSeed(this.seed, 'cursor'),
    );
    return this.arrow;
  }

  /** The cursor group for a state: the pointer, slightly shrunk while pressed, plus a fading click ripple. */
  render(state: InteractionState): FrameGroup {
    const children: VElement[] = [];
    const ripple = state.lastRelease;
    if (ripple && state.t - ripple.time < RIPPLE_DURATION) {
      const age = (state.t - ripple.time) / RIPPLE_DURATION;
      children.push(
        h('circle', {
          cx: ripple.at.x - state.cursor.x,
          cy: ripple.at.y - state.cursor.y,
          r: 4 + age * 12,
          fill: 'none',
          stroke: this.theme.accent,
          'stroke-width': 1.5,
          opacity: Math.round((1 - age) * 100) / 100,
        }),
      );
    }
    const scale = state.pressed ? ' scale(0.92)' : '';
    children.push(h('g', { transform: `translate(0 0)${scale}` }, this.arrowElements()));
    return group(CURSOR_KEY, { transform: `translate(${fmt(state.cursor.x)} ${fmt(state.cursor.y)})` }, children);
  }
}
