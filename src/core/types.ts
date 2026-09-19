import type { FillStyle } from '../sketch/index.js';
import type { IconDef } from '../icons/types.js';

export type { FillStyle };

export interface Point {
  x: number;
  y: number;
}

export interface Size {
  width: number;
  height: number;
}

export interface Bounds extends Point, Size {}

/** An RGBA colour with components in 0..1, as Figma spells it. `a` defaults to 1. */
export interface Color {
  r: number;
  g: number;
  b: number;
  a?: number;
}

/** A Figma `Color`, or a CSS colour string for convenience. */
export type ColorLike = Color | string;

/** A solid paint. Only `SOLID` is supported; gradients and images are rejected at load. */
export interface SolidPaint {
  type: 'SOLID';
  color: ColorLike;
  /** 0..1, multiplied into the colour's alpha. */
  opacity?: number;
  /** Defaults to true; an invisible paint is skipped. */
  visible?: boolean;
}

export type Paint = SolidPaint;

/**
 * The hand-drawn look. Figma has no equivalent, so these live under their own
 * key. Unset fields fall back to the theme or the engine defaults.
 */
export interface SketchStyle {
  roughness?: number;
  bowing?: number;
  fillStyle?: FillStyle;
  hachureGap?: number;
  hachureAngle?: number;
  fillWeight?: number;
}

export type TextAlignHorizontal = 'LEFT' | 'CENTER' | 'RIGHT';

/** Text styling, a subset of Figma's TypeStyle. `fills` colours the glyphs. */
export interface TypeStyle {
  fontSize?: number;
  textAlignHorizontal?: TextAlignHorizontal;
  fills?: Paint[];
}

export interface Theme {
  stroke: string;
  text: string;
  accent: string;
  muted: string;
  surface: string;
  background: string;
  strokeWeight: number;
  roughness: number;
  bowing: number;
  radius: number;
  fontSize: number;
  /** Roughness applied to text strokes; text wants less wobble than boxes. */
  textRoughness: number;
}

/**
 * Authored component state. Interaction state (what the timeline does to a
 * component at time t) is derived per frame and is never written back here.
 */
export interface ComponentState {
  focused?: boolean;
  pressed?: boolean;
  hovered?: boolean;
  disabled?: boolean;
}

/** A model value a control carries: text, a number, a selection, or several selections. */
export type ControlValue = string | number | string[];

export type LayoutMode = 'NONE' | 'HORIZONTAL' | 'VERTICAL';
export type PrimaryAxisAlignItems = 'MIN' | 'CENTER' | 'MAX' | 'SPACE_BETWEEN';
export type CounterAxisAlignItems = 'MIN' | 'CENTER' | 'MAX';
export type LayoutSizing = 'FIXED' | 'HUG' | 'FILL';
export type LayoutPositioning = 'AUTO' | 'ABSOLUTE';

/**
 * Figma-style auto-layout of a container's content area. Every default is
 * omitted from the stored node. Children of a container with a `layoutMode`
 * are positioned by the layout unless they are `layoutPositioning: 'ABSOLUTE'`.
 */
export interface AutoLayoutProps {
  /** NONE (default): children sit at their own x/y. */
  layoutMode?: LayoutMode;
  /** Gap between children along the primary axis. */
  itemSpacing?: number;
  paddingLeft?: number;
  paddingRight?: number;
  paddingTop?: number;
  paddingBottom?: number;
  /** Where children sit along the primary axis when there is slack. */
  primaryAxisAlignItems?: PrimaryAxisAlignItems;
  /** Where each child sits across the primary axis. */
  counterAxisAlignItems?: CounterAxisAlignItems;
}

/**
 * What a click changes. `target` defaults to the node whose region was hit,
 * or, for an authored reaction, to the node the reaction sits on.
 */
export interface WidgetAction {
  target?: string;
  checked?: boolean;
  open?: boolean;
  value?: ControlValue;
  /** Move focus to the target (true) or clear it (false); unset leaves the default focus rule. */
  focus?: boolean;
}

/** What makes a reaction fire. Figma's trigger vocabulary; only clicks are understood so far. */
export type ReactionTrigger = 'ON_CLICK';

/**
 * An authored response to an interaction, as Figma names it. Where Figma
 * navigates between frames, a sketch reaction sets model state on a node, so
 * the action is the same `WidgetAction` a component's own click returns.
 */
