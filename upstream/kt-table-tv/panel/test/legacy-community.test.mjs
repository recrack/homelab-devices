import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { runInNewContext } from 'node:vm';
import { legacyAlertScript, legacySnapshotScript } from '../server/legacy.mjs';
const html = await readFile(new URL('../legacy/index.html', import.meta.url), 'utf8');
const script = legacyAlertScript(await readFile(new URL('../src/washer-alerts.mjs', import.meta.url), 'utf8')) + '\n' + legacySnapshotScript(await readFile(new URL('../src/offline-snapshot.mjs', import.meta.url), 'utf8')) + '\n' + html.match(/<script>([\s\S]*?)<\/script>/)[1];
const state = overrides => ({ mode: 'live', connected: true, serverReachable: true, error: null, csrfToken: 'fixture-only', updatedAt: new Date().toISOString(),
  roomConfig: [{ id: 'living', name: '작업실', scenes: { on: 'scene.example_work_on', off: 'scene.example_work_off' } }, { id: 'bedroom', name: '아이방', scenes: { on: null, off: null } }],
  rooms: [{ id: 'living', name: '작업실', temperature: 22, humidity: 40 }, { id: 'bedroom', name: '아이방', temperature: 21, humidity: 45 }],
  scenes: [{ entityId: 'scene.example_work_on', available: true }, { entityId: 'scene.example_work_off', available: true }], ...overrides });
function fixture({ storage, now, userAgent = '', includeFeatures = false, includeForecast = false, prefersDark = false } = {}) {
  const navigations = [];
  const listeners = {}, windowListeners = {}, requests = [], pending = [], intervals = [], dynamicNodes = [];
  const positions = { 'completion-confirm': [1060, 40, 116, 52], refresh: [1088, 76, 120, 48],
    'living-on': [60, 400, 250, 64], 'living-off': [330, 400, 250, 64],
    'bedroom-on': [680, 440, 250, 64], 'bedroom-off': [950, 440, 250, 64] };
  if (includeForecast) {
    positions['forecast-section'] = [36, 250, 1208, 200];
    for (const id of ['living-on', 'living-off', 'bedroom-on', 'bedroom-off']) positions[id][1] += 160;
  }
  const tags = new Map([...html.matchAll(/<([A-Za-z]+)\b[^>]*\bid="([^"]+)"/g)].map(([, tag, id]) => [id, tag.toUpperCase()]));
  const classes = new Map([...html.matchAll(/<[^>]*\bid="([^"]+)"[^>]*>/g)].map(([markup, id]) => [id, markup.match(/\bclass="([^"]*)"/)?.[1] || '']));
  const body = { tagName: 'BODY' };
  const document = { activeElement: body, documentElement: { attributes: {}, setAttribute(name, value) { this.attributes[name] = value; } },
    addEventListener(type, handler) { listeners[type] = handler; } };
  const nodes = new Map([...html.matchAll(/\bid="([^"]+)"/g)].map(([, id]) => [id, {
    id, tagName: tags.get(id) || 'DIV', textContent: '', className: classes.get(id), style: {}, attributes: {}, handlers: {}, disabled: false, children: [],
    appendChild(child) { this.children.push(child); child.parentNode = this; child.offsetWidth = 1148; child.offsetHeight = 190; },
    removeChild(child) { this.children.splice(this.children.indexOf(child), 1); child.parentNode = null; child.offsetWidth = 0; child.offsetHeight = 0; },
    setAttribute(name, value) { this.attributes[name] = value; },
    addEventListener(type, handler) { this.handlers[type] = handler; },
    focus() { if (!this.disabled) document.activeElement = this; },
    scrollIntoView(value) { this.scrolled = value; },
    click() { if (!this.disabled) this.handlers.click?.(); },
    getBoundingClientRect() { const [left, top, width, height] = positions[id] || [60, 280, 180, 52]; return { left, top, right: left + width, bottom: top + height }; },
  }]));
  document.createElement = tag => {
    const node = { tagName: tag.toUpperCase(), id: '', className: '', textContent: '', style: {}, attributes: {}, children: [],
      offsetWidth: 0, offsetHeight: 0,
      setAttribute(name, value) { this.attributes[name] = value; },
      appendChild(child) { this.children.push(child); child.parentNode = this; },
      focus() { document.activeElement = this; }, scrollIntoView(value) { this.scrolled = value; },
      getBoundingClientRect() { const top = 600 + Number(this.id.split('-')[1] || 0) * 210; return { left: 60, right: 1208, top, bottom: top + 190 }; },
    };
    dynamicNodes.push(node); return node;
  };
  document.getElementById = id => nodes.get(id) || dynamicNodes.find(node => node.id === id);
  document.querySelectorAll = selector => { assert.equal(selector, '.focusable'); return [...Object.keys(positions).map(id => nodes.get(id)), ...(includeFeatures ? [...nodes.values()].filter(node => node.tagName === 'BUTTON' && !positions[node.id] && node.style.display !== 'none') : []), ...nodes.get('washers').children]; };
  class Request {
    open(method, path) { this.method = method; this.path = path; this.headers = {}; }
    setRequestHeader(name, value) { this.headers[name] = value; }
    send(body) { this.body = body; requests.push(this); pending.push(this); }
    respond(data, status = 200) { this.status = status; this.readyState = 4; this.responseText = JSON.stringify(data); this.onreadystatechange(); }
  }
  const FixtureDate = now ? class extends Date { constructor(...args) { super(...(args.length ? args : [now()])); } static now() { return now(); } } : Date;
  const window = { localStorage: storage, matchMedia: () => ({ matches: prefersDark }), navigator: { userAgent }, location: { replace: path => navigations.push(path) }, addEventListener: (type, handler) => { windowListeners[type] = handler; } };
  runInNewContext(script, { Date: FixtureDate, document, window,
    XMLHttpRequest: Request, setInterval(fn, ms) { intervals.push({ fn, ms }); } });
  function event(type, code, extra = {}) {
    const value = { keyCode: code, prevented: false, preventDefault() { this.prevented = true; }, ...extra };
    listeners[type](value); return value;
  }
  function respond(method = 'GET', data = state(), status = 200) {
    const index = pending.findIndex(item => item.method === method);
    assert.notEqual(index, -1, 'expected pending ' + method);
    pending.splice(index, 1)[0].respond(data, status);
  }
  return { nodes, document, window, requests, respond, event, intervals, windowListeners, navigations,
    down: (code, extra) => event('keydown', code, extra), up: code => event('keyup', code),
    focus: id => nodes.get(id).focus(), active: () => document.activeElement.id,
    posts: () => requests.filter(request => request.method === 'POST') };
}

