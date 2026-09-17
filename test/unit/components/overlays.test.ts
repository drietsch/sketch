import { describe, expect, test } from 'vitest';
import { createDemo, loadDemo } from '../../../src/index.js';
import { componentFor } from '../../../src/components/index.js';
import { placeAnchored } from '../../../src/core/layout.js';
import { CompileError } from '../../../src/timeline/compile.js';
import type { RenderContext } from '../../../src/components/types.js';
import type { ComponentState } from '../../../src/core/types.js';

const make = () => createDemo({ width: 800, height: 600, seed: 3 });
type Demo = ReturnType<typeof make>;

function ctxFor(demo: Demo, state: ComponentState = {}, extra: Partial<RenderContext> = {}): RenderContext {
  return {
    theme: demo.theme,
    font: demo.font,
    icons: (i) => demo.resolveIcon(i),
    document: { width: demo.width, height: demo.height },
    bounds: (id) => demo.scene.bounds(id),
    state,
    ...extra,
  };
}
const expand = (demo: Demo, id: string, extra: Partial<RenderContext> = {}) => {
  const node = demo.scene.resolved(id);
  return componentFor(node).expand(node, ctxFor(demo, {}, extra));
};
const regions = (demo: Demo, id: string, extra: Partial<RenderContext> = {}) => {
  const node = demo.scene.resolved(id);
  return componentFor(node).regions?.(node, ctxFor(demo, {}, extra)) ?? [];
};
const keys = (parts: { key: string }[]) => parts.map((p) => p.key);
const groupKeys = (demo: Demo, t: number) => demo.frameAt(t).groups.map((g) => g.key);
const of = (demo: Demo, authored: number) => demo.compiled().steps.filter((s) => s.authored === authored);
const types = (demo: Demo, authored: number) => of(demo, authored).map((s) => s.step.type);

describe('anchoring', () => {
  const doc = { width: 800, height: 600 };
  const anchor = { x: 100, y: 100, width: 80, height: 40 };
  const size = { width: 40, height: 20 };

  test('a popup sits outside its anchor on the given side, aligned along it, and stays on the page', () => {
    expect(placeAnchored({ side: 'top', gap: 10 }, anchor, size, doc, false)).toEqual({ x: 120, y: 70 });
    expect(placeAnchored({ side: 'bottom', align: 'start' }, anchor, size, doc, false)).toEqual({ x: 100, y: 140 });
    expect(placeAnchored({ side: 'right', align: 'end', gap: 4 }, anchor, size, doc, false)).toEqual({
      x: 184,
      y: 120,
    });
    expect(placeAnchored({ side: 'left' }, anchor, size, doc, false)).toEqual({ x: 60, y: 110 });
    expect(placeAnchored({ side: 'center' }, anchor, size, doc, false)).toEqual({ x: 120, y: 110 });
    expect(placeAnchored({ side: 'top' }, { x: 0, y: 5, width: 10, height: 10 }, size, doc, false)).toEqual({
      x: 0,
      y: 0,
    });
  });

  test('against the document the side is an edge and the gap an inset', () => {
    const page = { x: 0, y: 0, ...doc };
    expect(placeAnchored({ side: 'center' }, page, size, doc, true)).toEqual({ x: 380, y: 290 });
    expect(placeAnchored({ side: 'bottom', align: 'end', gap: 16 }, page, size, doc, true)).toEqual({ x: 744, y: 564 });
    expect(placeAnchored({ side: 'right' }, page, size, doc, true)).toEqual({ x: 760, y: 290 });
    expect(
      placeAnchored({ side: 'top', align: 'start', gap: 8, offset: { x: 1, y: 2 } }, page, size, doc, true),
    ).toEqual({ x: 9, y: 10 });
  });

  test('the layout places anchored nodes after everything else, even when the anchor comes later or the popup is nested', () => {
    const demo = make();
    demo.frame({ id: 'card', x: 50, y: 50, width: 300, height: 200 });
    demo.button({ id: 'go', parent: 'card', x: 20, y: 100, characters: 'Go' });
    demo.tooltip({ id: 'tip', parent: 'card', anchor: 'go', characters: 'Go now' });
    // Painted before its anchor, yet placed by it.
    demo.scene.sendToBack('tip');
    const go = demo.scene.bounds('go');
    const tip = demo.scene.bounds('tip');
    expect(tip.y + tip.height).toBe(go.y - 10);
    expect(tip.x + tip.width / 2).toBeCloseTo(go.x + go.width / 2, 6);
    // Anchored nodes ignore their own coordinates and a parent's auto-layout flow.
    demo.frame({ id: 'row', x: 0, y: 400, width: 400, height: 60, layoutMode: 'HORIZONTAL', itemSpacing: 10 });
    demo.button({ id: 'a', parent: 'row', characters: 'A' });
    demo.tooltip({ id: 'a-tip', parent: 'row', anchor: 'a', characters: 'A', x: 999, y: 999 });
    demo.button({ id: 'b', parent: 'row', characters: 'B' });
    expect(demo.scene.bounds('b').x).toBe(demo.scene.bounds('a').x + demo.scene.bounds('a').width + 10);
    expect(demo.scene.bounds('a-tip').y).toBeLessThan(demo.scene.bounds('a').y);
  });

  test('an unknown or self anchor is rejected; a popup may anchor to another popup', () => {
    const demo = make();
    expect(() => demo.tooltip({ id: 'x', anchor: 'nope', characters: 'x' })).toThrow(/anchor "nope" does not exist/);
    expect(() => demo.tooltip({ id: 'y', anchor: 'y', characters: 'y' })).toThrow(/cannot anchor to itself/);
    demo.button({ id: 'go', x: 100, y: 100, characters: 'Go' });
    demo.popover({ id: 'pop', anchor: 'go', open: true, title: 'Hi' });
    demo.tooltip({ id: 'pop-tip', anchor: 'pop', characters: 'On the popover', side: 'right' });
    expect(demo.scene.bounds('pop-tip').x).toBe(demo.scene.bounds('pop').x + demo.scene.bounds('pop').width + 10);
  });
});

