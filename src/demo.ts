import { Scene } from './core/scene.js';
import type {
  ButtonNode,
  EllipseNode,
  FrameNode,
  IconNode,
  InputNode,
  LineNode,
  RectangleNode,
  SceneNode,
  TextNode,
  Theme,
  NodeType,
  NodeOf,
  NodePatch,
  VectorNode,
  WindowNode,
  CheckboxNode,
  CheckboxGroupNode,
  SwitchNode,
  ToggleNode,
  ToggleGroupNode,
  RadioGroupNode,
  SliderNode,
  ProgressNode,
  MeterNode,
  SeparatorNode,
  AvatarNode,
  NumberFieldNode,
  OtpFieldNode,
  FieldNode,
  FieldsetNode,
  FormNode,
  ToolbarNode,
  CollapsibleNode,
  AccordionNode,
  TabsNode,
  TooltipNode,
  PreviewCardNode,
  PopoverNode,
  MenuNode,
  ContextMenuNode,
  MenubarNode,
  SelectNode,
  ComboboxNode,
  AutocompleteNode,
  DialogNode,
  AlertDialogNode,
  DrawerNode,
  ToastNode,
  NavigationMenuNode,
  ScrollAreaNode,
  HighlightNode,
  EncircleNode,
  UnderlineNode,
  ArrowNode,
  CalloutNode,
} from './core/types.js';
import type { IconDef } from './icons/types.js';
import { resolvePlacement, splitPlacement } from './core/place.js';
import type { Placement } from './core/place.js';
import { expandPadding } from './core/layout.js';
import { componentFor } from './components/index.js';
import type { Padding } from './core/layout.js';
import type { DistributiveOmit } from './core/types.js';
import { getIcon, isBuiltinIcon } from './icons/registry.js';
import { flatten, parseDemoJSON } from './core/json.js';
import type { DemoJSON } from './core/json.js';
import { Timeline } from './timeline/timeline.js';
import { compile } from './timeline/compile.js';
import { caretVisible, stateAt } from './timeline/state.js';
import type { CompiledTimeline, InteractionState, Step } from './timeline/types.js';
import { CursorRenderer } from './render/chrome.js';
import { patchDOM } from './render/patch-dom.js';
import { Player } from './player/player.js';
import type { PlayerOptions } from './player/player.js';
import { SVGNS } from './sketch/index.js';
import type { NodeInteraction } from './render/build-frame.js';
import type { Scene as SceneType } from './core/scene.js';
import { BUILTIN_FONTS, DEFAULT_FONT } from './text/index.js';
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

/** Node props with literal coordinates: everything but `type`, with `id` optional. */
export type Props<N extends SceneNode> = Omit<N, 'type' | 'id'> & { id?: string };

/**
 * Node props placed relative to an existing node (`below`, `above`, `rightOf`,
 * `leftOf`). `x`/`y` become optional overrides for the cross axis.
 */
export type RelativeProps<N extends SceneNode> = Omit<N, 'type' | 'id' | 'x' | 'y'> & {
  id?: string;
  x?: number;
  y?: number;
} & Placement;

/**
 * Node props for a child of an auto-layout container: the layout decides the
 * position, so `x`/`y` are optional (and ignored unless ABSOLUTE).
 */
export type LayoutChildProps<N extends SceneNode> = Omit<N, 'type' | 'id' | 'x' | 'y'> & {
  id?: string;
  parent: string;
  x?: number;
  y?: number;
};

/** Node props for a node placed by something else: a popup on its anchor, a mark on what it annotates. So `x`/`y` are optional. */
export type AnchoredProps<N extends SceneNode> = Omit<N, 'type' | 'id' | 'x' | 'y'> & {
  id?: string;
  x?: number;
  y?: number;
};

/** What every factory accepts: literal coordinates, a placement relative to another node, or a slot in a layout container. */
export type NodeProps<N extends SceneNode> = Props<N> | RelativeProps<N> | LayoutChildProps<N>;

