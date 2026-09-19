import { describe, expect, test } from 'vitest';
import { createDemo, loadDemo } from '../../../src/index.js';
import { componentFor } from '../../../src/components/index.js';
import { CONTROL, LABEL_GAP, SWITCH_HEIGHT, SWITCH_WIDTH } from '../../../src/components/controls.js';
import { BUTTON_HEIGHT } from '../../../src/components/button.js';
import { INPUT_HEIGHT } from '../../../src/components/input.js';
import { DEFAULT_FONT } from '../../../src/text/index.js';
import { CompileError } from '../../../src/timeline/compile.js';
import type { RenderContext } from '../../../src/components/types.js';
import type { ComponentState, SceneNode } from '../../../src/core/types.js';

const make = () => createDemo({ width: 800, height: 600, seed: 3 });
type Demo = ReturnType<typeof make>;

function expand(demo: Demo, node: SceneNode, state: ComponentState = {}, extra: Partial<RenderContext> = {}) {
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

function regions(demo: Demo, id: string, extra: Partial<RenderContext> = {}) {
  const node = demo.scene.resolved(id);
  const ctx: RenderContext = {
    theme: demo.theme,
    font: demo.font,
    icons: (i) => demo.resolveIcon(i),
    document: { width: demo.width, height: demo.height },
    bounds: (b) => demo.scene.bounds(b),
    state: {},
    ...extra,
  };
  return componentFor(node).regions?.(node, ctx) ?? [];
}

const keys = (parts: { key: string }[]) => parts.map((p) => p.key);
const fillOf = (part: unknown) => (part as { style: { fill?: string } }).style.fill;
/** The html of one node's group at time t. */
const html = (demo: Demo, id: string, t: number) => demo.frameAt(t).groups.find((g) => g.key === id)!.html;

describe('checkbox and switch', () => {
  test('bounds cover the box and label; parts follow checked, indeterminate and live state', () => {
    const demo = make();
    const cb = demo.checkbox({ id: 'cb', x: 0, y: 0, characters: 'Remember me' });
    const w = demo.scene.bounds('cb').width;
    expect(w).toBe(CONTROL + LABEL_GAP + DEFAULT_FONT.measure('Remember me', demo.theme.fontSize));
    expect(demo.scene.bounds('cb').height).toBe(CONTROL);
    expect(demo.scene.bounds(demo.checkbox({ id: 'bare', x: 0, y: 0 }).id).width).toBe(CONTROL);
    expect(keys(expand(demo, cb))).toEqual(['box', 'label']);
    expect(keys(expand(demo, cb, {}, { checked: true }))).toEqual(['box', 'mark', 'label']);
    const mixed = demo.checkbox({ id: 'mixed', x: 0, y: 0, checked: true, indeterminate: true });
    expect(keys(expand(demo, mixed))).toEqual(['box', 'dash']);
    expect(fillOf(expand(demo, mixed)[0])).toBe(demo.theme.accent);
    // Live state wins over the authored prop.
    expect(keys(expand(demo, mixed, {}, { checked: false }))).toEqual(['box']);
  });

  test('a switch slides its thumb to the checked side', () => {
    const demo = make();
    const sw = demo.switch({ id: 'sw', x: 0, y: 0, characters: 'Wi-Fi' });
    expect(demo.scene.bounds('sw')).toMatchObject({ height: SWITCH_HEIGHT });
    const off = expand(demo, sw);
    const on = expand(demo, sw, {}, { checked: true });
    expect(keys(off)).toEqual(['track', 'thumb', 'label']);
    expect((on[1] as { x: number }).x).toBeGreaterThan((off[1] as { x: number }).x);
    expect((on[1] as { x: number }).x).toBeLessThan(SWITCH_WIDTH);
    expect(fillOf(on[0])).toBe(demo.theme.accent);
  });

  test('check, uncheck and toggle change the rendered frame and nodeAt; a satisfied step only moves', () => {
    const demo = make();
    demo.checkbox({ id: 'cb', x: 20, y: 20, characters: 'Email' });
    demo.switch({ id: 'sw', x: 20, y: 60, characters: 'Wifi', checked: true });
    demo.timeline.check('cb').check('cb').toggle('sw').uncheck('cb');
    const c = demo.compiled();
    const of = (authored: number) => c.steps.filter((s) => s.authored === authored);
    expect(of(0).map((s) => s.step.type)).toEqual(['moveCursor', 'click']);
    expect(of(0)[1].effects).toEqual([{ id: 'cb', checked: true }]);
    // Already checked: the cursor goes there, nothing is clicked.
    expect(of(1).map((s) => s.step.type)).toEqual(['moveCursor']);
    expect(of(2)[1].effects).toEqual([{ id: 'sw', checked: false }]);
    expect(of(3)[1].effects).toEqual([{ id: 'cb', checked: false }]);
    const afterCheck = of(0)[1].end;
    const accentFill = `fill="${demo.theme.accent}"`;
    expect(html(demo, 'cb', afterCheck)).toContain(accentFill);
    expect(html(demo, 'cb', 0)).not.toContain(accentFill);
    expect(html(demo, 'cb', c.duration)).not.toContain(accentFill);
    expect(demo.nodeAt('cb', afterCheck).checked).toBe(true);
    expect(demo.nodeAt('sw', c.duration).checked).toBe(false);
    expect(demo.scene.node('cb').checked).toBeUndefined();
  });

  test('check on a node without the capability names the step, the node and its type', () => {
    const demo = make();
    demo.button({ id: 'go', x: 0, y: 0, characters: 'Go' });
    demo.timeline.wait(10).check('go');
    expect(() => demo.compiled()).toThrow(CompileError);
    expect(() => demo.compiled()).toThrow(/step 1: target "go" is a BUTTON, which cannot be checked/);
  });
});

describe('toggle and toggle group', () => {
  test('a toggle is a button that stays down; the live state maps to pressed', () => {
    const demo = make();
    const tg = demo.toggle({ id: 'tg', x: 0, y: 0, characters: 'Bold', icon: 'pencil' });
    expect(demo.scene.bounds('tg').height).toBe(BUTTON_HEIGHT);
    expect(keys(expand(demo, tg))).toEqual(['box', 'icon', 'label']);
    const down = expand(demo, demo.toggle({ id: 'down', x: 0, y: 0, characters: 'I', pressed: true }));
    expect(fillOf(down[0])).toBe(demo.theme.accent);
    demo.timeline.toggle('tg');
    expect(demo.nodeAt('tg', demo.duration)).toMatchObject({ pressed: true });
    expect(demo.nodeAt('tg', demo.duration).checked).toBeUndefined();
  });

  test('a toggle group chooses one option, or several when multiple', () => {
    const demo = make();
    demo.toggleGroup({ id: 'align', x: 0, y: 0, options: ['Left', 'Center', 'Right'], value: 'Center' });
    demo.toggleGroup({ id: 'fmt', x: 0, y: 100, options: ['B', 'I'], multiple: true, value: ['B'] });
    const options = regions(demo, 'align');
    expect(options.map((r) => r.key)).toEqual(['option:Left', 'option:Center', 'option:Right']);
    expect(options[2].bounds.x).toBeGreaterThan(options[1].bounds.x + options[1].bounds.width - 1);
    demo.timeline.choose('align', 'Right').check('fmt', 'I').uncheck('fmt', 'B');
    expect(demo.nodeAt('align', demo.duration).value).toBe('Right');
    expect(demo.nodeAt('fmt', demo.duration).value).toEqual(['I']);
    expect(() => demo.toggleGroup({ id: 'bad', x: 0, y: 0, options: ['A'], value: 'B' })).toThrow(
      /value must be one of A/,
    );
  });
});

describe('radio and checkbox groups', () => {
  test('options stack vertically by default, each with its own label row', () => {
    const demo = make();
    const plan = demo.radioGroup({ id: 'plan', x: 0, y: 0, options: ['Free', 'Pro', 'Team'], value: 'Pro' });
    const parts = expand(demo, plan);
    expect(keys(parts)).toEqual(['0.box', '0.label', '1.box', '1.dot', '1.label', '2.box', '2.label']);
    const labelY = (i: number) => (parts.find((p) => p.key === `${i}.label`) as { y: number }).y;
    expect(labelY(1)).toBeGreaterThan(labelY(0));
    expect(labelY(2)).toBeGreaterThan(labelY(1));
    expect(demo.scene.bounds('plan').height).toBe(CONTROL * 3 + 10 * 2);
    const row = demo.radioGroup({ id: 'row', x: 0, y: 0, options: ['A', 'B'], orientation: 'horizontal' });
    expect(demo.scene.bounds('row').height).toBe(CONTROL);
    expect(keys(expand(demo, row))).toEqual(['0.box', '0.label', '1.box', '1.label']);
  });

  test('choose picks the option region; check adds to a checkbox group', () => {
    const demo = make();
    demo.radioGroup({ id: 'plan', x: 20, y: 20, options: ['Free', 'Pro', 'Team'], value: 'Free' });
    demo.checkboxGroup({ id: 'top', x: 200, y: 20, options: ['Cheese', 'Olives'], value: ['Cheese'] });
    demo.timeline.choose('plan', 'Team').check('top', 'Olives').uncheck('top', 'Cheese');
    const c = demo.compiled();
    const click = c.steps.filter((s) => s.authored === 0)[1];
    const region = regions(demo, 'plan')[2];
    const b = demo.scene.bounds('plan');
    const p = click.cursor?.to ?? c.steps[0].cursor!.to;
    expect(p.y).toBeGreaterThanOrEqual(b.y + region.bounds.y);
    expect(p.y).toBeLessThanOrEqual(b.y + region.bounds.y + region.bounds.height);
    expect(click.effects).toEqual([{ id: 'plan', value: 'Team' }]);
    expect(demo.nodeAt('plan', c.duration).value).toBe('Team');
    expect(demo.nodeAt('top', c.duration).value).toEqual(['Olives']);
    expect(html(demo, 'plan', c.duration)).not.toBe(html(demo, 'plan', 0));
    demo.timeline.reset().choose('plan', 'Gold');
    expect(() => demo.compiled()).toThrow(/has no option "Gold"/);
    expect(() => demo.radioGroup({ id: 'bad', x: 0, y: 0, options: [] })).toThrow(/non-empty array/);
    expect(() => demo.checkboxGroup({ id: 'bad', x: 0, y: 0, options: ['A'], value: 'A' as never })).toThrow(/array/);
  });
});

describe('slider', () => {
  test('parts and regions follow the value; validation bounds it', () => {
    const demo = make();
    const s = demo.slider({ id: 's', x: 0, y: 0, width: 200, value: 0 });
    expect(keys(expand(demo, s))).toEqual(['track', 'thumb']);
    expect(keys(expand(demo, s, {}, { value: 50 }))).toEqual(['track', 'fill', 'thumb']);
    const thumb = (v: number) => regions(demo, 's', { value: v }).find((r) => r.key === 'thumb')!.bounds.x;
    expect(thumb(100)).toBeGreaterThan(thumb(50));
    expect(thumb(50)).toBeGreaterThan(thumb(0));
    expect(() => demo.slider({ id: 'bad', x: 0, y: 0, width: 100, value: 120 })).toThrow(/within 0..100/);
    expect(() => demo.slider({ id: 'bad', x: 0, y: 0, width: 100, min: 5, max: 5 })).toThrow(/max must be greater/);
  });

  test('drag moves the thumb with the cursor and snaps to the step at the end', () => {
    const demo = make();
    demo.slider({ id: 's', x: 100, y: 100, width: 200, value: 20, step: 5 });
    demo.timeline.drag('s', 82);
    const c = demo.compiled();
    const drag = c.steps.find((st) => st.drag)!;
    expect(drag.drag).toMatchObject({ target: 's', from: 20, to: 80 });
    const mid = demo.nodeAt('s', drag.start + (drag.end - drag.start) / 2).value as number;
    expect(mid).toBeGreaterThan(20);
    expect(mid).toBeLessThan(80);
    expect(demo.nodeAt('s', c.duration).value).toBe(80);
    expect(html(demo, 's', c.duration)).not.toBe(html(demo, 's', 0));
    demo.timeline.reset().choose('s', 60);
    expect(demo.nodeAt('s', demo.duration).value).toBe(60);
  });
});

describe('progress, meter, separator and avatar', () => {
  test('progress and meter draw a proportional indicator, or a hatch while indeterminate', () => {
    const demo = make();
    const p = demo.progress({ id: 'p', x: 0, y: 0, width: 200, value: 50, characters: 'Half' });
    const parts = expand(demo, p);
    expect(keys(parts)).toEqual(['track', 'indicator', 'label']);
    expect((parts[1] as { width: number }).width).toBe(100);
    expect(keys(expand(demo, demo.progress({ id: 'z', x: 0, y: 0, width: 200 })))).toEqual(['track']);
    const busy = expand(demo, demo.progress({ id: 'b', x: 0, y: 0, width: 200, indeterminate: true }));
    expect((busy[1] as { style: { fillStyle: string } }).style.fillStyle).toBe('hachure');
    const m = expand(demo, demo.meter({ id: 'm', x: 0, y: 0, width: 100, value: 4, min: 2, max: 6 }));
    expect((m[1] as { width: number }).width).toBe(50);
    expect(demo.scene.bounds('p').height).toBeGreaterThan(demo.scene.bounds('z').height);
    expect(() => demo.progress({ id: 'bad', x: 0, y: 0, width: 10, value: 200 })).toThrow(/within 0..100/);
    expect(() => demo.meter({ id: 'bad', x: 0, y: 0, width: 10, value: 1, min: 2, max: 6 })).toThrow(/within 2..6/);
  });

  test('a separator is a single line along its orientation', () => {
    const demo = make();
    demo.separator({ id: 'h', x: 0, y: 0, length: 120 });
    demo.separator({ id: 'v', x: 0, y: 0, length: 80, orientation: 'vertical' });
    expect(demo.scene.bounds('h')).toMatchObject({ width: 120 });
    expect(demo.scene.bounds('v')).toMatchObject({ height: 80 });
    expect(demo.scene.bounds('v').width).toBeLessThan(demo.scene.bounds('v').height);
    expect(keys(expand(demo, demo.scene.node('h')))).toEqual(['line']);
    expect(() => demo.separator({ id: 'bad', x: 0, y: 0, length: 0 })).toThrow(/length must be positive/);
  });

  test('an avatar shows two initials or an icon inside a circle', () => {
    const demo = make();
    const a = demo.avatar({ id: 'a', x: 0, y: 0, characters: 'ada lovelace' });
    expect(demo.scene.bounds('a')).toMatchObject({ width: 36, height: 36 });
    const parts = expand(demo, a);
    expect(keys(parts)).toEqual(['circle', 'initials']);
    expect((parts[1] as { text: string }).text).toBe('AD');
    expect(keys(expand(demo, demo.avatar({ id: 'i', x: 0, y: 0, icon: 'user', size: 48 })))).toEqual([
      'circle',
      'icon',
    ]);
    expect(demo.scene.bounds('i').width).toBe(48);
  });
});

describe('number field and OTP field', () => {
  test('steppers move the value within the bounds; choose walks there; typing sets it', () => {
    const demo = make();
    const n = demo.numberField({ id: 'n', x: 20, y: 20, width: 140, value: 2, min: 0, max: 3 });
    expect(demo.scene.bounds('n').height).toBe(INPUT_HEIGHT);
    expect(keys(expand(demo, n))).toEqual(['box', 'div-left', 'div-right', 'minus', 'plus', 'value']);
    expect(regions(demo, 'n').map((r) => [r.key, r.action?.value])).toEqual([
      ['decrement', 1],
      ['increment', 3],
    ]);
    expect(regions(demo, 'n', { value: 3 })[1].action?.value).toBe(3);
    demo.timeline.choose('n', 0).choose('n', 3);
    const c = demo.compiled();
    expect(c.steps.filter((s) => s.authored === 0 && s.click).length).toBe(2);
    expect(c.steps.filter((s) => s.authored === 1 && s.click).length).toBe(3);
    expect(demo.nodeAt('n', c.steps.findLast((s) => s.authored === 0)!.end).value).toBe(0);
    expect(demo.nodeAt('n', c.duration).value).toBe(3);
    demo.timeline.reset().choose('n', 9);
    expect(() => demo.compiled()).toThrow(/cannot reach 9/);
    demo.timeline.reset().type('n', '7');
    expect(demo.nodeAt('n', demo.duration).value).toBe('27');
    expect(regions(demo, 'n', { value: '27' })[0].action?.value).toBe(3);
  });

  test('an OTP field fills one slot per typed character and marks the next', () => {
    const demo = make();
    const otp = demo.otpField({ id: 'o', x: 20, y: 20, length: 4, value: '49' });
    expect(demo.scene.bounds('o').width).toBe(4 * 36 + 3 * 8);
    expect(keys(expand(demo, otp))).toEqual(['slot-0', 'char-0', 'slot-1', 'char-1', 'slot-2', 'slot-3']);
    expect(keys(expand(demo, otp, { focused: true }))).toContain('caret-2');
    expect(keys(expand(demo, otp, { focused: true }, { value: '4921' }))).not.toContain('caret-3');
    demo.timeline.type('o', '21');
    expect(demo.nodeAt('o', demo.duration).value).toBe('4921');
    expect(() => demo.otpField({ id: 'bad', x: 0, y: 0, length: 0 })).toThrow(/at least 1/);
  });
});

describe('form containers', () => {
  test('a field hugs its control below the label and reserves room for a description', () => {
    const demo = make();
    demo.field({ id: 'f', x: 10, y: 10, label: 'Name', width: 200 });
    demo.input({ id: 'name', parent: 'f', width: 200 });
    demo.field({ id: 'g', x: 10, y: 200, label: 'Email', description: 'Private.', width: 200 });
    demo.input({ id: 'email', parent: 'g', width: 200 });
    const labelHeight = demo.font.lineHeight(demo.theme.fontSize) + 6;
    expect(demo.scene.bounds('name').y).toBe(10 + labelHeight);
    expect(demo.scene.bounds('f').height).toBe(labelHeight + INPUT_HEIGHT);
    expect(demo.scene.bounds('g').height).toBeGreaterThan(demo.scene.bounds('f').height);
    expect(keys(expand(demo, demo.scene.resolved('g')))).toEqual(['label', 'note']);
    const err = demo.field({ id: 'e', x: 10, y: 400, label: 'X', error: 'Required', width: 200 });
    expect((expand(demo, err).at(-1) as { color: string }).color).not.toBe(demo.theme.muted);
  });

  test('a form stacks fields with spacing; a fieldset offsets its children below the legend', () => {
    const demo = make();
    demo.form({ id: 'form', x: 0, y: 0, width: 300, layoutSizingVertical: 'HUG' });
    demo.field({ id: 'a', parent: 'form', label: 'A', width: 300 });
    demo.input({ id: 'ia', parent: 'a', width: 300 });
    demo.field({ id: 'b', parent: 'form', label: 'B', width: 300 });
    demo.input({ id: 'ib', parent: 'b', width: 300 });
    expect(demo.scene.bounds('b').y).toBe(demo.scene.bounds('a').y + demo.scene.bounds('a').height + 10);
    expect(demo.scene.bounds('form').height).toBe(demo.scene.bounds('b').y + demo.scene.bounds('b').height);
    expect(expand(demo, demo.scene.resolved('form'))).toEqual([]);
    demo.fieldset({ id: 'fs', x: 400, y: 0, width: 200, height: 100, legend: 'Contact' });
    demo.checkbox({ id: 'c', parent: 'fs', x: 10, y: 10, characters: 'Email' });
    expect(demo.scene.bounds('c').y).toBe(10 + demo.font.lineHeight(demo.theme.fontSize));
    expect(keys(expand(demo, demo.scene.node('fs')))).toEqual([
      'box',
      'frame-band',
      'frame-ink',
      'frame-ink2',
      'frame-corners',
      'legend-bg',
      'legend',
    ]);
  });

  test('a toolbar lays its children out in a row with padding', () => {
    const demo = make();
    demo.toolbar({ id: 't', x: 0, y: 0, height: 44, layoutSizingHorizontal: 'HUG' });
    demo.button({ id: 'a', parent: 't', characters: 'A' });
    demo.separator({ id: 's', parent: 't', orientation: 'vertical', length: 20 });
    demo.button({ id: 'b', parent: 't', characters: 'B' });
    expect(demo.scene.bounds('a').x).toBe(6);
    expect(demo.scene.bounds('s').x).toBeGreaterThan(demo.scene.bounds('a').x + demo.scene.bounds('a').width);
    expect(demo.scene.bounds('b').x).toBeGreaterThan(demo.scene.bounds('s').x);
    expect(demo.scene.bounds('t').width).toBe(demo.scene.bounds('b').x + demo.scene.bounds('b').width + 6);
    demo.toolbar({ id: 'v', x: 0, y: 100, width: 60, orientation: 'vertical', layoutSizingVertical: 'HUG' });
    demo.button({ id: 'c', parent: 'v', characters: 'C' });
    demo.button({ id: 'd', parent: 'v', characters: 'D' });
    expect(demo.scene.bounds('d').y).toBeGreaterThan(demo.scene.bounds('c').y);
  });
});

describe('collapsible, accordion and tabs', () => {
  test('a closed collapsible hides its children and hugs to its header; open and close animate the cursor', () => {
    const demo = make();
    demo.collapsible({ id: 'adv', x: 0, y: 0, width: 200, characters: 'Advanced', padding: 10 });
    demo.checkbox({ id: 'beta', parent: 'adv', characters: 'Beta' });
    expect(demo.scene.bounds('adv').height).toBe(36);
    expect(demo.scene.visible().map((n) => n.id)).toEqual(['adv']);
    expect(keys(expand(demo, demo.scene.resolved('adv')))).toEqual(['header', 'chevron', 'title']);
    demo.timeline.open('adv').wait(100).open('adv').close('adv');
    const c = demo.compiled();
    const of = (authored: number) => c.steps.filter((s) => s.authored === authored);
    expect(of(0)[1].effects).toEqual([{ id: 'adv', open: true }]);
    expect(of(2).map((s) => s.step.type)).toEqual(['moveCursor']);
    expect(of(3)[1].effects).toEqual([{ id: 'adv', open: false }]);
    const opened = of(0)[1].end;
    expect(demo.frameAt(opened).groups.some((g) => g.key === 'beta')).toBe(true);
    expect(demo.frameAt(c.duration).groups.some((g) => g.key === 'beta')).toBe(false);
    expect(demo.nodeAt('adv', opened).open).toBe(true);
    expect(() => demo.collapsible({ id: 'bad', x: 0, y: 0, width: 100, characters: '' })).toThrow(/header text/);
  });

  test('an accordion opens one item at a time (or several), growing by the body text', () => {
    const demo = make();
    demo.accordion({
      id: 'faq',
      x: 0,
      y: 0,
      width: 240,
      items: [
        { label: 'Shipping', characters: 'Two days.' },
        { label: 'Returns', characters: 'Thirty days.' },
      ],
    });
    const closed = demo.scene.bounds('faq').height;
    expect(closed).toBe(72);
    expect(keys(expand(demo, demo.scene.node('faq')))).toEqual([
      '0.header',
      '0.chevron',
      '0.label',
      '1.header',
      '1.chevron',
      '1.label',
    ]);
    expect(keys(expand(demo, demo.scene.node('faq'), {}, { value: 'Returns' }))).toContain('1.body');
    expect(regions(demo, 'faq').map((r) => r.action?.value)).toEqual(['Shipping', 'Returns']);
    demo.timeline.choose('faq', 'Returns').choose('faq', 'Shipping').open('faq');
    const c = demo.compiled();
    expect(demo.nodeAt('faq', c.steps.findLast((s) => s.authored === 0)!.end).value).toBe('Returns');
    expect(demo.nodeAt('faq', c.steps.findLast((s) => s.authored === 1)!.end).value).toBe('Shipping');
    expect(demo.nodeAt('faq', c.duration).value).toBe('Shipping');
    expect(html(demo, 'faq', c.duration)).not.toBe(html(demo, 'faq', 0));
    demo.accordion({ id: 'multi', x: 300, y: 0, width: 200, items: ['A', 'B'], multiple: true, value: ['A'] });
    expect(regions(demo, 'multi')[1].action?.value).toEqual(['A', 'B']);
    expect(() => demo.accordion({ id: 'bad', x: 0, y: 0, width: 100, items: ['A'], value: 'B' })).toThrow(/one of A/);
    expect(() => demo.accordion({ id: 'bad', x: 0, y: 0, width: 100, items: ['A', 'B'], value: ['A', 'B'] })).toThrow(
      /single item/,
    );
  });

  test('tabs show exactly the child at the active index; choose switches the panel', () => {
    const demo = make();
    demo.tabs({ id: 'tabs', x: 0, y: 0, width: 300, height: 150, tabs: ['One', 'Two'], value: 'One' });
    demo.text({ id: 'p1', parent: 'tabs', x: 0, y: 10, characters: 'First' });
    demo.text({ id: 'p2', parent: 'tabs', x: 0, y: 10, characters: 'Second' });
    expect(demo.scene.visible().map((n) => n.id)).toEqual(['tabs', 'p1']);
    expect(demo.scene.bounds('p1').y).toBe(50);
    expect(keys(expand(demo, demo.scene.node('tabs')))).toEqual(['baseline', '0.label', '0.indicator', '1.label']);
    expect(keys(expand(demo, demo.scene.node('tabs'), {}, { value: 'Two' }))).toEqual([
      'baseline',
      '0.label',
      '1.label',
      '1.indicator',
    ]);
    demo.timeline.choose('tabs', 'Two');
    const c = demo.compiled();
    const end = demo.frameAt(c.duration).groups.map((g) => g.key);
    expect(end).toContain('p2');
    expect(end).not.toContain('p1');
    expect(demo.frameAt(0).groups.map((g) => g.key)).not.toContain('p2');
    expect(() => demo.tabs({ id: 'bad', x: 0, y: 0, width: 10, height: 10, tabs: ['A'], value: 'B' })).toThrow(
      /one of A/,
    );
  });
});

describe('the whole family', () => {
  test('every control type round-trips through JSON and renders identically', () => {
    const demo = make();
    demo.checkbox({ id: 'a', x: 0, y: 0, characters: 'A', checked: true });
    demo.switch({ id: 'b', x: 0, y: 30, checked: true });
    demo.toggle({ id: 'c', x: 0, y: 60, characters: 'C', pressed: true });
    demo.toggleGroup({ id: 'd', x: 0, y: 100, options: ['1', '2'], value: '1' });
    demo.radioGroup({ id: 'e', x: 0, y: 150, options: ['1', '2'], value: '2' });
    demo.checkboxGroup({ id: 'f', x: 0, y: 200, options: ['1', '2'], value: ['1', '2'] });
    demo.slider({ id: 'g', x: 0, y: 260, width: 100, value: 40 });
    demo.progress({ id: 'h', x: 0, y: 300, width: 100, value: 40 });
    demo.meter({ id: 'i', x: 0, y: 320, width: 100, value: 40 });
    demo.separator({ id: 'j', x: 0, y: 340, length: 100 });
    demo.avatar({ id: 'k', x: 0, y: 350, characters: 'K' });
    demo.numberField({ id: 'l', x: 0, y: 400, width: 100, value: 1 });
    demo.otpField({ id: 'm', x: 0, y: 440, length: 2, value: '1' });
    demo.form({ id: 'n', x: 200, y: 0, width: 200, layoutSizingVertical: 'HUG' });
    demo.field({ id: 'o', parent: 'n', label: 'O', width: 200 });
    demo.input({ id: 'oi', parent: 'o', width: 200 });
    demo.fieldset({ id: 'p', x: 200, y: 200, width: 200, height: 60, legend: 'P' });
    demo.toolbar({ id: 'q', x: 200, y: 300, height: 40, layoutSizingHorizontal: 'HUG' });
    demo.button({ id: 'qb', parent: 'q', characters: 'Q' });
    demo.collapsible({ id: 'r', x: 200, y: 360, width: 200, characters: 'R', open: true });
    demo.text({ id: 'rt', parent: 'r', characters: 'inside' });
    demo.accordion({
      id: 's',
      x: 450,
      y: 0,
      width: 200,
      items: ['S1', { label: 'S2', characters: 'body' }],
      value: 'S2',
    });
    demo.tabs({ id: 't', x: 450, y: 200, width: 200, height: 100, tabs: ['T1', 'T2'], value: 'T2' });
    demo.text({ id: 't1', parent: 't', characters: 'one' });
    demo.text({ id: 't2', parent: 't', characters: 'two' });
    demo.timeline.check('a').choose('t', 'T1').drag('g', 90);
    const json = demo.toJSON();
    const back = loadDemo(json);
    expect(back.toJSON()).toEqual(json);
    for (const t of [0, demo.duration / 2, demo.duration]) expect(back.toSVG(t)).toBe(demo.toSVG(t));
    const types = new Set(demo.scene.all().map((n) => n.type));
    for (const type of [
      'CHECKBOX',
      'CHECKBOX_GROUP',
      'SWITCH',
      'TOGGLE',
      'TOGGLE_GROUP',
      'RADIO_GROUP',
      'SLIDER',
      'PROGRESS',
      'METER',
      'SEPARATOR',
      'AVATAR',
      'NUMBER_FIELD',
      'OTP_FIELD',
      'FIELD',
      'FIELDSET',
      'FORM',
      'TOOLBAR',
      'COLLAPSIBLE',
      'ACCORDION',
      'TABS',
    ]) {
      expect(types).toContain(type);
    }
  });
});