describe('tooltip and preview card', () => {
  test('hovering the anchor opens the tooltip after its delay, resting so it is seen; leaving closes it', () => {
    const demo = make();
    demo.button({ id: 'save', x: 100, y: 100, characters: 'Save' });
    demo.button({ id: 'other', x: 400, y: 400, characters: 'Other' });
    demo.tooltip({ id: 'tip', anchor: 'save', characters: 'Saves', delay: 250 });
    expect(expand(demo, 'tip')).toEqual([]);
    expect(keys(expand(demo, 'tip', { open: true }))).toEqual(['panel', 'arrow', 'label']);
    demo.timeline.hover('save').click('other');
    expect(types(demo, 0)).toEqual(['moveCursor', 'hover', 'hover']);
    const [, delay, rest] = of(demo, 0);
    expect(delay.end - delay.start).toBe(250);
    expect(delay.effects).toEqual([{ id: 'tip', open: true }]);
    expect(demo.nodeAt('tip', rest.start).open).toBe(true);
    expect(groupKeys(demo, rest.start).indexOf('tip')).toBeGreaterThan(groupKeys(demo, rest.start).indexOf('other'));
    const [away] = of(demo, 1);
    expect(away.step.type).toBe('moveCursor');
    expect(away.effects).toEqual([{ id: 'tip', open: false }]);
    expect(demo.nodeAt('tip', demo.duration).open).toBe(false);
  });

  test('hover and open on the tooltip itself act on its anchor; a preview card has a body region', () => {
    const demo = make();
    demo.text({ id: 'who', x: 100, y: 100, characters: '@ada' });
    demo.previewCard({
      id: 'card',
      anchor: 'who',
      title: 'Ada',
      description: 'A long description that wraps onto several lines of the card.',
    });
    demo.timeline.hover('card').wait(10).open('card');
    expect(of(demo, 0)[0].step).toEqual({ type: 'moveCursor', target: 'who' });
    expect(demo.nodeAt('card', of(demo, 0).at(-1)!.end).open).toBe(true);
    expect(types(demo, 2)).toEqual(['moveCursor']);
    const parts = expand(demo, 'card', { open: true });
    expect(keys(parts)).toEqual(['shadow', 'panel', 'arrow', 'title', 'description']);
    expect((parts[4] as { text: string }).text).toContain('\n');
    expect(regions(demo, 'card', { open: true }).map((r) => r.key)).toEqual(['body']);
    expect(demo.scene.bounds('card').height).toBeGreaterThan(60);
  });
});

