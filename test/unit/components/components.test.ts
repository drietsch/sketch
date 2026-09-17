import { describe, expect, test } from 'vitest';
import { createDemo } from '../../../src/index.js';
import { componentFor } from '../../../src/components/index.js';
import { visibleValue, INPUT_HEIGHT, INPUT_PADDING_X } from '../../../src/components/input.js';
import { BUTTON_HEIGHT } from '../../../src/components/button.js';
import { FRAME_TITLE_HEIGHT } from '../../../src/components/frame.js';
import { BROWSER_BAR_HEIGHT, WINDOW_BAR_HEIGHT } from '../../../src/components/window.js';
import { DEFAULT_FONT } from '../../../src/text/index.js';
import type { RenderContext } from '../../../src/components/types.js';
import type { ButtonNode, ComponentState, InputNode, SceneNode } from '../../../src/core/types.js';

const make = () => createDemo({ width: 800, height: 600, seed: 3 });

function expand(
  demo: ReturnType<typeof make>,
  node: SceneNode,
  state: ComponentState = {},
  extra: Partial<RenderContext> = {},
) {
  const ctx: RenderContext = {
    theme: demo.theme,
    font: demo.font,
    icons: (i) => demo.resolveIcon(i),
    document: { width: demo.width, height: demo.height },
    bounds: (id) => demo.scene.bounds(id),
    state,
    ...extra,
  };
  return componentFor(node).expand(node, ctx);
}

describe('button', () => {
  test('auto-sizes to its label and icon, or takes explicit dimensions', () => {
    const demo = make();
    const a = demo.button({ id: 'a', x: 0, y: 0, characters: 'Sign in' });
    const b = demo.button({ id: 'b', x: 0, y: 0, characters: 'Sign in', icon: 'log-in' });
    const c = demo.button({ id: 'c', x: 0, y: 0, characters: 'Sign in', width: 300, height: 50 });
    const wa = demo.scene.bounds('a').width;
    expect(wa).toBe(Math.ceil(32 + DEFAULT_FONT.measure('Sign in', demo.theme.fontSize)));
    expect(demo.scene.bounds('b').width).toBe(wa + 18 + 8);
    expect(demo.scene.bounds('a').height).toBe(BUTTON_HEIGHT);
    expect(demo.scene.bounds('c')).toEqual({ x: 0, y: 0, width: 300, height: 50 });
    expect(demo.scene.isFocusable(a)).toBe(true);
    expect(demo.scene.isInteractive(b)).toBe(true);
    expect(demo.scene.isInteractive(c)).toBe(true);
  });

  test('parts: box and centred label; primary inverts colours; icon sits before the label', () => {
    const demo = make();
    const plain = demo.button({ id: 'p', x: 0, y: 0, characters: 'Go' });
    const parts = expand(demo, plain);
    expect(parts.map((p) => p.key)).toEqual(['box', 'label']);
    const label = parts[1] as Extract<(typeof parts)[number], { kind: 'text' }>;
    expect(label.color).toBe(demo.theme.text);
    expect(label.x).toBeCloseTo((demo.scene.bounds('p').width - DEFAULT_FONT.measure('Go', 14)) / 2, 6);

    const primary = demo.button({ id: 'q', x: 0, y: 0, characters: 'Go', variant: 'primary', icon: 'check' });
    const pp = expand(demo, primary);
    expect(pp.map((p) => p.key)).toEqual(['box', 'icon', 'label']);
    expect((pp[0] as { style: { fill?: string } }).style.fill).toBe(demo.theme.accent);
    expect((pp[2] as { color: string }).color).toBe(demo.theme.surface);
    const icon = pp[1] as Extract<(typeof pp)[number], { kind: 'icon' }>;
    expect(icon.x).toBeLessThan((pp[2] as { x: number }).x);
  });

  test('state changes the parts: hovered adds a hatch, pressed offsets everything', () => {
    const demo = make();
    const node = demo.button({ id: 'b', x: 0, y: 0, characters: 'Go' });
    expect(expand(demo, node, { hovered: true }).map((p) => p.key)).toEqual(['box', 'hover', 'label']);
    const pressed = expand(demo, node, { pressed: true });
    expect((pressed[0] as { x: number; y: number }).x).toBe(1);
    expect((pressed[1] as { x: number }).x).toBe((expand(demo, node)[1] as { x: number }).x + 1);
    expect((pressed[0] as { style: { strokeWeight: number } }).style.strokeWeight).toBeGreaterThan(
      demo.theme.strokeWeight,
    );
  });
});

