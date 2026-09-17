import { SVGNS } from '../sketch/index.js';
import type { Frame, VElement } from './frame.js';
import { fmt } from './frame.js';

/** Builds a DOM subtree from a virtual element. */
export function createElement(doc: Document, el: VElement): Element {
  const node = doc.createElementNS(SVGNS, el.tag);
  for (const key of Object.keys(el.attrs)) {
    const value = el.attrs[key];
    if (value === undefined) continue;
    node.setAttribute(key, typeof value === 'number' ? fmt(value) : value);
  }
  if (el.text !== undefined) node.appendChild(doc.createTextNode(el.text));
  for (const child of el.children ?? []) node.appendChild(createElement(doc, child));
  return node;
}

/**
 * Brings an <svg> element in line with a frame, touching as little as
 * possible: a group whose content hash matches the element already in place
 * is kept (so the browser does no work for it), everything else is rebuilt,
 * and the children are re-ordered to the frame's paint order. Between two
 * frames of a moving cursor only the cursor group changes.
 */
export function patchDOM(svg: SVGSVGElement, frame: Frame): void {
  const doc = svg.ownerDocument;
  // Same root attributes, in the same order, as the string emitter, so a
  // serialised live document equals toSVG(t).
  setAttr(svg, 'xmlns', SVGNS);
  setAttr(svg, 'width', fmt(frame.width));
  setAttr(svg, 'height', fmt(frame.height));
  setAttr(svg, 'viewBox', `0 0 ${fmt(frame.width)} ${fmt(frame.height)}`);

  const existing = new Map<string, Element>();
  for (const child of Array.from(svg.children)) {
    const key = child.getAttribute('data-key');
    if (key !== null && !existing.has(key)) existing.set(key, child);
    else child.remove();
  }

  let cursor: Element | null = null;
  const place = (el: Element) => {
    const next = cursor ? cursor.nextSibling : svg.firstChild;
    if (next !== el) svg.insertBefore(el, next);
    cursor = el;
  };

  const bg = existing.get('__bg');
  existing.delete('__bg');
  if (frame.background !== undefined) {
    let rect = bg && bg.tagName.toLowerCase() === 'rect' ? bg : null;
    if (!rect) {
      bg?.remove();
      rect = doc.createElementNS(SVGNS, 'rect');
      rect.setAttribute('data-key', '__bg');
    }
    setAttr(rect, 'width', fmt(frame.width));
    setAttr(rect, 'height', fmt(frame.height));
    setAttr(rect, 'fill', frame.background);
    place(rect);
  } else {
    bg?.remove();
  }

  for (const group of frame.groups) {
    const current = existing.get(group.key);
    existing.delete(group.key);
    if (current && current.getAttribute('data-h') === group.hash) {
      place(current);
    } else {
      const fresh = createElement(doc, group.el);
      if (current) current.replaceWith(fresh);
      place(fresh);
    }
  }
  for (const stale of existing.values()) stale.remove();
}

function setAttr(el: Element, name: string, value: string): void {
  if (el.getAttribute(name) !== value) el.setAttribute(name, value);
}