export interface Reaction {
  trigger: ReactionTrigger;
  action: WidgetAction;
}

export interface NodeBase {
  id: string;
  /** Position relative to the parent's content origin, or the document. Ignored for AUTO children of a layout container. */
  x: number;
  y: number;
  parent?: string;
  /** ABSOLUTE children of a layout container keep their x/y and are skipped by the layout. */
  layoutPositioning?: LayoutPositioning;
  /** FIXED (default) uses the stored size; HUG wraps content (containers); FILL takes the parent's available space. */
  layoutSizingHorizontal?: LayoutSizing;
  layoutSizingVertical?: LayoutSizing;
  /** Defaults to true. An invisible node and its children are not rendered, hit-tested or targetable. */
  visible?: boolean;
  /** Fill paints, bottom to top; the first visible one is drawn. Absent: the component's default; empty: no fill. */
  fills?: Paint[];
  /** Stroke paints; the first visible one outlines the node. Absent: the theme stroke; empty: no outline. */
  strokes?: Paint[];
  strokeWeight?: number;
  /** Dash pattern for the outline, in user units. */
  strokeDashes?: number[];
  /** Whole-node opacity, 0..1. */
  opacity?: number;
  /** The hand-drawn look of this node. */
  sketch?: SketchStyle;
  /** Whether the node takes part in hit-testing. Components default to true, primitives to false. */
  interactive?: boolean;
  /** Re-rolls this node's sketch jitter without changing the document seed. */
  sketchVariant?: number;
  /**
   * Model state, Base UI's names. Authored here; the timeline overrides it live
   * (a click toggles `checked`, `choose` sets `value`) without writing back.
   */
  checked?: boolean;
  open?: boolean;
  value?: ControlValue;
  pressed?: boolean;
  /**
   * What clicking this node does, on top of whatever the component itself
   * does: a dialog's Cancel button closes the dialog, a link-like button
   * opens a popover. Every matching reaction fires, in order, after the
   * component's own effect, so a reaction can override it.
   */
  reactions?: Reaction[];
}

export interface RectangleNode extends NodeBase {
  type: 'RECTANGLE';
  width: number;
  height: number;
  cornerRadius?: number;
}

export interface EllipseNode extends NodeBase {
  type: 'ELLIPSE';
  width: number;
  height: number;
}

/** A line from (x, y) to (x2, y2), both in the parent's coordinate space. */
export interface LineNode extends NodeBase {
  type: 'LINE';
  x2: number;
  y2: number;
}

/** SVG path data in the node's local coordinate space (origin at x, y). */
export interface VectorNode extends NodeBase {
  type: 'VECTOR';
  d: string;
}

export interface TextNode extends NodeBase {
  type: 'TEXT';
  characters: string;
  style?: TypeStyle;
}

export interface IconNode extends NodeBase {
  type: 'ICON';
  /** A registered icon name, or an icon definition passed directly. */
  icon: string | IconDef;
  size?: number;
}

export interface ButtonNode extends NodeBase {
  type: 'BUTTON';
  characters: string;
  /** Styling of the label. */
  style?: TypeStyle;
  icon?: string | IconDef;
  width?: number;
  height?: number;
  variant?: 'default' | 'primary';
  state?: ComponentState;
}

export interface InputNode extends NodeBase {
  type: 'INPUT';
  width: number;
  height?: number;
  value?: string;
  placeholder?: string;
  /** Styling of the value and placeholder text. */
  style?: TypeStyle;
  state?: ComponentState;
}

/** A container, optionally with a title bar and auto-layout. Children are positioned from below the bar. */
export interface FrameNode extends NodeBase, AutoLayoutProps {
  type: 'FRAME';
  /** Required unless the horizontal sizing is HUG or FILL. */
  width?: number;
  /** Required unless the vertical sizing is HUG or FILL. */
  height?: number;
  title?: string;
  /** Styling of the title. */
  style?: TypeStyle;
}

export interface WindowNode extends NodeBase, AutoLayoutProps {
  type: 'WINDOW';
  width: number;
  height: number;
  title?: string;
  chrome: 'window' | 'browser';
  url?: string;
  /** Styling of the title and url text. */
  style?: TypeStyle;
}

export type Orientation = 'horizontal' | 'vertical';

/** Props shared by the in-place controls: an optional label and text styling. */
interface ControlBase extends NodeBase {
  /** Label drawn next to the control. */
  characters?: string;
  /** Styling of the label. */
  style?: TypeStyle;
  state?: ComponentState;
}

