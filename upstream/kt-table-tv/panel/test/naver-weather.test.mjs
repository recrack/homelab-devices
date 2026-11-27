import test from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import { once } from 'node:events';
import { mkdtemp, mkdir, rm } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { resolve, join } from 'node:path';
import { validateSetup } from '../server/config.mjs';
import { createNaverWeather, parseNaverWeatherHtml, naverWeatherUrl, conditionFromKoreanText } from '../server/naver-weather.mjs';
import { createPanelServer } from '../server/index.mjs';
import { buildDashboard } from '../server/model.mjs';

const SAMPLE_HTML = `
<html><body>
<div class="weather_graphic">
  <div class="weather_main"><i class="wt_icon ico_wt1"><span class="blind">맑음</span></i></div>
  <div class="temperature_text"><strong><span class="blind">현재 온도</span>5.6<span class="celsius">°</span></strong></div>
</div>
<div class="graph_inner _hourly_weather">
  <ul>
    <li class="_li _day" data-day="today">
      <dl class="graph_content">
        <dt class="time"><em>15시</em></dt>
        <dd class="weather_box"><i class="wt_icon ico_wt1"><span class="blind">맑음</span></i></dd>
        <dd class="degree_point"><span class="num">5<span class="celsius">°</span></span></dd>
      </dl>
    </li>
    <li class="_li">
      <dl class="graph_content">
        <dt class="time"><em>22시</em></dt>
        <dd class="weather_box"><i class="wt_icon ico_wt2"><span class="blind">맑음</span></i></dd>
        <dd class="degree_point"><span class="num">-1<span class="celsius">°</span></span></dd>
      </dl>
    </li>
    <li class="tomorrow _li _day" data-day="tomorrow">
      <dl class="graph_content">
        <dt class="time"><em>내일</em></dt>
        <dd class="weather_box"><i class="wt_icon ico_wt7"><span class="blind">구름많음</span></i></dd>
        <dd class="degree_point"><span class="num">-2<span class="celsius">°</span></span></dd>
      </dl>
    </li>
    <li class="_li">
      <dl class="graph_content">
        <dt class="time"><em>03시</em></dt>
        <dd class="weather_box"><i class="wt_icon ico_wt9"><span class="blind">비</span></i></dd>
        <dd class="degree_point"><span class="num">0<span class="celsius">°</span></span></dd>
      </dl>
    </li>
  </ul>
</div>
</body></html>`;

const baseConfig = () => ({
  schema: 1,
  server: { address: '10.77.0.10', port: 4173, legacyPort: 4181 },
  device: { address: '10.77.0.20' },
  homeAssistant: { url: 'http://ha.example.test:8123' },
  rooms: [
    { id: 'living', name: '거실', scenes: { on: null, off: null } },
    { id: 'bedroom', name: '안방', scenes: { on: null, off: null } },
  ],
});

test('Default setup configures Seoul Naver weather while allowing custom regions and HA mode', () => {
  const defaulted = validateSetup(baseConfig());
  assert.deepEqual(defaulted.weather, { source: 'naver', location: '서울' });

  const custom = validateSetup({ ...baseConfig(), weather: { source: 'naver', location: '부산 해운대구' } });
  assert.deepEqual(custom.weather, { source: 'naver', location: '부산 해운대구' });

  const haMode = validateSetup({ ...baseConfig(), weather: { source: 'ha' } });
  assert.deepEqual(haMode.weather, { source: 'ha', location: null });

  assert.throws(() => validateSetup({ ...baseConfig(), weather: { source: 'invalid' } }));
  assert.throws(() => validateSetup({ ...baseConfig(), weather: { source: 'naver', location: '<script>' } }));
  assert.throws(() => validateSetup({ ...baseConfig(), weather: { source: 'naver', location: '   ' } }));
});

test('Naver weather HTML parser extracts Seoul current weather and KST hourly forecasts across midnight', () => {
  // 2026-11-22 14:30 KST = 2026-11-22T05:30:00Z
  const nowMs = Date.parse('2026-11-22T05:30:00Z');
  const parsed = parseNaverWeatherHtml(SAMPLE_HTML, { location: '서울', now: nowMs });
  assert.equal(parsed.weather.available, true);
  assert.equal(parsed.weather.name, '서울');
  assert.equal(parsed.weather.source, '네이버 날씨');
  assert.equal(parsed.weather.conditionCode, 'sunny');
  assert.equal(parsed.weather.condition, '맑음');
  assert.equal(parsed.weather.temperatureC, 5.6);

  assert.equal(parsed.hourly.length, 4);
  assert.equal(parsed.hourly[0].time, '2026-11-22T06:00:00.000Z'); // 15:00 KST
  assert.equal(parsed.hourly[0].temperatureC, 5);
  assert.equal(parsed.hourly[1].time, '2026-11-22T13:00:00.000Z'); // 22:00 KST
  assert.equal(parsed.hourly[1].conditionCode, 'clear-night');
  assert.equal(parsed.hourly[1].temperatureC, -1);
  assert.equal(parsed.hourly[2].time, '2026-11-22T15:00:00.000Z'); // next day 00:00 KST
  assert.equal(parsed.hourly[2].conditionCode, 'partlycloudy');
  assert.equal(parsed.hourly[2].temperatureC, -2);
  assert.equal(parsed.hourly[3].time, '2026-11-22T18:00:00.000Z'); // next day 03:00 KST
  assert.equal(parsed.hourly[3].conditionCode, 'rainy');
  assert.equal(parsed.hourly[3].temperatureC, 0);

  assert.equal(conditionFromKoreanText('눈/비'), 'snowy-rainy');
  assert.equal(conditionFromKoreanText('맑음', true), 'clear-night');
  assert.equal(parseNaverWeatherHtml('<html>empty</html>', { location: '서울', now: nowMs }), null);
  assert.equal(naverWeatherUrl('서울'), 'https://m.search.naver.com/search.naver?where=m&sm=top_hty&fbm=1&ie=utf8&query=%EC%84%9C%EC%9A%B8+%EB%82%A0%EC%94%A8');
});