/** Container props may also give `padding` as a shorthand for the four sides. */
export type ContainerProps<N extends SceneNode> = NodeProps<N> & { padding?: Padding };

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
  // A built-in font is found by its name; any other must be supplied.
  const font = options.font ?? (doc.font !== undefined ? BUILTIN_FONTS.get(doc.font) : undefined) ?? DEFAULT_FONT;
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
  for (const node of flatten(doc.children)) {
    try {
      demo.scene.add(node);
    } catch (e) {
      throw new Error(`loadDemo: node "${node.id}": ${(e as Error).message}`, { cause: e });
    }
  }
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
    this.scene = new Scene(
      {
        theme: this.theme,
        font: this.font,
        icons: (icon) => this.resolveIcon(icon),
        document: { width: this.width, height: this.height },
      },
      // Removing a node through the scene is the one removal path; it frees the
      // node's cached geometry here so nothing leaks.
      { onRemove: (ids) => ids.forEach((id) => this.adapter.forget(id)) },
    );
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

  rectangle(props: NodeProps<RectangleNode>): RectangleNode {
    return this.add('RECTANGLE', props);
  }

  ellipse(props: NodeProps<EllipseNode>): EllipseNode {
    return this.add('ELLIPSE', props);
  }

  line(props: NodeProps<LineNode>): LineNode {
    return this.add('LINE', props);
  }

  /** A shape from SVG path data, in local coordinates. */
  vector(props: NodeProps<VectorNode>): VectorNode {
    return this.add('VECTOR', props);
  }

  text(props: NodeProps<TextNode>): TextNode {
    return this.add('TEXT', props);
  }

  icon(props: NodeProps<IconNode>): IconNode {
    return this.add('ICON', props);
  }

  button(props: NodeProps<ButtonNode>): ButtonNode {
    return this.add('BUTTON', props);
  }

  input(props: NodeProps<InputNode>): InputNode {
    return this.add('INPUT', props);
  }

  /** A container, optionally with a title bar and auto-layout. */
  frame(props: ContainerProps<FrameNode>): FrameNode {
    return this.add('FRAME', props);
  }

  window(
    props: DistributiveOmit<ContainerProps<WindowNode>, 'chrome'> & { chrome?: WindowNode['chrome'] },
  ): WindowNode {
    return this.add('WINDOW', { chrome: 'window', ...props } as NodeProps<WindowNode>);
  }

  /** A window with browser chrome: navigation arrows and an address bar. */
  browser(props: DistributiveOmit<ContainerProps<WindowNode>, 'chrome'>): WindowNode {
    return this.add('WINDOW', { ...props, chrome: 'browser' } as NodeProps<WindowNode>);
  }

  // --- controls (Base UI's catalogue) ------------------------------------

  checkbox(props: NodeProps<CheckboxNode>): CheckboxNode {
    return this.add('CHECKBOX', props);
  }

  checkboxGroup(props: NodeProps<CheckboxGroupNode>): CheckboxGroupNode {
    return this.add('CHECKBOX_GROUP', props);
  }

  switch(props: NodeProps<SwitchNode>): SwitchNode {
    return this.add('SWITCH', props);
  }

  toggle(props: NodeProps<ToggleNode>): ToggleNode {
    return this.add('TOGGLE', props);
  }

  toggleGroup(props: NodeProps<ToggleGroupNode>): ToggleGroupNode {
    return this.add('TOGGLE_GROUP', props);
  }

  radioGroup(props: NodeProps<RadioGroupNode>): RadioGroupNode {
    return this.add('RADIO_GROUP', props);
  }

  slider(props: NodeProps<SliderNode>): SliderNode {
    return this.add('SLIDER', props);
  }

  progress(props: NodeProps<ProgressNode>): ProgressNode {
    return this.add('PROGRESS', props);
  }

  meter(props: NodeProps<MeterNode>): MeterNode {
    return this.add('METER', props);
  }

  separator(props: NodeProps<SeparatorNode>): SeparatorNode {
    return this.add('SEPARATOR', props);
  }

  avatar(props: NodeProps<AvatarNode>): AvatarNode {
    return this.add('AVATAR', props);
  }

  numberField(props: NodeProps<NumberFieldNode>): NumberFieldNode {
    return this.add('NUMBER_FIELD', props);
  }

  otpField(props: NodeProps<OtpFieldNode>): OtpFieldNode {
    return this.add('OTP_FIELD', props);
  }

  /** A label above one control, with an optional description or error below. Hugs its control vertically by default. */
  field(props: ContainerProps<FieldNode>): FieldNode {
    return this.add('FIELD', { layoutMode: 'VERTICAL', layoutSizingVertical: 'HUG', ...props } as NodeProps<FieldNode>);
  }

  fieldset(props: ContainerProps<FieldsetNode>): FieldsetNode {
    return this.add('FIELDSET', props);
  }

  /** A vertical stack of fields by default. */
  form(props: ContainerProps<FormNode>): FormNode {
    return this.add('FORM', { layoutMode: 'VERTICAL', itemSpacing: 10, ...props } as NodeProps<FormNode>);
  }

  /** A row of controls by default. */
  toolbar(props: ContainerProps<ToolbarNode>): ToolbarNode {
    const vertical = (props as { orientation?: string }).orientation === 'vertical';
    return this.add('TOOLBAR', {
      layoutMode: vertical ? 'VERTICAL' : 'HORIZONTAL',
      padding: 6,
      itemSpacing: 6,
      ...props,
    } as NodeProps<ToolbarNode>);
  }

  collapsible(props: ContainerProps<CollapsibleNode>): CollapsibleNode {
    return this.add('COLLAPSIBLE', {
      layoutMode: 'VERTICAL',
      layoutSizingVertical: 'HUG',
      itemSpacing: 10,
      ...props,
    } as NodeProps<CollapsibleNode>);
  }

  accordion(props: NodeProps<AccordionNode>): AccordionNode {
    return this.add('ACCORDION', props);
  }

  tabs(props: ContainerProps<TabsNode>): TabsNode {
    return this.add('TABS', props);
  }

  // --- popups and overlays. Anchored ones need no x/y: they sit by their anchor or the page's edge.

  /** A short label shown while `anchor` is hovered. */
  tooltip(props: AnchoredProps<TooltipNode>): TooltipNode {
    return this.add('TOOLTIP', props as NodeProps<TooltipNode>);
  }

  previewCard(props: AnchoredProps<PreviewCardNode>): PreviewCardNode {
    return this.add('PREVIEW_CARD', props as NodeProps<PreviewCardNode>);
  }

  /** A panel toggled by a click on `anchor`; children are its content, stacked vertically by default. */
  popover(props: AnchoredProps<PopoverNode> & { padding?: Padding }): PopoverNode {
    return this.add('POPOVER', {
      layoutMode: 'VERTICAL',
      layoutSizingVertical: 'HUG',
      padding: 12,
      itemSpacing: 8,
      ...props,
    } as NodeProps<PopoverNode>);
  }

  /** A button that drops a list of items. */
  menu(props: NodeProps<MenuNode>): MenuNode {
    return this.add('MENU', props);
  }

  /** A list of items opened by a click on `anchor`. */
  contextMenu(props: AnchoredProps<ContextMenuNode>): ContextMenuNode {
    return this.add('CONTEXT_MENU', props as NodeProps<ContextMenuNode>);
  }

  menubar(props: NodeProps<MenubarNode>): MenubarNode {
    return this.add('MENUBAR', props);
  }

  select(props: NodeProps<SelectNode>): SelectNode {
    return this.add('SELECT', props);
  }

  combobox(props: NodeProps<ComboboxNode>): ComboboxNode {
    return this.add('COMBOBOX', props);
  }

  autocomplete(props: NodeProps<AutocompleteNode>): AutocompleteNode {
    return this.add('AUTOCOMPLETE', props);
  }

  /** A modal centred on the page over a backdrop; children stack below the description. */
  dialog(props: AnchoredProps<DialogNode> & { padding?: Padding }): DialogNode {
    return this.add('DIALOG', {
      layoutMode: 'VERTICAL',
      layoutSizingVertical: 'HUG',
      padding: 20,
      itemSpacing: 12,
      ...props,
    } as NodeProps<DialogNode>);
  }

  alertDialog(props: AnchoredProps<AlertDialogNode> & { padding?: Padding }): AlertDialogNode {
    return this.add('ALERT_DIALOG', {
      layoutMode: 'VERTICAL',
      layoutSizingVertical: 'HUG',
      padding: 20,
      itemSpacing: 12,
      ...props,
    } as NodeProps<AlertDialogNode>);
  }

  /** A panel at a page edge (right by default) over a backdrop. */
  drawer(props: AnchoredProps<DrawerNode> & { padding?: Padding }): DrawerNode {
    return this.add('DRAWER', {
      layoutMode: 'VERTICAL',
      padding: 20,
      itemSpacing: 12,
      ...props,
    } as NodeProps<DrawerNode>);
  }

  /** A notice in the bottom-right corner, shown unless `open: false`. */
  toast(props: AnchoredProps<ToastNode>): ToastNode {
    return this.add('TOAST', { open: true, ...props } as NodeProps<ToastNode>);
  }

  navigationMenu(props: NodeProps<NavigationMenuNode>): NavigationMenuNode {
    return this.add('NAVIGATION_MENU', props);
  }

  /** A viewport over taller content: children are clipped and scrolled by `value`. */
  scrollArea(props: ContainerProps<ScrollAreaNode>): ScrollAreaNode {
    return this.add('SCROLL_AREA', props);
  }

  // --- annotation marks. With a `target` they take its box, so they need no x/y.

  /** A translucent marker band over `target`, or over a box of its own. */
  highlight(props: AnchoredProps<HighlightNode>): HighlightNode {
    return this.add('HIGHLIGHT', props as NodeProps<HighlightNode>);
  }

  /** A hand-drawn ring around `target`. */
  encircle(props: AnchoredProps<EncircleNode>): EncircleNode {
    return this.add('ENCIRCLE', props as NodeProps<EncircleNode>);
  }

  /** A line under `target`, or struck through it. */
  underline(props: AnchoredProps<UnderlineNode>): UnderlineNode {
    return this.add('UNDERLINE', props as NodeProps<UnderlineNode>);
  }

  /** An arrow from one node or point to another. */
  arrow(props: AnchoredProps<ArrowNode>): ArrowNode {
    return this.add('ARROW', props as NodeProps<ArrowNode>);
  }

  /** A bubble carrying a note, on a side of `target`, with a tail back to it. */
  callout(props: AnchoredProps<CalloutNode>): CalloutNode {
    return this.add('CALLOUT', props as NodeProps<CalloutNode>);
  }

  /** Total length of the timeline in ms; 0 for a static scene. */
  get duration(): number {
    return this.compiled().duration;
  }

  /**
   * The timeline resolved against the current scene, recompiled lazily when
   * either changes. Not part of the package surface: the compiled form is an
   * implementation detail that tests inspect.
   * @internal
   */
  compiled(): CompiledTimeline {
    const c = this.compiledCache;
    if (c && c.sceneVersion === this.scene.version && c.timelineVersion === this.timeline.version) return c;
    const size = { width: this.width, height: this.height };
    const fresh = compile(this.timeline, this.scene, this.seed, size, {
      theme: this.theme,
      font: this.font,
      icons: (icon) => this.resolveIcon(icon),
      document: size,
    });
    this.compiledCache = fresh;
    return fresh;
  }

  /** The interaction state at time t: cursor, focus, pressed node, live values, scene patches. */
  stateAt(t: number): InteractionState {
    return stateAt(this.compiled(), t);
  }

  /** The frame at time t (ms) as a virtual SVG tree. Pure: the same inputs always give the same frame. */
  frameAt(t = 0): Frame {
    const size = { width: this.width, height: this.height };
    const base = {
      theme: this.theme,
      font: this.font,
      icons: (icon: string | IconDef) => this.resolveIcon(icon),
      document: size,
    };
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
    for (const [id, checked] of state.checked) {
      if (scene.has(id)) touch(id).checked = checked;
    }
    for (const [id, open] of state.open) {
      if (scene.has(id)) touch(id).open = open;
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
    return frameToSVG(this.frameAt(t));
  }

  /**
   * Renders into the document: into the given <svg>, or into a new <svg>
   * appended to the container. Returns a Player that drives the timeline.
   */
  mount(container: Element, options: PlayerOptions = {}): Player {
    const svg =
      container.namespaceURI === SVGNS && container.tagName.toLowerCase() === 'svg'
        ? (container as SVGSVGElement)
        : null;
    const target = svg ?? (container.ownerDocument.createElementNS(SVGNS, 'svg') as SVGSVGElement);
    if (!svg) container.appendChild(target);
    return new Player(this, target, options);
  }

  /** Renders the frame at t into an existing <svg>, replacing only what changed. */
  renderInto(svg: SVGSVGElement, t = 0): void {
    patchDOM(svg, this.frameAt(t));
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
   * patches and live value, checked and open state applied. The scene itself
   * is never mutated by playback.
   */
  nodeAt<N extends SceneNode = SceneNode>(id: string, t: number): N {
    const node = this.scene.node<N>(id);
    if (this.timeline.steps.length === 0) return node;
    const state = this.stateAt(t);
    const patch = state.patches.get(id);
    const value = state.values.get(id);
    const checked = state.checked.get(id);
    const open = state.open.get(id);
    if (!patch && value === undefined && checked === undefined && open === undefined) return node;
    const out = Object.assign({}, node) as N;
    if (patch) Object.assign(out, patch);
    if (value !== undefined) out.value = value;
    // A TOGGLE keeps its "checked" state under Base UI's name for it.
    if (checked !== undefined) out[node.type === 'TOGGLE' ? 'pressed' : 'checked'] = checked;
    if (open !== undefined) out.open = open;
    return out;
  }

  private patchedCache?: { compiled: CompiledTimeline; key: string; scene: SceneType };

  /**
   * The scene with the timeline's `set` patches applied. Cached per distinct
   * patch state, so a player pays one clone (and one layout) per `set` step
   * rather than per frame.
   */
  private patchedScene(state: InteractionState): SceneType {
    // Live model state of components whose layout depends on it is applied
    // like a `set` patch, so the layout pass and child visibility see it.
    const patches = new Map<string, NodePatch>(state.patches);
    const layoutState = (id: string, patch: NodePatch) => {
      const node = this.scene.get(id);
      if (!node || !componentFor(node).layoutDependsOnState) return;
      patches.set(id, { ...patches.get(id), ...patch });
    };
    for (const [id, open] of state.open) layoutState(id, { open });
    for (const [id, value] of state.values) layoutState(id, { value });
    for (const [id, checked] of state.checked) layoutState(id, { checked });
    if (patches.size === 0) return this.scene;
    const compiled = this.compiled();
    const key = JSON.stringify([...patches]);
    const c = this.patchedCache;
    if (c && c.compiled === compiled && c.key === key) return c.scene;
    const scene = this.scene.clone();
    for (const [id, patch] of patches) {
      if (scene.has(id)) scene.update<SceneNode>(id, patch);
    }
    this.patchedCache = { compiled, key, scene };
    return scene;
  }

  /**
   * A plain, JSON-serialisable description of the whole demo. Icons referred
   * to by name that are not built in are embedded so the document stands alone.
   */
  toJSON(): DemoJSON {
    const children = this.scene.toJSON();
    const icons: Record<string, IconDef> = {};
    for (const [name, def] of this.icons) icons[name] = def;
    for (const node of this.scene.all()) {
      const ref = node.type === 'ICON' || node.type === 'BUTTON' ? node.icon : undefined;
      if (typeof ref === 'string' && !(ref in icons) && !isBuiltinIcon(ref)) {
        const def = getIcon(ref);
        if (def) icons[ref] = def;
      }
    }
    const doc: DemoJSON = {
      version: 2,
      width: this.width,
      height: this.height,
      seed: this.seed,
      theme: { ...this.theme },
      background: this.background ?? null,
      font: this.font.name,
      children,
    };
    if (Object.keys(icons).length) doc.icons = icons;
    const timeline = this.timeline.toJSON();
    if (timeline.steps.length || timeline.cursor) doc.timeline = timeline.steps;
    if (timeline.cursor) doc.cursor = timeline.cursor;
    return doc;
  }

  private add<T extends NodeType>(type: T, props: NodeProps<NodeOf<T>>): NodeOf<T> {
    const id = props.id ?? this.ids.next(type, (candidate) => this.scene.has(candidate));
    // Placement and padding shorthands must never reach the stored node: they would leak into toJSON().
    const { placement, rest } = splitPlacement(id, type, props as Record<string, unknown>);
    expandPadding(id, rest);
    if (!placement) {
      if (typeof rest.x !== 'number' || typeof rest.y !== 'number') {
        // Inside a container the position may be left to the container: an
        // auto-layout parent positions the child; any other container puts it
        // at its content origin.
        const parent = typeof rest.parent === 'string' ? this.scene.get(rest.parent) : undefined;
        const def = componentFor({ type } as SceneNode);
        const probe = { ...rest, id, type } as SceneNode;
        // A popup sits on its anchor and a mark on what it annotates; neither needs x/y.
        const placed = def.anchor?.(probe) !== undefined || (def.fit?.placed(probe) ?? false);
        if (!placed && (parent === undefined || !componentFor(parent).container)) {
          throw new Error(
            `Node "${id}" needs x and y, a placement (below, above, rightOf, leftOf), or a container parent.`,
          );
        }
        rest.x ??= 0;
        rest.y ??= 0;
      }
      return this.scene.add({ ...rest, id, type } as unknown as NodeOf<T>);
    }
    const provisional = { ...rest, id, type, x: 0, y: 0 } as unknown as NodeOf<T>;
    const opts = { parentGiven: 'parent' in rest, x: rest.x as number | undefined, y: rest.y as number | undefined };
    const placed = resolvePlacement(this.scene, provisional, placement, opts);
    const node = { ...provisional, x: placed.x, y: placed.y } as NodeOf<T> & {
      parent?: string;
      x2?: number;
      y2?: number;
    };
    if (placed.parent !== undefined) node.parent = placed.parent;
    else delete node.parent;
    if (node.type === 'LINE') {
      // A line's geometry is its (x2 - x, y2 - y) vector; a placed line keeps
      // that vector, so x2/y2 are read as offsets from the resolved origin.
      node.x2 = (node.x2 ?? 0) + placed.x;
      node.y2 = (node.y2 ?? 0) + placed.y;
    }
    return this.scene.add(node);
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
