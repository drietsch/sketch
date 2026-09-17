import type { Frame } from './frame.js';
import { escapeAttr, fmt } from './frame.js';
import { SVGNS } from '../sketch/index.js';

export function rootAttrs(frame: Frame): string {
  return ` xmlns="${SVGNS}" width="${fmt(frame.width)}" height="${fmt(frame.height)}" viewBox="0 0 ${fmt(frame.width)} ${fmt(frame.height)}"`;
}

export function backgroundHtml(frame: Frame): string {
  return frame.background === undefined
    ? ''
    : `<rect data-key="__bg" width="${fmt(frame.width)}" height="${fmt(frame.height)}" fill="${escapeAttr(frame.background)}"/>`;
}

/** Serialises a frame to a complete SVG document, byte-stable for identical frames. */
export function frameToSVG(frame: Frame): string {
  let out = `<svg${rootAttrs(frame)}>${backgroundHtml(frame)}`;
  for (const g of frame.groups) out += g.html;
  return out + '</svg>';
}