describe('popover', () => {
  function shareDemo() {
    const demo = make();
    demo.button({ id: 'share', x: 100, y: 100, characters: 'Share' });
    demo.button({ id: 'elsewhere', x: 600, y: 500, characters: 'Elsewhere' });
    demo.popover({ id: 'pop', anchor: 'share', title: 'Share', width: 240 });
    demo.input({ id: 'email', parent: 'pop', width: 216, placeholder: 'Email' });
    demo.button({ id: 'send', parent: 'pop', characters: 'Send' });
    return demo;
  }

  test('a click on the anchor toggles it; open and close click the anchor; an outside click dismisses it', () => {
    const demo = shareDemo();
    expect(groupKeys(demo, 0)).not.toContain('send');
    demo.timeline.click('share').click('share').open('pop').click('elsewhere').open('pop').close('pop');
    const c = demo.compiled();
    expect(of(demo, 0).at(-1)!.effects).toEqual([{ id: 'pop', open: true }]);
    expect(of(demo, 1).at(-1)!.effects).toEqual([{ id: 'pop', open: false }]);
    expect(of(demo, 2).at(-1)!.click?.hit).toBe('share');
    expect(demo.nodeAt('pop', of(demo, 2).at(-1)!.end).open).toBe(true);
    expect(of(demo, 3).at(-1)!.effects).toEqual([{ id: 'pop', open: false }]);
    expect(of(demo, 5).at(-1)!.click?.hit).toBe('share');
    expect(demo.nodeAt('pop', c.duration).open).toBe(false);
    const open = of(demo, 2).at(-1)!.end;
    const shown = groupKeys(demo, open);
    expect(shown.indexOf('send')).toBeGreaterThan(shown.indexOf('elsewhere'));
    expect(shown.indexOf('pop')).toBeGreaterThan(shown.indexOf('elsewhere'));
  });

  test('children of an open popover are laid out below its header and take clicks over its body', () => {
    const demo = shareDemo();
    demo.timeline.open('pop').type('email', 'x@y.z').click('send');
    const c = demo.compiled();
    const last = c.steps.at(-1)!;
    expect(last.click?.hit).toBe('send');
    expect(demo.nodeAt('email', c.duration).value).toBe('x@y.z');
    expect(demo.nodeAt('pop', c.duration).open).toBe(true);
    demo.scene.update('pop', { open: true });
    const pop = demo.scene.bounds('pop');
    const email = demo.scene.bounds('email');
    expect(email.y).toBeGreaterThan(pop.y + 20);
    expect(demo.scene.bounds('send').y).toBeGreaterThan(email.y + email.height);
    expect(pop.height).toBeGreaterThan(demo.scene.bounds('send').y + 36 - pop.y);
    expect(demo.scene.hitTestDetailed({ x: email.x + 5, y: email.y + 5 }, () => ctxFor(demo))?.id).toBe('email');
  });
});

