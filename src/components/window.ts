import type { WindowNode } from '../core/types.js';
import type { ComponentDef, Part } from './types.js';
import { centredTextTop, rectPart, textPart } from './common.js';
import { resolvePartStyle } from './style.js';
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
  interactive: true,
  localBounds: (node) => ({ x: 0, y: 0, width: node.width, height: node.height }),
  contentOffset: (node) => ({ x: 0, y: barHeight(node) }),
  expand: (node, ctx) => {
    const { theme, font } = ctx;
    const bar = barHeight(node);
    const fontSize = node.style?.fontSize ?? theme.fontSize;
    const base = resolvePartStyle(theme, node.style);
    const parts: Part[] = [
      rectPart('box', theme, {
        x: 0,
        y: 0,
        width: node.width,
        height: node.height,
        radius: RADIUS,
        style: node.style,
        overrides: { fill: node.style?.fill ?? theme.surface, fillStyle: node.style?.fillStyle ?? 'solid' },
      }),
      { key: 'divider', kind: 'line', x1: 0, y1: bar, x2: node.width, y2: bar, style: { ...base, fill: undefined } },
    ];
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
        rectPart('address', theme, {
          x: addressX,
          y: bar / 2 - addressHeight / 2,
          width: addressWidth,
          height: addressHeight,
          radius: addressHeight / 2,
          style: node.style,
          overrides: { stroke: theme.muted, fill: undefined, roughness: Math.min(base.roughness, 0.8) },
        }),
      );
      if (node.url) {
        const urlSize = Math.max(10, fontSize - 2);
        parts.push(
          textPart('url', theme, font, {
            x: addressX + 12,
            y: bar / 2 - addressHeight / 2 + centredTextTop(font, urlSize, addressHeight),
            text: visibleValue(font, node.url, urlSize, addressWidth - 24),
            fontSize: urlSize,
            color: theme.muted,
            style: node.style,
          }),
        );
      }
    } else if (node.title) {
      parts.push(
        textPart('title', theme, font, {
          x: node.width / 2,
          y: centredTextTop(font, fontSize, bar),
          text: node.title,
          fontSize,
          color: node.style?.color ?? theme.text,
          align: 'middle',
          style: node.style,
        }),
      );
    }
    if (node.chrome === 'browser' && node.title) {
      // A browser shows its title as a tab label above the address bar area is
      // too fussy at this size; put it centred in the bar like a window does
      // only when there is no url to show.
      if (!node.url) {
        parts.push(
          textPart('title', theme, font, {
            x: node.width / 2,
            y: centredTextTop(font, fontSize, bar),
            text: node.title,
            fontSize,
            color: node.style?.color ?? theme.text,
            align: 'middle',
            style: node.style,
          }),
        );
      }
    }
    return parts;
  },
};
