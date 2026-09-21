import type { CheckboxGroupNode, RadioGroupNode, ToggleGroupNode } from '../core/types.js';
import type { ComponentDef, Part, Region } from './types.js';
import { BUTTON_HEIGHT } from './button.js';
import {
  CONTROL,
  GROUP_GAP,
  LABEL_GAP,
  checkBoxParts,
  controlWidth,
  labelPart,
  optionBoxes,
  optionRegions,
  selected,
  union,
  validateOptions,
} from './controls.js';
import { centredTextTop, rectPart, textPart } from './common.js';
import { fontSizeOf, textColor } from './style.js';

type Group = RadioGroupNode | CheckboxGroupNode;

function boxes(node: Group, ctx: Parameters<ComponentDef<Group>['localBounds']>[1]) {
  const fontSize = fontSizeOf(node.style, ctx.theme);
  return optionBoxes(node.options, node.orientation ?? 'vertical', CONTROL, (o) =>
    controlWidth(ctx.font, fontSize, CONTROL, o),
  );
}

/** Radio and checkbox groups: one small control per option, stacked or in a row. */
function boxGroup<N extends Group>(round: boolean): ComponentDef<N> {
  return {
    focusable: true,
    interactive: true,
    capabilities: round ? { choose: true } : { check: true, choose: true },
    validate: (node) => validateOptions(node.options, node.value, !round),
    localBounds: (node, ctx) => union(boxes(node, ctx)),
    expand: (node, ctx) => {
      const value = ctx.value ?? node.value;
      const parts: Part[] = [];
      boxes(node, ctx).forEach((box, i) => {
        const option = node.options[i];
        parts.push(
          ...checkBoxParts(`${i}.`, ctx.theme, node, ctx, box.x, box.y, selected(value, option), false, round),
        );
        parts.push(
          labelPart(`${i}.label`, ctx.theme, ctx.font, node, option, box.x + CONTROL + LABEL_GAP, box.y, CONTROL),
        );
      });
      return parts;
    },
    regions: (node, ctx) => {
      const value = ctx.value ?? node.value;
      return optionRegions(node.options, boxes(node, ctx), (option) => {
        if (round) return { value: option };
        const current = Array.isArray(value) ? value : [];
        return { value: current.includes(option) ? current.filter((v) => v !== option) : [...current, option] };
      });
    },
  } as ComponentDef<N>;
}

export const radioGroup = boxGroup<RadioGroupNode>(true);
export const checkboxGroup = boxGroup<CheckboxGroupNode>(false);

const TOGGLE_PADDING = 12;

/** A row of toggle buttons sharing one selection. */
export const toggleGroup: ComponentDef<ToggleGroupNode> = {
  focusable: true,
  interactive: true,
  capabilities: { choose: true, check: true },
  validate: (node) => validateOptions(node.options, node.value, !!node.multiple),
  localBounds: (node, ctx) => union(toggleBoxes(node, ctx)),
  expand: (node, ctx) => {
    const { theme, font } = ctx;
    const value = ctx.value ?? node.value;
    const fontSize = fontSizeOf(node.style, theme);
    const parts: Part[] = [];
    toggleBoxes(node, ctx).forEach((box, i) => {
      const option = node.options[i];
      const down = selected(value, option);
      parts.push(
        rectPart(`${i}.box`, theme, node, {
          x: box.x,
          y: box.y,
          width: box.width,
          height: box.height,
          cornerRadius: theme.radius,
          overrides: down
            ? { fill: theme.accent, fillStyle: 'hachure', hachureGap: 5 }
            : { fill: theme.surface, fillStyle: 'solid' },
        }),
        textPart(`${i}.label`, theme, node, {
          x: box.x + TOGGLE_PADDING,
          y: box.y + centredTextTop(font, fontSize, box.height),
          text: option,
          fontSize,
          color: textColor(node.style, theme.text),
          halo: down ? theme.surface : undefined,
        }),
      );
    });
    return parts;
  },
  regions: (node, ctx): Region[] => {
    const value = ctx.value ?? node.value;
    return optionRegions(node.options, toggleBoxes(node, ctx), (option) => {
      if (!node.multiple) return { value: option };
      const current = Array.isArray(value) ? value : [];
      return { value: current.includes(option) ? current.filter((v) => v !== option) : [...current, option] };
    });
  },
};

function toggleBoxes(node: ToggleGroupNode, ctx: Parameters<ComponentDef<ToggleGroupNode>['localBounds']>[1]) {
  const fontSize = fontSizeOf(node.style, ctx.theme);
  const orientation = node.orientation ?? 'horizontal';
  let x = 0;
  let y = 0;
  return node.options.map((option) => {
    const width = Math.ceil(TOGGLE_PADDING * 2 + ctx.font.measure(option, fontSize));
    const box = { x, y, width, height: BUTTON_HEIGHT };
    if (orientation === 'horizontal') x += width + GROUP_GAP / 2;
    else y += BUTTON_HEIGHT + GROUP_GAP / 2;
    return box;
  });
}
