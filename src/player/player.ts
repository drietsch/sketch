import type { Demo } from '../demo.js';
import { patchDOM } from '../render/patch-dom.js';

/** The time source and frame scheduler; injectable so playback can be tested without a browser. */
export interface Clock {
  now(): number;
  requestFrame(callback: (now: number) => void): number;
  cancelFrame(id: number): void;
}

export function browserClock(): Clock {
  const g = globalThis as unknown as {
    requestAnimationFrame?: (cb: (t: number) => void) => number;
    cancelAnimationFrame?: (id: number) => void;
    performance?: { now(): number };
  };
  if (!g.requestAnimationFrame || !g.performance) {
    throw new Error('No requestAnimationFrame: pass a clock to mount() outside a browser');
  }
  return {
    now: () => g.performance!.now(),
    requestFrame: (cb) => g.requestAnimationFrame!(cb),
    cancelFrame: (id) => g.cancelAnimationFrame?.(id),
  };
}

export type PlayerEvent = 'play' | 'pause' | 'seeked' | 'timeupdate' | 'end';

export interface PlayerOptions {
  autoplay?: boolean;
  loop?: boolean;
  /** Playback rate; 1 is real time. */
  rate?: number;
  clock?: Clock;
}

/**
 * Plays a demo into an <svg> element. A thin loop over `demo.frame(t)` and
 * the DOM patcher: it owns the current time and nothing else, so seeking is
 * exact and every frame it shows is the frame `toSVG(t)` would produce.
 */
export class Player {
  rate: number;
  loop: boolean;

  private readonly clock: Clock;
  private current = 0;
  private playing_ = false;
  private frameId?: number;
  private lastNow = 0;
  private renderedAt?: number;
  private readonly listeners = new Map<PlayerEvent, Set<(t: number) => void>>();

  constructor(
    readonly demo: Demo,
    readonly svg: SVGSVGElement,
    options: PlayerOptions = {},
  ) {
    this.clock = options.clock ?? browserClock();
    this.rate = options.rate ?? 1;
    this.loop = options.loop ?? false;
    this.render();
    if (options.autoplay) this.play();
  }

  get time(): number {
    return this.current;
  }

  get duration(): number {
    return this.demo.duration;
  }

  get playing(): boolean {
    return this.playing_;
  }

  play(): void {
    if (this.playing_) return;
    if (this.current >= this.duration && !this.loop) this.current = 0;
    this.playing_ = true;
    this.lastNow = this.clock.now();
    this.emit('play');
    this.schedule();
  }

  pause(): void {
    if (!this.playing_) return;
    this.playing_ = false;
    if (this.frameId !== undefined) this.clock.cancelFrame(this.frameId);
    this.frameId = undefined;
    this.emit('pause');
  }

  toggle(): void {
    if (this.playing_) this.pause();
    else this.play();
  }

  /** Jumps to t (clamped to the timeline) and renders that frame immediately. */
  seek(t: number): void {
    this.current = Math.min(Math.max(0, t), this.duration);
    this.lastNow = this.clock.now();
    this.render();
    this.emit('seeked');
  }

  /** Pauses and rewinds. */
  stop(): void {
    this.pause();
    this.seek(0);
  }

  on(event: PlayerEvent, callback: (t: number) => void): () => void {
    let set = this.listeners.get(event);
    if (!set) {
      set = new Set();
      this.listeners.set(event, set);
    }
    set.add(callback);
    return () => set.delete(callback);
  }

  /** Re-renders the current time; call after editing the scene or timeline while paused. */
  render(): void {
    patchDOM(this.svg, this.demo.frame(this.current));
    this.renderedAt = this.current;
  }

  destroy(): void {
    this.pause();
    this.listeners.clear();
  }

  private schedule(): void {
    this.frameId = this.clock.requestFrame((now) => this.tick(now));
  }

  private tick(now: number): void {
    if (!this.playing_) return;
    this.current += (now - this.lastNow) * this.rate;
    this.lastNow = now;
    const duration = this.duration;
    let ended = false;
    if (this.current >= duration) {
      if (this.loop && duration > 0) {
        this.current %= duration;
      } else {
        this.current = duration;
        ended = true;
      }
    }
    if (this.current !== this.renderedAt) this.render();
    this.emit('timeupdate');
    if (ended) {
      this.playing_ = false;
      this.frameId = undefined;
      this.emit('pause');
      this.emit('end');
      return;
    }
    this.schedule();
  }

  private emit(event: PlayerEvent): void {
    const set = this.listeners.get(event);
    if (!set) return;
    for (const cb of set) cb(this.current);
  }
}
