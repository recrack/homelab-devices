import http from 'node:http';
import { readFile, stat } from 'node:fs/promises';
import { resolve, join, extname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { randomBytes, createHash, timingSafeEqual } from 'node:crypto';
import { HomeAssistant } from './ha.mjs';
import { buildDashboard, selectedWeatherState, validateSceneRun } from './model.mjs';
import { PanelInsights } from './insights.mjs';
import { createNaverWeather } from './naver-weather.mjs';
import { WeeklyEnvironment } from './weekly.mjs';
import { WeeklyView } from './weekly-view.mjs';
import { PanelFeatures, runFavorite } from './features.mjs';
import { createPanelMaintenance } from './panel-maintenance.mjs';
import { loadSetup, sceneCatalog } from './config.mjs';
import { requestUrl, trustedApiRead, applySecurityHeaders, contentSecurityPolicy } from './security.mjs';

const panelRoot = fileURLToPath(new URL('..', import.meta.url));
const projectRoot = resolve(panelRoot, '..');
const random = () => randomBytes(32).toString('hex');
function equal(a, b) { if (typeof a !== 'string' || typeof b !== 'string') return false; const x = Buffer.from(a), y = Buffer.from(b); return x.length === y.length && timingSafeEqual(x, y); }
function json(res, code, value) { res.writeHead(code, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' }); res.end(JSON.stringify(value)); }
function redirect(res, location, headers = {}) { res.writeHead(303, { Location: location, 'Cache-Control': 'no-store', ...headers }); res.end(); }
async function body(req) {
  if (!/^application\/json(?:\s*;|$)/i.test(req.headers['content-type'] || '')) throw new Error('JSON 요청이 필요합니다.');
  let length = 0; const parts = [];
  for await (const part of req) { length += part.length; if (length > 8192) throw new Error('요청이 너무 큽니다.'); parts.push(part); }
  return JSON.parse(Buffer.concat(parts).toString());
}

export async function createPanelServer(config, { ha: injectedHa, runtime = join(projectRoot, 'runtime'), port = 4173, dist = join(panelRoot, 'dist'), sendReturn, weatherProvider } = {}) {
  const origin = `http://localhost:${port}`, csrf = random(), catalog = sceneCatalog(config), flows = new Map();
  const ha = injectedHa || new HomeAssistant({ url: config.homeAssistant.url, dataDir: join(runtime, 'panel'), clientId: origin + '/' });
  await ha.init();
  const features = new PanelFeatures({ path: join(runtime, 'panel/features.json'), catalog });
  await features.init();
  const insights = new PanelInsights({ ha }), weekly = new WeeklyView({ weekly: new WeeklyEnvironment({ ha }) });
  const weatherConfig = config.weather || { source: 'naver', location: '서울' };
  const naverWeather = weatherProvider !== undefined
    ? weatherProvider
    : weatherConfig.source === 'naver'
      ? createNaverWeather({ location: weatherConfig.location || '서울' })
      : null;
  const maintenance = createPanelMaintenance({ directory: join(runtime, 'panel-maintenance'), ...(sendReturn ? { sendReturn } : {}) });
  let last = null, reading = null, readAt = 0, busy = false;
  async function dashboard(force = false) {
    if (!force && last && Date.now() - readAt < 12000) return last;
    if (reading) return reading;
    reading = (async () => {
      const [data, naver] = await Promise.all([
        ha.websocket(['get_states', 'config/entity_registry/list', 'config/device_registry/list', 'config/area_registry/list', 'config_entries/get']),
        naverWeather ? naverWeather.read().catch(() => null) : Promise.resolve(null),
      ]);
      const states = data.get_states || [], registry = data['config/entity_registry/list'] || [];
      const view = buildDashboard(states, registry, data['config/device_registry/list'] || [], data['config/area_registry/list'] || [], data['config_entries/get'] || [], config);
      const weather = selectedWeatherState(states, new Map(registry.map(item => [item.entity_id, item])));
      const useNaver = Boolean(naver?.weather?.available);
      if (useNaver) view.weather = naver.weather;
      const extra = await insights.enrich(view, useNaver ? {} : { weatherEntityId: weather?.entity_id, weatherAttributes: weather?.attributes });
      view.forecast = useNaver ? naver.forecast : extra.forecast;
      for (const room of view.rooms) { room.histories = extra.histories[room.id] || { temperature: [], humidity: [], co2: [] }; }
      view.updatedAt = new Date().toISOString();
      await features.observe(view, { reliable: true });
      last = view; readAt = Date.now(); return view;
    })().finally(() => { reading = null; });
    return reading;
  }
  async function runScene(entityId) {
    if (!ha.connected) throw new Error('Home Assistant 연결이 필요합니다.');
    const view = await dashboard(true);
    validateSceneRun({ entityId }, view.scenes);
    await ha.request('/api/services/scene/turn_on', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ entity_id: entityId }) });
  }
  const server = http.createServer({ maxHeaderSize: 16384 }, async (req, res) => {
    applySecurityHeaders(res, { development: false });
    if (!new Set([`localhost:${port}`, `127.0.0.1:${port}`, `[::1]:${port}`]).has(req.headers.host)) return json(res, 403, { error: '허용되지 않은 호스트입니다.' });
    const url = requestUrl(req.url, origin);
    if (!url) return json(res, 400, { error: '잘못된 주소입니다.' });
    const path = url.pathname;
    if (path.startsWith('/api/') && ['GET', 'HEAD'].includes(req.method) && !trustedApiRead(req.headers, origin)) return json(res, 403, { error: '패널에서 직접 접속하세요.' });
    if (req.method === 'POST' && (req.headers.origin !== origin || !equal(req.headers['x-csrf-token'], csrf))) return json(res, 403, { error: '화면을 새로고침하세요.' });
    try {
      if (req.method === 'GET' && path === '/api/health') return json(res, 200, { ok: true, connected: ha.connected });
      if (req.method === 'GET' && path === '/api/panel-maintenance') return json(res, 200, await maintenance.snapshot());
      if (req.method === 'GET' && path === '/api/dashboard') {
        let error = null, available = false, view = last || { rooms: config.rooms.map(room => ({ id: room.id, name: room.name, temperature: null, humidity: null, co2: null })), devices: [], scenes: [], integrations: [] };
        if (ha.connected) try { view = await dashboard(); available = true; } catch { error = 'Home Assistant에 연결하지 못했습니다.'; }
        else error = '서버에서 Home Assistant 연결을 완료하세요.';
        if (!available) await features.observe(null, { reliable: false });
        return json(res, 200, { ...view, ...features.snapshot(available ? view : null), roomConfig: config.rooms, mode: available ? 'live' : 'unavailable', connected: ha.connected, serverReachable: available, error, csrfToken: csrf, weekly: available ? weekly.snapshot(view, { co2Threshold: features.settings().co2Threshold }) : null, maintenance: await maintenance.snapshot() });
      }
      if (req.method === 'GET' && path === '/auth/start') {
        if (req.headers.host !== `localhost:${port}`) return redirect(res, origin + '/auth/start');
        for (const [key, value] of flows) if (value.expires < Date.now()) flows.delete(key);
        if (flows.size >= 32) return json(res, 429, { error: '잠시 후 다시 연결하세요.' });
        const state = random(), verifier = random();
        flows.set(state, { verifier, expires: Date.now() + 600000 });
        const destination = new URL('/auth/authorize', ha.url);
        destination.search = new URLSearchParams({ client_id: origin + '/', redirect_uri: origin + '/auth/callback', state, code_challenge: createHash('sha256').update(verifier).digest('base64url'), code_challenge_method: 'S256' }).toString();
        return redirect(res, destination.href, { 'Set-Cookie': `panel_flow=${state}; HttpOnly; SameSite=Lax; Path=/; Max-Age=600` });
      }
      if (req.method === 'GET' && path === '/auth/callback') {
        const state = url.searchParams.get('state'), flow = flows.get(state);
        const cookie = String(req.headers.cookie || '').split(';').map(item => item.trim()).find(item => item.startsWith('panel_flow='))?.slice(11);
        if (!flow || flow.expires < Date.now() || !equal(cookie, state) || !url.searchParams.get('code')) return redirect(res, '/?auth=failed');
        flows.delete(state);
        try { await ha.exchange(url.searchParams.get('code'), flow.verifier); last = null; readAt = 0; return redirect(res, '/?auth=connected', { 'Set-Cookie': 'panel_flow=; HttpOnly; SameSite=Lax; Path=/; Max-Age=0' }); }
        catch { return redirect(res, '/?auth=failed'); }
      }
      if (req.method === 'POST' && ['/api/scenes/run', '/api/favorites/run', '/api/favorites/settings', '/api/alert-settings', '/api/notifications/dismiss', '/api/panel-maintenance/return-home'].includes(path)) {
        if (busy) return json(res, 409, { error: '실행 중입니다. 완료될 때까지 기다리세요.' });
        const input = await body(req); busy = true;
        try {
          if (path === '/api/scenes/run') { if (!input || Object.keys(input).join(',') !== 'entityId') throw new Error('장면을 다시 선택하세요.'); await runScene(input.entityId); }
          if (path === '/api/favorites/run') await runFavorite(input, { runScene, catalog });
          if (path === '/api/favorites/settings') await features.choose(input);
          if (path === '/api/alert-settings') await features.configure(input);
          if (path === '/api/notifications/dismiss') await features.dismiss(input);
          if (path === '/api/panel-maintenance/return-home') {
            if (!input || typeof input !== 'object' || Array.isArray(input) || Object.keys(input).length > 0) return json(res, 400, { error: '잘못된 복귀 요청입니다.' });
            await maintenance.requestReturnHome();
            return json(res, 200, { ok: true, message: '기가지니에 홈 패널 복귀 요청을 보냈습니다. 몇 초 안에 화면이 돌아오는지 확인하세요.' });
          }
          return json(res, 200, { ok: true, message: '요청을 처리했습니다. 실제 기기 상태를 확인하세요.' });
        } finally { busy = false; }
      }
      if (path.startsWith('/api/') || path.startsWith('/auth/')) return json(res, 404, { error: '지원하지 않는 경로입니다.' });
      if (!['GET', 'HEAD'].includes(req.method)) return json(res, 405, { error: '지원하지 않는 요청입니다.' });
      let file = resolve(dist, '.' + decodeURIComponent(path));
      if (file !== dist && !file.startsWith(dist + '/')) return json(res, 403, { error: '지원하지 않는 경로입니다.' });
      try { if (!(await stat(file)).isFile()) file = join(dist, 'index.html'); } catch { file = join(dist, 'index.html'); }
      const raw = await readFile(file), types = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8', '.svg': 'image/svg+xml' };
      if (extname(file) === '.html') res.setHeader('Content-Security-Policy', contentSecurityPolicy(raw.toString()));
      res.writeHead(200, { 'Content-Type': types[extname(file)] || 'application/octet-stream', 'Cache-Control': 'no-cache' });
      res.end(req.method === 'HEAD' ? undefined : raw);
    } catch { if (!res.headersSent) json(res, 502, { error: '요청 결과를 확인하지 못했습니다. 연결과 장면 설정을 확인하세요.' }); else res.end(); }
  });
  server.requestTimeout = 20000; server.headersTimeout = 10000; server.maxConnections = 64;
  return { server, stop() { server.close(); server.closeAllConnections(); } };
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const config = await loadSetup(join(projectRoot, 'runtime/setup.json'));
  const app = await createPanelServer(config);
  app.server.listen(4173, '127.0.0.1', () => console.log('Home Panel: http://localhost:4173'));
  for (const signal of ['SIGINT', 'SIGTERM']) process.on(signal, () => app.stop());
}
