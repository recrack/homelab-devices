import test from 'node:test';
import assert from 'node:assert/strict';
import { directionalTarget, installRemoteNavigation } from '../src/remote-navigation.mjs';

const rect = (left, top, width = 60, height = 40) => ({ left, top, right: left + width, bottom: top + height, width, height });

function fixture() {
  const timers = new Map();
  const observers = new Set();
  let timerId = 0;
  class Hub {
    listeners = new Map();
    addEventListener(type, handler) {
      if (!this.listeners.has(type)) this.listeners.set(type, new Set());
      this.listeners.get(type).add(handler);
    }
    removeEventListener(type, handler) { this.listeners.get(type)?.delete(handler); }
    emit(type, event) {
      for (const handler of [...this.listeners.get(type) || []]) {
        handler(event);
        if (event.immediateStopped) break;
      }
      return event;
    }
  }
  const document = new Hub();
  class Element extends Hub {
    constructor(tagName, box, parent = null, attributes = {}) {
      super();
      this.tagName = tagName.toUpperCase();
      this.box = box;
      this.parentElement = parent;
      this.children = [];
      this.attributes = { ...attributes };
      this.style = {};
      this.ownerDocument = document;
      this.tabIndex = ['BUTTON', 'A', 'INPUT', 'SELECT', 'TEXTAREA'].includes(this.tagName) ? 0 : -1;
      this.disabled = false;
      this.hidden = false;
      this.inert = false;
      this.clicks = 0;
      this.scrolls = 0;
      this.classList = { contains: value => (this.attributes.class || '').split(' ').includes(value) };
      parent?.children.push(this);
    }
    get id() { return this.attributes.id || ''; }
    get isConnected() { return this === document.body || Boolean(this.parentElement?.isConnected); }
    get isContentEditable() { return this.getAttribute('contenteditable') === 'true'; }
    getAttribute(name) { return this.attributes[name] ?? null; }
    hasAttribute(name) { return Object.hasOwn(this.attributes, name); }
    setAttribute(name, value) { this.attributes[name] = value; }
    removeAttribute(name) { delete this.attributes[name]; }
    getBoundingClientRect() { return this.box; }
    getClientRects() { return this.style.display === 'none' ? [] : [this.box]; }
    contains(element) { return element === this || this.children.some(child => child.contains(element)); }
    matches(selector) {
      return selector.split(',').some(part => {
        if (part === ':disabled') return this.disabled || Boolean(this.parentElement?.closest('fieldset')?.disabled);
        if (part === '.room-nav button[aria-pressed="true"]') return this.tagName === 'BUTTON' && this.getAttribute('aria-pressed') === 'true' && Boolean(this.parentElement?.closest('.room-nav'));
        if (part.startsWith('.')) return this.classList.contains(part.slice(1));
        if (part === '[contenteditable]:not([contenteditable="false"])') return this.hasAttribute('contenteditable') && this.getAttribute('contenteditable') !== 'false';
        const match = /^([a-z]+)?(?:\[([^=\]]+)(?:="([^"]*)")?\])?$/.exec(part);
        return Boolean(match && (!match[1] || this.tagName === match[1].toUpperCase()) &&
          (!match[2] || (match[3] === undefined ? this.hasAttribute(match[2]) : this.getAttribute(match[2]) === match[3])));
      });
    }
    closest(selector) { return this.matches(selector) ? this : this.parentElement?.closest(selector) || null; }
    querySelectorAll(selector) {
      return this.children.flatMap(child => [...(child.matches(selector) ? [child] : []), ...child.querySelectorAll(selector)]);
    }
    focus() {
      if (this.disabled || !this.isConnected) return;
      document.activeElement = this;
      root.emit('focusin', { target: this });
    }
    scrollIntoView() { this.scrolls++; }
    click() { click(this); }
  }
  document.body = new Element('body', rect(0, 0, 1400, 1200));
  document.documentElement = document.body;
  document.activeElement = document.body;
  document.querySelectorAll = selector => document.body.querySelectorAll(selector);
  const root = new Element('main', rect(0, 0, 1200, 1200), document.body);
  const window = new Hub();
  Object.assign(window, {
    getComputedStyle: element => ({ display: 'block', visibility: 'visible', opacity: '1', ...element.style }),
    setTimeout(callback) { timers.set(++timerId, callback); return timerId; },
    clearTimeout(id) { timers.delete(id); },
    MutationObserver: class {
      constructor(callback) { this.callback = callback; }
      observe() { observers.add(this); }
      disconnect() { observers.delete(this); }
    },
  });
  document.defaultView = window;
  function event(target, values = {}) {
    return {
      target, defaultPrevented: false, cancelable: true,
      preventDefault() { this.defaultPrevented = true; },
      stopPropagation() { this.stopped = true; },
      stopImmediatePropagation() { this.immediateStopped = true; },
      ...values,
    };
  }
  function click(element, detail = 0) {
    const e = document.emit('click', event(element, { detail }));
    if (!e.defaultPrevented) { element.clicks++; element.onClick?.(); }
    return e;
  }
  function tick() { for (const [id, callback] of [...timers]) { timers.delete(id); callback(); } }
  return {
    root, document, window, observers,
    add(tag, x, y, attributes = {}, parent = root) { return new Element(tag, rect(x, y), parent, attributes); },
    key(key, values = {}, type = 'keydown') { return document.emit(type, event(document.activeElement, { key, ...values })); },
    click,
    pointer() { root.emit('pointerdown', event(document.activeElement)); },
    tick,
    changed() { for (const observer of observers) observer.callback([]); tick(); },
    remove(element) {
      element.parentElement.children = element.parentElement.children.filter(child => child !== element);
      element.parentElement = null;
      if (element.contains(document.activeElement)) document.activeElement = document.body;
    },
  };
}

