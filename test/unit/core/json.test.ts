import { describe, expect, test } from 'vitest';
import { createDemo, loadDemo, parseDemoJSON, DemoJSONError, registerIcon } from '../../../src/index.js';
import { clearRegisteredIcons } from '../../../src/icons/index.js';
import { SCENES } from '../../support/scenes.js';

describe('toJSON / loadDemo', () => {
  test.each(Object.keys(SCENES))('%s round-trips byte-identically, through a string too', (name) => {
    const demo = SCENES[name]();
    const json = demo.toJSON();
    const back = loadDemo(json);
    expect(back.toSVG()).toBe(demo.toSVG());
    expect(loadDemo(JSON.stringify(json)).toSVG()).toBe(demo.toSVG());
    expect(back.toJSON()).toEqual(json);
  });

  test('is plain data in paint order with the document settings', () => {
    const demo = createDemo({ width: 300, height: 200, seed: 9, background: null, theme: { accent: '#f00' } });
    demo.rectangle({ id: 'a', x: 0, y: 0, width: 10, height: 10 });
    demo.rectangle({ id: 'b', parent: 'a', x: 1, y: 1, width: 5, height: 5 });
    const json = demo.toJSON();
    expect(json).toMatchObject({
      version: 2,
      width: 300,
      height: 200,
      seed: 9,
      background: null,
      font: 'grape-nuts',
    });
    expect(json.theme.accent).toBe('#f00');
    expect(json.children.map((n) => n.id)).toEqual(['a']);
    expect(json.children[0].children!.map((n) => n.id)).toEqual(['b']);
    expect('parent' in json.children[0].children![0]).toBe(false);
    expect(json.icons).toBeUndefined();
    expect(JSON.parse(JSON.stringify(json))).toEqual(json);
  });

  test('embeds icons that are not built in, whether per-demo or global', () => {
    try {
      const demo = createDemo({ width: 100, height: 100, seed: 1 });
      const mine = { nodes: [['path', { d: 'M0 0L1 1' }]] as [string, Record<string, string>][] };
      const shared = { nodes: [['path', { d: 'M2 2L3 3' }]] as [string, Record<string, string>][] };
      demo.registerIcon('mine', mine);
      registerIcon('shared', shared);
      demo.icon({ id: 'a', x: 0, y: 0, icon: 'mine' });
      demo.button({ id: 'b', x: 0, y: 30, characters: 'x', icon: 'shared' });
      demo.icon({ id: 'c', x: 0, y: 60, icon: 'search' });
      const json = demo.toJSON();
      expect(Object.keys(json.icons!)).toEqual(['mine', 'shared']);
      const svg = demo.toSVG();
      clearRegisteredIcons();
      // The document carries the icon, so it loads without the global registration.
      expect(loadDemo(json).toSVG()).toBe(svg);
    } finally {
      clearRegisteredIcons();
    }
  });

  test('loaded demos keep working: new nodes get fresh ids', () => {
    const demo = createDemo({ width: 100, height: 100, seed: 1 });
    demo.rectangle({ x: 0, y: 0, width: 1, height: 1 });
    const back = loadDemo(demo.toJSON());
    expect(back.rectangle({ x: 0, y: 0, width: 1, height: 1 }).id).toBe('rectangle-2');
  });

  test('rejects malformed documents with a precise message', () => {
    const good = SCENES.minimal().toJSON();
    expect(() => parseDemoJSON('{')).toThrow(DemoJSONError);
    expect(() => parseDemoJSON({ ...good, version: 3 } as never)).toThrow(/unsupported version 3/);
    expect(() => parseDemoJSON({ ...good, width: -1 })).toThrow(/width must be a positive number/);
    expect(() => parseDemoJSON({ ...good, seed: 1.5 })).toThrow(/seed must be an integer/);
    expect(() =>
      parseDemoJSON({ ...good, children: [{ id: 'bad id', type: 'RECTANGLE', x: 0, y: 0 }] as never }),
    ).toThrow(/children\[0\].id "bad id"/);
    expect(() => parseDemoJSON({ ...good, children: [{ id: 'a', type: 'blob', x: 0, y: 0 }] as never })).toThrow(
      /unknown type "blob"/,
    );
    expect(() =>
      parseDemoJSON({ ...good, children: [{ id: 'a', type: 'RECTANGLE', x: 'no', y: 0 }] as never }),
    ).toThrow(/\.x must be a finite number/);
    expect(() =>
      parseDemoJSON({
        ...good,
        children: [{ id: 'a', type: 'RECTANGLE', x: 0, y: 0, children: [{ id: 'b', type: 'nope' }] }],
      } as never),
    ).toThrow(/children\[0\].children\[0\] \("b"\) has unknown type/);
    expect(() =>
      parseDemoJSON({ ...good, children: [{ id: 'a', type: 'RECTANGLE', x: 0, y: 0, parent: 'zz' }] } as never),
    ).toThrow(/must nest under its parent/);
    expect(() =>
      parseDemoJSON({
        ...good,
        children: [{ id: 'a', type: 'RECTANGLE', x: 0, y: 0, fills: [{ type: 'GRADIENT_LINEAR' }] }],
      } as never),
    ).toThrow(/fills\[0\].type "GRADIENT_LINEAR" is not supported/);
    expect(() =>
      parseDemoJSON({
        ...good,
        children: [{ id: 'a', type: 'RECTANGLE', x: 0, y: 0, fills: [{ type: 'SOLID', color: { r: 2, g: 0, b: 0 } }] }],
      } as never),
    ).toThrow(/color.r must be in 0..1/);
    expect(() =>
      parseDemoJSON({
        ...good,
        children: [{ id: 'a', type: 'TEXT', x: 0, y: 0, characters: 'x', style: { textAlignHorizontal: 'middle' } }],
      } as never),
    ).toThrow(/textAlignHorizontal must be one of LEFT, CENTER, RIGHT/);
    expect(() => parseDemoJSON({ ...good, icons: { bad: {} } } as never)).toThrow(/icon "bad" must have nodes/);
    expect(() => loadDemo({ ...good, font: 'other' })).toThrow(/uses font "other"/);
    expect(() =>
      loadDemo({
        ...good,
        children: [
          {
            id: 'a',
            type: 'RECTANGLE',
            x: 0,
            y: 0,
            width: 1,
            height: 1,
            children: [{ id: 'a', type: 'RECTANGLE', x: 0, y: 0, width: 1, height: 1 }],
          },
        ],
      }),
    ).toThrow(/node "a": Duplicate node id "a"/);
  });
});
