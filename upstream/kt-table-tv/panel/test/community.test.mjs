import test from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import { once } from 'node:events';
import { Readable } from 'node:stream';
import { mkdtemp, mkdir, readFile, rm, stat, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { resolve, join } from 'node:path';
import { initialize } from '../../scripts/setup.mjs';
import { validateSetup, sceneCatalog, readPrivateJson } from '../server/config.mjs';
import { createPanelServer } from '../server/index.mjs';
import { buildDashboard } from '../server/model.mjs';
import { createLegacyServer, projectState, legacyPageAssets } from '../server/legacy.mjs';
import { createPanelSnapshotCache } from '../src/offline-snapshot.mjs';

const base = () => ({ schema: 1, server: { address: '10.77.0.10', port: 4173, legacyPort: 4181 }, device: { address: '10.77.0.20' }, homeAssistant: { url: 'http://ha.example.test:8123' }, rooms: [{ id: 'living', name: '작업실', scenes: { on: 'scene.example_work_on', off: 'scene.example_work_off' } }, { id: 'bedroom', name: '아이방', scenes: { on: null, off: null } }] });
async function temporary(t) { const path = await mkdtemp(resolve(fileURLToPath(new URL('..', import.meta.url)), '.test-')); t.after(() => rm(path, { recursive: true, force: true })); return path; }
const current = () => new Date().toISOString();
function inventory() {
  const sensor = (entity_id, value, kind, unit) => ({ entity_id, state: String(value), attributes: { device_class: kind, unit_of_measurement: unit }, last_updated: current(), last_reported: current() });
  return {
    get_states: [sensor('sensor.example_temperature', 20.7, 'temperature', '°C'), sensor('sensor.example_humidity', 43, 'humidity', '%'), sensor('sensor.example_co2', 822, 'carbon_dioxide', 'ppm'), sensor('sensor.example_child_temp', 21.4, 'temperature', '°C'), { entity_id: 'scene.example_work_on', state: current(), attributes: { friendly_name: '작업실 켜기' } }, { entity_id: 'scene.unconfigured', state: current(), attributes: {} }, { entity_id: 'weather.example', state: 'sunny', attributes: { friendly_name: '내 HA 날씨', temperature: 8, temperature_unit: '°C' }, last_updated: current() }],
    'config/entity_registry/list': [{ entity_id: 'sensor.example_temperature', area_id: 'work', platform: 'example_sensor' }, { entity_id: 'sensor.example_humidity', device_id: 'example_device', platform: 'example_sensor' }, { entity_id: 'sensor.example_co2', area_id: 'work', platform: 'example_sensor' }, { entity_id: 'sensor.example_child_temp', area_id: 'child', platform: 'example_sensor' }, { entity_id: 'scene.example_work_on', platform: 'homeassistant' }],
    'config/device_registry/list': [{ id: 'example_device', area_id: 'work' }],
    'config/area_registry/list': [{ area_id: 'work', name: '작업실' }, { area_id: 'child', name: '아이방' }], 'config_entries/get': [],
  };
}
test('Setup creates new private credentials, preserves them on rerun, and accepts optional scenes', async t => {
  const root = await temporary(t), config = base();
  await initialize(root, config);
  const devicePath = join(root, 'runtime/legacy/device.json'), authPath = join(root, 'runtime/legacy/auth.json');
  const device = await readPrivateJson(devicePath), auth = await readPrivateJson(authPath);
  assert.match(device.token, /^[0-9a-f]{64}$/); assert.notEqual(device.token, auth.session); assert.notEqual(auth.session, auth.csrf);
  for (const path of [devicePath, authPath, join(root, 'runtime/setup.json')]) assert.equal((await stat(path)).mode & 0o777, 0o600);
  assert.equal((await stat(join(root, 'runtime'))).mode & 0o777, 0o700);
  await initialize(root, config);
  assert.deepEqual(await readPrivateJson(devicePath), device); assert.deepEqual(await readPrivateJson(authPath), auth);
  config.server.address = '10.77.0.11'; config.rooms[0].name = '서재';
  assert.equal((await initialize(root, config)).changedAddress, true);
  assert.equal((await readPrivateJson(devicePath)).token, device.token);
  assert.equal((await readPrivateJson(authPath)).csrf, auth.csrf);
  const second = await temporary(t); await initialize(second, config);
  assert.notEqual((await readPrivateJson(join(second, 'runtime/legacy/device.json'))).token, device.token);
  assert.equal(sceneCatalog(config).length, 2);
});
test('Setup rejects public or duplicate peers, arbitrary ports, credentials in URL, invalid room and scene identifiers', () => {
  for (const change of [x => { x.server.address = '8.8.8.8'; }, x => { x.device.address = x.server.address; }, x => { x.server.port = 80; }, x => { x.server.legacyPort = 80; }, x => { x.homeAssistant.url = 'http://user:secret@ha.example.test'; }, x => { x.rooms[1].name = x.rooms[0].name; }, x => { x.rooms[0].scenes.on = 'light.example'; }, x => { x.rooms[0].scenes.off = x.rooms[0].scenes.on; }]) {
    const config = base(); change(config); assert.throws(() => validateSetup(config));
  }
});
test('Arbitrary HA area names, device areas and sensor providers map to stable room slots, with no implicit scene permission', () => {
  const data = inventory(), config = base();
  const view = buildDashboard(data.get_states, data['config/entity_registry/list'], data['config/device_registry/list'], data['config/area_registry/list'], [], config);
  assert.deepEqual(view.rooms.map(room => [room.id, room.name]), [['living', '작업실'], ['bedroom', '아이방']]);
  assert.equal(view.rooms[0].temperature, 20.7); assert.equal(view.rooms[0].humidity, 43); assert.equal(view.rooms[0].co2, 822);
  assert.equal(view.rooms[1].temperature, 21.4);
  assert.deepEqual(view.scenes.map(scene => scene.entityId), ['scene.example_work_on']);
  assert.equal(view.weather.name, '내 HA 날씨');
  const legacy = projectState({ ...view, mode: 'live', connected: true, serverReachable: true }, config);
  assert.equal(legacy.rooms[0].id, 'living'); assert.equal(legacy.rooms[0].name, '작업실'); assert.equal(legacy.roomConfig[1].scenes.on, null);
});
test('Offline snapshot preserves custom names and numeric readings but never credentials or scene mappings', () => {
  let stored = null;
  const cache = createPanelSnapshotCache({ storage: { getItem: () => stored, setItem: (_, value) => { stored = value; } } });
  cache.save({ mode: 'live', connected: true, serverReachable: true, updatedAt: current(), csrfToken: 'private-token', roomConfig: base().rooms, rooms: [{ id: 'living', name: '작업실', temperature: 22, humidity: 45, hasCo2: true, co2: 900, scene: 'private-scene' }] });
  assert.equal(cache.load().rooms[0].name, '작업실'); assert.equal(cache.load().rooms[0].id, 'living');
  assert.doesNotMatch(stored, /private|csrf|scene|entity/);
});

async function backend(t, extraOptions = {}) {
  const directory = await temporary(t), runtime = join(directory, 'runtime'), calls = [], data = inventory();
  let broken = false;
  const ha = { url: base().homeAssistant.url, connected: false, async init() { await mkdir(join(runtime, 'panel'), { recursive: true, mode: 0o700 }); }, async exchange(code, verifier) { calls.push({ exchange: code, verifier }); this.connected = true; }, async websocket() { if (broken) throw new Error('fixture failure'); return data; }, async json() { return []; }, async request(path, init) { calls.push({ path, init }); return Response.json({}); } };
  const reserve = http.createServer(); reserve.listen(0, '127.0.0.1'); await once(reserve, 'listening'); const port = reserve.address().port; await new Promise(done => reserve.close(done));
  const app = await createPanelServer(base(), { ha, runtime, port, weatherProvider: null, ...extraOptions }); app.server.listen(port, '127.0.0.1'); await once(app.server, 'listening'); t.after(() => app.stop());
  const origin = `http://localhost:${port}`;
  return { origin, runtime, ha, calls, offline() { broken = true; }, get: path => fetch(origin + path), post: (path, body, csrf) => fetch(origin + path, { method: 'POST', headers: { Origin: origin, 'Content-Type': 'application/json', 'X-CSRF-Token': csrf }, body: JSON.stringify(body) }) };
}
test('Mocked onboarding performs local OAuth with state and PKCE then permits only configured HA scenes', async t => {
  const f = await backend(t);
  assert.equal((await (await f.get('/api/dashboard')).json()).connected, false);
  const started = await fetch(f.origin + '/auth/start', { redirect: 'manual' });
  const target = new URL(started.headers.get('location')), cookie = started.headers.get('set-cookie').split(';')[0];
  assert.equal(target.origin, base().homeAssistant.url); assert.equal(target.searchParams.get('code_challenge_method'), 'S256'); assert.ok(target.searchParams.get('code_challenge'));
  const callback = `${f.origin}/auth/callback?code=fixture-only&state=${target.searchParams.get('state')}`;
  assert.match((await fetch(callback, { redirect: 'manual' })).headers.get('location'), /auth=failed/);
  assert.equal(f.ha.connected, false);
  const connected = await fetch(callback, { redirect: 'manual', headers: { Cookie: cookie } });
  assert.match(connected.headers.get('location'), /auth=connected/); assert.equal(f.calls.filter(call => call.exchange).length, 1);
  const view = await (await f.get('/api/dashboard')).json(); assert.equal(view.mode, 'live'); assert.equal(view.rooms[0].temperature, 20.7);
  assert.equal((await f.post('/api/scenes/run', { entityId: 'scene.unconfigured' }, view.csrfToken)).status, 502);
  assert.equal((await f.post('/api/scenes/run', { entityId: 'scene.example_work_on' }, view.csrfToken)).status, 200);
  assert.equal(f.calls.filter(call => call.path).length, 1); assert.equal(JSON.parse(f.calls.find(call => call.path).init.body).entity_id, 'scene.example_work_on');
  assert.equal((await f.post('/api/scenes/run', { entityId: 'scene.example_work_on' }, 'wrong')).status, 403);
  assert.equal((await fetch(f.origin + '/api/dashboard', { headers: { Origin: 'https://foreign.example.test' } })).status, 403);
  for (const path of ['/api/kt/status', '/api/phone/status', '/api/tv/netflix']) assert.equal((await f.get(path)).status, 404);
  assert.equal((await fetch(callback, { redirect: 'manual', headers: { Cookie: cookie } })).headers.get('location'), '/?auth=failed');
});

async function simulatedRequest(server, { address, host, path = '/', method = 'GET', headers = {}, body = '' }) {
  return new Promise(resolve => {
    const req = Readable.from(body ? [Buffer.from(body)] : []); Object.assign(req, { method, url: path, headers: { host, ...headers }, socket: { remoteAddress: address } });
    const response = { status: 200, headers: {}, setHeader(key, value) { this.headers[key.toLowerCase()] = value; }, writeHead(status, headers = {}) { this.status = status; for (const [key, value] of Object.entries(headers)) this.setHeader(key, value); }, end(text = '') { resolve({ status: this.status, headers: this.headers, text: String(text) }); } };
    server.emit('request', req, response);
  });
}
test('Legacy uses configured LAN peers, fresh device session, protected assets and CSRF without forwarding an unapproved action', async t => {
  const config = base(), host = config.server.address, device = config.device.address, origin = `http://${host}:4181`, token = 'a'.repeat(64), calls = [];
  const html = await readFile(new URL('../legacy/index.html', import.meta.url), 'utf8');
  const app = createLegacyServer({ host, device, config, html, deviceToken: token, upstream: async (url, init) => { calls.push({ url, init }); return Response.json({ mode: 'live', connected: true, serverReachable: true, rooms: [], scenes: [], csrfToken: 'upstream-only' }); } });
  t.after(() => app.stop());
  const request = value => simulatedRequest(app.server, { address: device, host: `${host}:4181`, ...value });
  assert.equal((await request({ address: '10.77.0.99' })).status, 403);
  assert.equal((await request({ host: 'foreign.example.test' })).status, 403);
  assert.equal((await request({ path: '/panel.js' })).status, 401);
  const session = await request({ method: 'POST', path: '/api/device/session', headers: { authorization: 'Bearer ' + token, 'content-type': 'application/json' }, body: '{}' });
  assert.equal(session.status, 200); const cookie = session.headers['set-cookie'].split(';')[0];
  const state = await request({ path: '/api/state', headers: { cookie } }); assert.equal(state.status, 200);
  const data = JSON.parse(state.text); assert.notEqual(data.csrfToken, 'upstream-only'); assert.equal(data.roomConfig[0].name, '작업실');
  const rejected = await request({ method: 'POST', path: '/api/scenes/run', headers: { cookie, origin, 'content-type': 'application/json', 'x-csrf-token': data.csrfToken }, body: JSON.stringify({ entityId: 'scene.unconfigured' }) });
  assert.equal(rejected.status, 400); assert.equal(calls.filter(call => call.init?.method === 'POST').length, 0);
  assert.equal((await request({ method: 'POST', path: '/api/scenes/run', headers: { cookie, origin, 'content-type': 'application/json', 'x-csrf-token': 'invalid' }, body: '{}' })).status, 403);
  assert.doesNotMatch(legacyPageAssets(html).script, /entityId:\s*'scene\./);
});

test('Web panel remote return-home enforces CSRF, strict JSON, private maintenance config and works even when HA is offline', async t => {
  const sent = [];
  const f = await backend(t, { sendReturn: async target => { sent.push(target); return { ok: true, id: 'a'.repeat(32) }; } });
  const initial = await (await f.get('/api/dashboard')).json();
  assert.equal(initial.connected, false);

  // Missing maintenance config fails closed
  assert.equal((await f.post('/api/panel-maintenance/return-home', {}, initial.csrfToken)).status, 502);
  assert.equal(sent.length, 0);

  // Create valid private runtime/panel-maintenance/config.json
  const maintDir = join(f.runtime, 'panel-maintenance');
  await mkdir(maintDir, { recursive: true, mode: 0o700 });
  await writeFile(join(maintDir, 'config.json'), JSON.stringify({ version: 1, host: '10.77.0.10', device: '10.77.0.20', port: 4186, token: 'b'.repeat(64) }), { mode: 0o600 });

  // Invalid CSRF rejected
  assert.equal((await f.post('/api/panel-maintenance/return-home', {}, 'wrong')).status, 403);
  // Extra payload rejected
  assert.equal((await f.post('/api/panel-maintenance/return-home', { extra: 1 }, initial.csrfToken)).status, 400);
  assert.equal(sent.length, 0);

  // Valid request succeeds even while HA is disconnected
  const response = await f.post('/api/panel-maintenance/return-home', {}, initial.csrfToken);
  assert.equal(response.status, 200);
  const body = await response.json();
  assert.equal(body.ok, true);
  assert.deepEqual(sent, [{ host: '10.77.0.10', port: 4186 }]);
});