describe('input', () => {
  test('bounds and placeholder / value parts', () => {
    const demo = make();
    const empty = demo.input({ id: 'e', x: 0, y: 0, width: 200, placeholder: 'Email' });
    expect(demo.scene.bounds('e')).toEqual({ x: 0, y: 0, width: 200, height: INPUT_HEIGHT });
    const parts = expand(demo, empty);
    expect(parts.map((p) => p.key)).toEqual(['box', 'placeholder']);
    expect((parts[1] as { color: string }).color).toBe(demo.theme.muted);

    const filled = demo.input({ id: 'f', x: 0, y: 0, width: 200, value: 'hello' });
    const fp = expand(demo, filled);
    expect(fp.map((p) => p.key)).toEqual(['box', 'value']);
    expect((fp[1] as { text: string }).text).toBe('hello');
    expect((fp[1] as { x: number }).x).toBe(INPUT_PADDING_X);
  });

  test('a live value overrides the authored one', () => {
    const demo = make();
    const node = demo.input({ id: 'i', x: 0, y: 0, width: 200, value: 'authored' });
    const parts = expand(demo, node, {}, { value: 'typed' });
    expect((parts[1] as { text: string }).text).toBe('typed');
    const cleared = expand(demo, node, {}, { value: '' });
    expect(cleared.map((p) => p.key)).toEqual(['box']);
  });

  test('focus turns the border accent and adds a caret after the value, blinking off on request', () => {
    const demo = make();
    const node = demo.input({ id: 'i', x: 0, y: 0, width: 200, value: 'ab' });
    const parts = expand(demo, node, { focused: true });
    expect(parts.map((p) => p.key)).toEqual(['box', 'value', 'caret']);
    expect((parts[0] as { style: { stroke: string } }).style.stroke).toBe(demo.theme.accent);
    const caret = parts[2] as Extract<(typeof parts)[number], { kind: 'raw' }>;
    expect(caret.el.tag).toBe('line');
    expect(caret.el.attrs.x1).toBe(INPUT_PADDING_X + DEFAULT_FONT.measure('ab', 14) + 1);
    expect(expand(demo, node, { focused: true }, { caretVisible: false }).map((p) => p.key)).toEqual(['box', 'value']);
    expect(expand(demo, node, { focused: false }).map((p) => p.key)).toEqual(['box', 'value']);
  });

  test('overflowing values scroll so the end stays visible', () => {
    const long = 'abcdefghijklmnopqrstuvwxyz'.repeat(3);
    const shown = visibleValue(DEFAULT_FONT, long, 14, 100);
    expect(long.endsWith(shown)).toBe(true);
    expect(shown.length).toBeLessThan(long.length);
    expect(DEFAULT_FONT.measure(shown, 14)).toBeLessThanOrEqual(100);
    expect(visibleValue(DEFAULT_FONT, 'short', 14, 1000)).toBe('short');
    expect(visibleValue(DEFAULT_FONT, 'x', 14, 0)).toBe('');
  });
});