test('Naver weather provider caches reads and serves Seoul weather in panel server with HA fallback', async t => {
  let fetchCount = 0;
  let shouldFail = false;
  let clock = Date.parse('2026-11-22T05:30:00Z');
  const provider = createNaverWeather({
    location: '서울',
    now: () => clock,
    cacheMs: 60000,
    fetchImpl: async url => {
      fetchCount++;
      assert.match(url, /^https:\/\/m\.search\.naver\.com\/search\.naver\?/);
      if (shouldFail) throw new Error('network down');
      return new Response(SAMPLE_HTML, { status: 200 });
    },
  });

  const first = await provider.read();
  const second = await provider.read();
  assert.equal(fetchCount, 1);
  assert.equal(first.weather.name, '서울');
  assert.equal(first.weather.source, '네이버 날씨');
  assert.equal(first.forecast.available, true);
  assert.equal(first.forecast.items.length, 4);
  assert.deepEqual(second.weather, first.weather);

  // Verify panel server uses Naver Seoul weather when available, and falls back to HA weather when Naver fails.
  const dir = await mkdtemp(resolve(fileURLToPath(new URL('..', import.meta.url)), '.test-naver-'));
  t.after(() => rm(dir, { recursive: true, force: true }));
  const runtime = join(dir, 'runtime');
  const nowIso = new Date().toISOString();
  const ha = {
    url: baseConfig().homeAssistant.url,
    connected: true,
    async init() { await mkdir(join(runtime, 'panel'), { recursive: true, mode: 0o700 }); },
    async websocket() {
      return {
        get_states: [{ entity_id: 'weather.ha_fallback', state: 'cloudy', attributes: { friendly_name: 'HA 날씨', temperature: 3.1, temperature_unit: '°C' }, last_updated: nowIso }],
        'config/entity_registry/list': [{ entity_id: 'weather.ha_fallback', platform: 'open_meteo' }],
        'config/device_registry/list': [],
        'config/area_registry/list': [],
        'config_entries/get': [],
      };
    },
    async json() { return []; },
  };
  const reserve = http.createServer(); reserve.listen(0, '127.0.0.1'); await once(reserve, 'listening');
  const port = reserve.address().port; await new Promise(done => reserve.close(done));
  const app = await createPanelServer(validateSetup(baseConfig()), { ha, runtime, port, weatherProvider: provider });
  app.server.listen(port, '127.0.0.1'); await once(app.server, 'listening');
  t.after(() => app.stop());

  const liveRes = await (await fetch(`http://localhost:${port}/api/dashboard`)).json();
  assert.equal(liveRes.weather.name, '서울');
  assert.equal(liveRes.weather.source, '네이버 날씨');
  assert.equal(liveRes.weather.temperatureC, 5.6);
  assert.equal(liveRes.forecast.source, '네이버 날씨');
  assert.equal(liveRes.forecast.items.length, 4);

  // Expire cache and simulate Naver outage -> clean fallback to HA weather
  clock += 120000;
  shouldFail = true;
  const fallbackProvider = createNaverWeather({
    location: '서울',
    now: () => clock,
    fetchImpl: async () => { throw new Error('offline'); },
  });
  const reserve2 = http.createServer(); reserve2.listen(0, '127.0.0.1'); await once(reserve2, 'listening');
  const port2 = reserve2.address().port; await new Promise(done => reserve2.close(done));
  const app2 = await createPanelServer(validateSetup(baseConfig()), { ha, runtime, port: port2, weatherProvider: fallbackProvider });
  app2.server.listen(port2, '127.0.0.1'); await once(app2.server, 'listening');
  t.after(() => app2.stop());

  const fallbackRes = await (await fetch(`http://localhost:${port2}/api/dashboard`)).json();
  assert.equal(fallbackRes.weather.name, 'HA 날씨');
  assert.equal(fallbackRes.weather.source, 'Open-Meteo');
});

test('Model prioritizes Korean HA weather platforms and excludes outdoor weather sensors from indoor devices', () => {
  const nowIso = new Date().toISOString();
  const states = [
    { entity_id: 'weather.a_open', state: 'sunny', attributes: { friendly_name: '서울', temperature: 4.1, temperature_unit: '°C' }, last_updated: nowIso },
    { entity_id: 'weather.z_fusion', state: 'partlycloudy', attributes: { friendly_name: '서울 날씨', temperature: 3.5, temperature_unit: '°C' }, last_updated: nowIso },
    { entity_id: 'sensor.seoul_outdoor_temp', state: '3.5', attributes: { device_class: 'temperature', unit_of_measurement: '°C', friendly_name: '서울 기온' }, last_updated: nowIso },
  ];
  const registry = [
    { entity_id: 'weather.a_open', platform: 'open_meteo' },
    { entity_id: 'weather.z_fusion', platform: 'weather_fusion' },
    { entity_id: 'sensor.seoul_outdoor_temp', platform: 'weather_fusion' },
  ];
  const view = buildDashboard(states, registry, [], [], [], validateSetup(baseConfig()));
  assert.equal(view.weather.source, '네이버·기상청');
  assert.equal(view.weather.name, '서울');
  assert.equal(view.weather.temperatureC, 3.5);
  assert.deepEqual(view.devices, []);
});