test('Spatial movement follows rows and columns, excludes the opposite direction, and has no edge wrap', () => {
  const source = rect(100, 100);
  const right = { getBoundingClientRect: () => rect(220, 100) };
  const diagonal = { getBoundingClientRect: () => rect(180, 190) };
  const below = { getBoundingClientRect: () => rect(100, 240) };
  assert.equal(directionalTarget(source, [diagonal, below, right], 'ArrowRight'), right);
  assert.equal(directionalTarget(source, [diagonal, below, right], 'ArrowDown'), below);
  assert.equal(directionalTarget(source, [diagonal, below, right], 'ArrowLeft'), null);
  const f = fixture();
  const a = f.add('button', 100, 100, { 'data-remote-default': '' });
  const b = f.add('button', 220, 100);
  const c = f.add('button', 100, 240);
  const d = f.add('button', 220, 240);
  const far = f.add('button', 100, 900);
  const controller = installRemoteNavigation(f.root);
  assert.equal(f.document.activeElement, a);
  for (const [key, expected] of [['ArrowRight', b], ['ArrowDown', d], ['ArrowLeft', c], ['ArrowUp', a], ['ArrowLeft', a]]) {
    assert.equal(f.key(key).defaultPrevented, true);
    assert.equal(f.document.activeElement, expected);
  }
  f.key('Unidentified', { keyCode: 40 });
  f.key('Unidentified', { keyCode: 40 });
  assert.equal(f.document.activeElement, far);
  assert.ok(far.scrolls > 0);
  assert.equal(f.root.getAttribute('data-navigation'), 'remote');
  assert.ok([a, b, c, d, far].every(item => item.clicks === 0));
  f.pointer();
  assert.equal(f.root.getAttribute('data-navigation'), null);
  controller.destroy();
});

