import type { NodeOf, NodeType, SceneNode } from '../core/types.js';
import type { ComponentDef } from './types.js';
import { ellipse, icon, line, rectangle, text, vector } from './primitives.js';
import { button } from './button.js';
import { input } from './input.js';
import { frame } from './frame.js';
import { window } from './window.js';
import { checkbox } from './checkbox.js';
import { switch_ } from './switch.js';
import { toggle } from './toggle.js';
import { checkboxGroup, radioGroup, toggleGroup } from './option-groups.js';
import { slider } from './slider.js';
import { meter, progress } from './progress.js';
import { separator } from './separator.js';
import { avatar } from './avatar.js';
import { numberField } from './number-field.js';
import { otpField } from './otp-field.js';
import { field, fieldset, form, toolbar } from './form-containers.js';
import { accordion, collapsible, tabs } from './disclosure.js';

const COMPONENTS: { [T in NodeType]?: ComponentDef<NodeOf<T>> } = {
  RECTANGLE: rectangle,
  ELLIPSE: ellipse,
  LINE: line,
  VECTOR: vector,
  TEXT: text,
  ICON: icon,
  BUTTON: button,
  INPUT: input,
  FRAME: frame,
  WINDOW: window,
  CHECKBOX: checkbox,
  CHECKBOX_GROUP: checkboxGroup,
  SWITCH: switch_,
  TOGGLE: toggle,
  TOGGLE_GROUP: toggleGroup,
  RADIO_GROUP: radioGroup,
  SLIDER: slider,
  PROGRESS: progress,
  METER: meter,
  SEPARATOR: separator,
  AVATAR: avatar,
  NUMBER_FIELD: numberField,
  OTP_FIELD: otpField,
  FIELD: field,
  FIELDSET: fieldset,
  FORM: form,
  TOOLBAR: toolbar,
  COLLAPSIBLE: collapsible,
  ACCORDION: accordion,
  TABS: tabs,
};

export function hasComponent(type: string): type is NodeType {
  return Object.hasOwn(COMPONENTS, type);
}

export function componentFor<N extends SceneNode>(node: N): ComponentDef<N> {
  const def = COMPONENTS[node.type];
  if (!def) {
    throw new Error(`Unknown node type "${node.type}"`);
  }
  return def as unknown as ComponentDef<N>;
}

export function registerComponent<T extends NodeType>(type: T, def: ComponentDef<NodeOf<T>>): void {
  (COMPONENTS as Record<string, ComponentDef<SceneNode>>)[type] = def as unknown as ComponentDef<SceneNode>;
}

export type { ComponentDef, LayoutContext, Part, PartStyle, RenderContext } from './types.js';
