import { createDemo } from '../../src/index.js';
import type { Demo } from '../../src/index.js';

/**
 * Fixture demos shared by the golden, determinism and dist tests. Each is a
 * function so every test gets a fresh instance; a fixture must be a pure
 * function of its seed.
 */
export const SCENES: Record<string, (seed?: number) => Demo> = {
  /** Small enough for its full SVG to be snapshotted and read in a diff. */
  minimal(seed = 7) {
    const demo = createDemo({ width: 200, height: 120, seed, background: null });
    demo.rectangle({ id: 'box', x: 20, y: 20, width: 100, height: 60, cornerRadius: 6 });
    demo.line({ id: 'underline', x: 20, y: 100, x2: 180, y2: 100 });
    return demo;
  },

  textAndIcons(seed = 11) {
    const demo = createDemo({ width: 420, height: 200, seed });
    demo.text({ id: 'title', x: 16, y: 12, characters: 'Sign in', style: { fontSize: 24 } });
    demo.text({
      id: 'hint',
      x: 16,
      y: 50,
      characters: 'Use your work email.\nIt stays private.',
      style: { fontSize: 13, fills: [{ type: 'SOLID', color: '#8a8f98' }] },
    });
    demo.text({ id: 'centre', x: 210, y: 110, characters: 'centred \u00e9', style: { textAlignHorizontal: 'CENTER' } });
    demo.icon({ id: 'mail', x: 360, y: 12, icon: 'mail', size: 32 });
    demo.icon({ id: 'lock', x: 360, y: 56, icon: 'lock', size: 24, strokes: [{ type: 'SOLID', color: '#2f6fed' }] });
    demo.icon({
      id: 'rough',
      x: 360,
      y: 96,
      icon: { nodes: [['circle', { cx: 12, cy: 12, r: 10 }]], rough: true },
      size: 40,
    });
    return demo;
  },

  /**
   * The briefing's login mockup, with every component state exercised. Laid
   * out with relative placement; the golden pins that it produces exactly the
   * coordinates the literal version did.
   */
  loginForm(seed = 42) {
    const demo = createDemo({ width: 900, height: 600, seed, background: null });
    demo.browser({ id: 'browser', x: 40, y: 30, width: 820, height: 540, url: 'https://example.com/login' });
    demo.frame({ id: 'card', parent: 'browser', x: 210, y: 70, width: 400, height: 330, title: 'Welcome back' });
    demo.text({
      id: 'email-label',
      parent: 'card',
      x: 24,
      y: 20,
      characters: 'Email',
      style: { fills: [{ type: 'SOLID', color: '#8a8f98' }] },
    });
    demo.input({ id: 'email', below: 'email-label', gap: 10, width: 352, placeholder: 'you@example.com' });
    demo.text({
      id: 'password-label',
      below: 'email',
      gap: 20,
      characters: 'Password',
      style: { fills: [{ type: 'SOLID', color: '#8a8f98' }] },
    });
    demo.input({
      id: 'password',
      below: 'password-label',
      gap: 10,
      width: 352,
      value: 'hunter2',
      state: { focused: true },
    });
    demo.button({
      id: 'login',
      below: 'password',
      gap: 30,
      width: 352,
      characters: 'Sign in',
      variant: 'primary',
      icon: 'log-in',
    });
    demo.button({ id: 'forgot', below: 'login', gap: 14, characters: 'Forgot password?' });
    demo.button({ id: 'hovered', rightOf: 'forgot', gap: 11, characters: 'Hovered', state: { hovered: true } });
    demo.button({ id: 'pressed', rightOf: 'hovered', gap: 13, characters: 'Pressed', state: { pressed: true } });
    demo.icon({
      id: 'help',
      parent: 'browser',
      x: 780,
      y: 20,
      icon: 'info',
      size: 22,
      strokes: [{ type: 'SOLID', color: '#8a8f98' }],
    });
    demo.button({
      id: 'disabled',
      parent: 'browser',
      x: 40,
      y: 440,
      characters: 'Disabled',
      state: { disabled: true },
    });
    return demo;
  },

  /** A plain window with a titled panel and mixed content. */
  window(seed = 5) {
    const demo = createDemo({ width: 520, height: 360, seed });
    demo.window({ id: 'win', x: 20, y: 20, width: 480, height: 320, title: 'Preferences' });
    demo.frame({ id: 'general', parent: 'win', x: 16, y: 16, width: 448, height: 120, title: 'General' });
    demo.text({ id: 'name-label', parent: 'general', x: 16, y: 14, characters: 'Display name' });
    demo.input({ id: 'name', parent: 'general', x: 160, y: 6, width: 270, value: 'Ada Lovelace' });
    demo.button({ id: 'save', parent: 'win', x: 360, y: 240, characters: 'Save', variant: 'primary', icon: 'check' });
    demo.button({ id: 'cancel', parent: 'win', x: 270, y: 240, characters: 'Cancel' });
    return demo;
  },

  /** The briefing's timeline over the login form. */
  loginDemo(seed = 42) {
    const demo = createDemo({ width: 900, height: 600, seed });
    demo.input({ id: 'email', x: 250, y: 200, width: 350, placeholder: 'Email' });
    demo.button({ id: 'login', x: 470, y: 300, characters: 'Sign in' });
    demo.text({ id: 'done', x: 470, y: 360, characters: 'Signed in!', visible: false });
    demo.timeline
      .moveCursor('email')
      .click()
      .type('email', 'hello@example.com')
      .moveCursor('login')
      .click()
      .set('done', { visible: true })
      .wait(400);
    return demo;
  },

  primitives(seed = 42) {
    const demo = createDemo({ width: 640, height: 360, seed });
    const styles = ['hachure', 'solid', 'zigzag', 'cross-hatch', 'dots', 'dashed', 'zigzag-line'] as const;
    styles.forEach((fillStyle, i) => {
      demo.rectangle({
        id: `fill-${fillStyle}`,
        x: 20 + i * 85,
        y: 20,
        width: 70,
        height: 50,
        fills: [{ type: 'SOLID', color: '#7aa2f7' }],
        sketch: { fillStyle },
      });
    });
    demo.rectangle({
      id: 'rounded',
      x: 20,
      y: 100,
      width: 160,
      height: 70,
      cornerRadius: 12,
      strokes: [{ type: 'SOLID', color: '#b00' }],
      strokeWeight: 2,
    });
    demo.ellipse({
      id: 'ellipse',
      x: 200,
      y: 100,
      width: 120,
      height: 70,
      fills: [{ type: 'SOLID', color: '#ffd166' }],
      sketch: { fillStyle: 'solid' },
    });
    demo.line({ id: 'line', x: 340, y: 100, x2: 600, y2: 170, strokeDashes: [6, 4] });
    demo.vector({
      id: 'triangle',
      x: 20,
      y: 200,
      d: 'M0 60 L40 0 L80 60 Z',
      fills: [{ type: 'SOLID', color: '#06d6a0' }],
    });
    demo.rectangle({ id: 'group', x: 140, y: 200, width: 300, height: 130, sketch: { roughness: 0.5 } });
    demo.rectangle({ id: 'child', parent: 'group', x: 10, y: 10, width: 60, height: 40 });
    demo.ellipse({ id: 'grandchild', parent: 'child', x: 5, y: 5, width: 20, height: 20, sketchVariant: 3 });
    demo.rectangle({ id: 'ghost', x: 500, y: 250, width: 40, height: 40, visible: false });
    return demo;
  },
};
