import { describe, expect, test } from 'vitest';
import { Timeline, validateStep } from '../../../src/timeline/timeline.js';

describe('Timeline builder', () => {
  test('fluent methods append plain steps and bump the version', () => {
    const tl = new Timeline();
    const v0 = tl.version;
    tl.moveCursor('email').click().type('email', 'hi').wait(100).focus('login').blur().setValue('email', 'x');
    tl.set('login', { visible: false }).press({ x: 1, y: 2 }).release().clear('email');
    expect(tl.steps.map((s) => s.type)).toEqual([
      'moveCursor',
      'click',
      'type',
      'wait',
      'focus',
      'blur',
      'setValue',
      'set',
      'press',
      'release',
      'clear',
    ]);
    expect(tl.steps[0]).toEqual({ type: 'moveCursor', target: 'email' });
    expect(tl.steps[1]).toEqual({ type: 'click' });
    expect(tl.version).toBeGreaterThan(v0);
  });

  test('options and at() land on the step', () => {
    const tl = new Timeline();
    tl.moveCursor('a', { duration: 500, key: 'first' }).at(2000).wait(10);
    expect(tl.steps[0]).toEqual({ type: 'moveCursor', target: 'a', duration: 500, key: 'first' });
    expect(tl.steps[1]).toEqual({ type: 'wait', duration: 10, at: 2000 });
  });

  test('JSON round-trips, including the cursor start', () => {
    const tl = new Timeline().startAt({ x: 5, y: 6 }).moveCursor({ x: 1, y: 2 }).type('a', 'b');
    const json = tl.toJSON();
    expect(json).toEqual({
      version: 1,
      cursor: { x: 5, y: 6 },
      steps: [
        { type: 'moveCursor', target: { x: 1, y: 2 } },
        { type: 'type', target: 'a', text: 'b' },
      ],
    });
    const back = Timeline.fromJSON(json);
    expect(back.toJSON()).toEqual(json);
    expect(Timeline.fromJSON(json.steps).steps).toEqual(json.steps);
    expect(JSON.parse(JSON.stringify(json))).toEqual(json);
  });

  test('rejects malformed steps on add and on load', () => {
    const tl = new Timeline();
    expect(() => tl.add({ type: 'nope' } as never)).toThrow(/unknown step type "nope"/);
    expect(() => tl.add({ type: 'type', target: 'a' } as never)).toThrow(/type needs text/);
    expect(() => tl.add({ type: 'wait' } as never)).toThrow(/wait needs a duration/);
    expect(() => tl.add({ type: 'moveCursor', target: 5 } as never)).toThrow(/needs a target/);
    expect(() => Timeline.fromJSON({ version: 2, steps: [] } as never)).toThrow(/unsupported version/);
    expect(() =>
      Timeline.fromJSON({ version: 1, steps: [{ type: 'blur' }, { type: 'set', target: 'x' }] } as never),
    ).toThrow(/steps\[1\]: set needs a patch object/);
    expect(validateStep({ type: 'click', target: { x: 1, y: 2 } })).toBeUndefined();
    expect(validateStep({ type: 'click', duration: -1 })).toBe('duration must be >= 0');
    expect(validateStep(null)).toBe('step must be an object');
  });

  test('reset empties the list', () => {
    const tl = new Timeline().wait(1).wait(2);
    tl.reset();
    expect(tl.steps).toEqual([]);
  });
});
