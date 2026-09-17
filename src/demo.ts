import { Scene } from './core/scene.js';
import type {
  ButtonNode,
  EllipseNode,
  IconNode,
  InputNode,
  LineNode,
  PanelNode,
  PathNode,
  RectNode,
  SceneNode,
  TextNode,
  Theme,
  NodeType,
  NodeOf,
  WindowNode,
} from './core/types.js';
import type { IconDef } from './icons/types.js';
import { getIcon, isBuiltinIcon } from './icons/registry.js';
import { parseDemoJSON } from './core/json.js';
import type { DemoJSON } from './core/json.js';
import { Timeline } from './timeline/timeline.js';
import { compile } from './timeline/compile.js';
import { caretVisible, stateAt } from './timeline/state.js';
import type { CompiledTimeline, InteractionState, Step } from './timeline/types.js';
import { CursorRenderer } from './render/chrome.js';
import type { NodeInteraction } from './render/build-frame.js';
import type { Scene as SceneType } from './core/scene.js';
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

export interface LoadOptions {
  /** Supplies a custom stroke font when the document was saved with one. */
  font?: StrokeFont;
}

/** Rebuilds a demo from `toJSON()` output. The result renders byte-identically to the original. */
export function loadDemo(json: DemoJSON | string, options: LoadOptions = {}): Demo {
  const doc = parseDemoJSON(json);
  const font = options.font ?? DEFAULT_FONT;
  if (doc.font !== undefined && doc.font !== font.name) {
    throw new Error(
      `loadDemo: the document uses font "${doc.font}" but "${font.name}" was supplied; pass it via options.font`,
    );
  }
  const demo = new Demo({
    width: doc.width,
    height: doc.height,
    seed: doc.seed,
    theme: doc.theme,
    background: doc.background ?? null,
    font,
  });
  for (const [name, def] of Object.entries(doc.icons ?? {})) demo.registerIcon(name, def);
  doc.nodes.forEach((node, i) => {
    try {
      demo.scene.add(node);
    } catch (e) {
      throw new Error(`loadDemo: nodes[${i}]: ${(e as Error).message}`, { cause: e });
    }
  });
  if (doc.timeline || doc.cursor) {
    const timeline: { version: 1; steps: Step[]; cursor?: { x: number; y: number } } = {
      version: 1,
      steps: (doc.timeline ?? []) as Step[],
    };
    if (doc.cursor) timeline.cursor = doc.cursor;
    demo.timeline.load(timeline);
  }
  return demo;
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
  /** Icons registered on this demo only; they travel with toJSON(). */
  readonly icons = new Map<string, IconDef>();
  readonly timeline = new Timeline();

  private readonly ids = new IdCounter();
  private readonly adapter: SketchAdapter;
  private readonly cursor: CursorRenderer;
  private compiledCache?: CompiledTimeline;

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
    this.scene = new Scene({ theme: this.theme, font: this.font, icons: (icon) => this.resolveIcon(icon) });
    this.cursor = new CursorRenderer(this.adapter, this.seed, this.theme);
  }

  /** Registers an icon for this demo only. Per-demo icons win over global and built-in ones. */
  registerIcon(name: string, def: IconDef): void {
    if (!name || !Array.isArray(def.nodes)) {
      throw new Error(`registerIcon: expected a name and an icon definition with nodes; got "${name}"`);
    }
    this.icons.set(name, def);
  }

  /** Resolves an icon reference: per-demo registrations first, then global ones, then built-ins. */
  resolveIcon(icon: string | IconDef): IconDef {
    if (typeof icon !== 'string') return icon;
    const def = this.icons.get(icon) ?? getIcon(icon);
    if (!def) {
      throw new Error(`Unknown icon "${icon}". Register it with registerIcon() or pass the definition directly.`);
    }
    return def;
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

  button(props: Props<ButtonNode>): ButtonNode {
    return this.add('button', props);
  }

  input(props: Props<InputNode>): InputNode {
    return this.add('input', props);
  }

  panel(props: Props<PanelNode>): PanelNode {
    return this.add('panel', props);
  }

  window(props: Omit<Props<WindowNode>, 'chrome'> & { chrome?: WindowNode['chrome'] }): WindowNode {
    return this.add('window', { chrome: 'window', ...props });
  }

  /** A window with browser chrome: navigation arrows and an address bar. */
  browser(props: Omit<Props<WindowNode>, 'chrome'>): WindowNode {
    return this.add('window', { ...props, chrome: 'browser' });
  }

  /** Removes a node (and its children) and forgets its cached geometry. */
  remove(id: string): void {
    const ids = [id, ...this.descendants(id)];
    this.scene.remove(id);
    for (const removed of ids) this.adapter.forget(removed);
  }

  /** Total length of the timeline in ms; 0 for a static scene. */
  get duration(): number {
    return this.compiled().duration;
  }

  /** The timeline resolved against the current scene. Recompiled lazily when either changes. */
  compiled(): CompiledTimeline {
    const c = this.compiledCache;
    if (c && c.sceneVersion === this.scene.version && c.timelineVersion === this.timeline.version) return c;
    const fresh = compile(this.timeline, this.scene, this.seed, { width: this.width, height: this.height });
    this.compiledCache = fresh;
    return fresh;
  }

  /** The interaction state at time t: cursor, focus, pressed node, live values, scene patches. */
  stateAt(t: number): InteractionState {
    return stateAt(this.compiled(), t);
  }

  /** The frame at time t (ms) as a virtual SVG tree. Pure: the same inputs always give the same frame. */
  frame(t = 0): Frame {
    const base = { theme: this.theme, font: this.font, icons: (icon: string | IconDef) => this.resolveIcon(icon) };
    const size = { width: this.width, height: this.height };
    if (this.timeline.steps.length === 0) {
      return buildFrame(this.scene, size, { ...base, seed: this.seed, adapter: this.adapter }, this.background);
    }
    const state = this.stateAt(t);
    const scene = this.patchedScene(state);
    const interaction = new Map<string, NodeInteraction>();
    const touch = (id: string): NodeInteraction => {
      let entry = interaction.get(id);
      if (!entry) {
        entry = {};
        interaction.set(id, entry);
      }
      return entry;
    };
    for (const node of scene.all()) {
      // The timeline owns focus: exactly one node can have it.
      if (scene.isFocusable(node)) touch(node.id).state = { focused: node.id === state.focused };
    }
    if (state.pressedNode !== undefined && scene.has(state.pressedNode)) {
      touch(state.pressedNode).state = { ...touch(state.pressedNode).state, pressed: true };
    }
    const hovered = scene.hitTest(state.cursor);
    if (hovered !== undefined && !state.pressed) touch(hovered).state = { ...touch(hovered).state, hovered: true };
    for (const [id, value] of state.values) {
      if (scene.has(id)) touch(id).value = value;
    }
    if (state.focused !== undefined && scene.has(state.focused))
      touch(state.focused).caretVisible = caretVisible(state);
    return buildFrame(
      scene,
      size,
      { ...base, seed: this.seed, adapter: this.adapter, interaction, chrome: [this.cursor.render(state)] },
      this.background,
    );
  }

  /** The frame at time t as a complete SVG document string. */
  toSVG(t = 0): string {
    return frameToSVG(this.frame(t));
  }

  /** Every frame of the timeline at a fixed rate, for export. The last frame is always the end. */
  *frames(fps = 30): Generator<{ t: number; svg: string }> {
    const step = 1000 / fps;
    const duration = this.duration;
    for (let t = 0; t < duration; t += step) yield { t, svg: this.toSVG(t) };
    yield { t: duration, svg: this.toSVG(duration) };
  }

  /**
   * The node as it is at time t: authored props with the timeline's `set`
   * patches and live input value applied. The scene itself is never mutated
   * by playback.
   */
  nodeAt<N extends SceneNode = SceneNode>(id: string, t: number): N {
    const node = this.scene.node<N>(id);
    if (this.timeline.steps.length === 0) return node;
    const state = this.stateAt(t);
    const patch = state.patches.get(id);
    const value = state.values.get(id);
    if (!patch && value === undefined) return node;
    const out = Object.assign({}, node) as N & { value?: string };
    if (patch) Object.assign(out, patch);
    if (value !== undefined && node.type === 'input') out.value = value;
    return out;
  }

  private patchedScene(state: InteractionState): SceneType {
    if (state.patches.size === 0) return this.scene;
    const scene = this.scene.clone();
    for (const [id, patch] of state.patches) {
      if (scene.has(id)) scene.update(id, patch);
    }
    return scene;
  }

  /**
   * A plain, JSON-serialisable description of the whole demo. Icons referred
   * to by name that are not built in are embedded so the document stands alone.
   */
  toJSON(): DemoJSON {
    const nodes = this.scene.toJSON();
    const icons: Record<string, IconDef> = {};
    for (const [name, def] of this.icons) icons[name] = def;
    for (const node of nodes) {
      const ref = node.type === 'icon' || node.type === 'button' ? node.icon : undefined;
      if (typeof ref === 'string' && !(ref in icons) && !isBuiltinIcon(ref)) {
        const def = getIcon(ref);
        if (def) icons[ref] = def;
      }
    }
    const doc: DemoJSON = {
      version: 1,
      width: this.width,
      height: this.height,
      seed: this.seed,
      theme: { ...this.theme },
      background: this.background ?? null,
      font: this.font.name,
      nodes,
    };
    if (Object.keys(icons).length) doc.icons = icons;
    const timeline = this.timeline.toJSON();
    if (timeline.steps.length || timeline.cursor) doc.timeline = timeline.steps;
    if (timeline.cursor) doc.cursor = timeline.cursor;
    return doc;
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