test('Disabled, hidden, inert, invisible and offscreen skip-link controls never receive remote focus', () => {
  const f = fixture();
  const a = f.add('button', 0, 100, { 'data-remote-default': '' });
  f.add('button', 80, 100).disabled = true;
  f.add('button', 160, 100).hidden = true;
  f.add('button', 240, 100, { 'aria-disabled': 'true' });
  const hiddenParent = f.add('div', 320, 100, { 'aria-hidden': 'true' });
  f.add('button', 320, 100, {}, hiddenParent);
  const inertParent = f.add('div', 400, 100);
  inertParent.inert = true;
  f.add('button', 400, 100, {}, inertParent);
  f.add('button', 480, 100).style.visibility = 'hidden';
  f.add('button', 560, 100).style.opacity = '0';
  f.add('button', 640, 100).style.display = 'none';
  f.add('input', 720, 100, { type: 'hidden' });
  f.add('button', 800, 100).tabIndex = -1;
  f.add('a', 880, -100, { href: '#main', class: 'skip-link' });
  const b = f.add('button', 1000, 100);
  const controller = installRemoteNavigation(f.root);
  assert.equal(f.document.activeElement, a);
  f.key('ArrowRight');
  assert.equal(f.document.activeElement, b);
  controller.destroy();
});

test('Initial focus prefers selected room navigation and never steals an existing focus', () => {
  const f = fixture();
  const a = f.add('button', 0, 100, { 'data-remote-default': '' });
  const nav = f.add('nav', 0, 0, { class: 'room-nav' });
  const selected = f.add('button', 0, 0, { 'aria-pressed': 'true' }, nav);
  const controller = installRemoteNavigation(f.root);
  assert.equal(f.document.activeElement, selected);
  assert.equal(f.root.getAttribute('data-navigation'), 'remote');
  a.focus();
  assert.equal(controller.focusInitial(), false);
  assert.equal(f.document.activeElement, a);
  controller.destroy();
});

test('Enter activates once per press, blocks legacy repeats and generated duplicate clicks, and resets on release', () => {
  const f = fixture();
  const button = f.add('button', 0, 0);
  const controller = installRemoteNavigation(f.root);
  assert.equal(f.key('Unidentified', { keyCode: 13 }).defaultPrevented, true);
  f.key('Enter');
  f.key('Enter', { repeat: true });
  f.click(button);
  assert.equal(button.clicks, 1);
  assert.equal(f.key('Enter', {}, 'keyup').defaultPrevented, true);
  f.click(button);
  assert.equal(button.clicks, 1);
  f.tick();
  f.key('Enter');
  assert.equal(button.clicks, 2);
  f.key('Enter', {}, 'keyup');
  f.tick();
  const input = f.add('input', 0, 70);
  button.onClick = () => input.focus();
  f.key('Enter');
  assert.equal(f.document.activeElement, input);
  assert.equal(f.key('Enter').defaultPrevented, true);
  assert.equal(button.clicks, 3);
  f.key('Enter', {}, 'keyup');
  assert.equal(f.key('Enter').defaultPrevented, false);
  controller.destroy();
});

test('Native editing, IME, browser shortcuts and media controls remain native; Escape can leave editing', () => {
  const f = fixture();
  const button = f.add('button', 0, 0);
  let backs = 0;
  const controller = installRemoteNavigation(f.root, { onBack() { backs++; return true; } });
  for (const tag of ['input', 'textarea', 'select', 'iframe', 'video']) {
    const control = f.add(tag, 0, 80);
    control.tabIndex = 0;
    control.focus();
    for (const key of ['ArrowLeft', 'ArrowDown', 'Enter', 'Backspace']) assert.equal(f.key(key).defaultPrevented, false, `${tag} ${key}`);
    controller.refresh();
    assert.equal(f.document.activeElement, control);
  }
  const editable = f.add('div', 0, 80, { contenteditable: 'true' });
  editable.tabIndex = 0;
  editable.focus();
  assert.equal(f.key('Backspace').defaultPrevented, false);
  assert.equal(f.key('Escape').defaultPrevented, true);
  assert.equal(backs, 1);
  f.key('Escape', {}, 'keyup');
  button.focus();
  for (const values of [{ altKey: true }, { ctrlKey: true }, { metaKey: true }, { isComposing: true }, { keyCode: 229 }]) {
    assert.equal(f.key('Enter', values).defaultPrevented, false);
  }
  assert.equal(button.clicks, 0);
  controller.destroy();
});

