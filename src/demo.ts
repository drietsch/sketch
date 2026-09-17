import { Scene } from './core/scene.js';
import type {
  EllipseNode,
  IconNode,
  LineNode,
  PathNode,
  RectNode,
  SceneNode,
  TextNode,
  Theme,
  NodeType,
  NodeOf,
} from './core/types.js';
import { DEFAULT_FONT } from './text/index.js';
import type { StrokeFont } from './text/font.js';
import { IdCounter } from './core/ids.js';
import { resolveTheme } from './core/theme.js';
import { randomSeed } from './sketch/index.js';
import { SketchAdapter } from './render/sketch-adapter.js';
import { buildFrame } from './render/build-frame.js';
import type { Frame } from './render/frame.js';
import { frameToSVG } from './render/svg-string.js';

export interface DemoOptions {
  width: number;
  height: number;
  /** Document seed. Omit for a fresh random seed; read it back from `demo.seed` to reproduce the result. */
  seed?: number;
  theme?: Partial<Theme>;
  /** Background colour, or `null` for a transparent document. Defaults to the theme background. */
  background?: string | null;
  /** The stroke font used for all text. Defaults to the built-in Hershey sans. */
  font?: StrokeFont;
}

/** Node props as passed to a factory: everything but `type`, with `id` optional. */
export type Props<N extends SceneNode> = Omit<N, 'type' | 'id'> & { id?: string };

export function createDemo(options: DemoOptions): Demo {
  return new Demo(options);
}

/**
 * A demo: a scene plus (later) a timeline, and everything needed to render
 * either as an SVG string or into a live document.
 */
export class Demo {
  readonly width: number;
  readonly height: number;
  readonly seed: number;
  readonly theme: Theme;
  readonly background: string | undefined;
  readonly font: StrokeFont;
  readonly scene: Scene;

  private readonly ids = new IdCounter();
  private readonly adapter: SketchAdapter;

  constructor(options: DemoOptions) {
    if (!(options.width > 0) || !(options.height > 0)) {
      throw new Error('createDemo: width and height must be positive numbers');
    }
    this.width = options.width;
    this.height = options.height;
    this.seed = normaliseSeed(options.seed);
    this.theme = resolveTheme(options.theme);
    this.background = options.background === null ? undefined : (options.background ?? this.theme.background);
    this.font = options.font ?? DEFAULT_FONT;
    this.adapter = new SketchAdapter(this.font);
    this.scene = new Scene({ theme: this.theme, font: this.font });
  }

  rect(props: Props<RectNode>): RectNode {
    return this.add('rect', props);
  }

  ellipse(props: Props<EllipseNode>): EllipseNode {
    return this.add('ellipse', props);
  }

  line(props: Props<LineNode>): LineNode {
    return this.add('line', props);
  }

  path(props: Props<PathNode>): PathNode {
    return this.add('path', props);
  }

  text(props: Props<TextNode>): TextNode {
    return this.add('text', props);
  }

  icon(props: Props<IconNode>): IconNode {
    return this.add('icon', props);
  }

  /** Removes a node (and its children) and forgets its cached geometry. */
  remove(id: string): void {
    const ids = [id, ...this.descendants(id)];
    this.scene.remove(id);
    for (const removed of ids) this.adapter.forget(removed);
  }

  /** The frame at time t (ms) as a virtual SVG tree. Pure: the same inputs always give the same frame. */
  frame(t = 0): Frame {
    void t;
    return buildFrame(
      this.scene,
      { width: this.width, height: this.height },
      { seed: this.seed, theme: this.theme, font: this.font, adapter: this.adapter },
      this.background,
    );
  }

  /** The frame at time t as a complete SVG document string. */
  toSVG(t = 0): string {
    return frameToSVG(this.frame(t));
  }

  private add<T extends NodeType>(type: T, props: Props<NodeOf<T>>): NodeOf<T> {
    const id = props.id ?? this.ids.next(type, (candidate) => this.scene.has(candidate));
    const node = { ...props, id, type } as unknown as NodeOf<T>;
    return this.scene.add(node);
  }

  private descendants(id: string): string[] {
    const out: string[] = [];
    for (const child of this.scene.childrenOf(id)) {
      out.push(child, ...this.descendants(child));
    }
    return out;
  }
}

function normaliseSeed(seed: number | undefined): number {
  if (seed === undefined) {
    return randomSeed() || 1;
  }
  if (!Number.isInteger(seed) || seed < 0 || seed >= 2 ** 31) {
    throw new Error(`seed must be an integer in [0, 2^31); got ${seed}`);
  }
  return seed;
}