describe('containers', () => {
  test('panel title creates a content offset; children are placed below it', () => {
    const demo = make();
    demo.frame({ id: 'p', x: 100, y: 100, width: 300, height: 200, title: 'Settings' });
    demo.frame({ id: 'q', x: 100, y: 400, width: 300, height: 100 });
    demo.rectangle({ id: 'child', parent: 'p', x: 10, y: 10, width: 20, height: 20 });
    expect(demo.scene.contentOrigin('p')).toEqual({ x: 100, y: 100 + FRAME_TITLE_HEIGHT });
    expect(demo.scene.contentOrigin('q')).toEqual({ x: 100, y: 400 });
    expect(demo.scene.bounds('child')).toEqual({ x: 110, y: 110 + FRAME_TITLE_HEIGHT, width: 20, height: 20 });
    expect(expand(demo, demo.scene.node('p')).map((p) => p.key)).toEqual(['box', 'title', 'divider']);
    expect(expand(demo, demo.scene.node('q')).map((p) => p.key)).toEqual(['box']);
    expect(demo.scene.isInteractive(demo.scene.node('p'))).toBe(true);
    expect(demo.scene.isFocusable(demo.scene.node('p'))).toBe(false);
  });

  test('window and browser chrome', () => {
    const demo = make();
    const w = demo.window({ id: 'w', x: 0, y: 0, width: 400, height: 300, title: 'Untitled' });
    const b = demo.browser({ id: 'b', x: 0, y: 0, width: 400, height: 300, url: 'https://example.com' });
    expect(w.chrome).toBe('window');
    expect(b.chrome).toBe('browser');
    expect(demo.scene.contentOrigin('w').y).toBe(WINDOW_BAR_HEIGHT);
    expect(demo.scene.contentOrigin('b').y).toBe(BROWSER_BAR_HEIGHT);
    const wk = expand(demo, w).map((p) => p.key);
    expect(wk).toEqual(['box', 'divider', 'light-0', 'light-1', 'light-2', 'title']);
    const bk = expand(demo, b).map((p) => p.key);
    expect(bk).toEqual(['box', 'divider', 'light-0', 'light-1', 'light-2', 'nav-0', 'nav-1', 'address', 'url']);
  });

  test('clicking inside a container but outside a control hits the container', () => {
    const demo = make();
    demo.frame({ id: 'p', x: 0, y: 0, width: 300, height: 300 });
    demo.button({ id: 'b', parent: 'p', x: 10, y: 10, characters: 'Go' });
    expect(demo.scene.hitTest({ x: 20, y: 20 })).toBe('b');
    expect(demo.scene.hitTest({ x: 200, y: 200 })).toBe('p');
    expect(demo.scene.hitTest({ x: 400, y: 400 })).toBeUndefined();
  });
});

describe('focus ring', () => {
  test('is drawn once, after the nodes, around the focused focusable node', () => {
    const demo = make();
    demo.input({ id: 'i', x: 50, y: 50, width: 200, state: { focused: true } });
    demo.button({ id: 'b', x: 50, y: 150, characters: 'Go' });
    const keys = demo.frameAt().groups.map((g) => g.key);
    expect(keys).toEqual(['i', 'b', '__focus']);
    const ring = demo.frameAt().groups[2];
    expect(ring.html).toContain('data-for="i"');
    expect(ring.html).toContain('translate(47 47)');
    expect(ring.html).toContain('stroke-dasharray="5 4"');
  });

  test('is not drawn for a focused flag on a non-focusable node', () => {
    const demo = make();
    demo.rectangle({ id: 'r', x: 0, y: 0, width: 10, height: 10 });
    (demo.scene.node('r') as unknown as { state: ComponentState }).state = { focused: true };
    expect(demo.frameAt().groups.map((g) => g.key)).toEqual(['r']);
  });
});

describe('icons per demo', () => {
  test('per-demo registrations resolve before built-ins and are used by nodes', () => {
    const demo = make();
    const custom = { nodes: [['path', { d: 'M0 0L24 24' }]] as [string, Record<string, string>][] };
    demo.registerIcon('check', custom);
    expect(demo.resolveIcon('check')).toBe(custom);
    demo.icon({ id: 'i', x: 0, y: 0, icon: 'check' });
    expect(demo.frameAt().groups[0].html).toContain('d="M0 0L24 24"');
    expect(() => demo.resolveIcon('nope')).toThrow(/Unknown icon "nope"/);
    expect(() => demo.registerIcon('', custom)).toThrow();
  });

  test('button icons accept a definition directly', () => {
    const demo = make();
    const node: ButtonNode = demo.button({
      id: 'b',
      x: 0,
      y: 0,
      characters: 'x',
      icon: { nodes: [['path', { d: 'M1 1L2 2' }]] },
    });
    expect(demo.frameAt().groups[0].html).toContain('d="M1 1L2 2"');
    expect(node.icon).toEqual({ nodes: [['path', { d: 'M1 1L2 2' }]] });
  });
});

describe('input typing helpers', () => {
  test('InputNode value defaults are respected in bounds', () => {
    const demo = make();
    const node: InputNode = demo.input({ id: 'i', x: 0, y: 0, width: 120, height: 50 });
    expect(demo.scene.bounds(node.id).height).toBe(50);
  });
});