describe('menus', () => {
  test('a menu button drops its items; choosing one records it and closes; separators and disabled items are drawn', () => {
    const demo = make();
    demo.menu({
      id: 'file',
      x: 20,
      y: 20,
      characters: 'File',
      items: ['New', '-', { label: 'Quit', icon: 'log-out' }, { label: 'Nope', disabled: true }],
    });
    expect(keys(expand(demo, 'file'))).toEqual(['box', 'label', 'chevron']);
    const open = keys(expand(demo, 'file', { open: true }));
    expect(open).toEqual(
      expect.arrayContaining([
        'menu.panel',
        'menu.0.label',
        'menu.1.sep',
        'menu.2.icon',
        'menu.2.label',
        'menu.3.label',
      ]),
    );
    expect(regions(demo, 'file').map((r) => r.key)).toEqual(['trigger']);
    const rs = regions(demo, 'file', { open: true });
    expect(rs.map((r) => r.key)).toEqual(['trigger', 'menu.body', 'option:New', 'option:Quit', 'option:Nope']);
    expect(rs.at(-1)!.action).toBeUndefined();
    demo.timeline.choose('file', 'Quit');
    expect(types(demo, 0)).toEqual(['moveCursor', 'click', 'moveCursor', 'click']);
    expect(demo.nodeAt('file', demo.duration)).toMatchObject({ value: 'Quit', open: false });
    demo.timeline.reset().choose('file', 'Nope');
    expect(() => demo.compiled()).toThrow(/has no option "Nope"/);
    expect(() => demo.menu({ id: 'bad', x: 0, y: 0, items: [] })).toThrow(/non-empty/);
  });

  test('a context menu opens over its anchor on a click there and closes on an outside click', () => {
    const demo = make();
    demo.rectangle({ id: 'area', x: 100, y: 100, width: 300, height: 200 });
    demo.button({ id: 'away', x: 600, y: 500, characters: 'Away' });
    demo.contextMenu({ id: 'ctx', anchor: 'area', items: ['Open', 'Rename'] });
    const b = demo.scene.bounds('ctx');
    expect(b.x + b.width / 2).toBeCloseTo(250, 6);
    expect(expand(demo, 'ctx')).toEqual([]);
    demo.timeline.open('ctx').choose('ctx', 'Rename').open('ctx').click('away');
    // A plain rectangle is not interactive, so the click hits nothing, yet it opens the menu anchored to it.
    expect(of(demo, 0).at(-1)!.click?.hit).toBeUndefined();
    expect(of(demo, 0).at(-1)!.effects).toEqual([{ id: 'ctx', open: true }]);
    expect(demo.nodeAt('ctx', of(demo, 0).at(-1)!.end).open).toBe(true);
    expect(demo.nodeAt('ctx', of(demo, 1).at(-1)!.end)).toMatchObject({ value: 'Rename', open: false });
    expect(demo.nodeAt('ctx', demo.duration).open).toBe(false);
  });

  test('a menubar opens one menu at a time; a navigation menu mixes links and dropdowns', () => {
    const demo = make();
    demo.menubar({
      id: 'bar',
      x: 20,
      y: 20,
      menus: [
        { label: 'File', items: ['New'] },
        { label: 'Edit', items: ['Cut', 'Paste'] },
      ],
    });
    demo.navigationMenu({
      id: 'nav',
      x: 20,
      y: 100,
      items: [{ label: 'Products', items: ['Editor'] }, { label: 'Pricing' }],
    });
    expect(keys(expand(demo, 'bar'))).toEqual(['bar', '0.label', '1.label']);
    expect(keys(expand(demo, 'nav'))).toEqual(['0.label', '0.chevron', '1.label']);
    expect(regions(demo, 'bar').map((r) => r.action)).toEqual([
      { value: 'File', open: true },
      { value: 'Edit', open: true },
    ]);
    demo.timeline
      .choose('bar', 'Edit')
      .choose('bar', 'Paste')
      .choose('nav', 'Pricing')
      .choose('nav', 'Products')
      .choose('nav', 'Editor');
    expect(demo.nodeAt('bar', of(demo, 0).at(-1)!.end)).toMatchObject({ value: 'Edit', open: true });
    expect(keys(expand(demo, 'bar', { open: true, value: 'Edit' }))).toContain('1.active');
    expect(regions(demo, 'bar', { open: true, value: 'Edit' }).map((r) => r.key)).toContain('option:Paste');
    expect(demo.nodeAt('bar', of(demo, 1).at(-1)!.end)).toMatchObject({ value: 'Paste', open: false });
    expect(demo.nodeAt('nav', of(demo, 2).at(-1)!.end)).toMatchObject({ value: 'Pricing', open: false });
    expect(demo.nodeAt('nav', demo.duration)).toMatchObject({ value: 'Editor', open: false });
    expect(() => demo.menubar({ id: 'bad', x: 0, y: 0, menus: [{ label: 'X', items: [] }] })).toThrow(/non-empty/);
  });
});

