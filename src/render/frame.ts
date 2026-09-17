/**
 * The frame tree: a minimal virtual SVG that both emitters consume. The string
 * emitter serialises it; the DOM patcher builds elements from it and replaces
 * only the groups whose serialised content changed.
 */
export interface VElement {
  tag: string;
  /** Insertion order is the serialisation order, so it must be deterministic. */
  attrs: Record<string, string | number | undefined>;
  children?: VElement[];
  text?: string;
}

export interface FrameGroup {
  /** A scene node id, or a reserved key such as `__bg` or `__cursor`. */
  key: string;
  /** Content hash of the serialised group, used by the DOM patcher. */
  hash: string;
  el: VElement;
  html: string;
}

export interface Frame {
  width: number;
  height: number;
  background?: string;
  groups: FrameGroup[];
}

/** Formats a number with at most two decimals and no trailing zeros or negative zero. */
export function fmt(n: number): string {
  const r = Math.round(n * 100) / 100;
  return String(r === 0 ? 0 : r);
}

export function escapeAttr(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/"/g, '&quot;');
}

export function escapeText(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

export function serializeAttrs(attrs: VElement['attrs']): string {
  let out = '';
  for (const key of Object.keys(attrs)) {
    const value = attrs[key];
    if (value === undefined) continue;
    out += ` ${key}="${escapeAttr(typeof value === 'number' ? fmt(value) : value)}"`;
  }
  return out;
}

export function serialize(el: VElement): string {
  const attrs = serializeAttrs(el.attrs);
  const inner = (el.text !== undefined ? escapeText(el.text) : '') + (el.children?.map(serialize).join('') ?? '');
  return inner ? `<${el.tag}${attrs}>${inner}</${el.tag}>` : `<${el.tag}${attrs}/>`;
}

export function h(tag: string, attrs: VElement['attrs'], children?: VElement[], text?: string): VElement {
  const el: VElement = { tag, attrs };
  if (children && children.length) el.children = children;
  if (text !== undefined) el.text = text;
  return el;
}
