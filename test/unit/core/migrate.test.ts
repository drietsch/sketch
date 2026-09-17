import { describe, expect, test } from 'vitest';
import { readFileSync } from 'node:fs';
import { loadDemo, parseDemoJSON } from '../../../src/index.js';
import { migrateV1 } from '../../../src/core/json.js';
import { SCENES } from '../../support/scenes.js';

/**
 * Documents written by 0.1.0 / 0.2.0 (version 1: flat `nodes` with `parent`,
 * lowercase types, a `style` bag) must load and render exactly like the same
 * scene authored with the 0.3.0 API. The fixtures were produced by the real
 * v0.2.0 code, not written by hand.
 */
const v1 = (name: string) => readFileSync(new URL(`../../support/v1-${name}.json`, import.meta.url), 'utf8');

describe('version 1 migration', () => {
  test.each([
    ['login-demo', 'loginDemo'],
    ['login-form', 'loginForm'],
    ['primitives', 'primitives'],
  ])('%s renders byte-identically to the 0.3.0 fixture', (file, fixture) => {
    const migrated = loadDemo(v1(file));
    const fresh = SCENES[fixture]();
    const duration = fresh.duration;
    expect(migrated.duration).toBe(duration);
    for (const t of duration > 0 ? [0, duration / 3, duration] : [0]) {
      expect(migrated.toSVG(t)).toBe(fresh.toSVG(t));
    }
    // And it re-saves as a version 2 document equal to the fresh one.
    expect(migrated.toJSON()).toEqual(fresh.toJSON());
  });

  test('every renamed field is mapped', () => {
    const doc = migrateV1({
      version: 1,
      width: 10,
      height: 10,
      seed: 1,
      theme: { strokeWidth: 2, accent: '#f00' },
      nodes: [
        {
          id: 'a',
          type: 'rect',
          x: 0,
          y: 0,
          width: 5,
          height: 5,
          radius: 3,
          hidden: true,
          style: {
            fill: 'red',
            stroke: 'none',
            strokeWidth: 2,
            dash: [1, 2],
            opacity: 0.5,
            roughness: 0.3,
            fillStyle: 'dots',
          },
        },
        {
          id: 't',
          type: 'text',
          parent: 'a',
          x: 1,
          y: 1,
          text: 'Hi',
          fontSize: 20,
          align: 'middle',
          style: { color: 'blue' },
        },
        { id: 'p', type: 'panel', x: 0, y: 0, width: 5, height: 5 },
        { id: 'v', type: 'path', parent: 'p', x: 0, y: 0, d: 'M0 0' },
      ],
    });
    expect(doc.version).toBe(2);
    expect(doc.theme).toEqual({ strokeWeight: 2, accent: '#f00' });
    expect(doc.children).toEqual([
      {
        id: 'a',
        type: 'RECTANGLE',
        x: 0,
        y: 0,
        width: 5,
        height: 5,
        cornerRadius: 3,
        visible: false,
        fills: [{ type: 'SOLID', color: 'red' }],
        strokes: [],
        strokeWeight: 2,
        strokeDashes: [1, 2],
        opacity: 0.5,
        sketch: { roughness: 0.3, fillStyle: 'dots' },
        children: [
          {
            id: 't',
            type: 'TEXT',
            x: 1,
            y: 1,
            characters: 'Hi',
            style: { fontSize: 20, textAlignHorizontal: 'CENTER', fills: [{ type: 'SOLID', color: 'blue' }] },
          },
        ],
      },
      {
        id: 'p',
        type: 'FRAME',
        x: 0,
        y: 0,
        width: 5,
        height: 5,
        children: [{ id: 'v', type: 'VECTOR', x: 0, y: 0, d: 'M0 0' }],
      },
    ]);
    expect(() => parseDemoJSON(doc as never)).not.toThrow();
  });

  test('a version nobody wrote is still rejected', () => {
    expect(() => parseDemoJSON({ version: 7 } as never)).toThrow(/unsupported version 7/);
  });
});