describe('select, combobox and autocomplete', () => {
  test('a select drops its options on a click and marks the current one; choose picks by value', () => {
    const demo = make();
    demo.select({ id: 'country', x: 20, y: 20, width: 200, options: ['Austria', 'Germany'], value: 'Austria' });
    expect(keys(expand(demo, 'country'))).toEqual(['box', 'value', 'chevron']);
    expect(keys(expand(demo, 'country', { open: true }))).toEqual(
      expect.arrayContaining(['list.panel', 'list.0.highlight', 'list.0.check', 'list.0.label', 'list.1.label']),
    );
    expect(keys(expand(demo, demo.select({ id: 'empty', x: 20, y: 80, width: 200, options: ['A'] }).id))).toEqual([
      'box',
      'placeholder',
      'chevron',
    ]);
    demo.timeline.choose('country', 'Germany').click('empty');
    expect(types(demo, 0)).toEqual(['moveCursor', 'click', 'moveCursor', 'click']);
    expect(demo.nodeAt('country', of(demo, 0).at(-1)!.end)).toMatchObject({ value: 'Germany', open: false });
    // Opening another select's list closes nothing else, and a click elsewhere closes it.
    expect(demo.nodeAt('empty', demo.duration).open).toBe(true);
    expect(() => demo.select({ id: 'bad', x: 0, y: 0, width: 10, options: ['A'], value: 'B' })).toThrow(/one of A/);
  });

  test('typing into a combobox opens and filters its list; choosing fills the box', () => {
    const demo = make();
    demo.combobox({ id: 'city', x: 20, y: 20, width: 200, options: ['Berlin', 'Bern', 'Vienna'], placeholder: 'City' });
    demo.autocomplete({ id: 'q', x: 20, y: 80, width: 200, options: ['Invoices', 'Inventory'] });
    expect(keys(expand(demo, 'city'))).toEqual(['box', 'placeholder', 'chevron']);
    expect(keys(expand(demo, 'q'))).toEqual(['box']);
    expect(regions(demo, 'q')).toEqual([]);
    expect(regions(demo, 'city', { open: true, value: 'ber' }).map((r) => r.key)).toEqual([
      'trigger',
      'list.body',
      'option:Berlin',
      'option:Bern',
    ]);
    expect(keys(expand(demo, 'city', { open: true, value: 'zzz' }))).toContain('list.0.label');
    demo.timeline.type('city', 'Ber').choose('city', 'Bern').type('q', 'Inve').choose('q', 'Inventory');
    expect(types(demo, 0)).toEqual(['open', 'type']);
    expect(demo.nodeAt('city', of(demo, 0).at(-1)!.end)).toMatchObject({ value: 'Ber', open: true });
    expect(demo.nodeAt('city', of(demo, 1).at(-1)!.end)).toMatchObject({ value: 'Bern', open: false });
    expect(demo.nodeAt('q', demo.duration)).toMatchObject({ value: 'Inventory', open: false });
  });
});