test('Legacy browser maps custom room slots and configured scene IDs; missing scenes stay disabled', () => {
  const f = fixture(); f.respond();
  assert.equal(f.nodes.get('living-name').textContent, '작업실');
  assert.equal(f.nodes.get('bedroom-name').textContent, '아이방');
  assert.equal(f.nodes.get('living-temperature').textContent, '22.0');
  assert.equal(f.nodes.get('bedroom-on').disabled, true);
  f.focus('living-on'); f.down(13); f.down(13); f.up(13);
  assert.equal(f.posts().length, 1);
  assert.deepEqual(JSON.parse(f.posts()[0].body), { entityId: 'scene.example_work_on' });
});
test('Legacy caches custom labels but blocks actions after connection failure, and consumes the standby wake press', () => {
  const values = new Map();
  const storage = { getItem: key => values.get(key) || null, setItem: (key, value) => values.set(key, value) };
  const f = fixture({ storage }); f.respond(); f.focus('living-on');
  assert.equal(f.window.requestHomePanelStandby(), true);
  f.down(13); f.down(13); f.up(13);
  assert.equal(f.posts().length, 0);
  f.intervals.find(timer => timer.ms === 20000).fn(); f.respond('GET', { error: 'fixture outage' }, 502);
  assert.equal(f.nodes.get('living-name').textContent, '작업실');
  assert.equal(f.nodes.get('living-temperature').textContent, '22.0');
  assert.equal(f.nodes.get('living-on').disabled, true);
  assert.equal(f.posts().length, 0);
  assert.doesNotMatch(values.get('home-panel-snapshot-v1'), /csrf|scene|fixture-only/);
});