export interface CheckboxNode extends ControlBase {
  type: 'CHECKBOX';
  /** A dash instead of a check, for "some of these". */
  indeterminate?: boolean;
}

export interface CheckboxGroupNode extends ControlBase {
  type: 'CHECKBOX_GROUP';
  options: string[];
  /** The checked options. */
  value?: string[];
  orientation?: Orientation;
}

export interface SwitchNode extends ControlBase {
  type: 'SWITCH';
}

export interface ToggleNode extends ControlBase {
  type: 'TOGGLE';
  icon?: string | IconDef;
}

export interface ToggleGroupNode extends ControlBase {
  type: 'TOGGLE_GROUP';
  options: string[];
  /** One option, or several when `multiple`. */
  value?: string | string[];
  multiple?: boolean;
  orientation?: Orientation;
}

export interface RadioGroupNode extends ControlBase {
  type: 'RADIO_GROUP';
  options: string[];
  value?: string;
  orientation?: Orientation;
}

export interface SliderNode extends ControlBase {
  type: 'SLIDER';
  min?: number;
  max?: number;
  step?: number;
  value?: number;
  width: number;
}

export interface ProgressNode extends ControlBase {
  type: 'PROGRESS';
  value?: number;
  max?: number;
  indeterminate?: boolean;
  width: number;
}

export interface MeterNode extends ControlBase {
  type: 'METER';
  value?: number;
  min?: number;
  max?: number;
  width: number;
}

export interface SeparatorNode extends NodeBase {
  type: 'SEPARATOR';
  orientation?: Orientation;
  length: number;
}

export interface AvatarNode extends NodeBase {
  type: 'AVATAR';
  /** Initials. */
  characters?: string;
  icon?: string | IconDef;
  size?: number;
  style?: TypeStyle;
}

export interface NumberFieldNode extends ControlBase {
  type: 'NUMBER_FIELD';
  value?: number;
  min?: number;
  max?: number;
  step?: number;
  width: number;
  placeholder?: string;
}

export interface OtpFieldNode extends ControlBase {
  type: 'OTP_FIELD';
  /** Number of character slots. */
  length?: number;
  value?: string;
}

/** Containers: optional size like a frame (required on a FIXED axis), auto-layout props. */
interface ContainerBase extends NodeBase, AutoLayoutProps {
  width?: number;
  height?: number;
  style?: TypeStyle;
}

export interface FieldNode extends ContainerBase {
  type: 'FIELD';
  label?: string;
  description?: string;
  error?: string;
}

export interface FieldsetNode extends ContainerBase {
  type: 'FIELDSET';
  legend?: string;
}

export interface FormNode extends ContainerBase {
  type: 'FORM';
}

export interface ToolbarNode extends ContainerBase {
  type: 'TOOLBAR';
  orientation?: Orientation;
}

export interface CollapsibleNode extends ContainerBase {
  type: 'COLLAPSIBLE';
  /** The header text; clicking it toggles `open`. */
  characters: string;
  state?: ComponentState;
}

export interface AccordionItem {
  label: string;
  /** Body text shown while the item is open. */
  characters?: string;
}

export interface AccordionNode extends NodeBase {
  type: 'ACCORDION';
  items: (string | AccordionItem)[];
  /** Open item label(s). */
  value?: string | string[];
  multiple?: boolean;
  width: number;
  style?: TypeStyle;
  state?: ComponentState;
}

export interface TabsNode extends ContainerBase {
  type: 'TABS';
  tabs: string[];
  /** The active tab; the child at its index is shown, the others hidden. */
  value?: string;
  state?: ComponentState;
}

// --- popups and overlays -------------------------------------------------

export type Side = 'top' | 'bottom' | 'left' | 'right';

/** A popup attached to another node: placed against it, opened from it. Its own x and y are ignored. */
interface AnchoredBase extends NodeBase {
  /** The node this popup is attached to. */
  anchor: string;
  side?: Side;
  style?: TypeStyle;
}

export interface TooltipNode extends AnchoredBase {
  type: 'TOOLTIP';
  characters: string;
  /** Hover time before it shows, in ms. */
  delay?: number;
}

export interface PreviewCardNode extends AnchoredBase {
  type: 'PREVIEW_CARD';
  title?: string;
  description?: string;
  width?: number;
  delay?: number;
}