describe('dialogs, drawer and toasts', () => {
  function confirmDemo() {
    const demo = make();
    demo.button({ id: 'trash', x: 20, y: 20, characters: 'Trash' });
    demo.dialog({ id: 'confirm', title: 'Delete?', description: 'This cannot be undone.', width: 300 });
    demo.button({ id: 'cancel', parent: 'confirm', characters: 'Cancel' });
    return demo;
  }

  test('a dialog is centred, dims the page, hides its children while closed and closes from its backdrop or mark', () => {
    const demo = confirmDemo();
    expect(expand(demo, 'confirm')).toEqual([]);
    expect(groupKeys(demo, 0)).not.toContain('cancel');
    demo.scene.update('confirm', { open: true });
    const b = demo.scene.bounds('confirm');
    expect(b.x + b.width / 2).toBeCloseTo(400, 6);
    expect(b.y + b.height / 2).toBeCloseTo(300, 6);
    expect(keys(expand(demo, 'confirm'))).toEqual(['backdrop', 'shadow', 'panel', 'title', 'description', 'close']);
    const rs = regions(demo, 'confirm');
    expect(rs.map((r) => r.key)).toEqual(['backdrop', 'body', 'close']);
    expect(rs[0].bounds).toEqual({ x: -b.x, y: -b.y, width: 800, height: 600 });
    const render = () => ctxFor(demo);
    expect(demo.scene.hitTestDetailed({ x: 5, y: 5 }, render)).toMatchObject({
      id: 'confirm',
      region: { key: 'backdrop' },
    });
    expect(demo.scene.hitTestDetailed({ x: 30, y: 30 }, render)?.id).toBe('confirm');
    const cancel = demo.scene.bounds('cancel');
    expect(demo.scene.hitTestDetailed({ x: cancel.x + 5, y: cancel.y + 5 }, render)?.id).toBe('cancel');
    demo.scene.update('confirm', { open: false });
    demo.timeline.open('confirm').click('cancel').close('confirm').wait(10).open('confirm').click('trash');
    expect(types(demo, 0)).toEqual(['open']);
    expect(of(demo, 1).at(-1)!.click?.hit).toBe('cancel');
    expect(of(demo, 2).at(-1)!.click?.hit).toBe('confirm');
    expect(demo.nodeAt('confirm', of(demo, 2).at(-1)!.end).open).toBe(false);
    // With the dialog open, a click aimed at a page button lands on the backdrop and closes it.
    expect(of(demo, 5).at(-1)!.click?.hit).toBe('confirm');
    expect(demo.nodeAt('confirm', demo.duration).open).toBe(false);
    const groups = demo.frameAt(of(demo, 0)[0].end).groups.map((g) => g.key);
    expect(groups.indexOf('confirm')).toBeGreaterThan(groups.indexOf('trash'));
    expect(groups.indexOf('cancel')).toBeGreaterThan(groups.indexOf('confirm'));
  });

  test('an alert dialog ignores the backdrop; a drawer fills a page edge; toasts stack in the corner', () => {
    const demo = make();
    demo.alertDialog({ id: 'alert', title: 'Sure?', open: true });
    demo.button({ id: 'ok', parent: 'alert', characters: 'OK' });
    expect(regions(demo, 'alert')[0].action).toBeUndefined();
    expect(keys(expand(demo, 'alert'))).toEqual(['backdrop', 'shadow', 'panel', 'title']);
    demo.timeline.close('alert');
    expect(types(demo, 0)).toEqual(['close']);
    expect(demo.nodeAt('alert', demo.duration).open).toBe(false);
    demo.drawer({ id: 'side', title: 'Settings', open: true });
    demo.switch({ id: 'dark', parent: 'side', characters: 'Dark' });
    const side = demo.scene.bounds('side');
    expect(side).toEqual({ x: 480, y: 0, width: 320, height: 600 });
    expect(demo.scene.bounds('dark').x).toBeGreaterThan(480);
    demo.drawer({ id: 'sheet', side: 'bottom', open: true, height: 200 });
    expect(demo.scene.bounds('sheet')).toEqual({ x: 0, y: 400, width: 800, height: 200 });
    demo.toast({ id: 't1', title: 'Saved', description: 'All good.' });
    demo.toast({ id: 't2', title: 'Offline', variant: 'warning', stack: 1 });
    const t1 = demo.scene.bounds('t1');
    const t2 = demo.scene.bounds('t2');
    expect(t1.x + t1.width).toBe(784);
    expect(t1.y + t1.height).toBe(584);
    expect(t2.y + t2.height).toBe(t1.y + t1.height - 76);
    expect(keys(expand(demo, 't1'))).toEqual(['shadow', 'panel', 'icon', 'title', 'description', 'close']);
    expect(regions(demo, 't2').map((r) => r.key)).toEqual(['body', 'close']);
    expect(() => demo.toast({ id: 'bad', title: '' })).toThrow(/title is required/);
  });
});

describe('scroll area', () => {
  function listDemo() {
    const demo = make();
    demo.scrollArea({
      id: 'list',
      x: 20,
      y: 20,
      width: 200,
      height: 100,
      contentHeight: 470,
      layoutMode: 'VERTICAL',
      itemSpacing: 10,
      padding: 10,
    });
    for (let i = 0; i < 10; i++) demo.button({ id: `b${i}`, parent: 'list', characters: `Row ${i}` });
    demo.button({ id: 'out', x: 400, y: 400, characters: 'Out' });
    return demo;
  }

  test('children are clipped to the viewport and offset by the scroll value', () => {
    const demo = listDemo();
    expect(keys(expand(demo, 'list'))).toEqual(['box', 'track', 'thumb']);
    const frame = demo.frameAt(0);
    const b3 = frame.groups.find((g) => g.key === 'b3')!;
    expect(b3.html).toContain('clip-path="url(#clip-');
    expect(b3.html).toContain('<clipPath id="clip-');
    expect(frame.groups.find((g) => g.key === 'list')!.html).not.toContain('clip-path=');
    expect(frame.groups.find((g) => g.key === 'out')!.html).not.toContain('clip-path=');
    const before = demo.scene.bounds('b3').y;
    demo.scene.update('list', { value: 120 });
    expect(demo.scene.bounds('b3').y).toBe(before - 120);
    expect(() => demo.scene.update('list', { value: 999 })).toThrow(/within 0..370/);
  });

  test('a row scrolled out of view cannot be hit; dragging the thumb scrolls', () => {
    const demo = listDemo();
    const render = () => ctxFor(demo);
    const b0 = demo.scene.bounds('b0');
    expect(demo.scene.hitTestDetailed({ x: b0.x + 5, y: b0.y + 5 }, render)?.id).toBe('b0');
    const b8 = demo.scene.bounds('b8');
    expect(demo.scene.hitTestDetailed({ x: b8.x + 5, y: b8.y + 5 }, render)?.id).toBeUndefined();
    demo.timeline.drag('list', 370).click('b8');
    expect(demo.nodeAt('list', of(demo, 0).at(-1)!.end).value).toBe(370);
    expect(of(demo, 1).at(-1)!.click?.hit).toBe('b8');
    expect(demo.nodeAt('list', demo.duration).value).toBe(370);
    // Scrolled to the end, the first row is out of view and cannot be a target.
    demo.timeline.click('b0');
    expect(() => demo.compiled()).toThrow(/target "b0" is scrolled out of view/);
  });
});

