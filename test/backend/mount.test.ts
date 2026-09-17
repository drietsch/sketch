import { describe, expect, test } from 'vitest';
import { createDemo, patchDOM } from '../../src/index.js';
import type { Clock } from '../../src/index.js';
import { SCENES } from '../support/scenes.js';

/** Serialises a DOM subtree the way the string emitter does, so the two can be compared byte for byte. */
function serializeDom(el: Element): string {
  let attrs = '';
  for (const a of Array.from(el.attributes)) {
    attrs += ` ${a.name}="${a.value.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/"/g, '&quot;')}"`;
  }
  let inner = '';
  for (const child of Array.from(el.childNodes)) {
    if (child.nodeType === 1) inner += serializeDom(child as Element);
    else if (child.nodeType === 3)
      inner += (child.textContent ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  }
  const tag = el.tagName.toLowerCase();
  return inner ? `<${tag}${attrs}>${inner}</${tag}>` : `<${tag}${attrs}/>`;
}

/** A hand-driven clock: tests advance time and flush frames explicitly. */
function fakeClock() {
  let now = 0;
  let next = 1;
  const pending = new Map<number, (now: number) => void>();
  const clock: Clock = {
    now: () => now,
    requestFrame: (cb) => {
      const id = next++;
      pending.set(id, cb);
      return id;
    },
    cancelFrame: (id) => {
      pending.delete(id);
    },
  };
  const advance = (ms: number) => {
    now += ms;
    const callbacks = [...pending.values()];
    pending.clear();
    for (const cb of callbacks) cb(now);
  };
  return { clock, advance, pendingCount: () => pending.size };
}

describe('mount and patchDOM', () => {
  test('mount creates an svg whose serialised DOM equals the string renderer, for every fixture and time', () => {
    for (const name of Object.keys(SCENES)) {
      const demo = SCENES[name]();
      const container = document.createElement('div');
      const player = demo.mount(container, { clock: fakeClock().clock });
      expect(container.children).toHaveLength(1);
      const svg = container.querySelector('svg')!;
      const times = demo.duration > 0 ? [0, demo.duration / 2, demo.duration, 0] : [0];
      for (const t of times) {
        player.seek(t);
        expect(serializeDom(svg), `${name} @ ${t}`).toBe(demo.toSVG(t));
      }
      player.destroy();
    }
  });

  test('mount into an existing svg reuses it', () => {
    const demo = SCENES.minimal();
    const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg') as SVGSVGElement;
    const player = demo.mount(svg, { clock: fakeClock().clock });
    expect(player.svg).toBe(svg);
    expect(svg.querySelectorAll('g[data-key]')).toHaveLength(2);
  });

  test('unchanged groups keep their element identity; changed ones are rebuilt; removed ones go', () => {
    const demo = createDemo({ width: 200, height: 200, seed: 1 });
    demo.rect({ id: 'a', x: 0, y: 0, width: 50, height: 50 });
    demo.rect({ id: 'b', x: 60, y: 0, width: 50, height: 50 });
    demo.rect({ id: 'c', x: 120, y: 0, width: 50, height: 50 });
    const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg') as SVGSVGElement;
    demo.renderInto(svg);
    const [a, b, c] = ['a', 'b', 'c'].map((k) => svg.querySelector(`g[data-key="${k}"]`)!);
    demo.scene.update('b', { x: 70 });
    demo.remove('c');
    demo.renderInto(svg);
    expect(svg.querySelector('g[data-key="a"]')).toBe(a);
    expect(svg.querySelector('g[data-key="b"]')).not.toBe(b);
    expect(svg.querySelector('g[data-key="c"]')).toBeNull();
    expect(c.isConnected).toBe(false);
    expect([...svg.children].map((el) => el.getAttribute('data-key'))).toEqual(['__bg', 'a', 'b']);
  });

  test('re-ordering only moves elements', () => {
    const demo = createDemo({ width: 200, height: 200, seed: 1, background: null });
    demo.rect({ id: 'a', x: 0, y: 0, width: 50, height: 50 });
    demo.rect({ id: 'b', x: 60, y: 0, width: 50, height: 50 });
    const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg') as SVGSVGElement;
    demo.renderInto(svg);
    const a = svg.querySelector('g[data-key="a"]')!;
    demo.scene.bringToFront('a');
    demo.renderInto(svg);
    expect([...svg.children].map((el) => el.getAttribute('data-key'))).toEqual(['b', 'a']);
    expect(svg.querySelector('g[data-key="a"]')).toBe(a);
  });

  test('a moving cursor touches only the cursor group', () => {
    const demo = SCENES.loginDemo();
    const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg') as SVGSVGElement;
    demo.renderInto(svg, 100);
    const before = new Map([...svg.children].map((el) => [el.getAttribute('data-key'), el]));
    demo.renderInto(svg, 200);
    for (const el of svg.children) {
      const key = el.getAttribute('data-key')!;
      if (key === '__cursor') expect(el).not.toBe(before.get(key));
      else expect(el).toBe(before.get(key));
    }
  });

  test('foreign children and the background are handled', () => {
    const demo = createDemo({ width: 100, height: 100, seed: 1 });
    demo.rect({ id: 'a', x: 0, y: 0, width: 10, height: 10 });
    const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg') as SVGSVGElement;
    svg.appendChild(document.createElementNS('http://www.w3.org/2000/svg', 'title'));
    demo.renderInto(svg);
    expect(svg.querySelector('title')).toBeNull();
    expect(svg.firstElementChild!.getAttribute('data-key')).toBe('__bg');
    const bg = svg.firstElementChild!;
    demo.renderInto(svg);
    expect(svg.firstElementChild).toBe(bg);
    patchDOM(svg, { ...demo.frame(), background: undefined });
    expect(svg.querySelector('[data-key="__bg"]')).toBeNull();
  });
});

describe('Player', () => {
  test('plays in real time through the clock, emits events, and ends on the last frame', () => {
    const demo = SCENES.loginDemo();
    const { clock, advance, pendingCount } = fakeClock();
    const player = demo.mount(document.createElement('div'), { clock });
    const events: string[] = [];
    for (const ev of ['play', 'pause', 'seeked', 'end'] as const) player.on(ev, () => events.push(ev));
    let updates = 0;
    player.on('timeupdate', () => updates++);

    expect(player.playing).toBe(false);
    player.play();
    expect(player.playing).toBe(true);
    advance(100);
    expect(player.time).toBe(100);
    advance(250);
    expect(player.time).toBe(350);
    expect(serializeDom(player.svg)).toBe(demo.toSVG(350));
    expect(updates).toBe(2);

    advance(demo.duration);
    expect(player.time).toBe(demo.duration);
    expect(player.playing).toBe(false);
    expect(pendingCount()).toBe(0);
    expect(events).toEqual(['play', 'pause', 'end']);
    expect(serializeDom(player.svg)).toBe(demo.toSVG(demo.duration));
  });

  test('pause stops the clock, seek jumps, play at the end restarts', () => {
    const demo = SCENES.loginDemo();
    const { clock, advance } = fakeClock();
    const player = demo.mount(document.createElement('div'), { clock });
    player.play();
    advance(200);
    player.pause();
    advance(500);
    expect(player.time).toBe(200);
    player.seek(1000);
    expect(player.time).toBe(1000);
    expect(serializeDom(player.svg)).toBe(demo.toSVG(1000));
    player.seek(-5);
    expect(player.time).toBe(0);
    player.seek(1e9);
    expect(player.time).toBe(demo.duration);
    player.play();
    expect(player.time).toBe(0);
    player.stop();
    expect(player.playing).toBe(false);
    expect(player.time).toBe(0);
  });

  test('rate and loop', () => {
    const demo = SCENES.loginDemo();
    const { clock, advance } = fakeClock();
    const player = demo.mount(document.createElement('div'), { clock, rate: 2, loop: true });
    player.play();
    advance(100);
    expect(player.time).toBe(200);
    advance(demo.duration);
    expect(player.playing).toBe(true);
    expect(player.time).toBeLessThan(demo.duration);
    player.destroy();
    expect(player.playing).toBe(false);
  });

  test('a static demo ends immediately', () => {
    const demo = SCENES.minimal();
    const { clock, advance } = fakeClock();
    const player = demo.mount(document.createElement('div'), { clock, autoplay: true });
    advance(16);
    expect(player.playing).toBe(false);
    expect(player.time).toBe(0);
  });

  test('render() picks up edits made while paused', () => {
    const demo = createDemo({ width: 100, height: 100, seed: 1 });
    demo.rect({ id: 'a', x: 0, y: 0, width: 10, height: 10 });
    const { clock } = fakeClock();
    const player = demo.mount(document.createElement('div'), { clock });
    demo.rect({ id: 'b', x: 20, y: 0, width: 10, height: 10 });
    expect(player.svg.querySelector('g[data-key="b"]')).toBeNull();
    player.render();
    expect(player.svg.querySelector('g[data-key="b"]')).not.toBeNull();
  });

  test('listeners can unsubscribe', () => {
    const demo = SCENES.minimal();
    const { clock } = fakeClock();
    const player = demo.mount(document.createElement('div'), { clock });
    let n = 0;
    const off = player.on('seeked', () => n++);
    player.seek(0);
    off();
    player.seek(0);
    expect(n).toBe(1);
  });
});