export interface PopoverNode extends AnchoredBase, AutoLayoutProps {
  type: 'POPOVER';
  title?: string;
  description?: string;
  width?: number;
  height?: number;
}

/** An entry of a menu: a label, a rich item (with `items` for a submenu), or '-' for a separator. */
export type MenuItem = string | { label: string; icon?: string | IconDef; disabled?: boolean; items?: MenuItem[] };

export interface MenuNode extends NodeBase {
  type: 'MENU';
  /** The trigger button's label and icon. */
  characters?: string;
  icon?: string | IconDef;
  items: MenuItem[];
  /** The last chosen item. */
  value?: string;
  width?: number;
  style?: TypeStyle;
  state?: ComponentState;
}

export interface ContextMenuNode extends AnchoredBase {
  type: 'CONTEXT_MENU';
  items: MenuItem[];
  value?: string;
  width?: number;
}

export interface MenuGroup {
  label: string;
  items: MenuItem[];
}

export interface MenubarNode extends NodeBase {
  type: 'MENUBAR';
  menus: MenuGroup[];
  /** The open menu's label. */
  value?: string;
  style?: TypeStyle;
  state?: ComponentState;
}

export interface SelectNode extends ControlBase {
  type: 'SELECT';
  options: string[];
  value?: string;
  placeholder?: string;
  width: number;
}

export interface ComboboxNode extends ControlBase {
  type: 'COMBOBOX';
  options: string[];
  value?: string;
  placeholder?: string;
  width: number;
}

export interface AutocompleteNode extends ControlBase {
  type: 'AUTOCOMPLETE';
  options: string[];
  value?: string;
  placeholder?: string;
  width: number;
}

/** A modal panel centred over a dimmed page. Children are its content, laid out below the description. */
export interface DialogNode extends ContainerBase {
  type: 'DIALOG';
  title: string;
  description?: string;
}

export interface AlertDialogNode extends ContainerBase {
  type: 'ALERT_DIALOG';
  title: string;
  description?: string;
}

export interface DrawerNode extends ContainerBase {
  type: 'DRAWER';
  title?: string;
  side?: Side;
}

export type ToastVariant = 'info' | 'success' | 'warning' | 'error';

export interface ToastNode extends NodeBase {
  type: 'TOAST';
  title: string;
  description?: string;
  variant?: ToastVariant;
  /** Position in the stack from the corner, 0 first. */
  stack?: number;
  width?: number;
  style?: TypeStyle;
}

export interface NavigationItem {
  label: string;
  /** Entries of the dropdown this item opens. */
  items?: MenuItem[];
}

export interface NavigationMenuNode extends NodeBase {
  type: 'NAVIGATION_MENU';
  items: NavigationItem[];
  /** The open item's label. */
  value?: string;
  style?: TypeStyle;
  state?: ComponentState;
}

/** A viewport over taller content: children are clipped and scrolled by `value`. */
export interface ScrollAreaNode extends ContainerBase {
  type: 'SCROLL_AREA';
  width: number;
  height: number;
  /** Height of the content, which sets the scroll range. */
  contentHeight: number;
  /** Scroll offset in px. */
  value?: number;
  state?: ComponentState;
}

/**
 * Marks drawn over a finished interface, the way someone reviewing it would:
 * a highlighter band, a ring around a control, an underline, an arrow. All of
 * them take their box from `target` when it is set, so a mark follows what it
 * annotates; without one they sit at their own `x`/`y` and size. Marks are
 * never hit-tested, so a click passes through to the interface beneath.
 */
export interface AnnotationBase extends NodeBase {
  /** The node this mark is drawn over. Its laid-out box wins over `x`, `y`, `width` and `height`. */
  target?: string;
  /** Grows the target's box before the mark is drawn, so a ring clears what it circles (negative shrinks it). */
  spread?: number;
  width?: number;
  height?: number;
}

/** A marker band swept across the box, translucent so the interface reads through it. */
export interface HighlightNode extends AnnotationBase {
  type: 'HIGHLIGHT';
  /** `marker` (default): one thick sweep. `block`: the whole box filled. */
  variant?: 'marker' | 'block';
}

/** A ring drawn around the box, the way someone circles what matters. */
export interface EncircleNode extends AnnotationBase {
  type: 'ENCIRCLE';
  shape?: 'oval' | 'rect';
  /** How many times the pen goes round; 2 (the default) reads as hand-drawn, 3 as emphatic. */
  passes?: number;
}