test('Back is consumed only when handled and a held back key does not cascade through pages', () => {
  const f = fixture();
  f.add('button', 0, 0);
  let handled = false;
  let calls = 0;
  const controller = installRemoteNavigation(f.root, { onBack() { calls++; return handled; } });
  assert.equal(f.key('BrowserBack').defaultPrevented, false);
  handled = true;
  assert.equal(f.key('Backspace').defaultPrevented, true);
  assert.equal(f.key('Backspace').defaultPrevented, true);
  assert.equal(calls, 2);
  f.key('Backspace', {}, 'keyup');
  f.key('Escape');
  assert.equal(calls, 3);
  controller.destroy();
});

test('Busy controls regain focus after refresh unless the user deliberately moves elsewhere', () => {
  const f = fixture();
  const original = f.add('button', 100, 0, { 'aria-label': '원래 버튼' });
  const fallback = f.add('button', 0, 0);
  const other = f.add('button', 0, 80);
  const controller = installRemoteNavigation(f.root);
  original.disabled = true;
  f.document.activeElement = f.document.body;
  f.changed();
  assert.equal(f.document.activeElement, fallback);
  original.disabled = false;
  f.changed();
  assert.equal(f.document.activeElement, original);
  original.disabled = true;
  f.document.activeElement = f.document.body;
  controller.refresh();
  other.focus();
  original.disabled = false;
  controller.refresh();
  assert.equal(f.document.activeElement, other);
  original.focus();
  f.remove(original);
  controller.refresh();
  const replacement = f.add('button', 100, 0, { 'aria-label': '원래 버튼' });
  controller.refresh();
  assert.equal(f.document.activeElement, replacement);
  controller.destroy();
});

test('Standby and modal focus are untouched and cleanup removes listeners and pending work', () => {
  const f = fixture();
  const button = f.add('button', 0, 0);
  const controller = installRemoteNavigation(f.root);
  const modal = f.add('div', 0, 0, { role: 'dialog', 'aria-modal': 'true' }, f.document.body);
  const wake = f.add('button', 0, 0, {}, modal);
  wake.focus();
  f.root.inert = true;
  assert.equal(f.key('ArrowLeft').defaultPrevented, false);
  controller.refresh();
  assert.equal(f.document.activeElement, wake);
  f.root.inert = false;
  controller.refresh();
  assert.equal(f.document.activeElement, wake);
  f.remove(modal);
  controller.focusInitial();
  assert.equal(f.document.activeElement, button);
  for (const observer of f.observers) observer.callback([]);
  controller.destroy();
  f.tick();
  assert.equal(f.observers.size, 0);
  assert.equal(f.key('Enter').defaultPrevented, false);
  assert.equal(button.clicks, 0);
  assert.ok([...f.document.listeners.values(), ...f.root.listeners.values(), ...f.window.listeners.values()].every(set => set.size === 0));
});

test('Suspending the panel clears held keys even when a standby shield consumes their keyup', () => {
  const f = fixture();
  const button = f.add('button', 0, 0);
  let backs = 0;
  const controller = installRemoteNavigation(f.root, { onBack() { backs++; return true; } });
  f.key('Enter');
  f.key('Escape');
  assert.equal(button.clicks, 1);
  assert.equal(backs, 1);
  f.root.inert = true;
  f.changed();
  f.root.inert = false;
  controller.refresh();
  f.key('Enter');
  f.key('Escape');
  assert.equal(button.clicks, 2);
  assert.equal(backs, 2);
  controller.destroy();
});
