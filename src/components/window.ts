import type { WindowNode } from '../core/types.js';
import type { ComponentDef, Part } from './types.js';
import { centredTextTop, rectPart, textPart, TITLE_WEIGHT } from './common.js';
import { handFrameParts, handRuleParts } from './hand-frame.js';
import { fontSizeOf, hasOwnFill, resolvePartStyle, textColor } from './style.js';
import { visibleValue } from './input.js';

export const WINDOW_BAR_HEIGHT = 36;
export const BROWSER_BAR_HEIGHT = 44;
const LIGHT_COLOURS = ['#ff5f57', '#febc2e', '#28c840'];
const LIGHT_RADIUS = 5.5;
const RADIUS = 8;
const NAV_ICON = 16;

export function barHeight(node: WindowNode): number {
  return node.chrome === 'browser' ? BROWSER_BAR_HEIGHT : WINDOW_BAR_HEIGHT;
}

export const window: ComponentDef<WindowNode> = {
  resizable: true,
  container: true,
  intrinsicSize: true,
  interactive: true,
  localBounds: (node) => ({ x: 0, y: 0, width: node.width, height: node.height }),
  contentOffset: (node) => ({ x: 0, y: barHeight(node) }),
  expand: (node, ctx) => {
    const { theme, font } = ctx;
    const bar = barHeight(node);
    const fontSize = fontSizeOf(node.style, theme);
    const base = resolvePartStyle(theme, node);
    const boxOverrides: Parameters<typeof rectPart>[3]['overrides'] = {};
    if (!hasOwnFill(node)) boxOverrides.fill = theme.surface;
    if (node.sketch?.fillStyle === undefined) boxOverrides.fillStyle = 'solid';
    const box = { x: 0, y: 0, width: node.width, height: node.height };
    const hand = handFrameParts('frame-', theme, node, { ...box, overrides: boxOverrides });
    const parts: Part[] = [
      // The hand-drawn frame carries the outline, so the box is left as the fill it sits on.
      rectPart('box', theme, node, {
        ...box,
        cornerRadius: RADIUS,
        overrides: hand.length ? { ...boxOverrides, stroke: 'none' } : boxOverrides,
      }),
      ...hand,
    ];
    const rule = handRuleParts('divider-', theme, node, { x1: 0, y1: bar, x2: node.width, y2: bar });
    parts.push(
      ...(rule.length
        ? rule
        : [
            {
              key: 'divider',
              kind: 'line' as const,
              x1: 0,
              y1: bar,
              x2: node.width,
              y2: bar,
              style: { ...base, fill: undefined },
            },
          ]),
    );
    LIGHT_COLOURS.forEach((colour, i) => {
      parts.push({
        key: `light-${i}`,
        kind: 'ellipse',
        x: 14 + i * 20,
        y: bar / 2 - LIGHT_RADIUS,
        width: LIGHT_RADIUS * 2,
        height: LIGHT_RADIUS * 2,
        style: { ...base, fill: colour, fillStyle: 'solid', roughness: Math.min(base.roughness, 0.8) },
      });
    });
    const lightsEnd = 14 + 3 * 20;
    const titleColor = textColor(node.style, theme.text);
    if (node.chrome === 'browser') {
      // Back/forward arrows and a rounded address bar showing the url.
      ['arrow-left', 'arrow-right'].forEach((name, i) => {
        parts.push({
          key: `nav-${i}`,
          kind: 'icon',
          x: lightsEnd + 6 + i * (NAV_ICON + 8),
          y: bar / 2 - NAV_ICON / 2,
          size: NAV_ICON,
          icon: ctx.icons(name),
          color: theme.muted,
          style: base,
        });
      });
      const addressX = lightsEnd + 6 + 2 * (NAV_ICON + 8) + 4;
      const addressWidth = Math.max(40, node.width - addressX - 14);
      const addressHeight = 26;
      parts.push(
        rectPart('address', theme, node, {
          x: addressX,
          y: bar / 2 - addressHeight / 2,
          width: addressWidth,
          height: addressHeight,
          cornerRadius: addressHeight / 2,
          overrides: { stroke: theme.muted, fill: undefined, roughness: Math.min(base.roughness, 0.8) },
        }),
      );
      if (node.url) {
        const urlSize = Math.max(10, fontSize - 2);
        parts.push(
          textPart('url', theme, node, {
            x: addressX + 12,
            y: bar / 2 - addressHeight / 2 + centredTextTop(font, urlSize, addressHeight),
            text: visibleValue(font, node.url, urlSize, addressWidth - 24),
            fontSize: urlSize,
            color: theme.muted,
          }),
        );
      } else if (node.title) {
        parts.push(
          textPart('title', theme, node, {
            x: node.width / 2,
            y: centredTextTop(font, fontSize, bar),
            text: node.title,
            fontSize,
            color: titleColor,
            align: 'CENTER',
            weight: TITLE_WEIGHT,
          }),
        );
      }
    } else if (node.title) {
      parts.push(
        textPart('title', theme, node, {
          x: node.width / 2,
          y: centredTextTop(font, fontSize, bar),
          text: node.title,
          fontSize,
          color: titleColor,
          align: 'CENTER',
          weight: TITLE_WEIGHT,
        }),
      );
    }
    return parts;
  },
};