export type UnderlineVariant = 'straight' | 'double' | 'wavy' | 'zigzag' | 'scribble' | 'loop';

/** A line under the box, or struck through it. */
export interface UnderlineNode extends AnnotationBase {
  type: 'UNDERLINE';
  variant?: UnderlineVariant;
  /** `under` (default) sits below the box; `through` crosses its middle, which is a strikethrough. */
  placement?: 'under' | 'through';
}

/** An endpoint of an arrow: a node, whose edge the arrow meets, or a point in document coordinates. */
export type ArrowEnd = string | Point;

/** Which edge of a node an arrow leaves or meets. `auto` takes the shortest way between the two boxes. */
export type ArrowSide = 'auto' | 'top' | 'right' | 'bottom' | 'left';

export interface ArrowNode extends NodeBase {
  type: 'ARROW';
  from: ArrowEnd;
  to: ArrowEnd;
  /** The shaft's shape. `curved` and `s` bow by `bend`; `elbow` turns a right angle. */
  curve?: 'straight' | 'curved' | 's' | 'elbow';
  /** How far a curved shaft bows, as a fraction of its length. Default 0.2. */
  bend?: number;
  /** Which ends carry a head. Default `end`. */
  head?: 'end' | 'start' | 'both' | 'none';
  /** Length of the head's strokes. Default 14. */
  headSize?: number;
  /** Clears this much space between the shaft and a node endpoint. Default 6. */
  gap?: number;
  /** The edge of `from` the shaft leaves. Default `auto`. Ignored when `from` is a point. */
  fromSide?: ArrowSide;
  /** The edge of `to` the shaft meets. Default `auto`. Ignored when `to` is a point. */
  toSide?: ArrowSide;
  /** Set by the layout from the endpoints; authoring them has no effect. */
  width?: number;
  height?: number;
}

export type CalloutShape = 'bubble' | 'burst' | 'cloud';

/**
 * A bubble carrying a note. With a `target` it sits on the given side of that
 * node and grows a tail back to it, so moving either one keeps the tail
 * pointing at the right thing.
 */
export interface CalloutNode extends NodeBase {
  type: 'CALLOUT';
  characters: string;
  /** The node the bubble is about. Without one it sits at its own `x`/`y` and grows no tail. */
  target?: string;
  /** Which way the bubble sits from the target. Default `top`. */
  side?: 'top' | 'bottom' | 'left' | 'right';
  /** Where it slides along that side. Default `center`. */
  align?: 'start' | 'center' | 'end';
  /** Space between the bubble and the target, which the tail crosses. Default 22. */
  gap?: number;
  shape?: CalloutShape;
  /** Text wraps to this width. Default 170. */
  width?: number;
  height?: number;
  style?: TypeStyle;
}

export type SceneNode =
  | RectangleNode
  | EllipseNode
  | LineNode
  | VectorNode
  | TextNode
  | IconNode
  | ButtonNode
  | InputNode
  | FrameNode
  | WindowNode
  | CheckboxNode
  | CheckboxGroupNode
  | SwitchNode
  | ToggleNode
  | ToggleGroupNode
  | RadioGroupNode
  | SliderNode
  | ProgressNode
  | MeterNode
  | SeparatorNode
  | AvatarNode
  | NumberFieldNode
  | OtpFieldNode
  | FieldNode
  | FieldsetNode
  | FormNode
  | ToolbarNode
  | CollapsibleNode
  | AccordionNode
  | TabsNode
  | TooltipNode
  | PreviewCardNode
  | PopoverNode
  | MenuNode
  | ContextMenuNode
  | MenubarNode
  | SelectNode
  | ComboboxNode
  | AutocompleteNode
  | DialogNode
  | AlertDialogNode
  | DrawerNode
  | ToastNode
  | NavigationMenuNode
  | ScrollAreaNode
  | HighlightNode
  | EncircleNode
  | UnderlineNode
  | ArrowNode
  | CalloutNode;

export type NodeType = SceneNode['type'];
export type NodeOf<T extends NodeType> = Extract<SceneNode, { type: T }>;
export type DistributiveOmit<T, K extends PropertyKey> = T extends unknown ? Omit<T, K> : never;

/** A partial update for a node. For the full union this accepts any node type's fields. */
export type NodePatch<N extends SceneNode = SceneNode> = Partial<DistributiveOmit<N, 'id' | 'type'>>;
