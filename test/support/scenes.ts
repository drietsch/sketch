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

  /** A form laid out by auto-layout: a HUG frame, FILL inputs, a SPACE_BETWEEN button row. */
  layoutForm(seed = 21) {
    const demo = createDemo({ width: 520, height: 420, seed });
    demo.frame({
      id: 'form',
      x: 40,
      y: 40,
      width: 440,
      title: 'Create account',
      layoutMode: 'VERTICAL',
      itemSpacing: 12,
      padding: 24,
      layoutSizingVertical: 'HUG',
    });
    demo.text({
      id: 'name-label',
      parent: 'form',
      characters: 'Name',
      style: { fills: [{ type: 'SOLID', color: '#8a8f98' }] },
    });
    demo.input({ id: 'name', parent: 'form', width: 100, layoutSizingHorizontal: 'FILL', placeholder: 'Ada Lovelace' });
    demo.text({
      id: 'email-label',
      parent: 'form',
      characters: 'Email',
      style: { fills: [{ type: 'SOLID', color: '#8a8f98' }] },
    });
    demo.input({
      id: 'email',
      parent: 'form',
      width: 100,
      layoutSizingHorizontal: 'FILL',
      placeholder: 'ada@example.com',
    });
    demo.frame({
      id: 'actions',
      parent: 'form',
      height: 36,
      layoutMode: 'HORIZONTAL',
      layoutSizingHorizontal: 'FILL',
      primaryAxisAlignItems: 'SPACE_BETWEEN',
      counterAxisAlignItems: 'CENTER',
      fills: [],
      strokes: [],
    });
    demo.button({ id: 'cancel', parent: 'actions', characters: 'Cancel' });
    demo.button({ id: 'create', parent: 'actions', characters: 'Create', variant: 'primary', icon: 'check' });
    demo.timeline.moveCursor('name').click().type('name', 'Ada').moveCursor('create').click();
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

  /** Every in-place leaf control, in its resting and its active state. */
  controls(seed = 13) {
    const demo = createDemo({ width: 560, height: 420, seed });
    demo.checkbox({ id: 'cb', x: 20, y: 20, characters: 'Remember me' });
    demo.checkbox({ id: 'cb-on', below: 'cb', gap: 10, characters: 'Checked', checked: true });
    demo.checkbox({ id: 'cb-mixed', below: 'cb-on', gap: 10, characters: 'Some', checked: true, indeterminate: true });
    demo.checkbox({ id: 'cb-off', below: 'cb-mixed', gap: 10, characters: 'Disabled', state: { disabled: true } });
    demo.switch({ id: 'sw', below: 'cb-off', gap: 14, characters: 'Wi-Fi' });
    demo.switch({ id: 'sw-on', below: 'sw', gap: 10, characters: 'Bluetooth', checked: true });
    demo.toggle({ id: 'tg', below: 'sw-on', gap: 14, characters: 'Bold', icon: 'pencil' });
    demo.toggle({ id: 'tg-on', rightOf: 'tg', gap: 8, characters: 'Italic', pressed: true });
    demo.toggleGroup({ id: 'align', below: 'tg', gap: 14, options: ['Left', 'Center', 'Right'], value: 'Center' });
    demo.radioGroup({
      id: 'plan',
      below: 'align',
      gap: 14,
      options: ['Free', 'Pro'],
      value: 'Pro',
      orientation: 'horizontal',
    });
    demo.checkboxGroup({ id: 'toppings', below: 'plan', gap: 14, options: ['Cheese', 'Olives'], value: ['Cheese'] });
    demo.slider({ id: 'volume', x: 300, y: 20, width: 220, value: 35 });
    demo.slider({ id: 'stepped', below: 'volume', gap: 14, width: 220, value: 80, step: 10 });
    demo.progress({ id: 'upload', below: 'stepped', gap: 20, width: 220, value: 62, characters: 'Uploading' });
    demo.progress({ id: 'busy', below: 'upload', gap: 10, width: 220, indeterminate: true });
    demo.meter({ id: 'disk', below: 'busy', gap: 14, width: 220, value: 78, characters: 'Disk' });
    demo.separator({ id: 'rule', below: 'disk', gap: 14, length: 220 });
    demo.separator({ id: 'bar', x: 270, y: 20, orientation: 'vertical', length: 380 });
    demo.avatar({ id: 'initials', below: 'rule', gap: 14, characters: 'Ada' });
    demo.avatar({ id: 'icon', rightOf: 'initials', gap: 10, icon: 'user' });
    demo.avatar({
      id: 'coloured',
      rightOf: 'icon',
      gap: 10,
      characters: 'JS',
      size: 44,
      fills: [{ type: 'SOLID', color: '#ffd166' }],
      sketch: { fillStyle: 'solid' },
    });
    demo.numberField({ id: 'qty', below: 'initials', gap: 16, width: 140, value: 2, min: 0, max: 10 });
    demo.otpField({ id: 'otp', below: 'qty', gap: 14, length: 4, value: '49', state: { focused: true } });
    return demo;
  },

  /** FIELD, FIELDSET and FORM under auto-layout, driven by the semantic steps. */
  formLayout(seed = 17) {
    const demo = createDemo({ width: 520, height: 460, seed });
    demo.form({ id: 'signup', x: 30, y: 30, width: 280, layoutSizingVertical: 'HUG' });
    demo.field({ id: 'f-name', parent: 'signup', label: 'Name', width: 280 });
    demo.input({ id: 'name', parent: 'f-name', width: 280, placeholder: 'Ada Lovelace' });
    demo.field({ id: 'f-plan', parent: 'signup', label: 'Plan', description: 'Change any time.', width: 280 });
    demo.radioGroup({ id: 'plan', parent: 'f-plan', options: ['Free', 'Team'], value: 'Free' });
    demo.field({ id: 'f-seats', parent: 'signup', label: 'Seats', width: 280 });
    demo.numberField({ id: 'seats', parent: 'f-seats', width: 140, value: 1, min: 1, max: 20 });
    demo.field({ id: 'f-volume', parent: 'signup', label: 'Volume', error: 'Too loud.', width: 280 });
    demo.slider({ id: 'volume', parent: 'f-volume', width: 280, value: 20 });
    demo.fieldset({ id: 'contact', x: 340, y: 30, width: 160, height: 90, legend: 'Contact' });
    demo.checkbox({ id: 'email-me', parent: 'contact', x: 14, y: 14, characters: 'Email' });
    demo.checkbox({ id: 'text-me', below: 'email-me', gap: 10, characters: 'Text', checked: true });
    demo.timeline
      .click('name')
      .type('name', 'Ada')
      .choose('plan', 'Team')
      .choose('seats', 3)
      .drag('volume', 75)
      .check('email-me')
      .uncheck('text-me');
    return demo;
  },

  /** TABS, ACCORDION, COLLAPSIBLE and TOOLBAR, with panels shown and hidden over time. */
  tabsAccordion(seed = 9) {
    const demo = createDemo({ width: 560, height: 420, seed });
    demo.tabs({ id: 'tabs', x: 20, y: 20, width: 250, height: 120, tabs: ['General', 'Billing'], value: 'General' });
    demo.text({ id: 'general', parent: 'tabs', x: 0, y: 10, characters: 'General settings' });
    demo.button({ id: 'billing', parent: 'tabs', x: 0, y: 10, characters: 'Add card', icon: 'plus' });
    demo.accordion({
      id: 'faq',
      below: 'tabs',
      gap: 16,
      width: 250,
      items: [{ label: 'Shipping', characters: 'Ships in 2 days.' }, 'Returns'],
      value: 'Shipping',
    });
    demo.collapsible({
      id: 'advanced',
      x: 300,
      y: 20,
      width: 230,
      characters: 'Advanced',
      open: true,
      padding: 12,
    });
    demo.checkbox({ id: 'beta', parent: 'advanced', characters: 'Beta features' });
    demo.switch({ id: 'logs', parent: 'advanced', characters: 'Verbose logs', checked: true });
    demo.toolbar({ id: 'tools', below: 'advanced', gap: 16, height: 44, layoutSizingHorizontal: 'HUG' });
    demo.toggle({ id: 't-pen', parent: 'tools', icon: 'pencil', pressed: true });
    demo.toggle({ id: 't-link', parent: 'tools', icon: 'link' });
    demo.separator({ id: 't-sep', parent: 'tools', orientation: 'vertical', length: 20 });
    demo.button({ id: 't-save', parent: 'tools', characters: 'Save', variant: 'primary' });
    demo.timeline
      .choose('tabs', 'Billing')
      .choose('faq', 'Returns')
      .close('advanced')
      .hover('t-save')
      .open('advanced')
      .toggle('logs');
    return demo;
  },

  /** MENU, CONTEXT_MENU, SELECT, COMBOBOX and AUTOCOMPLETE opening and choosing over a timeline. */
  menusAndSelects(seed = 23) {
    const demo = createDemo({ width: 560, height: 420, seed });
    demo.menu({
      id: 'file',
      x: 20,
      y: 20,
      characters: 'File',
      items: ['New', 'Open…', { label: 'Export', items: ['PDF', 'PNG'] }, '-', { label: 'Quit', icon: 'log-out' }],
    });
    demo.select({
      id: 'country',
      x: 20,
      y: 80,
      width: 200,
      options: ['Austria', 'Germany', 'Spain'],
      value: 'Austria',
    });
    demo.combobox({
      id: 'city',
      below: 'country',
      gap: 14,
      width: 200,
      options: ['Berlin', 'Bern', 'Vienna'],
      placeholder: 'City',
    });
    demo.autocomplete({
      id: 'q',
      below: 'city',
      gap: 14,
      width: 200,
      options: ['Invoices', 'Inventory', 'Reports'],
      placeholder: 'Search…',
    });
    demo.rectangle({ id: 'canvas', x: 300, y: 20, width: 240, height: 200, strokeDashes: [6, 4] });
    demo.text({
      id: 'hint',
      parent: 'canvas',
      x: 12,
      y: 12,
      characters: 'Click for options',
      style: { fills: [{ type: 'SOLID', color: '#8a8f98' }] },
    });
    demo.contextMenu({
      id: 'ctx',
      anchor: 'canvas',
      items: ['Paste', 'Select all', '-', { label: 'Clear', icon: 'x', disabled: true }],
    });
    demo.timeline
      .choose('file', 'PNG')
      .choose('country', 'Germany')
      .type('city', 'Ber')
      .choose('city', 'Bern')
      .type('q', 'Inv')
      .open('ctx')
      .choose('ctx', 'Select all');
    return demo;
  },

  /** TOOLTIP, POPOVER, DIALOG, ALERT_DIALOG, DRAWER and TOAST: hover, open, act, close. */
  dialogs(seed = 29) {
    const demo = createDemo({ width: 560, height: 420, seed });
    demo.button({ id: 'save', x: 20, y: 20, characters: 'Save', icon: 'check', variant: 'primary' });
    demo.tooltip({ id: 'save-tip', anchor: 'save', characters: 'Saves to the cloud' });
    demo.button({ id: 'share', rightOf: 'save', gap: 12, characters: 'Share', icon: 'send' });
    demo.popover({
      id: 'share-pop',
      anchor: 'share',
      title: 'Share',
      description: 'Anyone with the link can view.',
      width: 240,
    });
    demo.input({ id: 'share-email', parent: 'share-pop', width: 216, placeholder: 'name@example.com' });
    demo.button({ id: 'share-send', parent: 'share-pop', characters: 'Send', variant: 'primary' });
    demo.button({ id: 'trash', rightOf: 'share', gap: 12, characters: 'Delete', icon: 'x' });
    demo.dialog({
      id: 'confirm',
      title: 'Delete this file?',
      description: 'It moves to the trash for 30 days.',
      width: 320,
    });
    demo.toolbar({
      id: 'confirm-actions',
      parent: 'confirm',
      height: 48,
      layoutSizingHorizontal: 'FILL',
      primaryAxisAlignItems: 'MAX',
      fills: [],
      strokes: [],
    });
    demo.button({ id: 'cancel', parent: 'confirm-actions', characters: 'Cancel' });
    demo.button({ id: 'delete', parent: 'confirm-actions', characters: 'Delete', variant: 'primary' });
    demo.alertDialog({ id: 'lost', title: 'Connection lost', description: 'Reconnecting…', width: 280 });
    demo.button({ id: 'prefs', x: 20, y: 80, characters: 'Settings', icon: 'settings' });
    demo.drawer({ id: 'settings', title: 'Settings', width: 240 });
    demo.switch({ id: 'dark', parent: 'settings', characters: 'Dark mode' });
    demo.toast({
      id: 'saved',
      title: 'Saved',
      description: 'All changes are in the cloud.',
      variant: 'success',
      open: false,
    });
    demo.toast({ id: 'offline', title: 'You are offline', variant: 'warning', stack: 1 });
    demo.timeline
      .hover('save')
      .open('share-pop')
      .type('share-email', 'grace@example.com')
      .click('share-send')
      .close('share-pop')
      .open('confirm')
      .click('delete')
      .close('confirm')
      .open('lost')
      .wait(300)
      .close('lost')
      .open('settings')
      .toggle('dark')
      .close('settings')
      .open('saved')
      .wait(400);
    return demo;
  },

  /** MENUBAR, NAVIGATION_MENU, PREVIEW_CARD and a SCROLL_AREA that is dragged. */
  navigation(seed = 31) {
    const demo = createDemo({ width: 560, height: 420, seed });
    demo.menubar({
      id: 'bar',
      x: 20,
      y: 20,
      menus: [
        { label: 'File', items: ['New', 'Open'] },
        { label: 'Edit', items: [{ label: 'Cut', icon: 'copy' }, 'Paste', '-', { label: 'Undo', disabled: true }] },
      ],
    });
    demo.navigationMenu({
      id: 'nav',
      x: 300,
      y: 20,
      items: [{ label: 'Products', items: ['Editor', 'Player'] }, { label: 'Pricing' }],
    });
    demo.text({
      id: 'owner',
      x: 20,
      y: 80,
      characters: 'Owned by @ada',
      style: { fills: [{ type: 'SOLID', color: '#2f6fed' }] },
    });
    demo.previewCard({
      id: 'ada',
      anchor: 'owner',
      title: 'Ada Lovelace',
      description: 'Analyst, metaphysician, and founder of scientific computing.',
    });
    demo.scrollArea({
      id: 'list',
      x: 20,
      y: 120,
      width: 260,
      height: 160,
      contentHeight: 330,
      layoutMode: 'VERTICAL',
      padding: 10,
      itemSpacing: 8,
    });
    for (let i = 1; i <= 10; i++) demo.text({ id: `row-${i}`, parent: 'list', characters: `Document ${i}.pdf` });
    demo.timeline
      .choose('bar', 'Edit')
      .choose('bar', 'Paste')
      .choose('nav', 'Products')
      .choose('nav', 'Player')
      .hover('owner')
      .drag('list', 170)
      .click('row-9');
    return demo;
  },
};