describe('the overlay family', () => {
  test('every overlay type round-trips through JSON and renders identically over a timeline', () => {
    const demo = make();
    demo.button({ id: 'go', x: 20, y: 20, characters: 'Go' });
    demo.tooltip({ id: 'a', anchor: 'go', characters: 'A' });
    demo.previewCard({ id: 'b', anchor: 'go', title: 'B' });
    demo.popover({ id: 'c', anchor: 'go', title: 'C' });
    demo.text({ id: 'c1', parent: 'c', characters: 'inside' });
    demo.menu({ id: 'd', x: 20, y: 80, characters: 'D', items: ['1'] });
    demo.contextMenu({ id: 'e', anchor: 'go', items: ['1'] });
    demo.menubar({ id: 'f', x: 20, y: 140, menus: [{ label: 'F', items: ['1'] }] });
    demo.select({ id: 'g', x: 20, y: 200, width: 100, options: ['1'] });
    demo.combobox({ id: 'h', x: 20, y: 260, width: 100, options: ['1'] });
    demo.autocomplete({ id: 'i', x: 20, y: 320, width: 100, options: ['1'] });
    demo.dialog({ id: 'j', title: 'J' });
    demo.alertDialog({ id: 'k', title: 'K' });
    demo.drawer({ id: 'l' });
    demo.toast({ id: 'm', title: 'M' });
    demo.navigationMenu({ id: 'n', x: 300, y: 20, items: [{ label: 'N' }] });
    demo.scrollArea({ id: 'o', x: 300, y: 80, width: 100, height: 60, contentHeight: 200 });
    demo.text({ id: 'o1', parent: 'o', characters: 'row' });
    demo.timeline.hover('go').open('c').choose('g', '1').open('j').close('j').drag('o', 50);
    const json = demo.toJSON();
    const back = loadDemo(json);
    expect(back.toJSON()).toEqual(json);
    for (const t of [0, demo.duration / 3, demo.duration]) expect(back.toSVG(t)).toBe(demo.toSVG(t));
    const seen = new Set(demo.scene.all().map((n) => n.type));
    for (const type of [
      'TOOLTIP',
      'PREVIEW_CARD',
      'POPOVER',
      'MENU',
      'CONTEXT_MENU',
      'MENUBAR',
      'SELECT',
      'COMBOBOX',
      'AUTOCOMPLETE',
      'DIALOG',
      'ALERT_DIALOG',
      'DRAWER',
      'TOAST',
      'NAVIGATION_MENU',
      'SCROLL_AREA',
    ]) {
      expect(seen).toContain(type);
    }
  });

  test('a step a popup cannot take names it', () => {
    const demo = make();
    demo.button({ id: 'go', x: 20, y: 20, characters: 'Go' });
    demo.tooltip({ id: 'tip', anchor: 'go', characters: 'Tip' });
    demo.timeline.check('tip');
    expect(() => demo.compiled()).toThrow(CompileError);
    expect(() => demo.compiled()).toThrow(/target "tip" is a TOOLTIP, which cannot be checked/);
  });
});
